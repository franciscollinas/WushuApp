import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { getEscuelaId } from "@/lib/tenant";
import { protectedProcedure, adminProcedure, router } from "../trpc";
import type { EjercicioRow } from "@/types/supabase";

const ejercicioInput = z.object({
  nombre: z.string().min(1),
  categoria: z.string().min(1),
  dificultad: z.string().min(1),
  descripcion: z.string().nullable().optional(),
  duracion: z.string().nullable().optional(),
});

export const bibliotecaRouter = router({
  list: protectedProcedure.query(async (): Promise<EjercicioRow[]> => {
    const escuelaId = await getEscuelaId();
    const { data, error } = await supabase
      .from("ejercicio")
      .select("*")
      .eq("escuela_id", escuelaId)
      .order("nombre");
    if (error) throw new Error(error.message);
    return (data ?? []) as EjercicioRow[];
  }),

  create: adminProcedure.input(ejercicioInput).mutation(async ({ input }): Promise<EjercicioRow> => {
    const escuelaId = await getEscuelaId();
    const { data, error } = await supabase
      .from("ejercicio")
      .insert({ ...input, escuela_id: escuelaId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as EjercicioRow;
  }),

  update: adminProcedure
    .input(ejercicioInput.extend({ id: z.string() }))
    .mutation(async ({ input }): Promise<EjercicioRow> => {
      const escuelaId = await getEscuelaId();
      const { id, ...rest } = input;
      const { data, error } = await supabase
        .from("ejercicio")
        .update(rest)
        .eq("escuela_id", escuelaId)
        .eq("id", id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as EjercicioRow;
    }),

  delete: adminProcedure.input(z.string()).mutation(async ({ input }) => {
    const escuelaId = await getEscuelaId();
    const { error } = await supabase
      .from("ejercicio")
      .delete()
      .eq("escuela_id", escuelaId)
      .eq("id", input);
    if (error) throw new Error(error.message);
    return { success: true };
  }),
});