import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export function Input({ className = "", ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full min-h-11 rounded-xl border border-tinta/20 bg-papel-claro px-4 py-2.5 text-sm text-tinta outline-none transition-colors placeholder:text-tinta/40 focus:border-mantis focus:ring-2 focus:ring-mantis/25 ${className}`}
      {...rest}
    />
  );
}

export function Select({ className = "", ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`w-full min-h-11 rounded-xl border border-tinta/20 bg-papel-claro px-4 py-2.5 text-sm text-tinta outline-none transition-colors focus:border-mantis focus:ring-2 focus:ring-mantis/25 ${className}`}
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
      className={`w-full min-h-11 rounded-xl border border-tinta/20 bg-papel-claro px-4 py-2.5 text-sm text-tinta outline-none transition-colors placeholder:text-tinta/40 focus:border-mantis focus:ring-2 focus:ring-mantis/25 ${className}`}
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
      <span className="text-[13px] font-semibold text-tinta/70">{label}</span>
      {children}
    </label>
  );
}