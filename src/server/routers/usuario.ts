import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { supabase } from "@/lib/supabase";
import { getEscuela, getEscuelaId } from "@/lib/tenant";
import { protectedProcedure, adminProcedure, router } from "../trpc";
import type { UsuarioRow } from "@/types/supabase";

export const usuarioRouter = router({
  // Datos del usuario en sesión: útil para el sidebar y la navegación.
  miUsuario: protectedProcedure.query(async ({ ctx }) => {
    const { usuario } = ctx;
    const { slug } = await getEscuela();
    return { usuario, escuelaSlug: slug };
  }),

  list: adminProcedure.query(async (): Promise<UsuarioRow[]> => {
    const escuelaId = await getEscuelaId();
    const { data, error } = await supabase
      .from("usuario")
      .select("id, escuela_id, email, rol, created_at")
      .eq("escuela_id", escuelaId)
      .order("email");
    if (error) throw new Error(error.message);
    return (data ?? []) as UsuarioRow[];
  }),

  cambiarRol: adminProcedure
    .input(z.object({ id: z.string().min(1), rol: z.enum(["admin", "entrenador"]) }))
    .mutation(async ({ ctx, input }) => {
      if (input.id === ctx.usuario.id) {
        // Evita que el admin se auto-degrade y se bloquee fuera.
        throw new TRPCError({
          code: "CONFLICT",
          message: "No puedes cambiar tu propio rol.",
        });
      }
      const escuelaId = await getEscuelaId();
      const { error } = await supabase
        .from("usuario")
        .update({ rol: input.rol })
        .eq("escuela_id", escuelaId)
        .eq("id", input.id);
      if (error) throw new Error(error.message);
      return { success: true };
    }),

  eliminar: adminProcedure.input(z.string().min(1)).mutation(async ({ ctx, input }) => {
    if (input === ctx.usuario.id) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "No puedes eliminar tu propio usuario.",
      });
    }
    const escuelaId = await getEscuelaId();
    const { error } = await supabase
      .from("usuario")
      .delete()
      .eq("escuela_id", escuelaId)
      .eq("id", input);
    if (error) throw new Error(error.message);
    return { success: true };
  }),
});