import { supabase } from "@/lib/supabase";
import { getEscuelaId } from "@/lib/tenant";
import { adminProcedure, router } from "../trpc";
import type { AlumnoRow, PagoRow, SesionRow } from "@/types/supabase";

export const dashboardRouter = router({
  estadisticas: adminProcedure
    .input((val: unknown): { mes: string } => val as { mes: string })
    .query(async ({ input }) => {
      const escuelaId = await getEscuelaId();
      const inicio = `${input.mes}-01`;
      const fin = `${input.mes}-31`;

      const [{ data: alumnos, error: alErr }, { data: pagos, error: pErr }, { data: sesiones, error: sErr }] =
        await Promise.all([
          supabase.from("alumno").select("*").eq("escuela_id", escuelaId),
          supabase.from("pago").select("*").eq("escuela_id", escuelaId).eq("mes", input.mes),
          supabase
            .from("sesion")
            .select("*")
            .eq("escuela_id", escuelaId)
            .gte("fecha", inicio)
            .lte("fecha", fin),
        ]);

      if (alErr) throw new Error(alErr.message);
      if (pErr) throw new Error(pErr.message);
      if (sErr) throw new Error(sErr.message);

      const activos = ((alumnos ?? []) as AlumnoRow[]).filter((a) => a.estado === "activo");
      const pagosList = (pagos ?? []) as PagoRow[];
      const ingresos = pagosList
        .filter((p) => p.estado === "pagado")
        .reduce((sum, p) => sum + (p.monto ?? 0), 0);
      const pendientes = pagosList.filter((p) => p.estado !== "pagado").length;

      let porcentajeAsistencia = 0;
      const sesionIds = ((sesiones ?? []) as SesionRow[]).map((s) => s.id);
      if (sesionIds.length) {
        const { data: asistencias, error: aErr } = await supabase
          .from("asistencia")
          .select("presente")
          .eq("escuela_id", escuelaId)
          .in("sesion_id", sesionIds);
        if (!aErr && asistencias?.length) {
          const presentes = (asistencias as { presente: boolean }[]).filter((a) => a.presente).length;
          porcentajeAsistencia = Math.round((presentes / asistencias.length) * 100);
        }
      }

      return {
        alumnosActivos: activos.length,
        ingresosMes: ingresos,
        pagosPendientes: pendientes,
        asistenciaPromedio: porcentajeAsistencia,
      };
    }),
});