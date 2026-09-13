"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import PageHeader from "@/components/PageHeader";
import CriteriosEditor from "@/components/CriteriosEditor";
import type { CriterioEval, EvaluacionRow, ResultadoEval } from "@/types/supabase";

const vacio = {
  alumno_id: "",
  fecha: new Date().toISOString().slice(0, 10),
  tipo: "cinta",
  tecnica_json: [] as CriterioEval[],
  fisico_json: [] as CriterioEval[],
  actitud_json: [] as CriterioEval[],
  resultado: "no_apto" as ResultadoEval,
  nueva_cinta: "",
  observaciones: "",
};

const TIPOS = ["cinta", "tecnica", "fisico", "general"];

function Criterios({ lista }: { lista: CriterioEval[] }) {
  if (!lista.length) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {lista.map((c, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 rounded bg-papel px-1.5 py-0.5 text-[11px] text-tinta/60"
        >
          {c.nombre}
          <b className="text-tinta">{c.nota}</b>
        </span>
      ))}
    </div>
  );
}

export default function EvaluacionesPage() {
  const utils = trpc.useUtils();
  const { data: evaluaciones } = trpc.evaluacion.list.useQuery();
  const { data: alumnos } = trpc.alumno.list.useQuery();

  const crear = trpc.evaluacion.create.useMutation({
    onSuccess: () => {
      toast.success("Evaluación registrada");
      utils.evaluacion.list.invalidate();
      utils.alumno.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const actualizar = trpc.evaluacion.update.useMutation({
    onSuccess: () => {
      toast.success("Evaluación actualizada");
      utils.evaluacion.list.invalidate();
      utils.alumno.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const eliminar = trpc.evaluacion.delete.useMutation({
    onSuccess: () => {
      toast.success("Evaluación eliminada");
      utils.evaluacion.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [form, setForm] = useState(vacio);
  const [filtroAlumno, setFiltroAlumno] = useState("");
  const [filtroCinta, setFiltroCinta] = useState(false);

  const abrirNuevo = () => {
    setEditando(null);
    setForm({ ...vacio, fecha: new Date().toISOString().slice(0, 10) });
    setModalAbierto(true);
  };

  const abrirEditar = (ev: EvaluacionRow) => {
    setEditando(ev.id);
    setForm({
      alumno_id: ev.alumno_id,
      fecha: ev.fecha,
      tipo: ev.tipo,
      tecnica_json: ev.tecnica_json,
      fisico_json: ev.fisico_json,
      actitud_json: ev.actitud_json,
      resultado: ev.resultado,
      nueva_cinta: ev.nueva_cinta ?? "",
      observaciones: ev.observaciones ?? "",
    });
    setModalAbierto(true);
  };

  const setCampo = <K extends keyof typeof vacio>(k: K, v: (typeof vacio)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const guardar = () => {
    if (!form.alumno_id) return;
    const payload = {
      ...form,
      nueva_cinta: form.resultado === "apto" && form.nueva_cinta ? form.nueva_cinta : null,
      observaciones: form.observaciones || null,
    };
    if (editando) actualizar.mutate({ ...payload, id: editando });
    else crear.mutate(payload);
    setModalAbierto(false);
  };

  const filtradas = (evaluaciones ?? []).filter(
    (e) => (!filtroAlumno || e.alumno_id === filtroAlumno) && (!filtroCinta || e.tipo === "cinta")
  );

  return (
    <>
      <PageHeader
        titulo="Evaluaciones"
        descripcion="Fichas de técnica, físico y actitud"
        accion={
          <Button onClick={abrirNuevo}>
            <Plus className="h-4 w-4" /> Nueva evaluación
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Select value={filtroAlumno} onChange={(e) => setFiltroAlumno(e.target.value)}>
          <option value="">Todos los alumnos</option>
          {(alumnos ?? []).map((a) => (
            <option key={a.id} value={a.id}>
              {a.nombre}
            </option>
          ))}
        </Select>
        <label className="flex items-center gap-2 rounded-lg border border-tinta/15 bg-papel-claro px-3 py-2.5 text-sm text-tinta">
          <input
            type="checkbox"
            checked={filtroCinta}
            onChange={(e) => setFiltroCinta(e.target.checked)}
            className="accent-mantis"
          />
          Solo evaluaciones de cinturón
        </label>
      </div>

      <div className="overflow-hidden rounded-xl border border-tinta/10 bg-papel-claro">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-tinta/10 text-left text-xs uppercase tracking-wide text-tinta/50">
                <th className="px-4 py-3 font-semibold">Alumno</th>
                <th className="px-4 py-3 font-semibold">Fecha</th>
                <th className="px-4 py-3 font-semibold">Tipo</th>
                <th className="px-4 py-3 font-semibold">Resultado</th>
                <th className="px-4 py-3 font-semibold">Cinta</th>
                <th className="px-4 py-3 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-tinta/40">
                    Sin evaluaciones registradas
                  </td>
                </tr>
              )}
              {filtradas.map((ev) => (
                <tr key={ev.id} className="border-b border-tinta/5 last:border-0 hover:bg-papel">
                  <td className="px-4 py-3">
                    <span className="font-medium text-tinta">{ev.alumno?.nombre ?? "—"}</span>
                    <Criterios lista={[...ev.tecnica_json, ...ev.fisico_json, ...ev.actitud_json]} />
                  </td>
                  <td className="px-4 py-3 text-tinta/70">{ev.fecha}</td>
                  <td className="px-4 py-3 capitalize text-tinta/70">{ev.tipo}</td>
                  <td className="px-4 py-3">
                    <Badge variant={ev.resultado === "apto" ? "ok" : "falta"}>
                      {ev.resultado === "apto" ? "Apto" : "No apto"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {ev.nueva_cinta ? (
                      <Badge variant="info">{ev.nueva_cinta}</Badge>
                    ) : (
                      <span className="text-tinta/40">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => abrirEditar(ev)}
                        className="rounded-lg p-2 text-tinta/50 transition-colors hover:bg-papel hover:text-mantis"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm("¿Eliminar esta evaluación?")) eliminar.mutate(ev.id);
                        }}
                        className="rounded-lg p-2 text-tinta/50 transition-colors hover:bg-papel hover:text-falta"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        abierto={modalAbierto}
        titulo={editando ? "Editar evaluación" : "Nueva evaluación"}
        onCerrar={() => setModalAbierto(false)}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Alumno">
            <Select value={form.alumno_id} onChange={(e) => setCampo("alumno_id", e.target.value)}>
              <option value="">Selecciona…</option>
              {(alumnos ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Fecha">
            <Input type="date" value={form.fecha} onChange={(e) => setCampo("fecha", e.target.value)} />
          </Field>
          <Field label="Tipo de evaluación">
            <Select value={form.tipo} onChange={(e) => setCampo("tipo", e.target.value)}>
              {TIPOS.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Resultado">
            <Select value={form.resultado} onChange={(e) => setCampo("resultado", e.target.value as ResultadoEval)}>
              <option value="apto">Apto</option>
              <option value="no_apto">No apto</option>
            </Select>
          </Field>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          <CriteriosEditor
            titulo="Técnica"
            criterios={form.tecnica_json}
            onChange={(c) => setCampo("tecnica_json", c)}
          />
          <CriteriosEditor
            titulo="Físico"
            criterios={form.fisico_json}
            onChange={(c) => setCampo("fisico_json", c)}
          />
          <CriteriosEditor
            titulo="Actitud"
            criterios={form.actitud_json}
            onChange={(c) => setCampo("actitud_json", c)}
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nueva cinta (si apto)">
            <Input
              value={form.nueva_cinta}
              onChange={(e) => setCampo("nueva_cinta", e.target.value)}
              placeholder="Ej. amarilla con punta verde"
              disabled={form.resultado !== "apto"}
            />
          </Field>
          <Field label="Observaciones">
            <Textarea
              rows={1}
              value={form.observaciones}
              onChange={(e) => setCampo("observaciones", e.target.value)}
            />
          </Field>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secundario" onClick={() => setModalAbierto(false)}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={!form.alumno_id}>
            Guardar
          </Button>
        </div>
      </Modal>
    </>
  );
}