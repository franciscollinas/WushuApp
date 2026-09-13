"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { trpc } from "@/lib/trpc";
import PageHeader from "@/components/PageHeader";
import Button from "@/components/ui/Button";
import KPI from "@/components/ui/KPI";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import {
  CircleDollarSign,
  Plus,
  Users,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Trash2,
  Calendar,
  DollarSign,
  History,
} from "lucide-react";
import type { DeudaConTotales } from "@/types/supabase";

export default function DeudasPage() {
  const utils = trpc.useUtils();
  const { data: deudas, isLoading } = trpc.deuda.list.useQuery();
  const { data: alumnos } = trpc.alumno.list.useQuery();

  // Estados de modales
  const [modalNuevaDeuda, setModalNuevaDeuda] = useState(false);
  const [nombreDeuda, setNombreDeuda] = useState("");
  const [descripcionDeuda, setDescripcionDeuda] = useState("");

  // Deuda seleccionada para expandir detalles
  const [deudaSeleccionadaId, setDeudaSeleccionadaId] = useState<string | null>(null);
  const { data: detalleDeuda, isLoading: cargandoDetalle } = trpc.deuda.getById.useQuery(
    deudaSeleccionadaId!,
    { enabled: !!deudaSeleccionadaId }
  );

  // Modal Asignar Alumno
  const [modalAsignar, setModalAsignar] = useState(false);
  const [alumnoAsignarId, setAlumnoAsignarId] = useState("");
  const [montoAsignar, setMontoAsignar] = useState("");

  // Modal Abonar
  const [modalAbonar, setModalAbonar] = useState(false);
  const [asigAbonarId, setAsigAbonarId] = useState("");
  const [nombreAlumnoAbonar, setNombreAlumnoAbonar] = useState("");
  const [montoAbono, setMontoAbono] = useState("");
  const [notaAbono, setNotaAbono] = useState("");

  // Modal Historial Abonos
  const [modalHistorial, setModalHistorial] = useState(false);
  const [historialPagos, setHistorialPagos] = useState<
    { id: string; monto: number; fecha: string; nota: string | null }[]
  >([]);
  const [alumnoHistorialNombre, setAlumnoHistorialNombre] = useState("");

  // Mutations
  const crearDeuda = trpc.deuda.create.useMutation({
    onSuccess: (nueva) => {
      toast.success("Deuda o evento creado");
      setModalNuevaDeuda(false);
      setNombreDeuda("");
      setDescripcionDeuda("");
      utils.deuda.list.invalidate();
      setDeudaSeleccionadaId(nueva.id);
    },
    onError: (e) => toast.error(e.message),
  });

  const eliminarDeuda = trpc.deuda.delete.useMutation({
    onSuccess: () => {
      toast.success("Deuda eliminada");
      if (deudaSeleccionadaId) setDeudaSeleccionadaId(null);
      utils.deuda.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const asignarAlumno = trpc.deuda.asignarAlumno.useMutation({
    onSuccess: () => {
      toast.success("Alumno asignado a la deuda");
      setModalAsignar(false);
      setAlumnoAsignarId("");
      setMontoAsignar("");
      utils.deuda.list.invalidate();
      if (deudaSeleccionadaId) utils.deuda.getById.invalidate(deudaSeleccionadaId);
    },
    onError: (e) => toast.error(e.message),
  });

  const eliminarAsignacion = trpc.deuda.eliminarAsignacion.useMutation({
    onSuccess: () => {
      toast.success("Asignación eliminada");
      utils.deuda.list.invalidate();
      if (deudaSeleccionadaId) utils.deuda.getById.invalidate(deudaSeleccionadaId);
    },
    onError: (e) => toast.error(e.message),
  });

  const abonar = trpc.deuda.abonar.useMutation({
    onSuccess: () => {
      toast.success("Abono registrado con éxito");
      setModalAbonar(false);
      setAsigAbonarId("");
      setMontoAbono("");
      setNotaAbono("");
      utils.deuda.list.invalidate();
      if (deudaSeleccionadaId) utils.deuda.getById.invalidate(deudaSeleccionadaId);
    },
    onError: (e) => toast.error(e.message),
  });

  // Cálculos globales
  const totalAsignadoGlobal = (deudas ?? []).reduce(
    (acc, d) => acc + (d.total_asignado || 0),
    0
  );
  const totalPagadoGlobal = (deudas ?? []).reduce(
    (acc, d) => acc + (d.total_pagado || 0),
    0
  );
  const porcentajeGlobal =
    totalAsignadoGlobal > 0
      ? Math.round((totalPagadoGlobal / totalAsignadoGlobal) * 100)
      : 0;

  const formatearCOP = (valor: number) =>
    new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(valor);

  const abrirAbono = (id: string, nombreAlumno: string) => {
    setAsigAbonarId(id);
    setNombreAlumnoAbonar(nombreAlumno);
    setMontoAbono("");
    setNotaAbono("");
    setModalAbonar(true);
  };

  const abrirHistorial = (
    nombre: string,
    pagos?: { id: string; monto: number; fecha: string; nota: string | null }[]
  ) => {
    setAlumnoHistorialNombre(nombre);
    setHistorialPagos(pagos ?? []);
    setModalHistorial(true);
  };

  return (
    <>
      <PageHeader
        titulo="Deudas & Eventos"
        descripcion="Administra préstamos especiales, dotaciones o eventos y monitorea el progreso de pago por alumno"
        accion={
          <Button onClick={() => setModalNuevaDeuda(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Nueva Deuda / Evento
          </Button>
        }
      />

      {/* Tarjetas KPI */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPI
          label="Eventos / Préstamos"
          valor={String((deudas ?? []).length)}
          icono={<CreditCard className="h-4 w-4 text-mantis" />}
          detalle="Conceptos creados"
        />
        <KPI
          label="Total Asignado"
          valor={formatearCOP(totalAsignadoGlobal)}
          icono={<DollarSign className="h-4 w-4 text-dorado" />}
          detalle="Suma prestada entre alumnos"
        />
        <KPI
          label="Total Recaudado"
          valor={formatearCOP(totalPagadoGlobal)}
          icono={<CircleDollarSign className="h-4 w-4 text-mantis" />}
          detalle={`${porcentajeGlobal}% recuperado`}
        />
        <KPI
          label="Saldo Pendiente"
          valor={formatearCOP(Math.max(0, totalAsignadoGlobal - totalPagadoGlobal))}
          icono={<Users className="h-4 w-4 text-rojo" />}
          detalle="Por cobrar a padres"
        />
      </div>

      {/* Lista de Deudas / Eventos */}
      <div className="space-y-4">
        {isLoading && (
          <div className="rounded-xl border border-tinta/10 bg-papel-claro p-12 text-center text-sm text-tinta/50">
            Cargando deudas...
          </div>
        )}

        {!isLoading && (deudas ?? []).length === 0 && (
          <div className="rounded-xl border border-tinta/10 bg-papel-claro p-12 text-center text-sm text-tinta/60">
            <CreditCard className="mx-auto mb-3 h-10 w-10 text-tinta/30" />
            <p className="font-semibold text-tinta">No hay eventos ni deudas registrados</p>
            <p className="mt-1 text-xs text-tinta/50">
              Crea una nueva deuda (por ejemplo: "Préstamo de Dotación 2026") y asígnale montos a los alumnos.
            </p>
            <div className="mt-4">
              <Button onClick={() => setModalNuevaDeuda(true)}>Crear primera deuda</Button>
            </div>
          </div>
        )}

        {(deudas ?? []).map((deuda: DeudaConTotales) => {
          const seleccionada = deudaSeleccionadaId === deuda.id;
          const pct =
            deuda.total_asignado > 0
              ? Math.min(100, Math.round((deuda.total_pagado / deuda.total_asignado) * 100))
              : 0;

          return (
            <div
              key={deuda.id}
              className="overflow-hidden rounded-xl border border-tinta/10 bg-papel-claro shadow-sm transition-all"
            >
              {/* Cabecera del Evento / Deuda */}
              <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-bold text-tinta">{deuda.nombre}</h3>
                    <Badge variant={pct === 100 ? "exito" : pct > 0 ? "alerta" : "info"}>
                      {pct === 100 ? "Completado" : `${pct}% recaudado`}
                    </Badge>
                  </div>
                  {deuda.descripcion && (
                    <p className="mt-1 text-sm text-tinta/70">{deuda.descripcion}</p>
                  )}
                  <p className="mt-1 text-xs text-tinta/40">
                    Creado el {new Date(deuda.fecha_creacion).toLocaleDateString("es-CO")} •{" "}
                    {deuda.alumnos_count} {deuda.alumnos_count === 1 ? "alumno" : "alumnos"} asignados
                  </p>

                  {/* Barra de progreso global del evento */}
                  <div className="mt-3 max-w-md">
                    <div className="flex justify-between text-xs font-semibold text-tinta/70">
                      <span>{formatearCOP(deuda.total_pagado)} pagados</span>
                      <span>Meta: {formatearCOP(deuda.total_asignado)}</span>
                    </div>
                    <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-tinta/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-mantis to-dorado transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="secundario"
                    size="sm"
                    onClick={() => {
                      if (seleccionada) {
                        setDeudaSeleccionadaId(null);
                      } else {
                        setDeudaSeleccionadaId(deuda.id);
                      }
                    }}
                    className="flex items-center gap-1.5"
                  >
                    {seleccionada ? (
                      <>
                        <ChevronUp className="h-4 w-4" />
                        Ocultar alumnos
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-4 w-4" />
                        Ver alumnos ({deuda.alumnos_count})
                      </>
                    )}
                  </Button>

                  <Button
                    variant="peligro"
                    size="sm"
                    onClick={() => {
                      if (
                        confirm(
                          `¿Eliminar la deuda "${deuda.nombre}"? Esto borrará también las asignaciones y abonos asociados.`
                        )
                      ) {
                        eliminarDeuda.mutate(deuda.id);
                      }
                    }}
                    title="Eliminar evento"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Vista expandida: alumnos asignados y abonos */}
              {seleccionada && (
                <div className="border-t border-tinta/10 bg-papel/40 p-5">
                  <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                    <div>
                      <h4 className="font-bold text-tinta">Alumnos asignados a este evento</h4>
                      <p className="text-xs text-tinta/60">
                        Cada alumno tiene su monto asignado y su barra individual de pagos.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => {
                        setAlumnoAsignarId("");
                        setMontoAsignar("");
                        setModalAsignar(true);
                      }}
                      className="flex items-center gap-1.5"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Asignar Alumno
                    </Button>
                  </div>

                  {cargandoDetalle && (
                    <div className="p-8 text-center text-xs text-tinta/50">Cargando alumnos...</div>
                  )}

                  {!cargandoDetalle && (detalleDeuda?.alumnos ?? []).length === 0 && (
                    <div className="rounded-lg border border-dashed border-tinta/20 p-6 text-center text-sm text-tinta/50">
                      No hay ningún alumno asignado todavía. Haz clic en "Asignar Alumno" para repartir la deuda.
                    </div>
                  )}

                  {!cargandoDetalle && (detalleDeuda?.alumnos ?? []).length > 0 && (
                    <div className="overflow-x-auto rounded-lg border border-tinta/10 bg-papel-claro">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-tinta/10 bg-papel/60 text-xs font-semibold uppercase text-tinta/50">
                            <th className="px-4 py-3">Alumno</th>
                            <th className="px-4 py-3">Monto Deuda</th>
                            <th className="px-4 py-3">Pagado</th>
                            <th className="px-4 py-3">Saldo</th>
                            <th className="px-4 py-3">Progreso</th>
                            <th className="px-4 py-3">Estado</th>
                            <th className="px-4 py-3 text-right">Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detalleDeuda?.alumnos.map((asig) => {
                            const saldo = Math.max(0, asig.monto_total - asig.monto_pagado);
                            const alumnoPct =
                              asig.monto_total > 0
                                ? Math.min(
                                    100,
                                    Math.round((asig.monto_pagado / asig.monto_total) * 100)
                                  )
                                : 0;

                            return (
                              <tr
                                key={asig.id}
                                className="border-b border-tinta/5 last:border-0 hover:bg-papel/30 transition-colors"
                              >
                                <td className="px-4 py-3">
                                  <div className="font-semibold text-tinta">
                                    {asig.alumno?.nombre}
                                  </div>
                                  <div className="text-xs text-tinta/50 capitalize">
                                    Cinta {asig.alumno?.nivel_cinta} • {asig.alumno?.categoria}
                                  </div>
                                </td>
                                <td className="px-4 py-3 font-medium text-tinta">
                                  {formatearCOP(asig.monto_total)}
                                </td>
                                <td className="px-4 py-3 font-semibold text-mantis-dark">
                                  {formatearCOP(asig.monto_pagado)}
                                </td>
                                <td className="px-4 py-3 font-bold text-rojo">
                                  {formatearCOP(saldo)}
                                </td>
                                <td className="px-4 py-3 min-w-[140px]">
                                  <div className="flex items-center gap-2">
                                    <div className="h-2 w-full overflow-hidden rounded-full bg-tinta/10">
                                      <div
                                        className={`h-full rounded-full transition-all duration-300 ${
                                          alumnoPct === 100
                                            ? "bg-mantis"
                                            : "bg-dorado"
                                        }`}
                                        style={{ width: `${alumnoPct}%` }}
                                      />
                                    </div>
                                    <span className="text-xs font-bold text-tinta/70 min-w-[32px]">
                                      {alumnoPct}%
                                    </span>
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <Badge
                                    variant={
                                      asig.estado === "pagado"
                                        ? "exito"
                                        : asig.estado === "parcial"
                                        ? "alerta"
                                        : "peligro"
                                    }
                                  >
                                    {asig.estado}
                                  </Badge>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    {asig.estado !== "pagado" && (
                                      <Button
                                        size="sm"
                                        variant="primario"
                                        onClick={() => abrirAbono(asig.id, asig.alumno?.nombre || "")}
                                        className="text-xs"
                                      >
                                        Abonar
                                      </Button>
                                    )}
                                    <Button
                                      size="sm"
                                      variant="secundario"
                                      onClick={() =>
                                        abrirHistorial(asig.alumno?.nombre || "", asig.pagos)
                                      }
                                      title="Historial de abonos"
                                    >
                                      <History className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="peligro"
                                      onClick={() => {
                                        if (
                                          confirm(
                                            `¿Desvincular a ${asig.alumno?.nombre} de esta deuda?`
                                          )
                                        ) {
                                          eliminarAsignacion.mutate(asig.id);
                                        }
                                      }}
                                      title="Quitar alumno"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal: Nueva Deuda */}
      <Modal
        abierto={modalNuevaDeuda}
        titulo="Crear Deuda o Evento Especial"
        onCerrar={() => setModalNuevaDeuda(false)}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            crearDeuda.mutate({
              nombre: nombreDeuda,
              descripcion: descripcionDeuda,
            });
          }}
          className="space-y-4"
        >
          <Field label="Nombre del concepto o evento">
            <Input
              required
              placeholder="Ej: Préstamo dotación uniforme o Torneo Nacional"
              value={nombreDeuda}
              onChange={(e) => setNombreDeuda(e.target.value)}
            />
          </Field>
          <Field label="Descripción o notas (opcional)">
            <Textarea
              placeholder="Ej: Préstamo de $1.000.000 distribuido entre los padres para indumentaria deportiva..."
              rows={3}
              value={descripcionDeuda}
              onChange={(e) => setDescripcionDeuda(e.target.value)}
            />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secundario"
              onClick={() => setModalNuevaDeuda(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={crearDeuda.isPending}>
              {crearDeuda.isPending ? "Guardando..." : "Crear Deuda"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Asignar Alumno */}
      <Modal
        abierto={modalAsignar}
        titulo="Asignar Alumno al Evento"
        onCerrar={() => setModalAsignar(false)}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!alumnoAsignarId) {
              toast.error("Selecciona un alumno.");
              return;
            }
            const monto = Number(montoAsignar);
            if (isNaN(monto) || monto <= 0) {
              toast.error("Ingresa un monto válido.");
              return;
            }
            asignarAlumno.mutate({
              deuda_id: deudaSeleccionadaId!,
              alumno_id: alumnoAsignarId,
              monto_total: monto,
            });
          }}
          className="space-y-4"
        >
          <Field label="Alumno">
            <Select
              required
              value={alumnoAsignarId}
              onChange={(e) => setAlumnoAsignarId(e.target.value)}
            >
              <option value="">-- Selecciona un alumno --</option>
              {(alumnos ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre} ({a.categoria} - {a.nivel_cinta})
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Monto que le corresponde pagar (COP)">
            <Input
              type="number"
              required
              min={1000}
              step={1000}
              placeholder="Ej: 50000"
              value={montoAsignar}
              onChange={(e) => setMontoAsignar(e.target.value)}
            />
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secundario"
              onClick={() => setModalAsignar(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={asignarAlumno.isPending}>
              {asignarAlumno.isPending ? "Asignando..." : "Asignar"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Abonar */}
      <Modal
        abierto={modalAbonar}
        titulo={`Registrar Abono a ${nombreAlumnoAbonar}`}
        onCerrar={() => setModalAbonar(false)}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const monto = Number(montoAbono);
            if (isNaN(monto) || monto <= 0) {
              toast.error("Ingresa un monto válido.");
              return;
            }
            abonar.mutate({
              deuda_alumno_id: asigAbonarId,
              monto,
              nota: notaAbono,
            });
          }}
          className="space-y-4"
        >
          <Field label="Monto del abono (COP)">
            <Input
              type="number"
              required
              min={1000}
              step={1000}
              placeholder="Ej: 20000"
              value={montoAbono}
              onChange={(e) => setMontoAbono(e.target.value)}
              autoFocus
            />
          </Field>

          <Field label="Detalle o Comprobante (opcional)">
            <Input
              placeholder="Ej: Transferencia Nequi / Efectivo en sede"
              value={notaAbono}
              onChange={(e) => setNotaAbono(e.target.value)}
            />
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secundario"
              onClick={() => setModalAbonar(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={abonar.isPending}>
              {abonar.isPending ? "Registrando..." : "Registrar Abono"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Historial de Abonos */}
      <Modal
        abierto={modalHistorial}
        titulo={`Historial de Abonos: ${alumnoHistorialNombre}`}
        onCerrar={() => setModalHistorial(false)}
      >
        <div className="space-y-3">
          {historialPagos.length === 0 ? (
            <p className="py-6 text-center text-sm text-tinta/50">
              No hay abonos registrados para este alumno todavía.
            </p>
          ) : (
            <div className="space-y-2">
              {historialPagos.map((pago) => (
                <div
                  key={pago.id}
                  className="flex items-center justify-between rounded-lg border border-tinta/10 bg-papel/50 p-3 text-sm"
                >
                  <div>
                    <div className="font-bold text-tinta">{formatearCOP(pago.monto)}</div>
                    {pago.nota && <p className="text-xs text-tinta/60">{pago.nota}</p>}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-tinta/40">
                    <Calendar className="h-3.5 w-3.5" />
                    {new Date(pago.fecha).toLocaleDateString("es-CO")}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-end pt-3">
            <Button variant="secundario" onClick={() => setModalHistorial(false)}>
              Cerrar
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
