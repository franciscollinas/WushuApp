import type { ReactNode } from "react";

export default function KPI({
  label,
  valor,
  icono,
  detalle,
}: {
  label: string;
  valor: string;
  icono?: ReactNode;
  detalle?: string;
}) {
  return (
    <div className="rounded-xl bg-papel-claro p-5 shadow-[var(--sombra-md)]">
      <div className="flex items-center gap-2 text-sm font-semibold text-tinta/60">
        {icono}
        {label}
      </div>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-tinta">{valor}</p>
      {detalle && <p className="mt-1 text-xs text-tinta/50">{detalle}</p>}
    </div>
  );
}