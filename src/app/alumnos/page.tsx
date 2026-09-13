"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import PageHeader from "@/components/PageHeader";
import type { AlumnoRow, Categoria, EstadoAlumno } from "@/types/supabase";

const vacio = {
  nombre: "",
  fecha_nacimiento: "",
  categoria: "infantil" as Categoria,
  nivel_cinta: "",
  fecha_ingreso: new Date().toISOString().slice(0, 10),
  estado: "activo" as EstadoAlumno,
  grupo_id: "" as string,
  padre_nombre: "",
  padre_telefono: "",
  notas: "",
};

export default function AlumnosPage() {
  const utils = trpc.useUtils();
  const { data: alumnos } = trpc.alumno.list.useQuery();
  const { data: grupos } = trpc.grupo.list.useQuery();

  const crear = trpc.alumno.create.useMutation({
    onSuccess: () => {
      toast.success("Alumno creado");
      utils.alumno.list.invalidate();
      utils.grupo.listWithAlumnos.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const actualizar = trpc.alumno.update.useMutation({
    onSuccess: () => {
      toast.success("Alumno actualizado");
      utils.alumno.list.invalidate();
      utils.grupo.listWithAlumnos.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const eliminar = trpc.alumno.delete.useMutation({
    onSuccess: () => {
      toast.success("Alumno eliminado");
      utils.alumno.list.invalidate();
      utils.grupo.listWithAlumnos.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [form, setForm] = useState(vacio);
  const [filtroGrupo, setFiltroGrupo] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");

  const set = (k: keyof typeof vacio) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({
      ...f,
      [k]: k === "categoria" || k === "estado" ? (e.target.value as Categoria & EstadoAlumno) : e.target.value,
    }));

  const abrirNuevo = () => {
    setEditando(null);
    setForm({ ...vacio, fecha_ingreso: new Date().toISOString().slice(0, 10) });
    setModalAbierto(true);
  };

  const abrirEditar = (a: AlumnoRow) => {
    setEditando(a.id);
    setForm({
      nombre: a.nombre,
      fecha_nacimiento: a.fecha_nacimiento ?? "",
      categoria: a.categoria,
      nivel_cinta: a.nivel_cinta,
      fecha_ingreso: a.fecha_ingreso ?? "",
      estado: a.estado,
      grupo_id: a.grupo_id ?? "",
      padre_nombre: a.padre_nombre ?? "",
      padre_telefono: a.padre_telefono ?? "",
      notas: a.notas ?? "",
    });
    setModalAbierto(true);
  };

  const guardar = () => {
    const payload = {
      ...form,
      grupo_id: form.grupo_id || null,
      fecha_nacimiento: form.fecha_nacimiento || null,
      fecha_ingreso: form.fecha_ingreso || null,
      padre_nombre: form.padre_nombre || null,
      padre_telefono: form.padre_telefono || null,
      notas: form.notas || null,
    };
    if (editando) {
      actualizar.mutate({ ...payload, id: editando });
    } else {
      crear.mutate(payload);
    }
    setModalAbierto(false);
  };

  const filtrados = (alumnos ?? []).filter(
    (a) =>
      (!filtroGrupo || a.grupo_id === filtroGrupo) &&
      (!filtroEstado || a.estado === filtroEstado) &&
      (!filtroCategoria || a.categoria === filtroCategoria)
  );

  return (
    <>
      <PageHeader
        titulo="Alumnos"
        descripcion={`${filtrados.length} alumnos`}
        accion={
          <Button onClick={abrirNuevo}>
            <Plus className="h-4 w-4" /> Nuevo alumno
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Select value={filtroGrupo} onChange={(e) => setFiltroGrupo(e.target.value)}>
          <option value="">Todos los grupos</option>
          {(grupos ?? []).map((g) => (
            <option key={g.id} value={g.id}>
              {g.nombre}
            </option>
          ))}
        </Select>
        <Select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="activo">Activo</option>
          <option value="inactivo">Inactivo</option>
        </Select>
        <Select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)}>
          <option value="">Todas las categorías</option>
          <option value="infantil">Infantil</option>
          <option value="juvenil">Juvenil</option>
          <option value="adulto">Adulto</option>
        </Select>
      </div>

      <div className="overflow-hidden rounded-xl border border-tinta/10 bg-papel-claro">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-tinta/10 text-left text-xs uppercase tracking-wide text-tinta/50">
                <th className="px-4 py-3 font-semibold">Nombre</th>
                <th className="px-4 py-3 font-semibold">Categoría</th>
                <th className="px-4 py-3 font-semibold">Cinta</th>
                <th className="px-4 py-3 font-semibold">Grupo</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 font-semibold">Padre / acudiente</th>
                <th className="px-4 py-3 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-tinta/40">
                    No hay alumnos
                  </td>
                </tr>
              )}
              {filtrados.map((a) => (
                <tr
                  key={a.id}
                  className="border-b border-tinta/5 last:border-0 hover:bg-papel"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/alumnos/${a.id}`}
                      className="font-medium text-tinta transition-colors hover:text-mantis"
                    >
                      {a.nombre}
                    </Link>
                    {(a.padre_telefono || a.padre_nombre) && (
                      <p className="text-xs font-normal text-tinta/40">
                        {a.padre_nombre ?? ""} {a.padre_telefono ?? ""}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 capitalize text-tinta/70">{a.categoria}</td>
                  <td className="px-4 py-3">
                    <Badge variant="info">{a.nivel_cinta}</Badge>
                  </td>
                  <td className="px-4 py-3 text-tinta/70">
                    {(grupos ?? []).find((g) => g.id === a.grupo_id)?.nombre ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={a.estado === "activo" ? "ok" : "estado"}>{a.estado}</Badge>
                  </td>
                  <td className="px-4 py-3 text-tinta/60">{a.padre_nombre ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => abrirEditar(a)}
                        className="rounded-lg p-2 text-tinta/50 transition-colors hover:bg-papel hover:text-mantis"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`¿Eliminar a ${a.nombre}?`)) eliminar.mutate(a.id);
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
        titulo={editando ? "Editar alumno" : "Nuevo alumno"}
        onCerrar={() => setModalAbierto(false)}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nombre completo">
            <Input value={form.nombre} onChange={set("nombre")} required />
          </Field>
          <Field label="Fecha de nacimiento">
            <Input type="date" value={form.fecha_nacimiento} onChange={set("fecha_nacimiento")} />
          </Field>
          <Field label="Categoría">
            <Select value={form.categoria} onChange={set("categoria")}>
              <option value="infantil">Infantil</option>
              <option value="juvenil">Juvenil</option>
              <option value="adulto">Adulto</option>
            </Select>
          </Field>
          <Field label="Nivel de cinta">
            <Input value={form.nivel_cinta} onChange={set("nivel_cinta")} required />
          </Field>
          <Field label="Fecha de ingreso">
            <Input type="date" value={form.fecha_ingreso} onChange={set("fecha_ingreso")} />
          </Field>
          <Field label="Grupo">
            <Select value={form.grupo_id} onChange={set("grupo_id")}>
              <option value="">Sin grupo</option>
              {(grupos ?? []).map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nombre}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Estado">
            <Select value={form.estado} onChange={set("estado")}>
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
            </Select>
          </Field>
          <Field label="Nombre del padre / acudiente">
            <Input value={form.padre_nombre ?? ""} onChange={set("padre_nombre")} />
          </Field>
          <Field label="Teléfono del padre">
            <Input value={form.padre_telefono ?? ""} onChange={set("padre_telefono")} placeholder="312…" />
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Notas">
            <Textarea rows={2} value={form.notas ?? ""} onChange={set("notas")} />
          </Field>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secundario" onClick={() => setModalAbierto(false)}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={!form.nombre || !form.nivel_cinta}>
            Guardar
          </Button>
        </div>
      </Modal>
    </>
  );
}