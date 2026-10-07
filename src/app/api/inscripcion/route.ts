import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";

// ── Configuración ────────────────────────────────────────────────────────────
// Orígenes permitidos (CORS), separados por coma.
// Ej: "https://mantisbox.com,https://x.lovable.app"
const ORIGENES = (process.env.INSCRIPCION_ORIGIN ?? "https://dojo-design-buddy.lovable.app")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
const VENTANA_MS = 60 * 60 * 1000; // 1 hora
const MAX_POR_IP = 10; // solicitudes por IP por ventana (en memoria: freno básico)
const MAX_PROSPECTOS_POR_HORA = 30; // tope global persistente (en BD)

// ── Anti-bots ────────────────────────────────────────────────────────────────
const solicitudesPorIp = new Map<string, number[]>();

function ipDe(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  return fwd ? fwd.split(",")[0].trim() : "desconocida";
}

function rateLimitPermitido(ip: string): boolean {
  const ahora = Date.now();
  const recientes = (solicitudesPorIp.get(ip) ?? []).filter((t) => ahora - t < VENTANA_MS);
  if (recientes.length >= MAX_POR_IP) {
    solicitudesPorIp.set(ip, recientes);
    return false;
  }
  recientes.push(ahora);
  solicitudesPorIp.set(ip, recientes);
  return true;
}

// Cloudflare Turnstile: si TURNSTILE_SECRET_KEY está definida, el token es
// obligatorio. Sin la variable, el captcha queda desactivado (compatible con
// la landing actual hasta que se agregue el widget).
async function captchaValido(token: string | undefined, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
    });
    const datos = (await res.json()) as { success?: boolean };
    return datos.success === true;
  } catch {
    return false;
  }
}

// ── Validación ───────────────────────────────────────────────────────────────
const inscripcionSchema = z.object({
  website: z.string().max(0).optional(), // honeypot: debe ir vacío
  turnstile_token: z.string().max(2048).optional(),
  estudiante: z.string().trim().min(3).max(80),
  fecha_nacimiento: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((f) => {
      const t = new Date(`${f}T00:00:00`).getTime();
      return !Number.isNaN(t) && t <= Date.now() && new Date(f).getFullYear() > 1920;
    }),
  genero: z.enum(["masculino", "femenino", "otro"]),
  documento: z.string().trim().min(4).max(30),
  peso_kg: z.coerce.number().positive().max(400).optional(),
  nombre_acudiente: z.string().trim().min(3).max(80),
  telefono: z.string().trim().min(7).max(20),
  email: z.string().trim().toLowerCase().email().max(120),
});

// ── Utilidades de respuesta ──────────────────────────────────────────────────
function corsHeaders(origin: string | null): HeadersInit {
  const permitido = origin && ORIGENES.includes(origin) ? origin : ORIGENES[0];
  return {
    "Access-Control-Allow-Origin": permitido,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "600",
    "Access-Control-Allow-Credentials": "false",
    Vary: "Origin",
  };
}

function json(respuesta: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(respuesta), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

function categoriaDesdeFecha(fecha: string): "infantil" | "juvenil" | "adulto" {
  const hoy = new Date();
  const fn = new Date(`${fecha}T00:00:00`);
  let edad = hoy.getFullYear() - fn.getFullYear();
  const m = hoy.getMonth() - fn.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < fn.getDate())) edad--;
  if (edad < 12) return "infantil";
  if (edad <= 14) return "juvenil";
  return "adulto";
}

export async function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(request.headers.get("origin")) });
}

// ── Endpoint público ─────────────────────────────────────────────────────────
// Solo registra un PROSPECTO. No crea cuentas ni alumnos activos: el admin
// revisa la solicitud y la aprueba desde /alumnos (ahí se invita al acudiente).
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const ip = ipDe(request);

  let crudo: Record<string, unknown>;
  try {
    crudo = await request.json();
  } catch {
    return json({ error: "Cuerpo inválido." }, 400, origin);
  }

  if (crudo.website) {
    // Honeypot: los bots suelen rellenar el campo trampa. Fingimos éxito.
    return json({ exito: true }, 201, origin);
  }

  if (!rateLimitPermitido(ip)) {
    return json({ error: "Demasiadas solicitudes, intenta más tarde." }, 429, origin);
  }

  const parsed = inscripcionSchema.safeParse(crudo);
  if (!parsed.success) {
    return json({ error: "Algunos campos no son válidos. Revísalos e intenta de nuevo." }, 400, origin);
  }
  const input = parsed.data;

  if (!(await captchaValido(input.turnstile_token, ip))) {
    return json({ error: "No pudimos verificar que eres una persona. Intenta de nuevo." }, 400, origin);
  }

  const slug = process.env.ESCUELA_SLUG;
  if (!slug) {
    return json({ error: "Servidor mal configurado." }, 500, origin);
  }

  let admin;
  try {
    admin = supabaseAdmin();
  } catch {
    return json({ error: "Servidor mal configurado." }, 500, origin);
  }

  const { data: escuela } = await admin
    .from("escuela")
    .select("id, activa")
    .eq("slug", slug)
    .maybeSingle();
  if (!escuela?.activa) {
    return json({ error: "Escuela no configurada." }, 500, origin);
  }
  const escuelaId = (escuela as { id: string }).id;

  // Tope global persistente: frena una inundación aunque cambien de IP.
  const desde = new Date(Date.now() - VENTANA_MS).toISOString();
  const { count: recientes } = await admin
    .from("alumno")
    .select("id", { count: "exact", head: true })
    .eq("escuela_id", escuelaId)
    .eq("estado", "prospecto")
    .gte("created_at", desde);
  if ((recientes ?? 0) >= MAX_PROSPECTOS_POR_HORA) {
    return json({ error: "Estamos recibiendo muchas solicitudes. Intenta más tarde." }, 429, origin);
  }

  // Duplicado por documento. No se revela de quién es el registro existente.
  const { data: existente } = await admin
    .from("alumno")
    .select("id")
    .eq("escuela_id", escuelaId)
    .eq("documento", input.documento)
    .maybeSingle();
  if (existente) {
    return json(
      { error: "Ya existe un registro con ese documento. El club te contactará para confirmarlo." },
      409,
      origin
    );
  }

  const { error } = await admin.from("alumno").insert({
    escuela_id: escuelaId,
    nombre: input.estudiante,
    fecha_nacimiento: input.fecha_nacimiento,
    categoria: categoriaDesdeFecha(input.fecha_nacimiento),
    nivel_cinta: "",
    fecha_ingreso: null,
    estado: "prospecto",
    documento: input.documento,
    genero: input.genero,
    peso_kg: input.peso_kg ?? null,
    padre_nombre: input.nombre_acudiente,
    padre_telefono: input.telefono,
    padre_email: input.email,
    notas: "Registro vía formulario web",
  });
  if (error) {
    return json({ error: "No se pudo guardar el registro. Intenta más tarde." }, 500, origin);
  }

  return json(
    { exito: true, mensaje: "¡Registro recibido! El club revisará tu solicitud y te contactará." },
    201,
    origin
  );
}
