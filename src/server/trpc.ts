import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { UsuarioRow } from "@/types/supabase";

export interface Context {
  supabase: SupabaseClient;
  user: { id: string; email?: string } | null;
  usuario: UsuarioRow | null;
}

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

// Requiere sesión de Supabase Auth Y fila en la tabla `usuario` (usuario
// aprovisionado en la escuela). Sin esto, la petición se rechaza.
const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.user || !ctx.usuario) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Inicia sesión para continuar.",
    });
  }
  return next({
    ctx: {
      ...ctx,
      // Estos campos ya no pueden ser null dentro de un procedimiento protegido.
      user: { id: ctx.user.id, email: ctx.user.email },
      usuario: ctx.usuario,
    },
  });
});

// Solo administradores. Los entrenadores y usuarios sin rol admin quedan fuera.
const isAdmin = t.middleware(({ ctx, next }) => {
  if (!ctx.usuario || ctx.usuario.rol !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Necesitas ser administrador para realizar esta acción.",
    });
  }
  return next({
    ctx: {
      ...ctx,
      usuario: ctx.usuario,
    },
  });
});

export const protectedProcedure = t.procedure.use(isAuthed);
export const adminProcedure = t.procedure.use(isAuthed).use(isAdmin);
export const createCallerFactory = t.createCallerFactory;