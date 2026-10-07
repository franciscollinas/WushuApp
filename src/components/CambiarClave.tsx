"use client";

import { KeyRound } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { browserSupabase } from "@/lib/supabase-browser";

// El padre cambia su propia contraseña. Si la olvida, no hay recuperación por
// correo: debe pedírsela al club, que le genera una nueva.
export default function CambiarClave() {
  const [abierto, setAbierto] = useState(false);
  const [clave, setClave] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [guardando, setGuardando] = useState(false);

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (clave.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (clave !== confirmar) {
      toast.error("Las contraseñas no coinciden.");
      return;
    }
    setGuardando(true);
    const { error } = await browserSupabase().auth.updateUser({ password: clave });
    setGuardando(false);
    if (error) {
      toast.error(error.message || "No se pudo cambiar la contraseña.");
      return;
    }
    toast.success("Contraseña actualizada");
    setClave("");
    setConfirmar("");
    setAbierto(false);
  };

  const inputClass =
    "w-full rounded-lg border border-tinta/15 bg-papel px-3 py-2 text-sm text-tinta outline-none focus:border-dorado";

  return (
    <div className="rounded-xl border border-tinta/10 bg-papel-claro p-4">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="flex w-full items-center gap-2 text-left text-sm font-semibold text-tinta"
        aria-expanded={abierto}
      >
        <KeyRound className="h-4 w-4 text-dorado" />
        Cambiar mi contraseña
      </button>

      {abierto && (
        <form onSubmit={guardar} className="mt-4 space-y-3">
          <div>
            <label htmlFor="clave-nueva" className="mb-1 block text-xs text-tinta/60">
              Contraseña nueva
            </label>
            <input
              id="clave-nueva"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={clave}
              onChange={(e) => setClave(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="clave-confirmar" className="mb-1 block text-xs text-tinta/60">
              Repite la contraseña
            </label>
            <input
              id="clave-confirmar"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
              className={inputClass}
            />
          </div>
          <p className="text-xs text-tinta/50">
            Si olvidas tu contraseña, pídele una nueva al club.
          </p>
          <button
            type="submit"
            disabled={guardando}
            className="rounded-lg bg-mantis px-4 py-2 text-sm font-semibold text-papel transition-colors hover:bg-mantis-dark disabled:opacity-60"
          >
            {guardando ? "Guardando…" : "Guardar contraseña"}
          </button>
        </form>
      )}
    </div>
  );
}
