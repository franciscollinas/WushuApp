"use client";

import { Flame, Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Field, Input, Select } from "@/components/ui/Field";
import PageHeader from "@/components/PageHeader";
import { CONFIG_XP_DEFECTO, XP_POR_NIVEL, type ConfigXp } from "@/lib/xp";

export default function PuntosPage() {
  const utils = trpc.useUtils();
  const { data: ranking } = trpc.xp.ranking.useQuery();
  const { data: config } = trpc.xp.config.useQuery();
  const { data: movimientos } = trpc.xp.movimientos.useQuery();

  // Lo editado manda; mientras no se edite se muestra lo guardado.
  const [editado, setEditado] = useState<ConfigXp | null>(null);
  const valores: ConfigXp = editado ?? config ?? CONFIG_XP_DEFECTO;

  const [modal, setModal] = useState(false);
  const [alumnoId, setAlumnoId] = useState("");
  const [puntos, setPuntos] = useState("");
  const [motivo, setMotivo] = useState("");

  const refrescar = () => {
    utils.xp.ranking.invalidate();
    utils.xp.movimientos.invalidate();
  };

  const guardarConfig = trpc.xp.setConfig.useMutation({
    onSuccess: () => {
      toast.success("Reglas de puntos guardadas");
      setEditado(null);
      utils.xp.config.invalidate();
      refrescar();
    },
    onError: (e) => toast.error(e.message),
  });
  const otorgar = trpc.xp.otorgar.useMutation({
    onSuccess: () => {
      toast.success("Puntos registrados");
      setModal(false);
      setPuntos("");
      setMotivo("");
      refrescar();
    },
    onError: (e) => toast.error(e.message),
  });
  const eliminar = trpc.xp.eliminarMovimiento.useMutation({
    onSuccess: () => {
      toast.success("Movimiento eliminado");
      refrescar();
    },
    onError: (e) => toast.error(e.message),
  });

  const num = (k: keyof typeof valores) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setEditado({ ...valores, [k]: Number(e.target.value) });

  return (
    <>
      <PageHeader
        titulo="Puntos XP"
        descripcion="Ranking, reglas y puntos extra. Los puntos de asistencia y racha se calculan solos."
        accion={
          <Button onClick={() => setModal(true)}>
            <Plus className="h-4 w-4" /> Dar puntos
          </Button>
        }
      />

      <div className="mb-6 rounded-xl border border-tinta/10 bg-papel-claro p-5">
        <h3 className="mb-3 font-bold text-tinta">Reglas</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="XP por clase asistida">
            <Input type="number" min={0} value={valores.xp_por_asistencia} onChange={num("xp_por_asistencia")} />
          </Field>
          <Field label="Racha: clases seguidas (0 = sin racha)">
            <Input type="number" min={0} value={valores.xp_racha_dias} onChange={num("xp_racha_dias")} />
          </Field>
          <Field label="XP de bono al completar la racha">
            <Input type="number" min={0} value={valores.xp_racha_bonus} onChange={num("xp_racha_bonus")} />
          </Field>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-xs text-tinta/60">
            Cada {XP_POR_NIVEL} XP se sube de nivel. Cambiar las reglas recalcula los puntos de todos.
          </p>
          <Button onClick={() => guardarConfig.mutate(valores)} disabled={guardarConfig.isPending}>
            Guardar reglas
          </Button>
        </div>
      </div>

      <div className="mb-6 overflow-hidden rounded-xl border border-tinta/10 bg-papel-claro">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-tinta/10 text-left text-xs uppercase tracking-wide text-tinta/50">
                <th className="px-4 py-3 font-semibold">#</th>
                <th className="px-4 py-3 font-semibold">Alumno</th>
                <th className="px-4 py-3 font-semibold">Nivel</th>
                <th className="px-4 py-3 font-semibold">Clases</th>
                <th className="px-4 py-3 font-semibold">Racha</th>
                <th className="px-4 py-3 text-right font-semibold">XP</th>
              </tr>
            </thead>
            <tbody>
              {(ranking ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-tinta/40">
                    Aún no hay alumnos activos
                  </td>
                </tr>
              )}
              {(ranking ?? []).map((r) => (
                <tr key={r.alumno_id} className="border-b border-tinta/5 last:border-0 hover:bg-papel">
                  <td className="px-4 py-3 font-mono text-xs font-bold text-tinta/60">{r.posicion}</td>
                  <td className="px-4 py-3 font-medium text-tinta">{r.nombre}</td>
                  <td className="px-4 py-3 text-tinta/70">{r.nivel}</td>
                  <td className="px-4 py-3 text-tinta/70">{r.asistidas}</td>
                  <td className="px-4 py-3 text-tinta/70">
                    <span className="inline-flex items-center gap-1">
                      <Flame className="h-3.5 w-3.5 text-falta" /> {r.rachaActual}
                      <span className="text-xs text-tinta/40">(mejor {r.mejorRacha})</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-mantis-dark">{r.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <h3 className="mb-2 font-bold text-tinta">Puntos extra recientes</h3>
      <div className="rounded-xl border border-tinta/10 bg-papel-claro">
        {(movimientos ?? []).length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-tinta/40">
            Todavía no has dado puntos extra. Úsalos para premiar logros, torneos o referidos.
          </p>
        )}
        <ul className="divide-y divide-tinta/10">
          {(movimientos ?? []).map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <div>
                <p className="font-medium text-tinta">{m.alumno}</p>
                <p className="text-xs text-tinta/60">
                  {m.motivo} · {m.fecha}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`font-mono font-bold ${m.puntos > 0 ? "text-mantis-dark" : "text-falta"}`}>
                  {m.puntos > 0 ? "+" : ""}
                  {m.puntos}
                </span>
                <button
                  onClick={() => {
                    if (confirm("¿Eliminar este movimiento de puntos?")) eliminar.mutate(m.id);
                  }}
                  className="rounded-lg p-1.5 text-tinta/50 hover:bg-papel hover:text-falta"
                  aria-label="Eliminar movimiento"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <Modal abierto={modal} titulo="Dar puntos extra" onCerrar={() => setModal(false)}>
        <div className="space-y-4">
          <Field label="Alumno">
            <Select value={alumnoId} onChange={(e) => setAlumnoId(e.target.value)}>
              <option value="">Elige un alumno…</option>
              {(ranking ?? [])
                .slice()
                .sort((a, b) => a.nombre.localeCompare(b.nombre))
                .map((r) => (
                  <option key={r.alumno_id} value={r.alumno_id}>
                    {r.nombre}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="Puntos (negativo para quitar)">
            <Input type="number" value={puntos} onChange={(e) => setPuntos(e.target.value)} placeholder="50" />
          </Field>
          <Field label="Motivo">
            <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Medalla en el torneo regional" />
          </Field>
          <div className="flex justify-end gap-3">
            <Button variant="secundario" onClick={() => setModal(false)}>
              Cancelar
            </Button>
            <Button
              disabled={!alumnoId || !Number(puntos) || !motivo.trim() || otorgar.isPending}
              onClick={() => otorgar.mutate({ alumno_id: alumnoId, puntos: Math.trunc(Number(puntos)), motivo })}
            >
              Guardar
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
