import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { supabase } from "@/lib/supabase";
import { getEscuela, getEscuelaId } from "@/lib/tenant";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { emailDeUsuario, generarClave, normalizarUsername, USERNAME_REGEX } from "@/lib/padres";
import { protectedProcedure, adminProcedure, router } from "../trpc";
import type { UsuarioRow, AlumnoRow } from "@/types/supabase";

export interface UsuarioConAlumnos extends UsuarioRow {
  alumnos_vinculados?: Pick<AlumnoRow, "id" | "nombre" | "categoria" | "nivel_cinta">[];
}

export const usuarioRouter = router({
  // Datos del usuario en sesión: útil para el sidebar y la navegación.
  miUsuario: protectedProcedure.query(async ({ ctx }) => {
    const { usuario } = ctx;
    const { slug } = await getEscuela();
    return { usuario, escuelaSlug: slug };
  }),

  // Lista de usuarios con sus alumnos vinculados si es padre
  list: adminProcedure.query(async (): Promise<UsuarioConAlumnos[]> => {
    const escuelaId = await getEscuelaId();
    const { data: usuarios, error } = await supabase
      .from("usuario")
      .select("id, escuela_id, email, rol, username, created_at")
      .eq("escuela_id", escuelaId)
      .order("email");

    if (error) throw new Error(error.message);
    if (!usuarios || usuarios.length === 0) return [];

    // Buscar vínculos alumno_padre
    const { data: vinculos } = await supabase
      .from("alumno_padre")
      .select("usuario_id, alumno:alumno_id(id, nombre, categoria, nivel_cinta)")
      .eq("escuela_id", escuelaId);

    const usuariosConAlumnos: UsuarioConAlumnos[] = usuarios.map((u: UsuarioRow) => {
      const vinculados = (vinculos ?? [])
        .filter((v) => v.usuario_id === u.id && v.alumno)
        .map((v) => (v as unknown as { alumno: Pick<AlumnoRow, "id" | "nombre" | "categoria" | "nivel_cinta"> }).alumno);

      return {
        ...u,
        alumnos_vinculados: vinculados,
      };
    });

    return usuariosConAlumnos;
  }),

  cambiarRol: adminProcedure
    .input(z.object({ id: z.string().min(1), rol: z.enum(["admin", "entrenador", "padre"]) }))
    .mutation(async ({ ctx, input }) => {
      if (input.id === ctx.usuario.id) {
        // Evita que el admin se auto-degrade y se bloquee fuera.
        throw new TRPCError({
          code: "CONFLICT",
          message: "No puedes cambiar tu propio rol.",
        });
      }
      const escuelaId = await getEscuelaId();
      const { error } = await supabase
        .from("usuario")
        .update({ rol: input.rol })
        .eq("escuela_id", escuelaId)
        .eq("id", input.id);
      if (error) throw new Error(error.message);
      return { success: true };
    }),

  vincularAlumno: adminProcedure
    .input(z.object({ usuario_id: z.string().min(1), alumno_id: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const escuelaId = await getEscuelaId();
      const { error } = await supabase.from("alumno_padre").insert({
        escuela_id: escuelaId,
        usuario_id: input.usuario_id,
        alumno_id: input.alumno_id,
      });

      if (error) {
        if (error.code === "23505") {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Este alumno ya está vinculado a este padre.",
          });
        }
        throw new Error(error.message);
      }
      return { success: true };
    }),

  desvincularAlumno: adminProcedure
    .input(z.object({ usuario_id: z.string().min(1), alumno_id: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const escuelaId = await getEscuelaId();
      const { error } = await supabase
        .from("alumno_padre")
        .delete()
        .eq("escuela_id", escuelaId)
        .eq("usuario_id", input.usuario_id)
        .eq("alumno_id", input.alumno_id);

      if (error) throw new Error(error.message);
      return { success: true };
    }),

  // Retira al usuario por completo: borra su cuenta de Auth (la fila de
  // `usuario` y sus vínculos caen en cascada). Así no queda una cuenta huérfana
  // que pudiera volver a iniciar sesión.
  eliminar: adminProcedure.input(z.string().min(1)).mutation(async ({ ctx, input }) => {
    if (input === ctx.usuario.id) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "No puedes eliminar tu propio usuario.",
      });
    }
    const escuelaId = await getEscuelaId();
    const { data: existe } = await supabase
      .from("usuario")
      .select("id")
      .eq("escuela_id", escuelaId)
      .eq("id", input)
      .maybeSingle();
    if (!existe) throw new TRPCError({ code: "NOT_FOUND", message: "Usuario no encontrado." });

    const { error } = await supabaseAdmin().auth.admin.deleteUser(input);
    if (error) throw new Error(error.message);
    return { success: true };
  }),

  // Genera una contraseña nueva para un padre (el club la entrega en persona).
  // Se devuelve una sola vez: no queda guardada en texto plano.
  restablecerClave: adminProcedure.input(z.string().min(1)).mutation(async ({ input }) => {
    const escuelaId = await getEscuelaId();
    const { data: u } = await supabase
      .from("usuario")
      .select("id, username, rol")
      .eq("escuela_id", escuelaId)
      .eq("id", input)
      .maybeSingle();
    if (!u || u.rol !== "padre") {
      throw new TRPCError({ code: "NOT_FOUND", message: "Padre no encontrado." });
    }
    const password = generarClave();
    const { error } = await supabaseAdmin().auth.admin.updateUserById(input, { password });
    if (error) throw new Error(error.message);
    return { username: u.username as string | null, password };
  }),

  // Cambia el usuario con el que el padre inicia sesión.
  cambiarUsername: adminProcedure
    .input(z.object({ id: z.string().min(1), username: z.string() }))
    .mutation(async ({ input }) => {
      const username = normalizarUsername(input.username);
      if (!USERNAME_REGEX.test(username)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "El usuario debe tener de 4 a 30 caracteres: letras, números, punto, guion o guion bajo.",
        });
      }
      const escuelaId = await getEscuelaId();
      const { data: u } = await supabase
        .from("usuario")
        .select("id, rol")
        .eq("escuela_id", escuelaId)
        .eq("id", input.id)
        .maybeSingle();
      if (!u || u.rol !== "padre") {
        throw new TRPCError({ code: "NOT_FOUND", message: "Padre no encontrado." });
      }
      const { data: ocupado } = await supabase
        .from("usuario")
        .select("id")
        .eq("escuela_id", escuelaId)
        .ilike("username", username)
        .neq("id", input.id)
        .maybeSingle();
      if (ocupado) {
        throw new TRPCError({ code: "CONFLICT", message: "Ese usuario ya está en uso." });
      }

      const email = emailDeUsuario(username);
      const { error: errAuth } = await supabaseAdmin().auth.admin.updateUserById(input.id, {
        email,
        email_confirm: true,
      });
      if (errAuth) throw new Error(errAuth.message);

      const { error } = await supabase
        .from("usuario")
        .update({ username, email })
        .eq("escuela_id", escuelaId)
        .eq("id", input.id);
      if (error) throw new Error(error.message);
      return { username };
    }),
});