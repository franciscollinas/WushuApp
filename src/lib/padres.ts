// Utilidades de cuentas de padres. La app NO envía correos: el padre inicia
// sesión con un usuario y una contraseña que entrega el club. Supabase Auth
// exige un correo, así que se usa uno interno derivado del usuario.

export const PADRES_EMAIL_DOMAIN =
  process.env.NEXT_PUBLIC_PADRES_EMAIL_DOMAIN ?? "mantis-box.vercel.app";

export const USERNAME_REGEX = /^[a-z0-9._-]{4,30}$/;

export function normalizarUsername(u: string): string {
  return u.trim().toLowerCase();
}

export function emailDeUsuario(username: string): string {
  return `${normalizarUsername(username)}@${PADRES_EMAIL_DOMAIN}`;
}

// Sin 0/O, 1/I/L para que se pueda dictar o leer sin errores.
const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function aleatorio(longitud: number, alfabeto: string): string {
  const bytes = new Uint32Array(longitud);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alfabeto[b % alfabeto.length]).join("");
}

export function generarCodigoInscripcion(): string {
  return `MB-${aleatorio(4, ALFABETO)}`;
}

export function generarClave(): string {
  return aleatorio(8, ALFABETO.toLowerCase() + "23456789");
}

// Fecha de hoy (YYYY-MM-DD) en hora de Colombia.
export function hoyColombia(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
}
