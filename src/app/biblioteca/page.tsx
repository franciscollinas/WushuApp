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
import type { EjercicioRow } from "@/types/supabase";

const CATEGORIAS = ["calentamiento", "tecnica", "fisico", "actitud"];
const DIFICULTADES = ["basica", "intermedia", "avanzada"];

const colores: Record<string, "ok" | "falta" | "estado" | "info"> = {
  calentamiento: "estado",
  tecnica: "info",
  fisico: "ok",
  actitud: "falta",
};

const vacio = {
  nombre: "",
  categoria: "tecnica",
  dificultad: "basica",
  descripcion: "",
  duracion: "",
};

export default function BibliotecaPage() {
  const utils = trpc.useUtils();
  const { data: ejercicios } = trpc.biblioteca.list.useQuery();

  const crear = trpc.biblioteca.create.useMutation({
    onSuccess: () => {
      toast.success("Ejercicio creado");
      utils.biblioteca.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const actualizar = trpc.biblioteca.update.useMutation({
    onSuccess: () => {
      toast.success("Ejercicio actualizado");
      utils.biblioteca.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const eliminar = trpc.biblioteca.delete.useMutation({
    onSuccess: () => {
      toast.success("Ejercicio eliminado");
      utils.biblioteca.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [form, setForm] = useState(vacio);
  const [busqueda, setBusqueda] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");

  const set = (k: keyof typeof vacio) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const abrirNuevo = () => {
    setEditando(null);
    setForm(vacio);
    setModalAbierto(true);
  };

  const abrirEditar = (ej: EjercicioRow) => {
    setEditando(ej.id);
    setForm({
      nombre: ej.nombre,
      categoria: ej.categoria,
      dificultad: ej.dificultad,
      descripcion: ej.descripcion ?? "",
      duracion: ej.duracion ?? "",
    });
    setModalAbierto(true);
  };

  const guardar = () => {
    const payload = {
      ...form,
      descripcion: form.descripcion || null,
      duracion: form.duracion || null,
    };
    if (editando) actualizar.mutate({ ...payload, id: editando });
    else crear.mutate(payload);
    setModalAbierto(false);
  };

  const filtrados = (ejercicios ?? []).filter(
    (e) =>
      (!filtroCategoria || e.categoria === filtroCategoria) &&
      (!busqueda || e.nombre.toLowerCase().includes(busqueda.toLowerCase()))
  );

  return (
    <>
      <PageHeader
        titulo="Biblioteca de entrenamiento"
        descripcion="Ejercicios catalogados para tus clases"
        accion={
          <Button onClick={abrirNuevo}>
            <Plus className="h-4 w-4" /> Nuevo ejercicio
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar ejercicio…"
        />
        <Select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)}>
          <option value="">Todas las categorías</option>
          {CATEGORIAS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {filtrados.length === 0 && (
          <div className="col-span-full rounded-xl border border-dashed border-tinta/20 py-12 text-center text-sm text-tinta/40">
            Sin ejercicios. Añade el primero.
          </div>
        )}
        {filtrados.map((ej) => (
          <div key={ej.id} className="flex flex-col rounded-xl border border-tinta/10 bg-papel-claro p-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-bold text-tinta">{ej.nombre}</h3>
                <div className="mt-1.5 flex items-center gap-2">
                  <Badge variant={colores[ej.categoria] ?? "estado"}>{ej.categoria}</Badge>
                  <Badge variant="info">{ej.dificultad}</Badge>
                  {ej.duracion && <span className="text-xs text-tinta/50">{ej.duracion}</span>}
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  onClick={() => abrirEditar(ej)}
                  className="rounded-lg p-1.5 text-tinta/50 transition-colors hover:bg-papel hover:text-mantis"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    if (confirm(`¿Eliminar "${ej.nombre}"?`)) eliminar.mutate(ej.id);
                  }}
                  className="rounded-lg p-1.5 text-tinta/50 transition-colors hover:bg-papel hover:text-falta"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            {ej.descripcion && (
              <p className="mt-3 text-sm leading-relaxed text-tinta/70">{ej.descripcion}</p>
            )}
          </div>
        ))}
      </div>

      <Modal
        abierto={modalAbierto}
        titulo={editando ? "Editar ejercicio" : "Nuevo ejercicio"}
        onCerrar={() => setModalAbierto(false)}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nombre">
            <Input value={form.nombre} onChange={set("nombre")} required />
          </Field>
          <Field label="Duración">
            <Input value={form.duracion} onChange={set("duracion")} placeholder="10 min" />
          </Field>
          <Field label="Categoría">
            <Select value={form.categoria} onChange={set("categoria")}>
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Dificultad">
            <Select value={form.dificultad} onChange={set("dificultad")}>
              {DIFICULTADES.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Descripción">
            <Textarea
              rows={3}
              value={form.descripcion}
              onChange={set("descripcion")}
              placeholder="En qué consiste, forma correcta, errores comunes…"
            />
          </Field>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secundario" onClick={() => setModalAbierto(false)}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={!form.nombre}>
            Guardar
          </Button>
        </div>
      </Modal>
    </>
  );
}