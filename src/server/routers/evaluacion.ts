import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { getEscuelaId } from "@/lib/tenant";
import { protectedProcedure, adminProcedure, router } from "../trpc";
import type { EvaluacionConAlumno, EvaluacionRow } from "@/types/supabase";

const criterioInput = z.object({
  nombre: z.string().min(1),
  nota: z.number().min(1).max(5),
});

const evaluacionInput = z.object({
  alumno_id: z.string(),
  fecha: z.string(),
  tipo: z.string().min(1),
  tecnica_json: z.array(criterioInput).default([]),
  fisico_json: z.array(criterioInput).default([]),
  actitud_json: z.array(criterioInput).default([]),
  resultado: z.enum(["apto", "no_apto"]),
  nueva_cinta: z.string().nullable().optional(),
  observaciones: z.string().nullable().optional(),
});

async function aplicarNuevaCinta(
  escuelaId: string,
  alumno_id: string,
  nueva_cinta: string | null | undefined
) {
  if (nueva_cinta) {
    await supabase
      .from("alumno")
      .update({ nivel_cinta: nueva_cinta })
      .eq("escuela_id", escuelaId)
      .eq("id", alumno_id);
  }
}

export const evaluacionRouter = router({
  list: protectedProcedure.query(async (): Promise<EvaluacionConAlumno[]> => {
    const escuelaId = await getEscuelaId();
    const { data, error } = await supabase
      .from("evaluacion")
      .select("*, alumno(*)")
      .eq("escuela_id", escuelaId)
      .order("fecha", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as EvaluacionConAlumno[];
  }),

  listByAlumno: protectedProcedure
    .input(z.string())
    .query(async ({ input }): Promise<EvaluacionConAlumno[]> => {
      const escuelaId = await getEscuelaId();
      const { data, error } = await supabase
        .from("evaluacion")
        .select("*, alumno(*)")
        .eq("escuela_id", escuelaId)
        .eq("alumno_id", input)
        .order("fecha", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as EvaluacionConAlumno[];
    }),

  create: adminProcedure.input(evaluacionInput).mutation(async ({ input }): Promise<EvaluacionRow> => {
    const escuelaId = await getEscuelaId();
    const { data, error } = await supabase
      .from("evaluacion")
      .insert({ ...input, escuela_id: escuelaId })
      .select()
      .single();
    if (error) throw new Error(error.message);

    if (input.resultado === "apto" && input.nueva_cinta) {
      await aplicarNuevaCinta(escuelaId, input.alumno_id, input.nueva_cinta);
    }

    return data as EvaluacionRow;
  }),

  update: adminProcedure
    .input(evaluacionInput.extend({ id: z.string() }))
    .mutation(async ({ input }): Promise<EvaluacionRow> => {
      const escuelaId = await getEscuelaId();
      const { id, ...rest } = input;
      const { data, error } = await supabase
        .from("evaluacion")
        .update(rest)
        .eq("escuela_id", escuelaId)
        .eq("id", id)
        .select()
        .single();
      if (error) throw new Error(error.message);

      if (input.resultado === "apto" && input.nueva_cinta) {
        await aplicarNuevaCinta(escuelaId, input.alumno_id, input.nueva_cinta);
      }

      return data as EvaluacionRow;
    }),

  delete: adminProcedure.input(z.string()).mutation(async ({ input }) => {
    const escuelaId = await getEscuelaId();
    const { error } = await supabase
      .from("evaluacion")
      .delete()
      .eq("escuela_id", escuelaId)
      .eq("id", input);
    if (error) throw new Error(error.message);
    return { success: true };
  }),
});