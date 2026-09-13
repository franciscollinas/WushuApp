import { AsyncLocalStorage } from "async_hooks";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Almacén por request: el route handler de /api/trpc crea un cliente con las
// cookies del usuario autenticado (vía @supabase/ssr) y lo guarda aquí. Así las
// consultas de los routers llevan el JWT del usuario y el RLS de Supabase
// aplica — sin tocar una sola línea de la lógica de negocio existente.
export const supabaseStore = new AsyncLocalStorage<SupabaseClient>();

// Cliente auxiliar (anon) para usos fuera de un request (p. ej. resolver la
// escuela por slug en contextos previos al login).
const anonClient = createClient(supabaseUrl, supabaseAnonKey);

function getClient(): SupabaseClient {
  return supabaseStore.getStore() ?? anonClient;
}

// Proxy que reenvía cada acceso al cliente del request actual. Los métodos se
// enlazan al cliente real para que `this` siempre apunte a la instancia de
// Supabase correcta.
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getClient();
    const value = Reflect.get(client, prop, client);
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
}) as SupabaseClient;

export { getClient as getRequestSupabase };