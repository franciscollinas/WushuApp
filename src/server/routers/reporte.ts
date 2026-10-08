import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { getEscuelaId } from "@/lib/tenant";
import { staffProcedure, router } from "../trpc";
import type { AlumnoRow, EvaluacionRow, PagoRow } from "@/types/supabase";

export const reporteRouter = router({
  deAlumno: staffProcedure
    .input(z.object({ alumno_id: z.string(), mes: z.string() }))
    .query(async ({ input }) => {
      const escuelaId = await getEscuelaId();
      const [año, m] = input.mes.split("-").map(Number);
      const ultimoDia = new Date(año, m, 0).getDate();
      const inicio = `${input.mes}-01`;
      const fin = `${input.mes}-${String(ultimoDia).padStart(2, "0")}`;

      const { data: alumno, error: alErr } = await supabase
        .from("alumno")
        .select("*")
        .eq("escuela_id", escuelaId)
        .eq("id", input.alumno_id)
        .single();
      if (alErr) throw new Error(alErr.message);
      const alumnoRow = alumno as AlumnoRow;

      // Un alumno recién aprobado puede no tener grupo todavía: en ese caso no hay
      // grupo ni clases que consultar (y `grupo_id = ''` no es un uuid válido).
      const grupoId = alumnoRow.grupo_id;
      let grupoNombre: string | null = null;
      let sesionIds: string[] = [];

      if (grupoId) {
        const { data: grupo, error: grErr } = await supabase
          .from("grupo")
          .select("nombre")
          .eq("escuela_id", escuelaId)
          .eq("id", grupoId)
          .maybeSingle();
        if (grErr) throw new Error(grErr.message);
        grupoNombre = grupo ? (grupo as { nombre: string }).nombre : null;

        const { data: sesiones, error: sErr } = await supabase
          .from("sesion")
          .select("id")
          .eq("escuela_id", escuelaId)
          .eq("grupo_id", grupoId)
          .gte("fecha", inicio)
          .lte("fecha", fin);
        if (sErr) throw new Error(sErr.message);
        sesionIds = ((sesiones ?? []) as { id: string }[]).map((x) => x.id);
      }

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