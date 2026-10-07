// Reglas de mensualidad y bloqueo. Misma lógica que la función SQL
// `alumno_al_dia` (migración 007): el mes de referencia es el mes en curso desde
// el día 5, y antes del 5 es el mes anterior.

const pad = (n: number) => String(n).padStart(2, "0");

export const DIA_LIMITE_PAGO = 5;

export function mesesDe(hoy: string): { mesActual: string; mesReferencia: string } {
  const [y, m, d] = hoy.split("-").map(Number);
  const mesActual = `${y}-${pad(m)}`;
  const anterior = m === 1 ? `${y - 1}-12` : `${y}-${pad(m - 1)}`;
  return { mesActual, mesReferencia: d >= DIA_LIMITE_PAGO ? mesActual : anterior };
}

// ingreso: fecha de ingreso (o de creación) del alumno, YYYY-MM-DD.
export function estaAlDia(
  hoy: string,
  ingreso: string,
  mesesPagados: Iterable<string>
): boolean {
  const { mesReferencia } = mesesDe(hoy);
  if (ingreso.slice(0, 7) > mesReferencia) return true;
  for (const m of mesesPagados) if (m === mesReferencia) return true;
  return false;
}

export function nombreMes(mes: string): string {
  const [y, m] = mes.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("es-CO", { month: "long", year: "numeric" });
}
