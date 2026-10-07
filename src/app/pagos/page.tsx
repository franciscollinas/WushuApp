"use client";

import { MessageCircle, Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { useMemo, useState } from "react";
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
  const { data: config } = trpc.pago.config.useQuery();
  const [mesFiltro, setMesFiltro] = useState(mesActual);
  const [valorEdit, setValorEdit] = useState<string | null>(null);

  const guardarValor = trpc.pago.setMensualidad.useMutation({
    onSuccess: () => {
      toast.success("Valor de la mensualidad guardado");
      setValorEdit(null);
      utils.pago.config.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const generarMes = trpc.pago.generarMes.useMutation({
    onSuccess: (r) => {
      toast.success(
        r.creados > 0
          ? `Se crearon ${r.creados} mensualidades pendientes`
          : "Todos los alumnos activos ya tienen su mensualidad de este mes"
      );
      utils.pago.list.invalidate();
      utils.pago.listByMes.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

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
    onMutate: async ({ id }) => {
      await utils.pago.list.cancel();
      const prevList = utils.pago.list.getData();
      utils.pago.list.setData(undefined, (prev) =>
        prev
          ? prev.map((x) => (x.id === id ? { ...x, estado: "pagado" as const } : x))
          : prev
      );
      return { prevList };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prevList) utils.pago.list.setData(undefined, ctx.prevList);
      toast.error(e.message);
    },
    onSuccess: () => {
      toast.success("Marcado como pagado");
    },
    onSettled: () => {
      utils.pago.list.invalidate();
      utils.pago.listByMes.invalidate();
      utils.dashboard.estadisticas.invalidate();
    },
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
  const [confirmando, setConfirmando] = useState<{ id: string; alumno: string } | null>(null);
  const [metodoConfirmacion, setMetodoConfirmacion] = useState("Efectivo");
  const [obsConfirmacion, setObsConfirmacion] = useState("");

  const set = (k: keyof typeof vacio) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const filtrados = useMemo(
    () => (pagos ?? []).filter((p) => p.mes === mesFiltro),
    [pagos, mesFiltro]
  );
  const totalMes = useMemo(
    () => filtrados.filter((p) => p.estado === "pagado").reduce((s, p) => s + p.monto, 0),
    [filtrados]
  );
  const soloPendientes = useMemo(
    () => filtrados.filter((p) => p.estado !== "pagado"),
    [filtrados]
  );

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

      <div className="mb-5 flex flex-wrap items-end justify-between gap-4 rounded-xl border border-tinta/10 bg-papel-claro px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-tinta/60">Valor de la mensualidad (todos los alumnos)</p>
          <div className="mt-1 flex items-center gap-2">
            <Input
              type="number"
              min={0}
              step="500"
              value={valorEdit ?? String(config?.mensualidad_monto ?? "")}
              onChange={(e) => setValorEdit(e.target.value)}
              placeholder="80000"
              className="w-40"
            />
            <Button
              variant="secundario"
              disabled={valorEdit === null || guardarValor.isPending}
              onClick={() => guardarValor.mutate({ monto: Number(valorEdit) || 0 })}
            >
              Guardar
            </Button>
          </div>
        </div>
        <div className="text-right">
          <Button
            variant="secundario"
            disabled={generarMes.isPending}
            onClick={() => generarMes.mutate({ mes: mesFiltro })}
          >
            Generar mensualidades de {mesFiltro}
          </Button>
          <p className="mt-1 text-xs text-tinta/50">
            Crea el cobro pendiente de cada alumno activo. El acceso de los padres se bloquea el
            día 5 si el mes no está pagado.
          </p>
        </div>
      </div>

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
                            onClick={() => {
                              setConfirmando({ id: p.id, alumno: alumno?.nombre ?? "" });
                              setMetodoConfirmacion("Efectivo");
                              setObsConfirmacion("");
                            }}
                            className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ok transition-colors hover:bg-ok-claro"
                          >
                            Marcar pagado
                          </button>
                        )}
                        {p.estado === "pagado" && (
                          <a
                            href={`/comprobante/${p.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-mantis transition-colors hover:bg-papel"
                          >
                            Comprobante
                          </a>
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

      <Modal
        abierto={!!confirmando}
        titulo="Confirmar pago"
        onCerrar={() => setConfirmando(null)}
      >
        {confirmando && (
          <div className="space-y-4">
            <p className="text-sm text-tinta/70">
              Confirma que el dinero de <strong>{confirmando.alumno}</strong> ya llegó. Se generará
              su comprobante de pago.
            </p>
            <Field label="Método de pago">
              <Select value={metodoConfirmacion} onChange={(e) => setMetodoConfirmacion(e.target.value)}>
                <option>Efectivo</option>
                <option>Transferencia</option>
                <option>Nequi</option>
                <option>Daviplata</option>
                <option>Otro</option>
              </Select>
            </Field>
            <Field label="Observaciones (opcional)">
              <Input
                value={obsConfirmacion}
                onChange={(e) => setObsConfirmacion(e.target.value)}
                placeholder="Ej. Pagó la mensualidad completa"
              />
            </Field>
            <div className="flex justify-end gap-3">
              <Button variant="secundario" onClick={() => setConfirmando(null)}>
                Cancelar
              </Button>
              <Button
                disabled={marcarPagado.isPending}
                onClick={() => {
                  marcarPagado.mutate({
                    id: confirmando.id,
                    fecha_pago: new Date().toISOString().slice(0, 10),
                    metodo_pago: metodoConfirmacion,
                    observaciones: obsConfirmacion.trim() || undefined,
                  });
                  setConfirmando(null);
                }}
              >
                Confirmar pago
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}