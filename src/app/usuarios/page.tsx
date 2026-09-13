"use client";

import toast from "react-hot-toast";
import { trpc } from "@/lib/trpc";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import PageHeader from "@/components/PageHeader";
import { Info, UserCheck, X } from "lucide-react";
import { useState } from "react";
import type { RolUsuario } from "@/types/supabase";

export default function UsuariosPage() {
  const utils = trpc.useUtils();
  const { data: usuarios } = trpc.usuario.list.useQuery();
  const { data: alumnos } = trpc.alumno.list.useQuery();
  const { data: mi } = trpc.usuario.miUsuario.useQuery();

  const [reemplazo, setReemplazo] = useState<Record<string, RolUsuario>>({});
  const [alumnoSeleccionado, setAlumnoSeleccionado] = useState<Record<string, string>>({});

  const cambiarRol = trpc.usuario.cambiarRol.useMutation({
    onSuccess: () => {
      toast.success("Rol actualizado");
      utils.usuario.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const vincular = trpc.usuario.vincularAlumno.useMutation({
    onSuccess: () => {
      toast.success("Hijo vinculado correctamente al padre");
      utils.usuario.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const desvincular = trpc.usuario.desvincularAlumno.useMutation({
    onSuccess: () => {
      toast.success("Vínculo eliminado");
      utils.usuario.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const eliminar = trpc.usuario.eliminar.useMutation({
    onSuccess: () => {
      toast.success("Usuario retirado");
      utils.usuario.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const aplicarRol = (id: string) => {
    const rol = reemplazo[id];
    if (rol) cambiarRol.mutate({ id, rol });
  };

  const handleVincular = (usuarioId: string) => {
    const alumnoId = alumnoSeleccionado[usuarioId];
    if (!alumnoId) {
      toast.error("Selecciona un alumno para vincular.");
      return;
    }
    vincular.mutate({ usuario_id: usuarioId, alumno_id: alumnoId });
  };

  const verificar = (id: string, email: string) =>
    confirm(`¿Retirar a ${email}? Dejará de acceder a la app.`);

  return (
    <>
      <PageHeader
        titulo="Usuarios & Roles"
        descripcion="Administra los accesos de administradores, entrenadores y padres de familia"
      />

      <div className="mb-6 flex items-start gap-3 rounded-xl border border-dorado/40 bg-conteo-claro p-4 text-sm text-tinta/80 shadow-sm">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-dorado" />
        <div>
          <p className="font-semibold text-tinta">Cómo agregar un nuevo padre o usuario</p>
          <p className="mt-1 leading-relaxed">
            1. En Supabase (Auth → Users → Add user), crea el usuario con su correo y contraseña provisional.
            <br />
            2. Insértalo en la tabla con el rol deseado (`padre`, `entrenador` o `admin`):
          </p>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-tinta p-3 text-xs text-papel">
{`insert into public.usuario (id, escuela_id, email, rol)
values (
  'ID_DEL_USUARIO', -- UUID copiado de Supabase Auth
  (select id from public.escuela where slug = 'mantisbox'),
  'correo_padre@gmail.com',
  'padre' -- o 'entrenador' / 'admin'
);`}
          </pre>
          <p className="mt-2 text-xs text-tinta/70">
            Una vez creado como rol <strong>padre</strong>, podrás vincularlo directamente abajo a la ficha de su hijo para que pueda ver sus mensualidades y deudas desde su celular.
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-tinta/10 bg-papel-claro shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-tinta/10 bg-papel/60 text-xs uppercase tracking-wide text-tinta/50">
              <th className="px-4 py-3 font-semibold">Correo</th>
              <th className="px-4 py-3 font-semibold">Rol</th>
              <th className="px-4 py-3 font-semibold">Hijos / Alumnos vinculados</th>
              <th className="px-4 py-3 font-semibold">Cambiar rol</th>
              <th className="px-4 py-3 text-right font-semibold">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {(usuarios ?? []).map((u) => {
              const esPadre = u.rol === "padre";
              const vinculadoIds = new Set((u.alumnos_vinculados ?? []).map((a) => a.id));
              const alumnosDisponibles = (alumnos ?? []).filter((a) => !vinculadoIds.has(a.id));

              return (
                <tr key={u.id} className="border-b border-tinta/5 last:border-0 hover:bg-papel/30 transition-colors">
                  <td className="px-4 py-3.5">
                    <div className="font-medium text-tinta">{u.email}</div>
                    {u.id === mi?.usuario.id && (
                      <span className="text-xs font-semibold text-dorado">(Tu sesión actual)</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <Badge
                      variant={
                        u.rol === "admin"
                          ? "info"
                          : u.rol === "padre"
                          ? "alerta"
                          : "estado"
                      }
                    >
                      {u.rol}
                    </Badge>
                  </td>
                  <td className="px-4 py-3.5">
                    {esPadre ? (
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-1.5">
                          {(u.alumnos_vinculados ?? []).length === 0 ? (
                            <span className="text-xs text-tinta/40 italic">Ningún alumno vinculado aún</span>
                          ) : (
                            u.alumnos_vinculados?.map((al) => (
                              <span
                                key={al.id}
                                className="inline-flex items-center gap-1 rounded-md bg-mantis/15 px-2 py-0.5 text-xs font-medium text-mantis-dark border border-mantis/30"
                              >
                                <UserCheck className="h-3 w-3" />
                                {al.nombre} ({al.nivel_cinta})
                                <button
                                  type="button"
                                  onClick={() =>
                                    desvincular.mutate({ usuario_id: u.id, alumno_id: al.id })
                                  }
                                  className="ml-1 text-tinta/40 hover:text-rojo"
                                  title="Desvincular alumno"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </span>
                            ))
                          )}
                        </div>

                        {/* Selector para vincular alumno */}
                        <div className="flex items-center gap-1.5 pt-1">
                          <select
                            value={alumnoSeleccionado[u.id] ?? ""}
                            onChange={(e) =>
                              setAlumnoSeleccionado((s) => ({ ...s, [u.id]: e.target.value }))
                            }
                            className="rounded-lg border border-tinta/15 bg-papel px-2 py-1 text-xs text-tinta"
                          >
                            <option value="">-- Vincular hijo --</option>
                            {alumnosDisponibles.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.nombre} ({a.categoria})
                              </option>
                            ))}
                          </select>
                          <Button
                            variant="secundario"
                            size="sm"
                            disabled={!alumnoSeleccionado[u.id] || vincular.isPending}
                            onClick={() => handleVincular(u.id)}
                          >
                            Vincular
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-tinta/30">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    {u.id === mi?.usuario.id ? (
                      <span className="text-xs text-tinta/40">No editable</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <select
                          value={reemplazo[u.id] ?? u.rol}
                          onChange={(e) =>
                            setReemplazo((s) => ({ ...s, [u.id]: e.target.value as RolUsuario }))
                          }
                          className="rounded-lg border border-tinta/15 bg-papel px-2 py-1.5 text-sm"
                        >
                          <option value="admin">admin</option>
                          <option value="entrenador">entrenador</option>
                          <option value="padre">padre</option>
                        </select>
                        {reemplazo[u.id] && reemplazo[u.id] !== u.rol && (
                          <Button variant="secundario" size="sm" onClick={() => aplicarRol(u.id)}>
                            Aplicar
                          </Button>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    {u.id !== mi?.usuario.id && (
                      <Button
                        variant="peligro"
                        size="sm"
                        onClick={() => {
                          if (verificar(u.id, u.email)) {
                            eliminar.mutate(u.id);
                          }
                        }}
                      >
                        Retirar
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
            {(usuarios ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-tinta/40">
                  Sin usuarios registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}