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
import type { AbonoResumen, PagoConAlumno } from "@/types/supabase";

const METODOS = ["Efectivo", "Transferencia", "Nequi", "Daviplata", "Otro"];

const cop = (n: number) => `$${Math.round(Number(n) || 0).toLocaleString("es-CO")}`;

function textoRecordatorio(nombre: string, saldo: number, mes: string) {
  const [anio, m] = mes.split("-");
  const nombreMes = new Date(Number(anio), Number(m) - 1, 1).toLocaleDateString("es-CO", {
    month: "long",
    year: "numeric",
  });
  return encodeURIComponent(
    `Hola, te escribimos de Mantis Box Sabanalarga. Te recordamos que la mensualidad de ${nombreMes} para ${nombre} tiene un saldo pendiente de ${cop(saldo)}. ¡Gracias!`
  );
}

const hoyISO = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });

// Una fila editable por cada pago recibido. Se vuelve a montar al guardar (por su key)
// para que muestre siempre lo que quedó guardado.
function FilaAbono({
  abono,
  ocupado,
  onGuardar,
  onEliminar,
}: {
  abono: AbonoResumen;
  ocupado: boolean;
  onGuardar: (d: { monto: number; fecha_pago: string; metodo_pago: string; observaciones: string }) => void;
  onEliminar: () => void;
}) {
  const [monto, setMonto] = useState(String(abono.monto));
  const [fecha, setFecha] = useState(abono.fecha_pago);
  const [metodo, setMetodo] = useState(abono.metodo_pago ?? "Efectivo");
  const [obs, setObs] = useState(abono.observaciones ?? "");
  const metodos = METODOS.includes(metodo) ? METODOS : [...METODOS, metodo];

  return (
    <div className="space-y-3 rounded-xl border border-tinta/10 p-3">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-tinta/70">
          Pago {abono.comprobante_numero ? `#${abono.comprobante_numero}` : ""}
        </span>
        <a
          href={`/comprobante/${abono.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-mantis hover:underline"
        >
          Ver comprobante
        </a>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Valor ($)">
          <Input type="number" min={0} step="500" value={monto} onChange={(e) => setMonto(e.target.value)} />
        </Field>
        <Field label="Fecha">
          <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </Field>
        <Field label="Método">
          <Select value={metodo} onChange={(e) => setMetodo(e.target.value)}>
            {metodos.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Observaciones">
        <Input value={obs} onChange={(e) => setObs(e.target.value)} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button variant="peligro" size="sm" disabled={ocupado} onClick={onEliminar}>
          Eliminar pago
        </Button>
        <Button
          size="sm"
          disabled={ocupado || !Number(monto) || !fecha}
          onClick={() => onGuardar({ monto: Number(monto), fecha_pago: fecha, metodo_pago: metodo, observaciones: obs })}
        >
          Guardar cambios
        </Button>
      </div>
    </div>
  );
}

export default function PagosPage() {
  const utils = trpc.useUtils();
  const mesActual = hoyISO().slice(0, 7);

  const { data: pagos } = trpc.pago.list.useQuery();
  const { data: alumnos } = trpc.alumno.list.useQuery();
  const { data: config } = trpc.pago.config.useQuery();
  const [mesFiltro, setMesFiltro] = useState(mesActual);
  const [valorEdit, setValorEdit] = useState<string | null>(null);

  const refrescar = () => {
    utils.pago.list.invalidate();
    utils.pago.listByMes.invalidate();
    utils.dashboard.estadisticas.invalidate();
  };

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
          ? `Se crearon ${r.creados} cobros pendientes`
          : "Todos los alumnos activos ya tienen su cobro de este mes"
      );
      refrescar();
    },
    onError: (e) => toast.error(e.message),
  });

  // Registrar un pago nuevo (alumno + mes)
  const registrarPago = trpc.pago.registrarPago.useMutation({
    onSuccess: () => {
      toast.success("Pago registrado");
      setModalNuevo(false);
      refrescar();
    },
    onError: (e) => toast.error(e.message),
  });
  // Abonar a un cobro que ya existe
  const registrarAbono = trpc.pago.registrarAbono.useMutation({
    onSuccess: () => {
      toast.success("Pago registrado");
      setAbonando(null);
      refrescar();
    },
    onError: (e) => toast.error(e.message),
  });
  const eliminar = trpc.pago.delete.useMutation({
    onSuccess: refrescar,
    onError: (e) => toast.error(e.message),
  });
  const editarPago = trpc.pago.editarPago.useMutation({
    onSuccess: () => {
      toast.success("Cobro actualizado");
      refrescar();
    },
    onError: (e) => toast.error(e.message),
  });
  const editarAbono = trpc.pago.editarAbono.useMutation({
    onSuccess: () => {
      toast.success("Pago actualizado");
      refrescar();
    },
    onError: (e) => toast.error(e.message),
  });
  const eliminarAbono = trpc.pago.eliminarAbono.useMutation({
    onSuccess: () => {
      toast.success("Pago eliminado");
      refrescar();
    },
    onError: (e) => toast.error(e.message),
  });

  const [modalNuevo, setModalNuevo] = useState(false);
  const [nuevo, setNuevo] = useState({
    alumno_id: "",
    mes: mesActual,
    monto: "",
    metodo_pago: "Efectivo",
    observaciones: "",
  });
  const [abonando, setAbonando] = useState<PagoConAlumno | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editCobro, setEditCobro] = useState({ monto: "", vence: "" });
  const editandoPago = (pagos ?? []).find((p) => p.id === editandoId) ?? null;
  const [abono, setAbono] = useState({ monto: "", metodo_pago: "Efectivo", observaciones: "" });

  const filtrados = useMemo(
    () => (pagos ?? []).filter((p) => p.mes === mesFiltro),
    [pagos, mesFiltro]
  );
  const totalMes = useMemo(
    () => filtrados.reduce((s, p) => s + Number(p.monto_pagado || 0), 0),
    [filtrados]
  );
  const soloPendientes = useMemo(
    () => filtrados.filter((p) => p.estado !== "pagado"),
    [filtrados]
  );
  const becados = useMemo(
    () => (alumnos ?? []).filter((a) => a.estado === "activo" && a.modalidad_pago === "becado").length,
    [alumnos]
  );

  const abrirEditar = (p: PagoConAlumno) => {
    setEditandoId(p.id);
    setEditCobro({ monto: String(p.monto), vence: p.fecha_vencimiento });
  };

  const abrirAbono = (p: PagoConAlumno) => {
    const saldo = Math.max(0, Number(p.monto) - Number(p.monto_pagado || 0));
    setAbonando(p);
    setAbono({ monto: String(saldo), metodo_pago: "Efectivo", observaciones: "" });
  };

  const alumnosPagan = (alumnos ?? []).filter(
    (a) => a.estado === "activo" && a.modalidad_pago !== "becado"
  );

  return (
    <>
      <PageHeader
        titulo="Pagos"
        descripcion="Mensualidades por alumno"
        accion={
          <Button
            onClick={() => {
              setNuevo({ alumno_id: "", mes: mesActual, monto: "", metodo_pago: "Efectivo", observaciones: "" });
              setModalNuevo(true);
            }}
          >
            <Plus className="h-4 w-4" /> Registrar pago
          </Button>
        }
      />

      <div className="mb-5 flex flex-wrap items-end justify-between gap-4 rounded-xl bg-papel-claro px-5 py-4 shadow-[var(--sombra-md)]">
        <div>
          <p className="text-sm font-semibold text-tinta/70">Valor de la mensualidad (todos los alumnos)</p>
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
            Generar cobros de {mesFiltro}
          </Button>
          <p className="mt-1 max-w-xs text-xs text-tinta/60">
            Crea el cobro pendiente de cada alumno activo (los becados no tienen cobro).
          </p>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-papel-claro px-5 py-4 shadow-[var(--sombra-md)]">
        <div>
          <p className="text-sm font-semibold text-tinta/70">Mes visible</p>
          <p className="text-2xl font-semibold text-tinta">
            {cop(totalMes)} <span className="text-sm font-normal text-tinta/60">cobrado</span>
          </p>
          {becados > 0 && (
            <p className="mt-1 text-xs text-tinta/60">
              {becados} {becados === 1 ? "alumno becado" : "alumnos becados"} (sin cobro)
            </p>
          )}
        </div>
        <input
          type="month"
          value={mesFiltro}
          onChange={(e) => setMesFiltro(e.target.value)}
          className="min-h-11 rounded-xl border border-tinta/20 bg-papel-claro px-3 py-2 text-sm text-tinta outline-none focus:border-mantis focus:ring-2 focus:ring-mantis/25"
        />
      </div>

      {soloPendientes.length > 0 && (
        <div className="mb-5 rounded-xl border border-amber-300 bg-conteo-claro px-5 py-3 text-sm">
          <strong>{soloPendientes.length}</strong> cobros pendientes, con pago parcial o vencidos este mes.{" "}
          <span className="text-amber-800">Usa el botón de WhatsApp para recordar.</span>
        </div>
      )}

      <div className="overflow-hidden rounded-xl bg-papel-claro shadow-[var(--sombra-md)]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-tinta/10 text-left text-xs uppercase tracking-wide text-tinta/60">
                <th className="px-4 py-3 font-semibold">Alumno</th>
                <th className="px-4 py-3 font-semibold">Mes</th>
                <th className="px-4 py-3 font-semibold">Pagado</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 font-semibold">Vence</th>
                <th className="px-4 py-3 text-right font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-tinta/60">
                    Sin cobros para este mes
                  </td>
                </tr>
              )}
              {filtrados.map((p) => {
                const alumno = p.alumno ?? null;
                const telefono = alumno?.padre_telefono ?? null;
                const saldo = Math.max(0, Number(p.monto) - Number(p.monto_pagado || 0));
                return (
                  <tr key={p.id} className="border-b border-tinta/5 last:border-0 hover:bg-papel">
                    <td className="px-4 py-3">
                      <div className="font-medium text-tinta">{alumno?.nombre ?? "—"}</div>
                      {alumno?.modalidad_pago === "semanal" && (
                        <span className="text-xs font-semibold text-mantis-dark">Paga semanal</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-tinta/70">{p.mes}</td>
                    <td className="px-4 py-3">
                      <span className="font-semibold">{cop(p.monto_pagado)}</span>
                      <span className="text-tinta/60"> de {cop(p.monto)}</span>
                      {p.estado !== "pagado" && Number(p.monto_pagado) > 0 && (
                        <div className="text-xs text-tinta/60">Falta {cop(saldo)}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {p.estado === "pagado" ? (
                        <Badge variant="ok">pagado</Badge>
                      ) : p.estado === "parcial" ? (
                        <Badge variant="alerta">parcial</Badge>
                      ) : p.estado === "vencido" ? (
                        <Badge variant="falta">vencido</Badge>
                      ) : (
                        <Badge variant="estado">{p.estado}</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-tinta/70">{p.fecha_vencimiento}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        {(p.abonos ?? []).map((ab) => (
                          <a
                            key={ab.id}
                            href={`/comprobante/${ab.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={`${cop(ab.monto)} · ${ab.fecha_pago}`}
                            className="rounded-full px-2.5 py-1 text-xs font-semibold text-mantis transition-colors hover:bg-papel"
                          >
                            Comprobante {ab.comprobante_numero ? `#${ab.comprobante_numero}` : ""}
                          </a>
                        ))}
                        <button
                          onClick={() => abrirEditar(p)}
                          className="rounded-full px-2.5 py-1.5 text-xs font-semibold text-tinta/70 transition-colors hover:bg-papel hover:text-tinta"
                        >
                          Editar
                        </button>
                        {saldo > 0 && (
                          <button
                            onClick={() => abrirAbono(p)}
                            className="rounded-full px-2.5 py-1.5 text-xs font-semibold text-mantis transition-colors hover:bg-mantis-light/50"
                          >
                            Registrar pago
                          </button>
                        )}
                        {telefono && saldo > 0 && (
                          <a
                            href={`https://wa.me/57${telefono.replace(/[^\d]/g, "")}?text=${textoRecordatorio(alumno?.nombre ?? "", saldo, p.mes)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold text-ok transition-colors hover:bg-ok-claro"
                          >
                            <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                          </a>
                        )}
                        <button
                          onClick={() => {
                            if (
                              confirm(
                                `¿Eliminar el cobro de ${alumno?.nombre ?? "este alumno"} (${p.mes})? También se borran sus pagos y comprobantes.`
                              )
                            )
                              eliminar.mutate(p.id);
                          }}
                          aria-label="Eliminar cobro"
                          className="rounded-full p-2 text-tinta/60 transition-colors hover:bg-papel hover:text-falta"
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

      <Modal abierto={modalNuevo} titulo="Registrar pago" onCerrar={() => setModalNuevo(false)}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Alumno">
            <Select value={nuevo.alumno_id} onChange={(e) => setNuevo({ ...nuevo, alumno_id: e.target.value })}>
              <option value="">Selecciona…</option>
              {alumnosPagan.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre}
                  {a.modalidad_pago === "semanal" ? " (semanal)" : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Mes que paga">
            <input
              type="month"
              value={nuevo.mes}
              onChange={(e) => setNuevo({ ...nuevo, mes: e.target.value })}
              className="min-h-11 w-full rounded-xl border border-tinta/20 bg-papel-claro px-4 py-2.5 text-sm text-tinta outline-none focus:border-mantis focus:ring-2 focus:ring-mantis/25"
            />
          </Field>
          <Field label="Valor recibido ($)">
            <Input
              type="number"
              min={0}
              step="500"
              value={nuevo.monto}
              onChange={(e) => setNuevo({ ...nuevo, monto: e.target.value })}
              placeholder="80000"
            />
          </Field>
          <Field label="Método de pago">
            <Select value={nuevo.metodo_pago} onChange={(e) => setNuevo({ ...nuevo, metodo_pago: e.target.value })}>
              {METODOS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Observaciones (opcional)">
            <Input
              value={nuevo.observaciones}
              onChange={(e) => setNuevo({ ...nuevo, observaciones: e.target.value })}
              placeholder="Ej. Primera semana"
            />
          </Field>
        </div>
        <p className="mt-3 text-xs text-tinta/60">
          Puede ser el pago completo o una parte: el mes queda pagado al sumar el valor de la
          mensualidad. Cada pago genera su comprobante.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secundario" onClick={() => setModalNuevo(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!nuevo.alumno_id || !Number(nuevo.monto) || registrarPago.isPending}
            onClick={() =>
              registrarPago.mutate({
                alumno_id: nuevo.alumno_id,
                mes: nuevo.mes,
                monto: Number(nuevo.monto),
                metodo_pago: nuevo.metodo_pago,
                observaciones: nuevo.observaciones.trim() || undefined,
              })
            }
          >
            Registrar
          </Button>
        </div>
      </Modal>

      <Modal abierto={!!abonando} titulo="Registrar pago" onCerrar={() => setAbonando(null)}>
        {abonando && (
          <div className="space-y-4">
            <div className="rounded-xl bg-papel p-3 text-sm">
              <p className="font-semibold text-tinta">{abonando.alumno?.nombre}</p>
              <p className="text-tinta/70">
                Mensualidad {abonando.mes}: {cop(abonando.monto_pagado)} pagados de {cop(abonando.monto)}
              </p>
            </div>
            <Field label="Valor recibido ($)">
              <Input
                type="number"
                min={0}
                step="500"
                value={abono.monto}
                onChange={(e) => setAbono({ ...abono, monto: e.target.value })}
              />
            </Field>
            <Field label="Método de pago">
              <Select value={abono.metodo_pago} onChange={(e) => setAbono({ ...abono, metodo_pago: e.target.value })}>
                {METODOS.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </Select>
            </Field>
            <Field label="Observaciones (opcional)">
              <Input
                value={abono.observaciones}
                onChange={(e) => setAbono({ ...abono, observaciones: e.target.value })}
              />
            </Field>
            <div className="flex justify-end gap-3">
              <Button variant="secundario" onClick={() => setAbonando(null)}>
                Cancelar
              </Button>
              <Button
                disabled={!Number(abono.monto) || registrarAbono.isPending}
                onClick={() =>
                  registrarAbono.mutate({
                    pago_id: abonando.id,
                    monto: Number(abono.monto),
                    metodo_pago: abono.metodo_pago,
                    observaciones: abono.observaciones.trim() || undefined,
                  })
                }
              >
                Confirmar pago
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal abierto={!!editandoPago} titulo="Editar cobro y pagos" onCerrar={() => setEditandoId(null)}>
        {editandoPago && (
          <div className="space-y-5">
            <div className="rounded-xl bg-papel p-3 text-sm">
              <p className="font-semibold text-tinta">{editandoPago.alumno?.nombre}</p>
              <p className="text-tinta/70">
                Mensualidad {editandoPago.mes} · {cop(editandoPago.monto_pagado)} pagados de{" "}
                {cop(editandoPago.monto)}
              </p>
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold text-tinta">Cobro del mes</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Valor del cobro ($)">
                  <Input
                    type="number"
                    min={0}
                    step="500"
                    value={editCobro.monto}
                    onChange={(e) => setEditCobro({ ...editCobro, monto: e.target.value })}
                  />
                </Field>
                <Field label="Vence">
                  <Input
                    type="date"
                    value={editCobro.vence}
                    onChange={(e) => setEditCobro({ ...editCobro, vence: e.target.value })}
                  />
                </Field>
              </div>
              <div className="mt-3 flex justify-end">
                <Button
                  size="sm"
                  disabled={editarPago.isPending || !Number(editCobro.monto) || !editCobro.vence}
                  onClick={() =>
                    editarPago.mutate({
                      id: editandoPago.id,
                      monto: Number(editCobro.monto),
                      fecha_vencimiento: editCobro.vence,
                    })
                  }
                >
                  Guardar cobro
                </Button>
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold text-tinta">Pagos recibidos</p>
              {(editandoPago.abonos ?? []).length === 0 ? (
                <p className="rounded-xl border border-dashed border-tinta/20 p-4 text-center text-xs text-tinta/60">
                  Este cobro no tiene pagos registrados.
                </p>
              ) : (
                <div className="space-y-3">
                  {(editandoPago.abonos ?? []).map((ab) => (
                    <FilaAbono
                      key={`${ab.id}-${ab.monto}-${ab.fecha_pago}-${ab.metodo_pago}-${ab.observaciones}`}
                      abono={ab}
                      ocupado={editarAbono.isPending || eliminarAbono.isPending}
                      onGuardar={(d) =>
                        editarAbono.mutate({
                          id: ab.id,
                          monto: d.monto,
                          fecha_pago: d.fecha_pago,
                          metodo_pago: d.metodo_pago,
                          observaciones: d.observaciones || undefined,
                        })
                      }
                      onEliminar={() => {
                        if (
                          confirm(
                            `¿Eliminar este pago de ${cop(ab.monto)}? También se borra su comprobante.`
                          )
                        )
                          eliminarAbono.mutate(ab.id);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
