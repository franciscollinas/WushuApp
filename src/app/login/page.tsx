"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { browserSupabase } from "@/lib/supabase-browser";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cargando, setCargando] = useState(false);

  // Mientras .env.local no tenga un proyecto real, el login no puede funcionar:
  // avisarlo en la propia pantalla en lugar de dejar un formulario "mudo".
  const supabaseNoConfigurado = (
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
  ).includes("tu-proyecto") || (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").includes("your-project");

  async function iniciarSesion(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    try {
      const { error } = await browserSupabase().auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      // El proxy redirige por rol (entrenador → /asistencia, admin → /).
      router.replace("/");
      router.refresh();
    } catch (err) {
      const mensaje =
        err instanceof Error && err.message
          ? err.message
          : "No se pudo iniciar sesión. Revisa tus credenciales.";
      toast.error(mensaje);
      setCargando(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-tinta px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-dorado bg-mantis text-2xl font-bold text-dorado">
            武
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-papel">Mantis Box Manager</h1>
            <p className="text-sm text-papel/60">Sabanalarga</p>
          </div>
        </div>

        {supabaseNoConfigurado && (
          <div className="mb-6 rounded-xl border border-dorado/50 bg-dorado/10 p-4 text-sm text-papel">
            <p className="mb-1 font-semibold text-dorado">Falta conectar Supabase</p>
            <p>
              El login aparecerá cuando pegues tu URL y anon key reales en{" "}
              <code className="rounded bg-papel/10 px-1">.env.local</code> (dónde sacarlas está
              escrito en ese mismo archivo) y reinicies el servidor.
            </p>
          </div>
        )}

        <form
          onSubmit={iniciarSesion}
          className="rounded-xl border border-papel/10 bg-papel/5 p-6 shadow-xl"
        >
          <label className="mb-1 block text-sm text-papel/80" htmlFor="email">
            Correo electrónico
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mb-4 w-full rounded-lg border border-papel/20 bg-papel px-3 py-2 text-sm text-tinta outline-none focus:border-dorado"
            placeholder="tucorreo@escuela.com"
          />

          <label className="mb-1 block text-sm text-papel/80" htmlFor="password">
            Contraseña
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mb-6 w-full rounded-lg border border-papel/20 bg-papel px-3 py-2 text-sm text-tinta outline-none focus:border-dorado"
            placeholder="••••••••"
          />

          <button
            type="submit"
            disabled={cargando}
            className="w-full rounded-lg bg-mantis px-3 py-2.5 text-sm font-semibold text-papel transition-colors hover:bg-mantis-dark disabled:opacity-60"
          >
            {cargando ? "Entrando…" : "Iniciar sesión"}
          </button>
        </form>
      </div>
    </div>
  );
}