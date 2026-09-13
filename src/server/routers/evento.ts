import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { getEscuelaId } from "@/lib/tenant";
import { protectedProcedure, adminProcedure, router } from "../trpc";
import type { EventoRow } from "@/types/supabase";

const eventoInput = z.object({
  nombre: z.string().min(1),
  fecha: z.string().min(1),
  tipo: z.string().min(1),
  lugar: z.string().nullable().optional(),
  descripcion: z.string().nullable().optional(),
});

export const eventoRouter = router({
  list: protectedProcedure.query(async (): Promise<EventoRow[]> => {
    const escuelaId = await getEscuelaId();
    const { data, error } = await supabase
      .from("evento")
      .select("*")
      .eq("escuela_id", escuelaId)
      .order("fecha");
    if (error) throw new Error(error.message);
    return (data ?? []) as EventoRow[];
  }),

  proximos: protectedProcedure.query(async (): Promise<EventoRow[]> => {
    const escuelaId = await getEscuelaId();
    const hoy = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from("evento")
      .select("*")
      .eq("escuela_id", escuelaId)
      .gte("fecha", hoy)
      .order("fecha")
      .limit(8);
    if (error) throw new Error(error.message);
    return (data ?? []) as EventoRow[];
  }),

  create: adminProcedure.input(eventoInput).mutation(async ({ input }): Promise<EventoRow> => {
    const escuelaId = await getEscuelaId();
    const { data, error } = await supabase
      .from("evento")
      .insert({ ...input, escuela_id: escuelaId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as EventoRow;
  }),

  update: adminProcedure
    .input(eventoInput.extend({ id: z.string() }))
    .mutation(async ({ input }): Promise<EventoRow> => {
      const escuelaId = await getEscuelaId();
      const { id, ...rest } = input;
      const { data, error } = await supabase
        .from("evento")
        .update(rest)
        .eq("escuela_id", escuelaId)
        .eq("id", id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as EventoRow;
    }),

  delete: adminProcedure.input(z.string()).mutation(async ({ input }) => {
    const escuelaId = await getEscuelaId();
    const { error } = await supabase
      .from("evento")
      .delete()
      .eq("escuela_id", escuelaId)
      .eq("id", input);
    if (error) throw new Error(error.message);
    return { success: true };
  }),
});