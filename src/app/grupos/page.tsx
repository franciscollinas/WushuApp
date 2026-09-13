"use client";

import { Pencil, Plus, Trash2, UserX } from "lucide-react";
import toast from "react-hot-toast";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Field, Input, Select } from "@/components/ui/Field";
import PageHeader from "@/components/PageHeader";
import type { AlumnoRow, GrupoRow } from "@/types/supabase";

const vacio = {
  nombre: "",
  categoria_edad: "",
  dias: "",
  hora_inicio: "",
  hora_fin: "",
  entrenador: "",
};

export default function GruposPage() {
  const utils = trpc.useUtils();
  const { data: grupos, isLoading } = trpc.grupo.listWithAlumnos.useQuery();

  const crear = trpc.grupo.create.useMutation({
    onSuccess: () => {
      toast.success("Grupo creado");
      utils.grupo.listWithAlumnos.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const actualizar = trpc.grupo.update.useMutation({
    onSuccess: () => {
      toast.success("Grupo actualizado");
      utils.grupo.listWithAlumnos.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const eliminar = trpc.grupo.delete.useMutation({
    onSuccess: () => {
      toast.success("Grupo eliminado");
      utils.grupo.listWithAlumnos.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const asignar = trpc.grupo.asignarAlumno.useMutation({
    onSuccess: () => utils.grupo.listWithAlumnos.invalidate(),
  });
  const quitar = trpc.grupo.quitarAlumno.useMutation({
    onSuccess: () => utils.grupo.listWithAlumnos.invalidate(),
  });

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [form, setForm] = useState(vacio);
  const [grupoSel, setGrupoSel] = useState<string | null>(null);
  const [alumnoNuevo, setAlumnoNuevo] = useState("");

  const { data: alumnosSinGrupo } = trpc.alumno.list.useQuery(undefined, {
    enabled: !!grupoSel,
  });
  const sinGrupo = (alumnosSinGrupo ?? []).filter((a) => !a.grupo_id || a.grupo_id === grupoSel);

  const set = (k: keyof typeof vacio) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const abrirNuevo = () => {
    setEditando(null);
    setForm(vacio);
    setModalAbierto(true);
  };

  const abrirEditar = (g: GrupoRow) => {
    setEditando(g.id);
    setForm({
      nombre: g.nombre,
      categoria_edad: g.categoria_edad,
      dias: g.dias,
      hora_inicio: g.hora_inicio,
      hora_fin: g.hora_fin,
      entrenador: g.entrenador,
    });
    setModalAbierto(true);
  };

  const guardar = () => {
    if (editando) actualizar.mutate({ ...form, id: editando });
    else crear.mutate(form);
    setModalAbierto(false);
  };

  const agregarAlumno = (grupo_id: string, alumno_id: string) => {
    if (!alumno_id) return;
    asignar.mutate({ grupo_id, alumno_id });
    setAlumnoNuevo("");
  };

  return (
    <>
      <PageHeader
        titulo="Grupos"
        descripcion="Horarios y asignación de alumnos"
        accion={
          <Button onClick={abrirNuevo}>
            <Plus className="h-4 w-4" /> Nuevo grupo
          </Button>
        }
      />

      {!isLoading && (grupos ?? []).length === 0 && (
        <div className="rounded-xl border border-dashed border-tinta/20 py-16 text-center text-sm text-tinta/40">
          Crea tu primer grupo
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {(grupos ?? []).map((g) => (
          <div key={g.id} className="overflow-hidden rounded-xl border border-tinta/10 bg-papel-claro">
            <div className="flex items-start justify-between gap-3 border-b border-tinta/10 px-5 py-4">
              <div>
                <h2 className="font-bold text-tinta">{g.nombre}</h2>
                <p className="mt-0.5 text-xs text-tinta/50">
                  {g.dias} · {g.hora_inicio}–{g.hora_fin} · {g.entrenador} · {g.categoria_edad}
                </p>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => abrirEditar(g)}
                  className="rounded-lg p-2 text-tinta/50 transition-colors hover:bg-papel hover:text-mantis"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    if (confirm(`¿Eliminar el grupo ${g.nombre}?`)) eliminar.mutate(g.id);
                  }}
                  className="rounded-lg p-2 text-tinta/50 transition-colors hover:bg-papel hover:text-falta"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex gap-2 px-5 py-3">
              <Select
                value={grupoSel === g.id ? alumnoNuevo : ""}
                onChange={(e) => {
                  setGrupoSel(g.id);
                  setAlumnoNuevo(e.target.value);
                  if (e.target.value) agregarAlumno(g.id, e.target.value);
                }}
              >
                <option value="">Agregar alumno…</option>
                {sinGrupo.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nombre}
                  </option>
                ))}
              </Select>
            </div>

            <ul className="max-h-64 divide-y divide-tinta/5 overflow-y-auto px-2 pb-2">
              {g.alumnos.length === 0 && (
                <li className="px-3 py-3 text-center text-sm text-tinta/40">Sin alumnos en este grupo</li>
              )}
              {g.alumnos.map((a: AlumnoRow) => (
                <li key={a.id} className="flex items-center justify-between gap-2 px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-tinta">{a.nombre}</p>
                    <p className="text-xs text-tinta/40">{a.nivel_cinta}</p>
                  </div>
                  <button
                    onClick={() => quitar.mutate(a.id)}
                    className="rounded-lg p-1.5 text-tinta/40 transition-colors hover:bg-papel hover:text-falta"
                    title="Quitar del grupo"
                  >
                    <UserX className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <Modal
        abierto={modalAbierto}
        titulo={editando ? "Editar grupo" : "Nuevo grupo"}
        onCerrar={() => setModalAbierto(false)}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nombre">
            <Input value={form.nombre} onChange={set("nombre")} required />
          </Field>
          <Field label="Categoría de edad">
            <Select value={form.categoria_edad} onChange={set("categoria_edad")}>
              <option value="">Selecciona…</option>
              <option value="infantil">Infantil</option>
              <option value="juvenil">Juvenil</option>
              <option value="adulto">Adulto</option>
              <option value="mixto">Mixto</option>
            </Select>
          </Field>
          <Field label="Días">
            <Input value={form.dias} onChange={set("dias")} placeholder="Lun · Mi · Vie" required />
          </Field>
          <Field label="Entrenador">
            <Input value={form.entrenador} onChange={set("entrenador")} required />
          </Field>
          <Field label="Hora inicio">
            <Input type="time" value={form.hora_inicio} onChange={set("hora_inicio")} required />
          </Field>
          <Field label="Hora fin">
            <Input type="time" value={form.hora_fin} onChange={set("hora_fin")} required />
          </Field>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secundario" onClick={() => setModalAbierto(false)}>
            Cancelar
          </Button>
          <Button
            onClick={guardar}
            disabled={!form.nombre || !form.dias || !form.hora_inicio || !form.hora_fin}
          >
            Guardar
          </Button>
        </div>
      </Modal>
    </>
  );
}