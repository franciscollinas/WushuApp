import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { supabase } from "@/lib/supabase";
import { getEscuela, getEscuelaId } from "@/lib/tenant";
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
      .select("id, escuela_id, email, rol, created_at")
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

  eliminar: adminProcedure.input(z.string().min(1)).mutation(async ({ ctx, input }) => {
    if (input === ctx.usuario.id) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "No puedes eliminar tu propio usuario.",
      });
    }
    const escuelaId = await getEscuelaId();
    const { error } = await supabase
      .from("usuario")
      .delete()
      .eq("escuela_id", escuelaId)
      .eq("id", input);
    if (error) throw new Error(error.message);
    return { success: true };
  }),

  // Vista consolidada de la ficha de su(s) hijo(s) para el rol padre
  miFichaPadre: protectedProcedure.query(async ({ ctx }) => {
    const escuelaId = await getEscuelaId();

    // Buscar hijos vinculados a este padre
    const { data: vinculos, error: errVinculos } = await supabase
      .from("alumno_padre")
      .select("alumno_id")
      .eq("escuela_id", escuelaId)
      .eq("usuario_id", ctx.user.id);

    if (errVinculos) throw new Error(errVinculos.message);
    const alumnoIds = (vinculos ?? []).map((v) => v.alumno_id);

    if (alumnoIds.length === 0) {
      return [];
    }

    // Traer datos completos de cada alumno vinculado
    const { data: alumnos, error: errAlumnos } = await supabase
      .from("alumno")
      .select("*, grupo(*)")
      .eq("escuela_id", escuelaId)
      .in("id", alumnoIds);

    if (errAlumnos) throw new Error(errAlumnos.message);

    // Traer pagos de mensualidad
    const { data: pagos } = await supabase
      .from("pago")
      .select("*")
      .eq("escuela_id", escuelaId)
      .in("alumno_id", alumnoIds)
      .order("fecha_vencimiento", { ascending: false });

    // Traer deudas por evento con abonos
    const { data: deudasAlumno } = await supabase
      .from("deuda_alumno")
      .select("*, deuda(*)")
      .eq("escuela_id", escuelaId)
      .in("alumno_id", alumnoIds)
      .order("created_at", { ascending: false });

    // Traer asistencias
    const { data: asistencias } = await supabase
      .from("asistencia")
      .select("alumno_id, presente, sesion(fecha, tema)")
      .eq("escuela_id", escuelaId)
      .in("alumno_id", alumnoIds);

    // Mapear cada alumno con su ficha completa
    const resultado = (alumnos ?? []).map((alumno) => {
      const susPagos = (pagos ?? []).filter((p) => p.alumno_id === alumno.id);
      const susDeudas = (deudasAlumno ?? []).filter((d) => d.alumno_id === alumno.id);
      const susAsistencias = (asistencias ?? []).filter((a) => a.alumno_id === alumno.id);

      const totalSesiones = susAsistencias.length;
      const totalPresente = susAsistencias.filter((a) => a.presente).length;
      const porcentajeAsistencia =
        totalSesiones > 0 ? Math.round((totalPresente / totalSesiones) * 100) : 100;

      return {
        alumno,
        pagos: susPagos,
        deudas: susDeudas,
        asistencia: {
          totalSesiones,
          totalPresente,
          porcentajeAsistencia,
        },
      };
    });

    return resultado;
  }),
});