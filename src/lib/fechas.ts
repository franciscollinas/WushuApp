// Edad en años cumplidos a una fecha dada (YYYY-MM-DD). Devuelve null si no hay fecha.
export function calcularEdad(nacimiento: string | null | undefined, hoy: string): number | null {
  if (!nacimiento) return null;
  const [y, m, d] = nacimiento.slice(0, 10).split("-").map(Number);
  const [hy, hm, hd] = hoy.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  let edad = hy - y;
  if (hm < m || (hm === m && hd < d)) edad -= 1;
  return edad >= 0 ? edad : null;
}

// 2018-12-21 -> 21/12/2018, sin pasar por Date para evitar desfases de zona horaria.
export function fechaCorta(fecha: string | null | undefined): string {
  if (!fecha) return "";
  const [y, m, d] = fecha.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}
