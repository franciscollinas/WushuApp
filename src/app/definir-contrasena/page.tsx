"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { browserSupabase } from "@/lib/supabase-browser";

type Fase = "verificando" | "listo" | "invalido";

// Destino de los enlaces de invitación (aprobación de inscripción) y de
// recuperación de contraseña. Establece la sesión a partir del enlace y deja
// al usuario definir su contraseña.
export default function DefinirContrasenaPage() {
  const router = useRouter();
  const [fase, setFase] = useState<Fase>("verificando");
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    const supabase = browserSupabase();
    let cancelado = false;

    async function iniciar() {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const accessToken = hash.get("access_token");
        const refreshToken = hash.get("refresh_token");

        // Recuperación de contraseña (PKCE): llega ?code=...
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (accessToken && refreshToken) {
          // Invitación: el enlace trae los tokens en el fragmento (#).
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
        }

        // Quita los tokens de la barra de direcciones.
        window.history.replaceState(null, "", url.pathname);

        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!cancelado) setFase(user ? "listo" : "invalido");
      } catch {
        if (!cancelado) setFase("invalido");
      }
    }

    iniciar();
    return () => {
      cancelado = true;
    };
  }, []);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirmar) {
      toast.error("Las contraseñas no coinciden.");
      return;
    }
    setGuardando(true);
    const { error } = await browserSupabase().auth.updateUser({ password });
    if (error) {
      toast.error(error.message || "No se pudo guardar la contraseña.");
      setGuardando(false);
      return;
    }
    toast.success("Contraseña guardada");
    // El proxy redirige según el rol (padre → /portal).
    router.replace("/");
    router.refresh();
  }

  const inputClass =
    "mb-4 w-full rounded-lg border border-papel/20 bg-papel px-3 py-2 text-sm text-tinta outline-none focus:border-dorado";

  return (
    <div className="flex min-h-screen items-center justify-center bg-tinta px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-center text-xl font-bold text-papel">Define tu contraseña</h1>

        {fase === "verificando" && (
          <p className="text-center text-sm text-papel/70">Verificando tu enlace…</p>
        )}

        {fase === "invalido" && (
          <div className="rounded-xl border border-papel/10 bg-papel/5 p-6 text-sm text-papel">
            <p>El enlace no es válido o ya venció. Solicita uno nuevo.</p>
            <Link href="/recuperar" className="mt-4 inline-block text-dorado hover:underline">
              Enviarme un enlace nuevo
            </Link>
          </div>
        )}

        {fase === "listo" && (
          <form
            onSubmit={guardar}
            className="rounded-xl border border-papel/10 bg-papel/5 p-6 shadow-xl"
          >
            <label className="mb-1 block text-sm text-papel/80" htmlFor="password">
              Contraseña nueva
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
            <label className="mb-1 block text-sm text-papel/80" htmlFor="confirmar">
              Repite la contraseña
            </label>
            <input
              id="confirmar"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
              className={inputClass}
            />
            <button
              type="submit"
              disabled={guardando}
              className="w-full rounded-lg bg-mantis px-3 py-2.5 text-sm font-semibold text-papel transition-colors hover:bg-mantis-dark disabled:opacity-60"
            >
              {guardando ? "Guardando…" : "Guardar y entrar"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
