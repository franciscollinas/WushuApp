"use client";

import { MessageCircle, Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import { Field, Input, Select } from "@/components/ui/Field";
import PageHeader from "@/components/PageHeader";

function textoRecordatorio(nombre: string, monto: number, mes: string) {
  const [anio, m] = mes.split("-");
  const nombreMes = new Date(Number(anio), Number(m) - 1, 1).toLocaleDateString("es-CO", {
    month: "long",
    year: "numeric",
  });
  return encodeURIComponent(
    `Hola, te escribimos de Mantis Box Sabanalarga. Te recordamos que la mensualidad de ${nombreMes} para ${nombre} está pendiente ($${Number(monto).toLocaleString("es-CO")}). ¡Gracias!`
  );
}

const vacio = {
  alumno_id: "",
  mes: new Date().toISOString().slice(0, 7),
  monto: 0,
  estado: "pendiente" as "pendiente" | "pagado" | "vencido",
  fecha_vencimiento: new Date().toISOString().slice(0, 10),
};

export default function PagosPage() {
  const utils = trpc.useUtils();
  const hoy = new Date();
  const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;

  const { data: pagos } = trpc.pago.list.useQuery();
  const { data: alumnos } = trpc.alumno.list.useQuery();
  const [mesFiltro, setMesFiltro] = useState(mesActual);

  const crear = trpc.pago.create.useMutation({
    onSuccess: () => {
      toast.success("Pago registrado");
      utils.pago.list.invalidate();
      utils.pago.listByMes.invalidate();
      utils.dashboard.estadisticas.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const marcarPagado = trpc.pago.marcarPagado.useMutation({
    onSuccess: () => {
      toast.success("Marcado como pagado");
      utils.pago.list.invalidate();
      utils.pago.listByMes.invalidate();
      utils.dashboard.estadisticas.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const eliminar = trpc.pago.delete.useMutation({
    onSuccess: () => {
      utils.pago.list.invalidate();
      utils.pago.listByMes.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const [modalAbierto, setModalAbierto] = useState(false);
  const [form, setForm] = useState(vacio);

  const set = (k: keyof typeof vacio) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const filtrados = (pagos ?? []).filter((p) => p.mes === mesFiltro);
  const totalMes = filtrados.filter((p) => p.estado === "pagado").reduce((s, p) => s + p.monto, 0);
  const soloPendientes = filtrados.filter((p) => p.estado !== "pagado");

  const guardar = () => {
    if (!form.alumno_id || form.monto <= 0) return;
    crear.mutate({
      ...form,
      monto: Number(form.monto),
      fecha_pago: form.estado === "pagado" ? new Date().toISOString().slice(0, 10) : null,
    });
    setModalAbierto(false);
  };

  return (
    <>
      <PageHeader
        titulo="Pagos"
        descripcion="Mensualidades por alumno"
        accion={
          <Button onClick={() => setModalAbierto(true)}>
            <Plus className="h-4 w-4" /> Registrar pago
          </Button>
        }
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-tinta/10 bg-papel-claro px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-tinta/60">Mes visible</p>
          <p className="text-2xl font-extrabold text-tinta">
            ${totalMes.toLocaleString("es-CO")}{" "}
            <span className="text-sm font-normal text-tinta/50">cobrado</span>
          </p>
        </div>
        <input
          type="month"
          value={mesFiltro}
          onChange={(e) => setMesFiltro(e.target.value)}
          className="rounded-lg border border-tinta/15 bg-papel-claro px-3 py-2 text-sm text-tinta outline-none focus:border-mantis"
        />
      </div>

      {soloPendientes.length > 0 && (
        <div className="mb-5 rounded-xl border border-amber-300 bg-conteo-claro px-5 py-3 text-sm">
          <strong>{soloPendientes.length}</strong> pagos pendientes o vencidos este mes.{" "}
          <span className="text-amber-800">Usa el botón de WhatsApp para recordar.</span>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-tinta/10 bg-papel-claro">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-tinta/10 text-left text-xs uppercase tracking-wide text-tinta/50">
                <th className="px-4 py-3 font-semibold">Alumno</th>
                <th className="px-4 py-3 font-semibold">Mes</th>
                <th className="px-4 py-3 font-semibold">Monto</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 font-semibold">Vence</th>
                <th className="px-4 py-3 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-tinta/40">
                    Sin pagos para este mes
                  </td>
                </tr>
              )}
              {filtrados.map((p) => {
                const alumno = p.alumno ?? null;
                const telefono = alumno?.padre_telefono ?? null;
                return (
                  <tr key={p.id} className="border-b border-tinta/5 last:border-0 hover:bg-papel">
                    <td className="px-4 py-3 font-medium text-tinta">{alumno?.nombre ?? "—"}</td>
                    <td className="px-4 py-3 text-tinta/70">{p.mes}</td>
                    <td className="px-4 py-3">${Number(p.monto).toLocaleString("es-CO")}</td>
                    <td className="px-4 py-3">
                      {p.estado === "pagado" ? (
                        <Badge variant="ok">{p.estado}</Badge>
                      ) : p.estado === "vencido" ? (
                        <Badge variant="falta">{p.estado}</Badge>
                      ) : (
                        <Badge variant="estado">{p.estado}</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-tinta/60">{p.fecha_vencimiento}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {p.estado !== "pagado" && (
                          <button
                            onClick={() => marcarPagado.mutate({ id: p.id, fecha_pago: new Date().toISOString().slice(0, 10) })}
                            className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ok transition-colors hover:bg-ok-claro"
                          >
                            Marcar pagado
                          </button>
                        )}
                        {telefono && p.estado !== "pagado" && (
                          <a
                            href={`https://wa.me/57${telefono.replace(/[^\d]/g, "")}?text=${textoRecordatorio(alumno?.nombre ?? "", p.monto, p.mes)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ok transition-colors hover:bg-ok-claro"
                          >
                            <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                          </a>
                        )}
                        <button
                          onClick={() => eliminar.mutate(p.id)}
                          className="rounded-lg p-2 text-tinta/50 transition-colors hover:bg-papel hover:text-falta"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        abierto={modalAbierto}
        titulo="Registrar pago"
        onCerrar={() => setModalAbierto(false)}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Alumno">
            <Select value={form.alumno_id} onChange={set("alumno_id")} required>
              <option value="">Selecciona…</option>
              {(alumnos ?? [])
                .filter((a) => a.estado === "activo")
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nombre}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="Mes">
            <input
              type="month"
              value={form.mes}
              onChange={set("mes")}
              className="w-full rounded-lg border border-tinta/15 bg-papel-claro px-3 py-2 text-sm text-tinta outline-none focus:border-mantis"
            />
          </Field>
          <Field label="Monto ($)">
            <Input
              type="number"
              min={0}
              step="500"
              value={form.monto || ""}
              onChange={set("monto")}
              placeholder="80000"
            />
          </Field>
          <Field label="Fecha de vencimiento">
            <Input type="date" value={form.fecha_vencimiento} onChange={set("fecha_vencimiento")} />
          </Field>
          <Field label="Estado">
            <Select value={form.estado} onChange={set("estado")}>
              <option value="pagado">Pagado</option>
              <option value="pendiente">Pendiente</option>
              <option value="vencido">Vencido</option>
            </Select>
          </Field>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secundario" onClick={() => setModalAbierto(false)}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={!form.alumno_id || form.monto <= 0}>
            Registrar
          </Button>
        </div>
      </Modal>
    </>
  );
}