import type { SupabaseClient } from "@supabase/supabase-js";

// La regla de "al día" (becados, acceso manual, día límite del grupo, pagos
// semanales y parciales) vive en la función SQL `alumno_al_dia`, la misma que usan
// las políticas de seguridad. Así el portal y la base de datos nunca discrepan.

const pad = (n: number) => String(n).padStart(2, "0");

export const DIA_LIMITE_POR_DEFECTO = 5;

// Primer mes cubierto por la app. Los padres solo ven y generan comprobantes desde
// este mes; lo anterior se manejaba antes de la app y no está registrado en ella.
export const MES_INICIO_APP = "2026-10";

// Meses (YYYY-MM) desde `inicio` hasta `hasta`, del más reciente al más antiguo.
export function mesesDesde(inicio: string, hasta: string): string[] {
  const lista: string[] = [];
  let [y, m] = hasta.split("-").map(Number);
  const [yi, mi] = inicio.split("-").map(Number);
  while (y > yi || (y === yi && m >= mi)) {
    lista.push(`${y}-${pad(m)}`);
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
  }
  return lista;
}

export function mesesDe(hoy: string, diaLimite = DIA_LIMITE_POR_DEFECTO): {
  mesActual: string;
  mesReferencia: string;
} {
  const [y, m, d] = hoy.split("-").map(Number);
  const mesActual = `${y}-${pad(m)}`;
  const anterior = m === 1 ? `${y - 1}-12` : `${y}-${pad(m - 1)}`;
  return { mesActual, mesReferencia: d >= diaLimite ? mesActual : anterior };
}

// Consulta la función SQL con un cliente de servicio (no depende del usuario).
export async function alumnoAlDia(admin: SupabaseClient, alumnoId: string): Promise<boolean> {
  const { data, error } = await admin.rpc("alumno_al_dia", { p_alumno: alumnoId });
  if (error) throw new Error(error.message);
  return data === true;
}

export function nombreMes(mes: string): string {
  const [y, m] = mes.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("es-CO", { month: "long", year: "numeric" });
}
