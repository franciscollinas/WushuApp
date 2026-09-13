"use client";

import {
  LayoutDashboard,
  Users,
  Building2,
  ClipboardCheck,
  Wallet,
  Award,
  BookOpen,
  CalendarDays,
  Sparkles,
  MessageCircle,
  UserCog,
  LogOut,
  CircleDollarSign,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { trpc } from "@/lib/trpc";
import { browserSupabase } from "@/lib/supabase-browser";

const NAV_ADMIN = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/alumnos", label: "Alumnos", icon: Users },
  { href: "/grupos", label: "Grupos", icon: Building2 },
  { href: "/asistencia", label: "Asistencia", icon: ClipboardCheck },
  { href: "/pagos", label: "Pagos", icon: Wallet },
  { href: "/deudas", label: "Deudas", icon: CircleDollarSign },
  { href: "/evaluaciones", label: "Evaluaciones", icon: Award },
  { href: "/biblioteca", label: "Biblioteca", icon: BookOpen },
  { href: "/eventos", label: "Eventos", icon: CalendarDays },
  { href: "/asistente", label: "Mantis", icon: Sparkles },
  { href: "/whatsapp", label: "WhatsApp", icon: MessageCircle },
  { href: "/usuarios", label: "Usuarios", icon: UserCog },
];

const NAV_ENTRENADOR = [
  { href: "/alumnos", label: "Alumnos", icon: Users },
  { href: "/grupos", label: "Grupos", icon: Building2 },
  { href: "/asistencia", label: "Asistencia", icon: ClipboardCheck },
];

const NAV_PADRE = [
  { href: "/portal", label: "Mi Portal", icon: Users },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: mi } = trpc.usuario.miUsuario.useQuery();

  const rol = mi?.usuario.rol;
  const navItems = !mi
    ? []
    : rol === "padre"
      ? NAV_PADRE
      : rol === "entrenador"
        ? NAV_ENTRENADOR
        : NAV_ADMIN;

  const [cerrando, setCerrando] = useState(false);

  async function cerrarSesion() {
    setCerrando(true);
    try {
      await browserSupabase().auth.signOut();
      router.replace("/login");
      router.refresh();
    } catch {
      toast.error("No se pudo cerrar la sesión.");
      setCerrando(false);
    }
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-16 flex-col border-r border-tinta/10 bg-tinta text-papel lg:w-56">
      <div className="flex items-center gap-3 px-4 py-5 lg:px-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-dorado bg-mantis text-xl font-bold text-dorado">
          武
        </div>
        <div className="hidden lg:block">
          <p className="text-sm font-bold leading-tight">Mantis Box</p>
          <p className="text-xs text-papel/60">Sabanalarga</p>
        </div>
      </div>

      <nav className="mt-2 flex flex-1 flex-col gap-1 px-2 lg:px-3">
        {navItems.map((item) => {
          const activo =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={activo ? "page" : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                activo
                  ? "bg-mantis text-papel"
                  : "text-papel/80 hover:bg-papel/10 hover:text-papel"
              }`}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              <span className="hidden lg:inline">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-papel/10 px-3 py-4 lg:px-5">
        <div className="mb-3 hidden lg:block">
          <p className="truncate text-xs font-medium text-papel/80">
            {mi?.usuario.email}
          </p>
          <p className="text-xs capitalize text-papel/50">
            {mi?.usuario.rol ?? "…"}
          </p>
        </div>
        <button
          onClick={cerrarSesion}
          disabled={cerrando}
          title="Cerrar sesión"
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-papel/70 transition-colors hover:bg-papel/10 hover:text-papel disabled:opacity-60"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          <span className="hidden lg:inline">{cerrando ? "Saliendo…" : "Salir"}</span>
        </button>
      </div>
    </aside>
  );
}