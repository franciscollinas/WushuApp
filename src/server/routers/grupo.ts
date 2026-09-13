import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { getEscuelaId } from "@/lib/tenant";
import { protectedProcedure, adminProcedure, router } from "../trpc";
import type { AlumnoRow, GrupoConAlumnos, GrupoRow } from "@/types/supabase";

const grupoInput = z.object({
  nombre: z.string().min(1),
  categoria_edad: z.string().min(1),
  dias: z.string().min(1),
  hora_inicio: z.string().min(1),
  hora_fin: z.string().min(1),
  entrenador: z.string().min(1),
});

export const grupoRouter = router({
  list: protectedProcedure.query(async (): Promise<GrupoRow[]> => {
    const escuelaId = await getEscuelaId();
    const { data, error } = await supabase
      .from("grupo")
      .select("*")
      .eq("escuela_id", escuelaId)
      .order("nombre");
    if (error) throw new Error(error.message);
    return (data ?? []) as GrupoRow[];
  }),

  listWithAlumnos: protectedProcedure.query(async (): Promise<GrupoConAlumnos[]> => {
    const escuelaId = await getEscuelaId();
    const [{ data: grupos, error: gErr }, { data: alumnos, error: aErr }] = await Promise.all([
      supabase.from("grupo").select("*").eq("escuela_id", escuelaId).order("nombre"),
      supabase.from("alumno").select("*").eq("escuela_id", escuelaId).order("nombre"),
    ]);
    if (gErr) throw new Error(gErr.message);
    if (aErr) throw new Error(aErr.message);

    return ((grupos ?? []) as GrupoRow[]).map((g) => ({
      ...g,
      alumnos: ((alumnos ?? []) as AlumnoRow[]).filter((a) => a.grupo_id === g.id),
    }));
  }),

  get: protectedProcedure.input(z.string()).query(async ({ input }): Promise<GrupoRow> => {
    const escuelaId = await getEscuelaId();
    const { data, error } = await supabase
      .from("grupo")
      .select("*")
      .eq("escuela_id", escuelaId)
      .eq("id", input)
      .single();
    if (error) throw new Error(error.message);
    return data as GrupoRow;
  }),

  create: adminProcedure.input(grupoInput).mutation(async ({ input }): Promise<GrupoRow> => {
    const escuelaId = await getEscuelaId();
    const { data, error } = await supabase
      .from("grupo")
      .insert({ ...input, escuela_id: escuelaId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as GrupoRow;
  }),

  update: adminProcedure
    .input(grupoInput.extend({ id: z.string() }))
    .mutation(async ({ input }): Promise<GrupoRow> => {
      const escuelaId = await getEscuelaId();
      const { id, ...rest } = input;
      const { data, error } = await supabase
        .from("grupo")
        .update(rest)
        .eq("escuela_id", escuelaId)
        .eq("id", id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as GrupoRow;
    }),

  delete: adminProcedure.input(z.string()).mutation(async ({ input }) => {
    const escuelaId = await getEscuelaId();
    const { error } = await supabase
      .from("grupo")
      .delete()
      .eq("escuela_id", escuelaId)
      .eq("id", input);
    if (error) throw new Error(error.message);
    return { success: true };
  }),

  asignarAlumno: adminProcedure
    .input(z.object({ grupo_id: z.string(), alumno_id: z.string() }))
    .mutation(async ({ input }) => {
      const escuelaId = await getEscuelaId();
      // Verifica que el grupo pertenezca a esta escuela.
      const { data: grupo, error: gErr } = await supabase
        .from("grupo")
        .select("id")
        .eq("escuela_id", escuelaId)
        .eq("id", input.grupo_id)
        .maybeSingle();
      if (gErr) throw new Error(gErr.message);
      if (!grupo) throw new Error("El grupo no pertenece a esta escuela.");

      const { error } = await supabase
        .from("alumno")
        .update({ grupo_id: input.grupo_id })
        .eq("escuela_id", escuelaId)
        .eq("id", input.alumno_id);
      if (error) throw new Error(error.message);
      return { success: true };
    }),

  quitarAlumno: adminProcedure.input(z.string()).mutation(async ({ input }) => {
    const escuelaId = await getEscuelaId();
    const { error } = await supabase
      .from("alumno")
      .update({ grupo_id: null })
      .eq("escuela_id", escuelaId)
      .eq("id", input);
    if (error) throw new Error(error.message);
    return { success: true };
  }),
});