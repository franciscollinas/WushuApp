import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { supabase } from "@/lib/supabase";
import { getEscuelaId } from "@/lib/tenant";
import { hoyColombia } from "@/lib/padres";
import { adminProcedure, router } from "../trpc";
import { cargarConfigXp, cargarRanking } from "../xp-data";

export const xpRouter = router({
  ranking: adminProcedure.query(async () => {
    const escuelaId = await getEscuelaId();
    return cargarRanking(escuelaId);
  }),

  config: adminProcedure.query(async () => {
    const escuelaId = await getEscuelaId();
    return cargarConfigXp(escuelaId);
  }),

  setConfig: adminProcedure
    .input(
      z.object({
        xp_por_asistencia: z.number().int().min(0).max(1000),
        xp_racha_dias: z.number().int().min(0).max(60),
        xp_racha_bonus: z.number().int().min(0).max(1000),
      })
    )
    .mutation(async ({ input }) => {
      const escuelaId = await getEscuelaId();
      const { error } = await supabase.from("escuela").update(input).eq("id", escuelaId);
      if (error) throw new Error(error.message);
      return { success: true };
    }),

  // Puntos otorgados a mano (logros, torneos, referidos, buen comportamiento…).
  // Pueden ser negativos para corregir un error.
  otorgar: adminProcedure
    .input(
      z.object({
        alumno_id: z.string().min(1),
        puntos: z.number().int().refine((n) => n !== 0, "Los puntos no pueden ser 0"),
        motivo: z.string().trim().min(1, "Escribe el motivo").max(120),
      })
    )
    .mutation(async ({ input }) => {
      const escuelaId = await getEscuelaId();
      const { error } = await supabase.from("xp_movimiento").insert({
        escuela_id: escuelaId,
        alumno_id: input.alumno_id,
        puntos: input.puntos,
        motivo: input.motivo,
        fecha: hoyColombia(),
      });
      if (error) throw new Error(error.message);
      return { success: true };
    }),

  movimientos: adminProcedure.query(async () => {
    const escuelaId = await getEscuelaId();
    const { data, error } = await supabase
      .from("xp_movimiento")
      .select("id, puntos, motivo, fecha, created_at, alumno:alumno_id(nombre)")
      .eq("escuela_id", escuelaId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (data ?? []).map((m) => {
      const al = Array.isArray(m.alumno) ? m.alumno[0] : m.alumno;
      return {
        id: m.id as string,
        puntos: Number(m.puntos),
        motivo: m.motivo as string,
        fecha: m.fecha as string,
        alumno: ((al as { nombre?: string } | null)?.nombre ?? "—") as string,
      };
    });
  }),

  eliminarMovimiento: adminProcedure.input(z.string().min(1)).mutation(async ({ input }) => {
    const escuelaId = await getEscuelaId();
    const { error, count } = await supabase
      .from("xp_movimiento")
      .delete({ count: "exact" })
      .eq("escuela_id", escuelaId)
      .eq("id", input);
    if (error) throw new Error(error.message);
    if (!count) throw new TRPCError({ code: "NOT_FOUND", message: "Movimiento no encontrado." });
    return { success: true };
  }),
});
