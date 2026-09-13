import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { getEscuelaId } from "@/lib/tenant";
import { protectedProcedure, router } from "../trpc";
import type { AlumnoConFaltas, AlumnoRow, SesionConAsistencia, SesionRow } from "@/types/supabase";

export const asistenciaRouter = router({
  abrirSesion: protectedProcedure
    .input(z.object({ grupo_id: z.string(), fecha: z.string(), tema: z.string().optional() }))
    .mutation(async ({ input }): Promise<SesionRow> => {
      const escuelaId = await getEscuelaId();
      const { data: grupo, error: gErr } = await supabase
        .from("grupo")
        .select("*")
        .eq("escuela_id", escuelaId)
        .eq("id", input.grupo_id)
        .single();
      if (gErr) throw new Error(gErr.message);

      const { data: sesion, error: sErr } = await supabase
        .from("sesion")
        .insert({
          escuela_id: escuelaId,
          grupo_id: input.grupo_id,
          fecha: input.fecha,
          tema: input.tema ?? "",
          entrenador: (grupo as { entrenador: string }).entrenador,
        })
        .select()
        .single();
      if (sErr) throw new Error(sErr.message);

      const { data: alumnos, error: aErr } = await supabase
        .from("alumno")
        .select("id")
        .eq("escuela_id", escuelaId)
        .eq("grupo_id", input.grupo_id)
        .eq("estado", "activo");
      if (aErr) throw new Error(aErr.message);

      if ((alumnos as { id: string }[]).length > 0) {
        const registros = (alumnos as { id: string }[]).map((a) => ({
          escuela_id: escuelaId,
          sesion_id: (sesion as SesionRow).id,
          alumno_id: a.id,
          presente: false,
        }));
        const { error: iErr } = await supabase.from("asistencia").insert(registros);
        if (iErr) throw new Error(iErr.message);
      }

      return sesion as SesionRow;
    }),

  listaConAsistencia: protectedProcedure
    .input(z.object({ grupo_id: z.string(), fecha: z.string() }))
    .query(async ({ input }) => {
      const escuelaId = await getEscuelaId();
      const { data: sesion, error } = await supabase
        .from("sesion")
        .select("*, asistencia(*, alumno(*))")
        .eq("escuela_id", escuelaId)
        .eq("grupo_id", input.grupo_id)
        .eq("fecha", input.fecha)
        .maybeSingle();
      if (error) throw new Error(error.message);

      if (sesion) {
        return {
          sesion: sesion as unknown as SesionConAsistencia,
          listo: true,
        };
      }

      const { data: alumnos, error: aErr } = await supabase
        .from("alumno")
        .select("*")
        .eq("escuela_id", escuelaId)
        .eq("grupo_id", input.grupo_id)
        .eq("estado", "activo")
        .order("nombre");
      if (aErr) throw new Error(aErr.message);

      return {
        sesion: null,
        alumnos: (alumnos ?? []) as AlumnoRow[],
        listo: false,
      };
    }),

  marcarPresencia: protectedProcedure
    .input(z.object({ asistencia_id: z.string(), presente: z.boolean() }))
    .mutation(async ({ input }) => {
      const escuelaId = await getEscuelaId();
      const { error } = await supabase
        .from("asistencia")
        .update({ presente: input.presente })
        .eq("escuela_id", escuelaId)
        .eq("id", input.asistencia_id);
      if (error) throw new Error(error.message);
      return { success: true };
    }),

  alumnosConFaltas: protectedProcedure
    .input(z.object({ mes: z.string() }))
    .query(async ({ input }): Promise<AlumnoConFaltas[]> => {
      const escuelaId = await getEscuelaId();
      const [año, m] = input.mes.split("-").map(Number);
      const ultimoDia = new Date(año, m, 0).getDate();
      const inicio = `${input.mes}-01`;
      const fin = `${input.mes}-${String(ultimoDia).padStart(2, "0")}`;

      const { data: sesiones, error: sErr } = await supabase
        .from("sesion")
        .select("id")
        .eq("escuela_id", escuelaId)
        .gte("fecha", inicio)
        .lte("fecha", fin);
      if (sErr) throw new Error(sErr.message);

      const sesionIds = ((sesiones ?? []) as { id: string }[]).map((s) => s.id);

      let asistencias: { alumno_id: string; presente: boolean }[] = [];
      if (sesionIds.length) {
        const { data, error: aErr } = await supabase
          .from("asistencia")
          .select("alumno_id, presente")
          .eq("escuela_id", escuelaId)
          .in("sesion_id", sesionIds);
        if (aErr) throw new Error(aErr.message);
        asistencias = (data ?? []) as { alumno_id: string; presente: boolean }[];
      }

      const faltasPorAlumno = new Map<string, number>();
      for (const a of asistencias) {
        if (!a.presente) {
          faltasPorAlumno.set(a.alumno_id, (faltasPorAlumno.get(a.alumno_id) ?? 0) + 1);
        }
      }

      const conFaltas = [...faltasPorAlumno.entries()]
        .filter(([, n]) => n >= 3)
        .map(([alumno_id, faltas]) => ({ alumno_id, faltas }));

      const ids = conFaltas.map((c) => c.alumno_id);
      let alumnos: Pick<AlumnoRow, "id" | "nombre" | "grupo_id">[] = [];
      if (ids.length) {
        const { data, error: alErr } = await supabase
          .from("alumno")
          .select("id, nombre, grupo_id")
          .eq("escuela_id", escuelaId)
          .in("id", ids);
        if (alErr) throw new Error(alErr.message);
        alumnos = (data ?? []) as Pick<AlumnoRow, "id" | "nombre" | "grupo_id">[];
      }

      return conFaltas.map((c) => ({
        ...c,
        alumno: alumnos.find((x) => x.id === c.alumno_id),
      }));
    }),
});