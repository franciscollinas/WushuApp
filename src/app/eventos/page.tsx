"use client";

import { CalendarDays, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import PageHeader from "@/components/PageHeader";
import type { EventoRow } from "@/types/supabase";

const TIPOS = ["examen", "torneo", "seminario", "otro"];

const tipoColor: Record<string, "ok" | "falta" | "estado" | "info"> = {
  examen: "info",
  torneo: "falta",
  seminario: "estado",
};

const vacio = {
  nombre: "",
  fecha: new Date().toISOString().slice(0, 10),
  tipo: "examen",
  lugar: "",
  descripcion: "",
};

export default function EventosPage() {
  const utils = trpc.useUtils();
  const { data: eventos } = trpc.evento.list.useQuery();

  const crear = trpc.evento.create.useMutation({
    onSuccess: () => {
      toast.success("Evento creado");
      utils.evento.list.invalidate();
      utils.evento.proximos.invalidate();
      utils.dashboard.estadisticas.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const actualizar = trpc.evento.update.useMutation({
    onSuccess: () => {
      toast.success("Evento actualizado");
      utils.evento.list.invalidate();
      utils.evento.proximos.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const eliminar = trpc.evento.delete.useMutation({
    onSuccess: () => {
      toast.success("Evento eliminado");
      utils.evento.list.invalidate();
      utils.evento.proximos.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [form, setForm] = useState(vacio);
  const [perspectiva, setPerspectiva] = useState<"proximos" | "pasados">("proximos");

  const set = (k: keyof typeof vacio) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const abrirNuevo = () => {
    setEditando(null);
    setForm({ ...vacio, fecha: new Date().toISOString().slice(0, 10) });
    setModalAbierto(true);
  };

  const abrirEditar = (ev: EventoRow) => {
    setEditando(ev.id);
    setForm({
      nombre: ev.nombre,
      fecha: ev.fecha,
      tipo: ev.tipo,
      lugar: ev.lugar ?? "",
      descripcion: ev.descripcion ?? "",
    });
    setModalAbierto(true);
  };

  const guardar = () => {
    const payload = { ...form, lugar: form.lugar || null, descripcion: form.descripcion || null };
    if (editando) actualizar.mutate({ ...payload, id: editando });
    else crear.mutate(payload);
    setModalAbierto(false);
  };

  const hoy = new Date().toISOString().slice(0, 10);
  const visibles = (eventos ?? []).filter((e) =>
    perspectiva === "proximos" ? e.fecha >= hoy : e.fecha < hoy
  );

  return (
    <>
      <PageHeader
        titulo="Eventos"
        descripcion="Exámenes, torneos y fechas importantes"
        accion={
          <Button onClick={abrirNuevo}>
            <Plus className="h-4 w-4" /> Nuevo evento
          </Button>
        }
      />

      <div className="mb-4 inline-flex rounded-lg border border-tinta/15 bg-papel-claro p-1">
        <button
          onClick={() => setPerspectiva("proximos")}
          className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
            perspectiva === "proximos" ? "bg-mantis text-papel" : "text-tinta/60"
          }`}
        >
          Próximos
        </button>
        <button
          onClick={() => setPerspectiva("pasados")}
          className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
            perspectiva === "pasados" ? "bg-mantis text-papel" : "text-tinta/60"
          }`}
        >
          Pasados
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {visibles.length === 0 && (
          <div className="col-span-full rounded-xl border border-dashed border-tinta/20 py-12 text-center text-sm text-tinta/40">
            No hay eventos {perspectiva === "proximos" ? "próximos" : "pasados"}
          </div>
        )}
        {visibles.map((ev) => (
          <div key={ev.id} className="rounded-xl border border-tinta/10 bg-papel-claro p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg bg-mantis text-papel">
                  <span className="text-xs font-bold leading-none">
                    {new Date(ev.fecha).getDate()}
                  </span>
                  <span className="text-[10px] uppercase leading-tight">
                    {new Date(ev.fecha).toLocaleDateString("es-CO", { month: "short" }).replace(".", "")}
                  </span>
                </div>
                <div>
                  <h3 className="font-bold text-tinta">{ev.nombre}</h3>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-tinta/60">
                    <Badge variant={tipoColor[ev.tipo] ?? "estado"}>{ev.tipo}</Badge>
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" /> {ev.fecha}
                    </span>
                    {ev.lugar && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" /> {ev.lugar}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  onClick={() => abrirEditar(ev)}
                  className="rounded-lg p-1.5 text-tinta/50 transition-colors hover:bg-papel hover:text-mantis"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    if (confirm(`¿Eliminar "${ev.nombre}"?`)) eliminar.mutate(ev.id);
                  }}
                  className="rounded-lg p-1.5 text-tinta/50 transition-colors hover:bg-papel hover:text-falta"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            {ev.descripcion && (
              <p className="mt-3 text-sm leading-relaxed text-tinta/70">{ev.descripcion}</p>
            )}
          </div>
        ))}
      </div>

      <Modal
        abierto={modalAbierto}
        titulo={editando ? "Editar evento" : "Nuevo evento"}
        onCerrar={() => setModalAbierto(false)}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nombre">
            <Input value={form.nombre} onChange={set("nombre")} required />
          </Field>
          <Field label="Fecha">
            <Input type="date" value={form.fecha} onChange={set("fecha")} required />
          </Field>
          <Field label="Tipo">
            <Select value={form.tipo} onChange={set("tipo")}>
              {TIPOS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Lugar">
            <Input value={form.lugar} onChange={set("lugar")} placeholder="Coliseo municipal…" />
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Descripción">
            <Textarea rows={2} value={form.descripcion} onChange={set("descripcion")} />
          </Field>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secundario" onClick={() => setModalAbierto(false)}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={!form.nombre || !form.fecha}>
            Guardar
          </Button>
        </div>
      </Modal>
    </>
  );
}