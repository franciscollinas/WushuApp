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
    <div className="rounded-xl border border-tinta/10 bg-papel-claro p-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-tinta/60">
        {icono}
        {label}
      </div>
      <p className="mt-2 text-3xl font-extrabold tracking-tight text-tinta">{valor}</p>
      {detalle && <p className="mt-1 text-xs text-tinta/50">{detalle}</p>}
    </div>
  );
}