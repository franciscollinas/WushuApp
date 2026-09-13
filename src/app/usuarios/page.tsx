"use client";

import toast from "react-hot-toast";
import { trpc } from "@/lib/trpc";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import PageHeader from "@/components/PageHeader";
import { Info } from "lucide-react";
import { useState } from "react";

type Rol = "admin" | "entrenador";

export default function UsuariosPage() {
  const utils = trpc.useUtils();
  const { data: usuarios } = trpc.usuario.list.useQuery();
  const { data: mi } = trpc.usuario.miUsuario.useQuery();

  const [reemplazo, setReemplazo] = useState<Record<string, Rol>>({});

  const cambiarRol = trpc.usuario.cambiarRol.useMutation({
    onSuccess: () => {
      toast.success("Rol actualizado");
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

  const verificar = (id: string, email: string) =>
    confirm(`¿Retirar a ${email}? Dejará de acceder a la app.`);

  return (
    <>
      <PageHeader
        titulo="Usuarios"
        descripcion="Administra quiénes entran a la plataforma y con qué rol"
      />

      <div className="mb-5 flex items-start gap-3 rounded-xl border border-dorado/40 bg-conteo-claro p-4 text-sm text-tinta/80">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-dorado" />
        <div>
          <p className="font-semibold text-tinta">Cómo crear un usuario nuevo</p>
          <p className="mt-1 leading-relaxed">
            La cuenta de acceso se crea en Supabase (Auth → Users → Add user, con correo y
            contraseña). Después, asigna su id y rol de esta escuela con el SQL Editor:
          </p>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-tinta p-3 text-xs text-papel">
{`insert into public.usuario (id, escuela_id, email, rol)
values (
  'ID_DEL_USUARIO',            -- uuid de auth.users (columna Auth > Users > ese usuario)
  (select id from public.escuela where slug = 'mantisbox'),
  'correo@escuela.com',
  'entrenador'
);`}
          </pre>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-tinta/10 bg-papel-claro">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-tinta/10 bg-papel/60 text-xs uppercase tracking-wide text-tinta/50">
              <th className="px-4 py-3 font-semibold">Correo</th>
              <th className="px-4 py-3 font-semibold">Rol</th>
              <th className="px-4 py-3 font-semibold">Cambiar rol</th>
              <th className="px-4 py-3 text-right font-semibold">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {(usuarios ?? []).map((u) => (
              <tr key={u.id} className="border-b border-tinta/5 last:border-0">
                <td className="px-4 py-3">
                  <span className="font-medium text-tinta">{u.email}</span>
                  {u.id === mi?.usuario.id && (
                    <span className="ml-2 text-xs text-tinta/40">(tú)</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={u.rol === "admin" ? "info" : "estado"}>{u.rol}</Badge>
                </td>
                <td className="px-4 py-3">
                  {u.id === mi?.usuario.id ? (
                    <span className="text-xs text-tinta/40">no editable</span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <select
                        value={reemplazo[u.id] ?? u.rol}
                        onChange={(e) =>
                          setReemplazo((s) => ({ ...s, [u.id]: e.target.value as Rol }))
                        }
                        className="rounded-lg border border-tinta/15 bg-papel px-2 py-1.5 text-sm"
                      >
                        <option value="admin">admin</option>
                        <option value="entrenador">entrenador</option>
                      </select>
                      {reemplazo[u.id] && reemplazo[u.id] !== u.rol && (
                        <Button variant="secundario" onClick={() => aplicarRol(u.id)}>
                          Aplicar
                        </Button>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {u.id !== mi?.usuario.id && (
                    <Button
                      variant="peligro"
                      onClick={() => verificar(u.id, u.email) && eliminar.mutate(u.id)}
                    >
                      Retirar
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {(usuarios ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-sm text-tinta/40">
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