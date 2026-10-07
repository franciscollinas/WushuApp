"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { browserSupabase } from "@/lib/supabase-browser";
import { emailDeUsuario } from "@/lib/padres";

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
        // Los padres entran con un usuario (sin @); el personal con su correo.
        email: email.includes("@") ? email.trim() : emailDeUsuario(email),
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-mantis-box.webp"
            alt="Club Mantis Box Sabanalarga"
            width={96}
            height={96}
            className="h-24 w-24 rounded-full"
          />
          <div className="text-center">
            <h1 className="text-2xl font-semibold text-white">Mantis Box Manager</h1>
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
          className="rounded-2xl bg-white p-7 shadow-[0_6px_20px_rgba(0,0,0,0.25)]"
        >
          <label className="mb-1.5 block text-[13px] font-semibold text-tinta/70" htmlFor="email">
            Usuario o correo
          </label>
          <input
            id="email"
            type="text"
            autoCapitalize="none"
            autoCorrect="off"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mb-4 min-h-11 w-full rounded-xl border border-tinta/20 bg-white px-4 py-2.5 text-sm text-tinta outline-none focus:border-mantis focus:ring-2 focus:ring-mantis/25"
            placeholder="usuario"
          />

          <label className="mb-1.5 block text-[13px] font-semibold text-tinta/70" htmlFor="password">
            Contraseña
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mb-6 min-h-11 w-full rounded-xl border border-tinta/20 bg-white px-4 py-2.5 text-sm text-tinta outline-none focus:border-mantis focus:ring-2 focus:ring-mantis/25"
            placeholder="••••••••"
          />

          <button
            type="submit"
            disabled={cargando}
            className="min-h-12 w-full rounded-full bg-mantis px-4 py-3 text-sm font-semibold text-white transition-[background-color,transform] duration-150 hover:bg-mantis-dark active:scale-95 disabled:opacity-60"
          >
            {cargando ? "Entrando…" : "Iniciar sesión"}
          </button>
          <p className="mt-4 text-center text-xs text-tinta/60">
            ¿Olvidaste tu contraseña? Pídesela al club.
          </p>
        </form>
      </div>
    </div>
  );
}