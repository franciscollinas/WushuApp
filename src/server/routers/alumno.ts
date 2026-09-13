import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { getEscuelaId } from "@/lib/tenant";
import { protectedProcedure, adminProcedure, router } from "../trpc";
import type { AlumnoRow } from "@/types/supabase";

const alumnoInput = z.object({
  nombre: z.string().min(1),
  fecha_nacimiento: z.string().nullable().optional(),
  categoria: z.enum(["infantil", "juvenil", "adulto"]),
  nivel_cinta: z.string().min(1),
  fecha_ingreso: z.string().nullable().optional(),
  estado: z.enum(["activo", "inactivo"]).default("activo"),
  grupo_id: z.string().nullable().optional(),
  padre_nombre: z.string().nullable().optional(),
  padre_telefono: z.string().nullable().optional(),
  notas: z.string().nullable().optional(),
});

export const alumnoRouter = router({
  list: protectedProcedure.query(async (): Promise<AlumnoRow[]> => {
    const escuelaId = await getEscuelaId();
    const { data, error } = await supabase
      .from("alumno")
      .select("*")
      .eq("escuela_id", escuelaId)
      .order("nombre");
    if (error) throw new Error(error.message);
    return (data ?? []) as AlumnoRow[];
  }),

  get: protectedProcedure.input(z.string()).query(async ({ input }): Promise<AlumnoRow> => {
    const escuelaId = await getEscuelaId();
    const { data, error } = await supabase
      .from("alumno")
      .select("*")
      .eq("escuela_id", escuelaId)
      .eq("id", input)
      .single();
    if (error) throw new Error(error.message);
    return data as AlumnoRow;
  }),

  create: adminProcedure.input(alumnoInput).mutation(async ({ input }): Promise<AlumnoRow> => {
    const escuelaId = await getEscuelaId();
    const { data, error } = await supabase
      .from("alumno")
      .insert({ ...input, escuela_id: escuelaId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as AlumnoRow;
  }),

  update: adminProcedure
    .input(alumnoInput.extend({ id: z.string() }))
    .mutation(async ({ input }): Promise<AlumnoRow> => {
      const escuelaId = await getEscuelaId();
      const { id, ...rest } = input;
      const { data, error } = await supabase
        .from("alumno")
        .update(rest)
        .eq("escuela_id", escuelaId)
        .eq("id", id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as AlumnoRow;
    }),

  delete: adminProcedure.input(z.string()).mutation(async ({ input }) => {
    const escuelaId = await getEscuelaId();
    const { error } = await supabase
      .from("alumno")
      .delete()
      .eq("escuela_id", escuelaId)
      .eq("id", input);
    if (error) throw new Error(error.message);
    return { success: true };
  }),
});