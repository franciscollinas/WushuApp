import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Cliente con service-role: se salta el RLS. SOLO para código de servidor que
// ya validó quién es el llamador (adminProcedure o el endpoint público de
// inscripción). Nunca importarlo desde un componente de cliente.
export function supabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Servidor mal configurado (faltan credenciales de Supabase).");
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
