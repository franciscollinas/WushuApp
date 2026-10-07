// Color del perfil del alumno según su cinta. Se reconoce por palabra clave en
// el nombre de la cinta (sin importar mayúsculas ni tildes).

export interface TemaCinta {
  nombre: string;
  fondo: string; // color principal de la cinta
  texto: string; // color legible sobre `fondo`
  suave: string; // fondo claro para tarjetas
}

const TEMAS: { clave: RegExp; tema: TemaCinta }[] = [
  { clave: /negr/, tema: { nombre: "Negra", fondo: "#171717", texto: "#ffffff", suave: "#e5e5e5" } },
  { clave: /marr|cafe|caf[eé]/, tema: { nombre: "Marrón", fondo: "#78350f", texto: "#ffffff", suave: "#f5e6d8" } },
  { clave: /roj/, tema: { nombre: "Roja", fondo: "#dc2626", texto: "#ffffff", suave: "#fde2e2" } },
  { clave: /moro|morad|violet|purpur/, tema: { nombre: "Morada", fondo: "#7e22ce", texto: "#ffffff", suave: "#f0e1fb" } },
  { clave: /azul/, tema: { nombre: "Azul", fondo: "#2563eb", texto: "#ffffff", suave: "#dbe7fd" } },
  { clave: /verd/, tema: { nombre: "Verde", fondo: "#16a34a", texto: "#ffffff", suave: "#d9f4e2" } },
  { clave: /naranj/, tema: { nombre: "Naranja", fondo: "#ea580c", texto: "#ffffff", suave: "#fde6d6" } },
  { clave: /amarill/, tema: { nombre: "Amarilla", fondo: "#facc15", texto: "#422006", suave: "#fdf3bf" } },
  { clave: /blanc/, tema: { nombre: "Blanca", fondo: "#f5f5f4", texto: "#292524", suave: "#fafaf9" } },
];

const SIN_CINTA: TemaCinta = {
  nombre: "Sin asignar",
  fondo: "#a8a29e",
  texto: "#ffffff",
  suave: "#f5f5f4",
};

function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function temaCinta(nivel: string | null | undefined): TemaCinta {
  if (!nivel) return SIN_CINTA;
  const n = normalizar(nivel);
  return TEMAS.find((t) => t.clave.test(n))?.tema ?? SIN_CINTA;
}

export function mismaCinta(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return normalizar(a).trim() === normalizar(b).trim();
}
