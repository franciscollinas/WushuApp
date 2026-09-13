import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primario" | "secundario" | "peligro" | "ok" | "fantasma";

const styles: Record<Variant, string> = {
  primario: "bg-mantis text-papel hover:bg-mantis-dark",
  secundario: "border border-tinta/20 bg-papel-claro text-tinta hover:bg-papel",
  peligro: "bg-falta text-papel hover:opacity-90",
  ok: "bg-ok text-papel hover:opacity-90",
  fantasma: "text-mantis hover:bg-mantis-light/40",
};

type Size = "sm" | "md" | "lg";

const sizeStyles: Record<Size, string> = {
  sm: "px-2.5 py-1 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-2.5 text-base",
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

export default function Button({
  variant = "primario",
  size = "md",
  className = "",
  children,
  ...rest
}: Props) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${sizeStyles[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}