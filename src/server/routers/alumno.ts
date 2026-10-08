import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { supabase } from "@/lib/supabase";
import { getEscuelaId } from "@/lib/tenant";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { emailDeUsuario, generarClave, hoyColombia } from "@/lib/padres";
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
  documento: z.string().nullable().optional(),
  genero: z.enum(["masculino", "femenino", "otro"]).nullable().optional(),
  peso_kg: z.number().positive().max(400).nullable().optional(),
  notas: z.string().nullable().optional(),
  modalidad_pago: z.enum(["mensual", "semanal", "becado"]).default("mensual"),
  acceso_manual: z.enum(["auto", "activo", "suspendido"]).default("auto"),
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

  // Interruptor de acceso del padre: 'auto' (según pagos), 'activo' (siempre puede
  // entrar) o 'suspendido' (no puede entrar). Manda sobre la regla del día límite.
  setAcceso: adminProcedure
    .input(z.object({ id: z.string().min(1), acceso_manual: z.enum(["auto", "activo", "suspendido"]) }))
    .mutation(async ({ input }) => {
      const escuelaId = await getEscuelaId();
      const { error } = await supabase
        .from("alumno")
        .update({ acceso_manual: input.acceso_manual })
        .eq("escuela_id", escuelaId)
        .eq("id", input.id);
      if (error) throw new Error(error.message);
      return { success: true };
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
  // Aprueba el pago de una inscripción web: crea la cuenta del padre (usuario
  // y contraseña, sin correos), la vincula al alumno, registra el primer mes
  // como pagado y activa al alumno. La contraseña solo se devuelve aquí, una
  // vez: no se guarda en texto plano. Usa service-role porque crear usuarios de
  // Auth no es posible con el JWT del admin.
  aprobarPago: adminProcedure
    .input(
      z.object({
        id: z.string().min(1),
        monto: z.number().min(0).default(0),
        modalidad_pago: z.enum(["mensual", "semanal", "becado"]).default("mensual"),
        nivel_cinta: z.string().trim().default(""),
        metodo_pago: z.string().trim().max(40).default("Efectivo"),
        grupo_id: z.string().min(1).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const escuelaId = await getEscuelaId();
      const admin = supabaseAdmin();

      if (input.modalidad_pago !== "becado" && input.monto <= 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Escribe el monto recibido." });
      }

      const { data: alumno } = await admin
        .from("alumno")
        .select("id, nombre, estado, padre_nombre, codigo_inscripcion")
        .eq("escuela_id", escuelaId)
        .eq("id", input.id)
        .maybeSingle();
      if (!alumno || alumno.estado !== "prospecto") {
        throw new TRPCError({ code: "NOT_FOUND", message: "No hay una inscripción pendiente con ese id." });
      }

      // El grupo es opcional, pero si viene debe ser de esta escuela. Se valida antes
      // de crear la cuenta del padre para no dejar nada a medias.
      if (input.grupo_id) {
        const { data: grupo } = await admin
          .from("grupo")
          .select("id")
          .eq("escuela_id", escuelaId)
          .eq("id", input.grupo_id)
          .maybeSingle();
        if (!grupo) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "El grupo elegido no existe." });
        }
      }

      // Usuario por defecto: el código sin guion (ej. MB-4F7K → mb4f7k). El admin
      // puede cambiarlo después. Si ya existe, se le agregan dígitos.
      const base = String(alumno.codigo_inscripcion ?? "padre")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .padEnd(4, "0");
      let username = base;
      for (let i = 0; i < 5; i++) {
        const { data: ocupado } = await admin
          .from("usuario")
          .select("id")
          .eq("escuela_id", escuelaId)
          .ilike("username", username)
          .maybeSingle();
        if (!ocupado) break;
        username = `${base}${Math.floor(10 + Math.random() * 90)}`;
      }

      const password = generarClave();
      const { data: creado, error: errCrear } = await admin.auth.admin.createUser({
        email: emailDeUsuario(username),
        password,
        email_confirm: true,
        user_metadata: { rol: "padre", nombre: alumno.padre_nombre },
      });
      if (errCrear || !creado?.user) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `No se pudo crear la cuenta del padre: ${errCrear?.message ?? "error desconocido"}.`,
        });
      }
      const padreId = creado.user.id;

      // Si algo falla de aquí en adelante, se deshace la cuenta para no dejar
      // usuarios huérfanos.
      const deshacer = async (mensaje: string): Promise<never> => {
        await admin.auth.admin.deleteUser(padreId).catch(() => undefined);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: mensaje });
      };

      const { error: errUsuario } = await admin.from("usuario").insert({
        id: padreId,
        escuela_id: escuelaId,
        email: emailDeUsuario(username),
        rol: "padre",
        username,
      });
      if (errUsuario) await deshacer("No se pudo registrar el usuario del padre. Intenta de nuevo.");

      const { error: errLink } = await admin
        .from("alumno_padre")
        .upsert(
          { alumno_id: alumno.id, usuario_id: padreId, escuela_id: escuelaId },
          { onConflict: "alumno_id,usuario_id" }
        );
      if (errLink) await deshacer("No se pudo vincular al padre con el alumno. Intenta de nuevo.");

      // Primer mes pagado: se crea el cobro del mes y se registra el pago como abono
      // (genera su comprobante). Un becado no paga nada.
      const hoy = hoyColombia();
      const mes = hoy.slice(0, 7);
      if (input.modalidad_pago !== "becado") {
        const { data: pagoMes, error: errPago } = await admin
          .from("pago")
          .upsert(
            {
              escuela_id: escuelaId,
              alumno_id: alumno.id,
              mes,
              monto: input.monto,
              estado: "pendiente",
              fecha_vencimiento: `${mes}-05`,
            },
            { onConflict: "alumno_id,mes" }
          )
          .select("id")
          .single();
        if (errPago || !pagoMes) await deshacer("No se pudo registrar el pago. Intenta de nuevo.");

        const { error: errAbono } = await admin.from("pago_abono").insert({
          escuela_id: escuelaId,
          pago_id: pagoMes!.id,
          monto: input.monto,
          fecha_pago: hoy,
          metodo_pago: input.metodo_pago,
          observaciones: "Inscripción y primer mes",
        });
        if (errAbono) await deshacer("No se pudo registrar el pago. Intenta de nuevo.");
      }

      const { error: errAlumno } = await admin
        .from("alumno")
        .update({
          estado: "activo",
          nivel_cinta: input.nivel_cinta,
          fecha_ingreso: hoy,
          modalidad_pago: input.modalidad_pago,
          ...(input.grupo_id ? { grupo_id: input.grupo_id } : {}),
        })
        .eq("escuela_id", escuelaId)
        .eq("id", alumno.id);
      if (errAlumno) await deshacer("No se pudo activar al alumno. Intenta de nuevo.");

      return { username, password, codigo: alumno.codigo_inscripcion as string | null };
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
