import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/index";
import { supabaseStore } from "@/lib/supabase";
import { createSupabaseFromCookieHeader, obtenerUsuarioRow, serializeCookie } from "@/lib/auth";

const handler = async (req: Request) => {
  const cookiesARefrescar: { name: string; value: string; options?: Parameters<typeof serializeCookie>[2] }[] = [];

  // Cliente Supabase con las cookies del request. El AsyncLocalStorage lo
  // mantiene activo durante todo el ciclo (context + procedimientos), de modo
  // que los routers (que importan `supabase` desde @/lib/supabase) consulten
  // con el JWT del usuario y el RLS aplique — sin tocar su lógica de negocio.
  const supabase = createSupabaseFromCookieHeader(req.headers.get("cookie"), (cookies) => {
    cookiesARefrescar.push(...cookies);
  });

  const response = await supabaseStore.run(supabase, () =>
    fetchRequestHandler({
      endpoint: "/api/trpc",
      req,
      router: appRouter,
      createContext: async () => {
        const client = supabaseStore.getStore() ?? supabase;
        const {
          data: { user },
        } = await client.auth.getUser();

        let usuario = null;
        if (user) {
          usuario = await obtenerUsuarioRow(client, user.id);
        }

        return {
          supabase: client,
          user: user ? { id: user.id, email: user.email } : null,
          usuario,
        };
      },
    })
  );

  // Reenvía las cookies de refresco que el SDK quiso escribir (la renovación
  // del JWT ya la hace también el proxy en su alcance).
  if (cookiesARefrescar.length > 0) {
    const headers = new Headers(response.headers);
    cookiesARefrescar.forEach(({ name, value, options }) => {
      headers.append("Set-Cookie", serializeCookie(name, value, options));
    });
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  return response;
};

export { handler as GET, handler as POST };