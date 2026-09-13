"use client";

import { Send, Sparkles, RotateCcw } from "lucide-react";
import toast from "react-hot-toast";
import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import PageHeader from "@/components/PageHeader";

type Mensaje = {
  rol: "usuario" | "asistente";
  contenido: string;
};

const SUGERENCIAS = [
  "¿Quién tiene más faltas este mes?",
  "Quiero un plan de clase para infantil",
  "¿Qué pagos siguen pendientes?",
  "Crea un recordatorio de pago para WhatsApp",
];

function resaltar(texto: string) {
  const partes = texto.split(/(\*[^*]+\*)/g);
  return partes.map((p, i) =>
    p.startsWith("*") && p.endsWith("*") ? (
      <strong key={i}>{p.slice(1, -1)}</strong>
    ) : (
      <span key={i}>{p}</span>
    )
  );
}

function Burbuja({ mensaje }: { mensaje: Mensaje }) {
  const esUsuario = mensaje.rol === "usuario";
  return (
    <div className={`flex ${esUsuario ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          esUsuario
            ? "rounded-br-md bg-mantis text-papel"
            : "rounded-bl-md border border-tinta/10 bg-papel-claro text-tinta"
        }`}
      >
        {resaltar(mensaje.contenido)}
      </div>
    </div>
  );
}

export default function AsistentePage() {
  const chat = trpc.asistente.chat.useMutation();
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [entrada, setEntrada] = useState("");
  const [pensando, setPensando] = useState(false);
  const finRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes, pensando]);

  const enviar = (texto: string) => {
    const limpio = texto.trim();
    if (!limpio || pensando) return;

    const nuevoMensaje: Mensaje = { rol: "usuario", contenido: limpio };
    const actualizados = [...mensajes, nuevoMensaje];
    setMensajes(actualizados);
    setEntrada("");
    setPensando(true);

    chat.mutate(
      {
        mensaje: limpio,
        historial: mensajes.map((m) => ({ rol: m.rol, contenido: m.contenido })),
      },
      {
        onSuccess: (resultado) => {
          setMensajes((prev) => [
            ...prev,
            { rol: "asistente", contenido: resultado.respuesta },
          ]);
        },
        onError: (e) => {
          toast.error(e.message);
          setMensajes((prev) => [
            ...prev,
            {
              rol: "asistente",
              contenido: `⚠ No pude responder: ${e.message}`,
            },
          ]);
        },
        onSettled: () => setPensando(false),
      }
    );
  };

  const reiniciar = () => {
    setMensajes([]);
    setPensando(false);
    chat.reset();
  };

  return (
    <>
      <PageHeader
        titulo="Mantis Assistant"
        descripcion="Pregunta sobre tus datos escolares: faltas, planes de clase, pagos y más"
        accion={
          mensajes.length > 0 ? (
            <button
              onClick={reiniciar}
              className="inline-flex items-center gap-2 rounded-lg border border-tinta/15 bg-papel-claro px-3 py-2 text-sm font-semibold text-tinta/70 transition-colors hover:text-mantis"
            >
              <RotateCcw className="h-4 w-4" /> Nueva conversación
            </button>
          ) : undefined
        }
      />

      <div className="flex rounded-xl border border-tinta/10 bg-papel-claro">
        <div className="flex-1 p-4">
          {mensajes.length === 0 ? (
            <div className="mx-auto max-w-xl py-10 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border-2 border-dorado bg-mantis text-papel">
                <Sparkles className="h-6 w-6 text-dorado" />
              </div>
              <h2 className="text-lg font-bold text-tinta">Hola, soy Mantis 🥋</h2>
              <p className="mt-2 text-sm text-tinta/60">
                Consulto tu base de datos en tiempo real: asistencia, pagos, biblioteca de
                ejercicios y eventos. Prueba con una de estas preguntas:
              </p>
              <div className="mt-5 flex flex-col gap-2">
                {SUGERENCIAS.map((s) => (
                  <button
                    key={s}
                    onClick={() => enviar(s)}
                    className="rounded-lg border border-tinta/15 bg-papel px-4 py-2.5 text-left text-sm text-tinta/80 transition-colors hover:border-mantis hover:text-mantis"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {mensajes.map((m, i) => (
                <Burbuja key={i} mensaje={m} />
              ))}
              {pensando && (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-md border border-tinta/10 bg-papel-claro px-4 py-3 text-sm text-tinta/50">
                    <span className="inline-flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 animate-pulse text-mantis" />
                      Mantis está consultando tu base de datos…
                    </span>
                  </div>
                </div>
              )}
              <div ref={finRef} />
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <input
          value={entrada}
          onChange={(e) => setEntrada(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") enviar(entrada);
          }}
          placeholder="Pregúntale a Mantis…"
          className="flex-1 rounded-xl border border-tinta/15 bg-papel-claro px-4 py-3 text-sm text-tinta outline-none transition-colors focus:border-mantis"
        />
        <button
          onClick={() => enviar(entrada)}
          disabled={!entrada.trim() || pensando}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-mantis text-papel transition-colors hover:bg-mantis-dark disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Send className="h-5 w-5" />
        </button>
      </div>
    </>
  );
}