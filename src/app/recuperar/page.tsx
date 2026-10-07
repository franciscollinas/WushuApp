"use client";

import Link from "next/link";
import { useState } from "react";
import toast from "react-hot-toast";
import { browserSupabase } from "@/lib/supabase-browser";

export default function RecuperarPage() {
  const [email, setEmail] = useState("");
  const [cargando, setCargando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    try {
      const { error } = await browserSupabase().auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/definir-contrasena`,
      });
      if (error) throw error;
      // Mismo mensaje exista o no la cuenta: no revela qué correos están registrados.
      setEnviado(true);
    } catch {
      toast.error("No se pudo enviar el correo. Intenta de nuevo en unos minutos.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-tinta px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-center text-xl font-bold text-papel">Recuperar contraseña</h1>

        {enviado ? (
          <div className="rounded-xl border border-papel/10 bg-papel/5 p-6 text-sm text-papel">
            <p>
              Si el correo está registrado, te enviamos un enlace para definir una contraseña
              nueva. Revisa también la carpeta de spam.
            </p>
            <Link href="/login" className="mt-4 inline-block text-dorado hover:underline">
              Volver a iniciar sesión
            </Link>
          </div>
        ) : (
          <form
            onSubmit={enviar}
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
              className="mb-6 w-full rounded-lg border border-papel/20 bg-papel px-3 py-2 text-sm text-tinta outline-none focus:border-dorado"
              placeholder="tucorreo@ejemplo.com"
            />
            <button
              type="submit"
              disabled={cargando}
              className="w-full rounded-lg bg-mantis px-3 py-2.5 text-sm font-semibold text-papel transition-colors hover:bg-mantis-dark disabled:opacity-60"
            >
              {cargando ? "Enviando…" : "Enviar enlace"}
            </button>
            <Link
              href="/login"
              className="mt-4 block text-center text-sm text-papel/60 hover:text-papel"
            >
              Volver
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
