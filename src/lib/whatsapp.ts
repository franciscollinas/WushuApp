import { createHmac, timingSafeEqual } from "crypto";

export type ResultadoWhatsApp =
  | { ok: true; id: string }
  | { ok: false; error: string };

const API_VERSION = process.env.WHATSAPP_API_VERSION ?? "v22.0";

export function whatsappConfigurado(): boolean {
  return Boolean(
    process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID
  );
}

function telefonoLimpio(telefono: string): string {
  return `57${telefono.replace(/[^\d]/g, "")}`;
}

function urlMensajes(): string {
  return `https://graph.facebook.com/${API_VERSION}/${process.env.WHATSAPP_PHONE_ID}/messages`;
}

export async function enviarTexto(
  telefono: string,
  texto: string
): Promise<ResultadoWhatsApp> {
  if (!whatsappConfigurado()) {
    return {
      ok: false,
      error: "WhatsApp API no configurada. Revisa WHATSAPP_TOKEN y WHATSAPP_PHONE_ID.",
    };
  }

  try {
    const res = await fetch(urlMensajes(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: telefonoLimpio(telefono),
        type: "text",
        text: { body: texto },
      }),
    });

    const datos = (await res.json().catch(() => ({}))) as {
      messages?: { id: string }[];
      error?: { message: string };
    };

    if (!res.ok || datos.error) {
      return { ok: false, error: datos.error?.message ?? `HTTP ${res.status}` };
    }
    return { ok: true, id: datos.messages?.[0]?.id ?? "" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error de red" };
  }
}

export interface ComponentePlantilla {
  type: "body" | "header" | "button";
  parameters?: { type: string; text?: string }[];
}

export async function enviarPlantilla(
  telefono: string,
  nombre: string,
  idioma: string,
  componentes: ComponentePlantilla[] = []
): Promise<ResultadoWhatsApp> {
  if (!whatsappConfigurado()) {
    return {
      ok: false,
      error: "WhatsApp API no configurada. Revisa WHATSAPP_TOKEN y WHATSAPP_PHONE_ID.",
    };
  }

  try {
    const res = await fetch(urlMensajes(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: telefonoLimpio(telefono),
        type: "template",
        template: {
          name: nombre,
          language: { code: idioma },
          components: componentes,
        },
      }),
    });

    const datos = (await res.json().catch(() => ({}))) as {
      messages?: { id: string }[];
      error?: { message: string };
    };

    if (!res.ok || datos.error) {
      return { ok: false, error: datos.error?.message ?? `HTTP ${res.status}` };
    }
    return { ok: true, id: datos.messages?.[0]?.id ?? "" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error de red" };
  }
}

// Handshake de verificación: Meta llama este GET al registrar el webhook.
export function verificarWebhook(query: URLSearchParams): string | null {
  const modo = query.get("hub.mode");
  const token = query.get("hub.verify_token");
  const reto = query.get("hub.challenge");

  if (
    modo === "subscribe" &&
    token &&
    token === process.env.WHATSAPP_VERIFY_TOKEN
  ) {
    return reto;
  }
  return null;
}

// Valida la firma X-Hub-Signature-256 (requiere WHATSAPP_APP_SECRET).
export function firmaValida(
  cuerpo: string,
  firmaEncabezado: string | null
): boolean {
  const secreto = process.env.WHATSAPP_APP_SECRET;
  if (!secreto || !firmaEncabezado) return false;

  const esperada = createHmac("sha256", secreto).update(cuerpo).digest("hex");
  const recibida = firmaEncabezado.startsWith("sha256=")
    ? firmaEncabezado.slice(7)
    : firmaEncabezado;

  try {
    const a = Buffer.from(esperada, "hex");
    const b = Buffer.from(recibida, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}