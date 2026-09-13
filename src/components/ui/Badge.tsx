import type { ReactNode } from "react";

type Variant = "estado" | "falta" | "ok" | "info";

const styles: Record<Variant, string> = {
  estado: "bg-conteo-claro text-amber-800",
  falta: "bg-falta-claro text-falta",
  ok: "bg-ok-claro text-ok",
  info: "bg-mantis-light/50 text-mantis-dark",
};

export default function Badge({
  children,
  variant = "estado",
}: {
  children: ReactNode;
  variant?: Variant;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles[variant]}`}
    >
      {children}
    </span>
  );
}