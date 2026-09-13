"use client";

import { CheckCircle2, MessageCircle, Send, Webhook } from "lucide-react";
import toast from "react-hot-toast";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import PageHeader from "@/components/PageHeader";

export default function WhatsappPage() {
  const { data: estado, refetch } = trpc.whatsapp.estado.useQuery();

  const enviarMensaje = trpc.whatsapp.enviarMensaje.useMutation({
    onSuccess: () => toast.success("Mensaje enviado"),
    onError: (e) => toast.error(e.message),
  });
  const enviarPlantilla = trpc.whatsapp.enviarPlantilla.useMutation({
    onSuccess: () => toast.success("Plantilla enviada"),
    onError: (e) => toast.error(e.message),
  });

  const [telefono, setTelefono] = useState("");
  const [mensaje, setMensaje] = useState("");

  const [tTelefono, setTTelefono] = useState("");
  const [tNombre, setTNombre] = useState("");
  const [tIdioma, setTIdioma] = useState("es");
  const [tTexto, setTTexto] = useState("");

  const itemsEstado: { k: string; v: string }[] = estado
    ? [
        { k: "Token", v: estado.token },
        { k: "ID de teléfono", v: estado.phoneId },
        { k: "App secret", v: estado.appSecret },
        { k: "Verify token", v: estado.verifyToken },
      ]
    : [];

  return (
    <>
      <PageHeader
        titulo="WhatsApp Business"
        descripcion="Estado de la integración y envío de mensajes a padres"
      />

      <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-tinta/10 bg-papel-claro p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-tinta/60">
            <MessageCircle className="h-4 w-4 text-ok" />
            Configuración
          </div>
          <div className="mt-3 flex items-center gap-2">
            {estado?.configurado ? (
              <>
                <Badge variant="ok">Lista</Badge>
                <span className="text-sm text-tinta/60">Todo configurado</span>
              </>
            ) : (
              <>
                <Badge variant="falta">Pendiente</Badge>
                <span className="text-sm text-tinta/60">Completa las variables de entorno</span>
              </>
            )}
          </div>
          <button
            onClick={() => refetch()}
            className="mt-3 text-xs font-semibold text-mantis transition-colors hover:text-mantis-dark"
          >
            Re-evaluar estado
          </button>
        </div>

        <div className="rounded-xl border border-tinta/10 bg-papel-claro p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-tinta/60">
            <Webhook className="h-4 w-4 text-dorado" />
            Webhook
          </div>
          <p className="mt-3 break-all rounded-lg bg-papel px-3 py-2 font-mono text-xs text-tinta/70">
            {estado?.webhookUrl ?? "…"}
          </p>
          <p className="mt-2 text-xs text-tinta/50">
            Regístrala en Meta con el verify token que definiste. Recibe mensajes entrantes.
          </p>
        </div>

        <div className="rounded-xl border border-tinta/10 bg-papel-claro p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-tinta/60">
            <CheckCircle2 className="h-4 w-4 text-ok" />
            Variables
          </div>
          <ul className="mt-3 flex flex-col gap-1.5">
            {itemsEstado.map((i) => (
              <li key={i.k} className="flex items-center justify-between text-sm">
                <span className="text-tinta/60">{i.k}</span>
                <span className={i.v === "definido" ? "text-ok" : "text-falta"}>{i.v}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-tinta/10 bg-papel-claro p-5">
          <h2 className="font-bold text-tinta">Probar envío libre</h2>
          <p className="mt-1 text-xs text-tinta/50">
            Solo dentro de la ventana de 24h tras un mensaje del padre. Para mensajes proactivos usa
            una plantilla aprobada.
          </p>
          <div className="mt-4 flex flex-col gap-3">
            <Field label="Teléfono (sin 57)">
              <Input
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="3012345678"
                inputMode="tel"
              />
            </Field>
            <Field label="Mensaje">
              <Textarea
                rows={4}
                value={mensaje}
                onChange={(e) => setMensaje(e.target.value)}
                placeholder="Hola, por favor recuerda el pago de la mensualidad…"
              />
            </Field>
            <Button
              onClick={() => enviarMensaje.mutate({ telefono, mensaje })}
              disabled={!telefono || !mensaje || enviarMensaje.isPending}
            >
              <Send className="h-4 w-4" />
              {enviarMensaje.isPending ? "Enviando…" : "Enviar mensaje"}
            </Button>
          </div>
        </section>

        <section className="rounded-xl border border-tinta/10 bg-papel-claro p-5">
          <h2 className="font-bold text-tinta">Enviar plantilla</h2>
          <p className="mt-1 text-xs text-tinta/50">
            Las plantillas se aprueban en Meta Business Manager; con este form las envías con
            parámetros.
          </p>
          <div className="mt-4 flex flex-col gap-3">
            <Field label="Teléfono (sin 57)">
              <Input
                value={tTelefono}
                onChange={(e) => setTTelefono(e.target.value)}
                placeholder="3012345678"
                inputMode="tel"
              />
            </Field>
            <Field label="Nombre de la plantilla">
              <Input
                value={tNombre}
                onChange={(e) => setTNombre(e.target.value)}
                placeholder="recordatorio_pago"
              />
            </Field>
            <Field label="Idioma">
              <Select value={tIdioma} onChange={(e) => setTIdioma(e.target.value)}>
                <option value="es">es</option>
                <option value="es_CO">es_CO</option>
                <option value="en">en</option>
              </Select>
            </Field>
            <Field label="Texto para el parámetro body (opcional)">
              <Input
                value={tTexto}
                onChange={(e) => setTTexto(e.target.value)}
                placeholder="Lo que ocupará {{1}} en la plantilla"
              />
            </Field>
            <Button
              onClick={() =>
                enviarPlantilla.mutate({
                  telefono: tTelefono,
                  nombre: tNombre,
                  idioma: tIdioma,
                  componentes: tTexto
                    ? [{ type: "body", parameters: [{ type: "text", text: tTexto }] }]
                    : [],
                })
              }
              disabled={!tTelefono || !tNombre || enviarPlantilla.isPending}
            >
              <CheckCircle2 className="h-4 w-4" />
              {enviarPlantilla.isPending ? "Enviando…" : "Enviar plantilla"}
            </Button>
          </div>
        </section>
      </div>
    </>
  );
}