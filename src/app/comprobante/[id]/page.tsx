"use client";

import { ArrowLeft, Printer } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { trpc } from "@/lib/trpc";
import { nombreMes } from "@/lib/pagos";

// El arte del comprobante mide 1024 × 1536 px. Los datos se colocan encima en
// porcentajes de esa imagen, así quedan alineados con los recuadros en cualquier
// tamaño de pantalla o de papel.
const ANCHO = 1024;
const ALTO = 1536;

const pos = (x: number, y: number): CSSProperties => ({
  left: `${(x / ANCHO) * 100}%`,
  top: `${(y / ALTO) * 100}%`,
  transform: "translateY(-50%)",
});

const cop = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

function fechaCorta(iso: string): string {
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}/${m}/${y}` : "";
}

function Campo({ x, y, children, ancho }: { x: number; y: number; children: string; ancho: number }) {
  return (
    <span
      className="absolute truncate font-semibold text-[#10301c]"
      style={{ ...pos(x, y), width: `${(ancho / ANCHO) * 100}%`, fontSize: "2.15cqw" }}
    >
      {children}
    </span>
  );
}

export default function ComprobantePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading, error } = trpc.pago.comprobante.useQuery(id, { retry: false });

  if (isLoading) {
    return <p className="p-8 text-center text-sm text-tinta/60">Preparando comprobante…</p>;
  }
  if (error || !data) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <p className="text-sm font-semibold text-tinta">
          {error?.message ?? "No se encontró el comprobante."}
        </p>
        <button
          type="button"
          onClick={() => router.back()}
          className="mt-4 text-sm font-semibold text-mantis hover:underline"
        >
          Volver
        </button>
      </div>
    );
  }

  const mes = nombreMes(data.mes);
  const valor = cop.format(data.monto);

  return (
    <div className="min-h-screen bg-papel py-6 print:bg-white print:py-0">
      <style>{`@page { size: auto; margin: 6mm; }
@media print { .no-imprimir { display: none !important; } body { background: #fff !important; } }`}</style>

      <div className="no-imprimir mx-auto mb-4 flex max-w-[780px] items-center justify-between px-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-mantis hover:text-mantis-dark"
        >
          <ArrowLeft className="h-4 w-4" /> Volver
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-lg bg-mantis px-4 py-2 text-sm font-semibold text-papel transition-colors hover:bg-mantis-dark"
        >
          <Printer className="h-4 w-4" /> Imprimir
        </button>
      </div>

      <div
        className="relative mx-auto w-full max-w-[780px] bg-white shadow-lg print:max-w-[185mm] print:shadow-none"
        style={{ containerType: "inline-size" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/comprobante-fondo.webp"
          alt="Comprobante de pago de mensualidad, Club Mantis Box Sabanalarga"
          className="block w-full"
        />

        <Campo x={140} y={577} ancho={365}>
          {data.estudiante}
        </Campo>
        <Campo x={140} y={665} ancho={365}>
          {data.grupoNivel}
        </Campo>
        <Campo x={140} y={756} ancho={365}>
          {mes.charAt(0).toUpperCase() + mes.slice(1)}
        </Campo>

        <Campo x={612} y={577} ancho={340}>
          {fechaCorta(data.fechaPago)}
        </Campo>
        <Campo x={616} y={670} ancho={335}>
          {data.metodo}
        </Campo>
        <Campo x={614} y={757} ancho={335}>
          {data.numero}
        </Campo>

        <span
          className="absolute font-bold text-[#10301c]"
          style={{ ...pos(724, 893), fontSize: "2.3cqw" }}
        >
          {valor}
        </span>
        <span
          className="absolute font-extrabold text-[#0b3d1e]"
          style={{ ...pos(724, 958), fontSize: "2.5cqw" }}
        >
          {valor}
        </span>

        {data.observaciones && (
          <p
            className="absolute whitespace-pre-line font-medium text-[#10301c]"
            style={{
              left: `${(90 / ANCHO) * 100}%`,
              top: `${(1076 / ALTO) * 100}%`,
              width: `${(840 / ANCHO) * 100}%`,
              fontSize: "1.9cqw",
              lineHeight: "2.83cqw", // las rayas del recuadro están cada 29 px de 1024
            }}
          >
            {data.observaciones}
          </p>
        )}
      </div>
    </div>
  );
}
