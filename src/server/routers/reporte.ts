import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { getEscuelaId } from "@/lib/tenant";
import { protectedProcedure, router } from "../trpc";
import type { AlumnoRow, EvaluacionRow, PagoRow } from "@/types/supabase";

export const reporteRouter = router({
  deAlumno: protectedProcedure
    .input(z.object({ alumno_id: z.string(), mes: z.string() }))
    .query(async ({ input }) => {
      const escuelaId = await getEscuelaId();
      const inicio = `${input.mes}-01`;
      const fin = `${input.mes}-31`;

      const { data: alumno, error: alErr } = await supabase
        .from("alumno")
        .select("*")
        .eq("escuela_id", escuelaId)
        .eq("id", input.alumno_id)
        .single();
      if (alErr) throw new Error(alErr.message);
      const alumnoRow = alumno as AlumnoRow;

      const { data: grupo, error: grErr } = await supabase
        .from("grupo")
        .select("nombre")
        .eq("escuela_id", escuelaId)
        .eq("id", alumnoRow.grupo_id ?? "")
        .maybeSingle();
      if (grErr) throw new Error(grErr.message);
      const grupoNombre = grupo ? (grupo as { nombre: string }).nombre : null;

      const { data: sesiones, error: sErr } = await supabase
        .from("sesion")
        .select("id")
        .eq("escuela_id", escuelaId)
        .eq("grupo_id", alumnoRow.grupo_id ?? "")
        .gte("fecha", inicio)
        .lte("fecha", fin);
      if (sErr) throw new Error(sErr.message);
      const sesionIds = ((sesiones ?? []) as { id: string }[]).map((s) => s.id);

      let presentes = 0;
      const totalSesiones = sesionIds.length;
      if (sesionIds.length) {
        const { data: asistencias, error: aErr } = await supabase
          .from("asistencia")
          .select("presente")
          .eq("escuela_id", escuelaId)
          .eq("alumno_id", input.alumno_id)
          .in("sesion_id", sesionIds);
        if (aErr) throw new Error(aErr.message);
        presentes = ((asistencias ?? []) as { presente: boolean }[]).filter((a) => a.presente).length;
      }

      const { data: evaluaciones, error: eErr } = await supabase
        .from("evaluacion")
        .select("*")
        .eq("escuela_id", escuelaId)
        .eq("alumno_id", input.alumno_id)
        .order("fecha", { ascending: false })
        .limit(1);
      if (eErr) throw new Error(eErr.message);
      const ultimaEval = (evaluaciones ?? [])[0] as EvaluacionRow | undefined;

      const { data: pagos, error: pErr } = await supabase
        .from("pago")
        .select("*")
        .eq("escuela_id", escuelaId)
        .eq("alumno_id", input.alumno_id)
        .eq("mes", input.mes);
      if (pErr) throw new Error(pErr.message);
      const pagoMes = (pagos ?? [])[0] as PagoRow | undefined;

      return {
        alumno: alumnoRow,
        grupoNombre,
        asistenciaMes: {
          presentes,
          total: totalSesiones,
          porcentaje: totalSesiones === 0 ? 0 : Math.round((presentes / totalSesiones) * 100),
        },
        ultimaEvaluacion: ultimaEval ?? null,
        pagoMes: pagoMes ?? null,
      };
    }),
});