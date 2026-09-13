import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { obtenerUsuarioRow } from "@/lib/auth";

// Rutas que el entrenador puede usar (consulta alumnos/grupos + asistencia).
const ENTRENADOR_PERMITIDAS = ["/alumnos", "/grupos", "/asistencia"];

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Ruta pública: /login.
  if (pathname === "/login") {
    if (user) {
      const usuario = await obtenerUsuarioRow(supabase, user.id);
      return usuario
        ? NextResponse.redirect(new URL(usuario.rol === "admin" ? "/" : "/asistencia", request.url))
        : supabaseResponse;
    }
    return supabaseResponse;
  }

  const usuario = user ? await obtenerUsuarioRow(supabase, user.id) : null;

  if (!usuario) {
    // No hay sesión o el usuario no está aprovisionado en la escuela.
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (usuario.rol === "entrenador") {
    // La vista principal del entrenador es /asistencia: fuera de las rutas de
    // consulta alumnos/grupos y asistencia, se redirige allí.
    const permitida = ENTRENADOR_PERMITIDAS.some(
      (r) => pathname === r || pathname.startsWith(`${r}/`)
    );
    if (pathname === "/" || !permitida) {
      return NextResponse.redirect(new URL("/asistencia", request.url));
    }
  }

  return supabaseResponse;
}

// Excluye API (el webhook /api/whatsapp debe ser público; /api/trpc se protege
// en cada procedimiento), estáticos y assets.
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};