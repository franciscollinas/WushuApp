import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

let cached: ReturnType<typeof createBrowserClient> | null = null;

// Crea (y cachea) el cliente de Supabase para el navegador. La sesión se
// persiste en cookies; por eso el siguiente request del App Router ya trae la
// sesión en las cabeceras y el proxy/server lo leen sin almacenamiento local.
export function browserSupabase() {
  if (!cached) {
    cached = createBrowserClient(supabaseUrl, supabaseAnonKey);
  }
  return cached;
}