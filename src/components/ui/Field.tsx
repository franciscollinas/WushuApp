import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export function Input({ className = "", ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-lg border border-tinta/15 bg-papel-claro px-3 py-2 text-sm text-tinta outline-none transition-colors placeholder:text-tinta/40 focus:border-mantis focus:ring-2 focus:ring-mantis/20 ${className}`}
      {...rest}
    />
  );
}

export function Select({ className = "", ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`w-full rounded-lg border border-tinta/15 bg-papel-claro px-3 py-2 text-sm text-tinta outline-none transition-colors focus:border-mantis focus:ring-2 focus:ring-mantis/20 ${className}`}
      {...rest}
    />
  );
}

export function Textarea({
  className = "",
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`w-full rounded-lg border border-tinta/15 bg-papel-claro px-3 py-2 text-sm text-tinta outline-none transition-colors placeholder:text-tinta/40 focus:border-mantis focus:ring-2 focus:ring-mantis/20 ${className}`}
      {...rest}
    />
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-tinta/60">{label}</span>
      {children}
    </label>
  );
}