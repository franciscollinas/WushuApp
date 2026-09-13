import { firmaValida, verificarWebhook } from "@/lib/whatsapp";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const reto = verificarWebhook(url.searchParams);

  if (!reto) return new Response("Verificación fallida", { status: 403 });
  return new Response(reto, { status: 200 });
}

export async function POST(request: Request) {
  const cuerpo = await request.text();
  const firma = request.headers.get("x-hub-signature-256");

  if (!firmaValida(cuerpo, firma)) {
    return new Response("Firma inválida", { status: 403 });
  }

  // Mensajes entrantes: Meta exige responder 200 rápido.
  // Aquí solo confirmamos la recepción; los webhooks serán procesados
  // cuando las plantillas y el número de negocio estén configurados.
  return new Response(JSON.stringify({ recibido: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}