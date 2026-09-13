import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { UsuarioRow } from "@/types/supabase";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// ── helper interno ──────────────────────────────────────────────────────────
function parseCookies(header: string | null): { name: string; value: string }[] {
  if (!header) return [];
  return header.split(";").map((c) => {
    const [name, ...rest] = c.trim().split("=");
    return { name, value: rest.join("=") };
  });
}

// ── cliente Supabase por request (route handlers) ───────────────────────────
// `onSetCookies` recibe las cookies que el SDK quiere escribir (refresco de
// sesión). El route handler las añade a la respuesta final, porque aquí no hay
// acceso directo a una NextResponse con cookies.
export function createSupabaseFromCookieHeader(
  cookieHeader: string | null,
  onSetCookies?: (cookies: { name: string; value: string; options?: CookieOptions }[]) => void
) {
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => parseCookies(cookieHeader),
      setAll: (cookiesToSet) => {
        onSetCookies?.(cookiesToSet.map(({ name, value, options }) => ({ name, value, options })));
      },
    },
  });
}

// ── obtener usuario de la tabla `usuario` ───────────────────────────────────
export async function obtenerUsuarioRow(
  supabase: SupabaseClient,
  userId: string
): Promise<UsuarioRow | null> {
  const { data, error } = await supabase
    .from("usuario")
    .select("id, escuela_id, email, rol, created_at")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return data as unknown as UsuarioRow;
}

// ── serializar cookie ───────────────────────────────────────────────────────
export function serializeCookie(
  name: string,
  value: string,
  options?: CookieOptions
): string {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (options?.path) parts.push(`Path=${options.path}`);
  if (options?.maxAge != null) parts.push(`Max-Age=${options.maxAge}`);
  if (options?.domain) parts.push(`Domain=${options.domain}`);
  if (options?.sameSite) {
    const valor =
      options.sameSite === true
        ? "Strict"
        : options.sameSite.charAt(0).toUpperCase() + options.sameSite.slice(1);
    parts.push(`SameSite=${valor}`);
  }
  if (options?.secure) parts.push("Secure");
  if (options?.httpOnly) parts.push("HttpOnly");
  return parts.join("; ");
}