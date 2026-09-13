"use client";

import { Check, CircleEllipsis, Play } from "lucide-react";
import toast from "react-hot-toast";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import Button from "@/components/ui/Button";
import PageHeader from "@/components/PageHeader";

export default function AsistenciaPage() {
  const utils = trpc.useUtils();
  const { data: grupos } = trpc.grupo.list.useQuery();

  const [grupoId, setGrupoId] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [tema, setTema] = useState("");

  const abrir = trpc.asistencia.abrirSesion.useMutation({
    onSuccess: () => {
      toast.success("Clase abierta");
      refetch();
      utils.asistencia.alumnosConFaltas.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const { data, refetch, isLoading } = trpc.asistencia.listaConAsistencia.useQuery(
    { grupo_id: grupoId, fecha },
    { enabled: !!grupoId && !!fecha }
  );

  const marcar = trpc.asistencia.marcarPresencia.useMutation({
    onSuccess: () => {
      refetch();
      utils.dashboard.estadisticas.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const sesion = data?.sesion ?? null;
  const lista = sesion ? [...sesion.asistencia].sort((a, b) =>
        (a.alumno?.nombre ?? "").localeCompare(b.alumno?.nombre ?? "")
      ) : [];

  const presentes = lista.filter((a) => a.presente).length;
  const total = lista.length;
  const pct = total === 0 ? 0 : Math.round((presentes / total) * 100);

  const seleccionado = !!grupoId && !!fecha;

  return (
    <>
      <PageHeader
        titulo="Asistencia"
        descripcion="Abre la clase y marca con un toque"
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <select
          value={grupoId}
          onChange={(e) => setGrupoId(e.target.value)}
          className="w-full rounded-lg border border-tinta/15 bg-papel-claro px-3 py-3 text-base text-tinta outline-none transition-colors focus:border-mantis"
        >
          <option value="">Elige grupo…</option>
          {(grupos ?? []).map((g) => (
            <option key={g.id} value={g.id}>
              {g.nombre}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className="w-full rounded-lg border border-tinta/15 bg-papel-claro px-3 py-3 text-base text-tinta outline-none transition-colors focus:border-mantis"
        />
        <input
          value={tema}
          onChange={(e) => setTema(e.target.value)}
          placeholder="Tema de la clase (opcional)"
          className="w-full rounded-lg border border-tinta/15 bg-papel-claro px-3 py-3 text-base text-tinta outline-none transition-colors focus:border-mantis"
        />
      </div>

      {seleccionado && !sesion && (
        <Button className="mt-5 w-full py-3 text-base" onClick={() => abrir.mutate({ grupo_id: grupoId, fecha, tema: tema || undefined })}>
          <Play className="h-5 w-5" /> Abrir clase
        </Button>
      )}

      {sesion && (
        <div className="mt-5 overflow-hidden rounded-xl border border-tinta/10 bg-papel-claro">
          <div className="flex items-center justify-between border-b border-tinta/10 px-5 py-4">
            <div>
              <h2 className="font-bold text-tinta">
                {sesion.tema || "Clase"} — {(grupos ?? []).find((g) => g.id === grupoId)?.nombre}
              </h2>
              <p className="text-xs text-tinta/50">Entrenador: {sesion.entrenador}</p>
            </div>
            <p className="text-2xl font-extrabold text-mantis">
              {pct}%
              <span className="ml-1 text-xs font-normal text-tinta/50">
                {presentes}/{total}
              </span>
            </p>
          </div>

          {isLoading ? (
            <p className="px-5 py-12 text-center text-sm text-tinta/40">Cargando lista…</p>
          ) : (
            <ul className="divide-y divide-tinta/5 px-2 py-2">
              {lista.length === 0 && (
                <li className="px-3 py-8 text-center text-sm text-tinta/40">
                  Este grupo no tiene alumnos activos
                </li>
              )}
              {lista.map((a) => {
                const presente = a.presente;
                return (
                  <li key={a.id} className="px-1">
                    <button
                      onClick={() =>
                        marcar.mutate({ asistencia_id: a.id, presente: !a.presente })
                      }
                      className={`flex w-full items-center justify-between gap-3 rounded-lg px-4 py-4 text-left text-base transition-colors ${
                        presente
                          ? "bg-ok-claro text-tinta"
                          : "bg-papel hover:bg-papel"
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <CircleEllipsis
                          className={`h-5 w-5 ${presente ? "text-ok" : "text-tinta/30"}`}
                        />
                        <span className="font-medium">
                          {a.alumno?.nombre ?? "—"}
                        </span>
                      </span>
                      {presente ? (
                        <Check className="h-6 w-6 text-ok" />
                      ) : (
                        <span className="text-xs font-semibold text-tinta/30">ausente</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </>
  );
}