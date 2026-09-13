import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { getEscuelaId } from "@/lib/tenant";
import { adminProcedure, router } from "../trpc";
import type { PagoConAlumno, PagoRow } from "@/types/supabase";

const pagoInput = z.object({
  alumno_id: z.string(),
  mes: z.string(),
  monto: z.number().positive(),
  estado: z.enum(["pagado", "pendiente", "vencido"]),
  fecha_pago: z.string().nullable().optional(),
  fecha_vencimiento: z.string(),
});

export const pagoRouter = router({
  list: adminProcedure.query(async (): Promise<PagoConAlumno[]> => {
    const escuelaId = await getEscuelaId();
    const { data, error } = await supabase
      .from("pago")
      .select("*, alumno(*)")
      .eq("escuela_id", escuelaId)
      .order("fecha_vencimiento", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as PagoConAlumno[];
  }),

  listByMes: adminProcedure.input(z.string()).query(async ({ input }): Promise<PagoConAlumno[]> => {
    const escuelaId = await getEscuelaId();
    const { data, error } = await supabase
      .from("pago")
      .select("*, alumno(*)")
      .eq("escuela_id", escuelaId)
      .eq("mes", input)
      .order("fecha_vencimiento");
    if (error) throw new Error(error.message);
    return (data ?? []) as PagoConAlumno[];
  }),

  create: adminProcedure.input(pagoInput).mutation(async ({ input }): Promise<PagoRow> => {
    const escuelaId = await getEscuelaId();
    const { data, error } = await supabase
      .from("pago")
      .insert({ ...input, escuela_id: escuelaId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as PagoRow;
  }),

  marcarPagado: adminProcedure
    .input(z.object({ id: z.string(), fecha_pago: z.string() }))
    .mutation(async ({ input }) => {
      const escuelaId = await getEscuelaId();
      const { error } = await supabase
        .from("pago")
        .update({ estado: "pagado", fecha_pago: input.fecha_pago })
        .eq("escuela_id", escuelaId)
        .eq("id", input.id);
      if (error) throw new Error(error.message);
      return { success: true };
    }),

  delete: adminProcedure.input(z.string()).mutation(async ({ input }) => {
    const escuelaId = await getEscuelaId();
    const { error } = await supabase
      .from("pago")
      .delete()
      .eq("escuela_id", escuelaId)
      .eq("id", input);
    if (error) throw new Error(error.message);
    return { success: true };
  }),
});