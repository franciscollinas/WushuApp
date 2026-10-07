import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { supabase } from "@/lib/supabase";
import { getEscuelaId } from "@/lib/tenant";
import { supabaseAdmin, urlApp } from "@/lib/supabase-admin";
import { staffProcedure, adminProcedure, router } from "../trpc";
import type { AlumnoRow } from "@/types/supabase";

const alumnoInput = z.object({
  nombre: z.string().min(1),
  fecha_nacimiento: z.string().nullable().optional(),
  categoria: z.enum(["infantil", "juvenil", "adulto"]),
  nivel_cinta: z.string().default(""),
  fecha_ingreso: z.string().nullable().optional(),
  estado: z.enum(["prospecto", "activo", "inactivo"]).default("activo"),
  grupo_id: z.string().nullable().optional(),
  padre_nombre: z.string().nullable().optional(),
  padre_telefono: z.string().nullable().optional(),
  padre_email: z.string().trim().toLowerCase().email().nullable().optional(),
  documento: z.string().nullable().optional(),
  genero: z.enum(["masculino", "femenino", "otro"]).nullable().optional(),
  peso_kg: z.number().positive().max(400).nullable().optional(),
  notas: z.string().nullable().optional(),
});

export const alumnoRouter = router({
  list: staffProcedure.query(async (): Promise<AlumnoRow[]> => {
    const escuelaId = await getEscuelaId();
    const { data, error } = await supabase
      .from("alumno")
      .select("*")
      .eq("escuela_id", escuelaId)
      .order("nombre");
    if (error) throw new Error(error.message);
    return (data ?? []) as AlumnoRow[];
  }),

  get: staffProcedure.input(z.string()).query(async ({ input }): Promise<AlumnoRow> => {
    const escuelaId = await getEscuelaId();
    const { data, error } = await supabase
      .from("alumno")
      .select("*")
      .eq("escuela_id", escuelaId)
      .eq("id", input)
      .single();
    if (error) throw new Error(error.message);
    return data as AlumnoRow;
  }),

  create: adminProcedure.input(alumnoInput).mutation(async ({ input }): Promise<AlumnoRow> => {
    const escuelaId = await getEscuelaId();
    const { data, error } = await supabase
      .from("alumno")
      .insert({ ...input, escuela_id: escuelaId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as AlumnoRow;
  }),

  update: adminProcedure
    .input(alumnoInput.extend({ id: z.string() }))
    .mutation(async ({ input }): Promise<AlumnoRow> => {
      const escuelaId = await getEscuelaId();
      const { id, ...rest } = input;
      const { data, error } = await supabase
        .from("alumno")
        .update(rest)
        .eq("escuela_id", escuelaId)
        .eq("id", id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as AlumnoRow;
    }),

  delete: adminProcedure.input(z.string()).mutation(async ({ input }) => {
    const escuelaId = await getEscuelaId();
    const { error } = await supabase
      .from("alumno")
      .delete()
      .eq("escuela_id", escuelaId)
      .eq("id", input);
    if (error) throw new Error(error.message);
    return { success: true };
  }),
  // Aprueba una inscripción web: invita al acudiente por correo (cuenta de
  // portal), lo vincula al alumno y lo pasa a `activo`. Usa service-role porque
  // crear usuarios de Auth no es posible con el JWT del admin.
  aprobarInscripcion: adminProcedure
    .input(z.object({ id: z.string().min(1), nivel_cinta: z.string().trim().min(1).default("Sin asignar") }))
    .mutation(async ({ input }) => {
      const escuelaId = await getEscuelaId();
      const admin = supabaseAdmin();

      const { data: alumno } = await admin
        .from("alumno")
        .select("id, nombre, estado, padre_nombre, padre_email")
        .eq("escuela_id", escuelaId)
        .eq("id", input.id)
        .maybeSingle();
      if (!alumno || alumno.estado !== "prospecto") {
        throw new TRPCError({ code: "NOT_FOUND", message: "No hay una inscripción pendiente con ese id." });
      }
      const email = (alumno.padre_email as string | null)?.trim().toLowerCase();
      if (!email) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "La inscripción no tiene correo del acudiente. Edítala y agrégalo antes de aprobar.",
        });
      }

      // ¿El acudiente ya tiene cuenta en esta escuela?
      const { data: existente } = await admin
        .from("usuario")
        .select("id")
        .eq("escuela_id", escuelaId)
        .eq("email", email)
        .maybeSingle();

      let padreId: string | null = (existente as { id: string } | null)?.id ?? null;
      let invitado = false;

      if (!padreId) {
        // inviteUserByEmail SÍ envía el correo (generateLink no lo hace).
        const { data: creado, error: errInv } = await admin.auth.admin.inviteUserByEmail(email, {
          data: { rol: "padre", nombre: alumno.padre_nombre },
          redirectTo: `${urlApp()}/definir-contrasena`,
        });
        if (errInv || !creado?.user) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `No se pudo invitar al acudiente: ${errInv?.message ?? "error desconocido"}.`,
          });
        }
        padreId = creado.user.id;
        invitado = true;

        const { error: errUsuario } = await admin
          .from("usuario")
          .insert({ id: padreId, escuela_id: escuelaId, email, rol: "padre" });
        if (errUsuario) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Se envió la invitación pero no se pudo crear el usuario. Reintenta la aprobación.",
          });
        }
      }

      const { error: errLink } = await admin
        .from("alumno_padre")
        .upsert(
          { alumno_id: alumno.id, usuario_id: padreId, escuela_id: escuelaId },
          { onConflict: "alumno_id,usuario_id" }
        );
      if (errLink) throw new Error(errLink.message);

      const { error: errAlumno } = await admin
        .from("alumno")
        .update({
          estado: "activo",
          nivel_cinta: input.nivel_cinta,
          fecha_ingreso: new Date().toISOString().slice(0, 10),
        })
        .eq("escuela_id", escuelaId)
        .eq("id", alumno.id);
      if (errAlumno) throw new Error(errAlumno.message);

      return { success: true, invitado };
    }),

  // Descarta una inscripción web sin borrarla (queda inactiva, con rastro).
  rechazarInscripcion: adminProcedure.input(z.string().min(1)).mutation(async ({ input }) => {
    const escuelaId = await getEscuelaId();
    const { data, error } = await supabase
      .from("alumno")
      .update({ estado: "inactivo", notas: "Inscripción web rechazada" })
      .eq("escuela_id", escuelaId)
      .eq("id", input)
      .eq("estado", "prospecto")
      .select("id");
    if (error) throw new Error(error.message);
    if (!data?.length) {
      throw new TRPCError({ code: "NOT_FOUND", message: "No hay una inscripción pendiente con ese id." });
    }
    return { success: true };
  }),
});
