import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { protectedProcedure, router } from "../trpc";

const BUCKET = "fotos-alumnos";

// Foto de perfil del alumno. La puede cambiar el admin o el padre vinculado.
// El navegador sube directo a Storage con una URL firmada que emite este router.
async function verificarAcceso(
  ctx: { usuario: { id: string; rol: string; escuela_id: string } },
  alumnoId: string
) {
  const admin = supabaseAdmin();
  const { data: alumno } = await admin
    .from("alumno")
    .select("id")
    .eq("escuela_id", ctx.usuario.escuela_id)
    .eq("id", alumnoId)
    .maybeSingle();
  if (!alumno) throw new TRPCError({ code: "NOT_FOUND", message: "Alumno no encontrado." });

  if (ctx.usuario.rol === "admin") return admin;
  if (ctx.usuario.rol === "padre") {
    const { data: vinculo } = await admin
      .from("alumno_padre")
      .select("alumno_id")
      .eq("usuario_id", ctx.usuario.id)
      .eq("alumno_id", alumnoId)
      .maybeSingle();
    if (vinculo) return admin;
  }
  throw new TRPCError({ code: "FORBIDDEN", message: "No puedes cambiar la foto de este alumno." });
}

export const fotoRouter = router({
  // Paso 1: pide permiso para subir; devuelve la ruta y el token firmado.
  urlSubida: protectedProcedure
    .input(z.object({ alumno_id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const admin = await verificarAcceso(ctx, input.alumno_id);
      const path = `${input.alumno_id}/${crypto.randomUUID()}.jpg`;
      const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path);
      if (error || !data) throw new Error(error?.message ?? "No se pudo preparar la subida.");
      return { path, token: data.token };
    }),

  // Paso 2: ya subida, la deja como foto del alumno.
  guardar: protectedProcedure
    .input(z.object({ alumno_id: z.string().min(1), path: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const admin = await verificarAcceso(ctx, input.alumno_id);
      if (!input.path.startsWith(`${input.alumno_id}/`) || input.path.includes("..")) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Ruta de foto inválida." });
      }
      const { data: anterior } = await admin
        .from("alumno")
        .select("foto_url")
        .eq("id", input.alumno_id)
        .maybeSingle();
      const url = admin.storage.from(BUCKET).getPublicUrl(input.path).data.publicUrl;
      const { error } = await admin
        .from("alumno")
        .update({ foto_url: url })
        .eq("escuela_id", ctx.usuario.escuela_id)
        .eq("id", input.alumno_id);
      if (error) throw new Error(error.message);

      // Borra la foto anterior para no acumular archivos.
      const marca = `/${BUCKET}/`;
      const vieja = anterior?.foto_url?.includes(marca) ? anterior.foto_url.split(marca)[1] : null;
      if (vieja && vieja !== input.path) await admin.storage.from(BUCKET).remove([vieja]);
      return { url };
    }),
});
