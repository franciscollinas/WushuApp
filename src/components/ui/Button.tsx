import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primario" | "secundario" | "peligro" | "ok" | "fantasma";

const styles: Record<Variant, string> = {
  primario: "bg-mantis text-white hover:bg-mantis-dark",
  secundario: "border border-mantis bg-transparent text-mantis hover:bg-mantis-light/50",
  peligro: "bg-falta text-white hover:opacity-90",
  ok: "bg-mantis text-white hover:bg-mantis-dark",
  fantasma: "text-mantis hover:bg-mantis-light/50",
};

type Size = "sm" | "md" | "lg";

const sizeStyles: Record<Size, string> = {
  sm: "min-h-9 px-3.5 py-1.5 text-xs",
  md: "min-h-11 px-5 py-2.5 text-sm",
  lg: "min-h-12 px-6 py-3 text-base",
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
      className={`inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-[background-color,transform,opacity] duration-150 active:scale-95 motion-reduce:transform-none disabled:cursor-not-allowed disabled:opacity-40 ${styles[variant]} ${sizeStyles[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}