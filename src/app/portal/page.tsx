"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import Badge from "@/components/ui/Badge";
import {
  User,
  Award,
  Calendar,
  Clock,
  CircleDollarSign,
  TrendingUp,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Clock3,
  Phone,
  Info,
} from "lucide-react";

export default function PortalPadrePage() {
  const { data: fichas, isLoading, error } = trpc.usuario.miFichaPadre.useQuery();
  const [hijoActivoIndex, setHijoActivoIndex] = useState(0);

  const formatearCOP = (valor: number) =>
    new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(valor);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border-2 border-dorado bg-mantis text-xl font-bold text-dorado animate-pulse">
            武
          </div>
          <p className="text-sm font-semibold text-tinta/70">Cargando ficha del alumno...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-rojo/30 bg-rojo/10 p-6 text-center text-sm text-rojo">
        Error al cargar la información: {error.message}
      </div>
    );
  }

  if (!fichas || fichas.length === 0) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-tinta/10 bg-papel-claro p-8 text-center shadow-md">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-mantis/10 text-mantis-dark">
          <User className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-tinta">¡Bienvenido al Portal de Padres!</h2>
        <p className="mt-2 text-sm text-tinta/70 leading-relaxed">
          Tu cuenta aún no tiene un alumno vinculado. Por favor, comunícate con la administración de{" "}
          <strong>Mantis Box Sabanalarga</strong> para que asocien tu usuario a la ficha de tu hijo.
        </p>
      </div>
    );
  }

  const fichaActual = fichas[hijoActivoIndex] || fichas[0];
  const { alumno, pagos, deudas, asistencia } = fichaActual;

  // Total de deudas pendientes por eventos
  const totalDeudasMonto = deudas.reduce((acc, d) => acc + Number(d.monto_total || 0), 0);
  const totalDeudasPagado = deudas.reduce((acc, d) => acc + Number(d.monto_pagado || 0), 0);
  const saldoDeudasTotal = Math.max(0, totalDeudasMonto - totalDeudasPagado);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Selector si el padre tiene más de un hijo en la escuela */}
      {fichas.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-xs font-semibold text-tinta/60 whitespace-nowrap">Hijos inscritos:</span>
          {fichas.map((f, idx) => (
            <button
              key={f.alumno.id}
              onClick={() => setHijoActivoIndex(idx)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                hijoActivoIndex === idx
                  ? "bg-mantis text-papel shadow-sm"
                  : "border border-tinta/15 bg-papel text-tinta/70 hover:bg-papel/80"
              }`}
            >
              {f.alumno.nombre}
            </button>
          ))}
        </div>
      )}

      {/* Encabezado Ficha del Alumno */}
      <div className="overflow-hidden rounded-2xl border border-tinta/10 bg-papel-claro p-6 shadow-sm">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border-2 border-dorado bg-mantis text-2xl font-bold text-dorado shadow-inner">
              武
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-black tracking-tight text-tinta">
                  {alumno.nombre}
                </h1>
                <Badge variant={alumno.estado === "activo" ? "exito" : "alerta"}>
                  {alumno.estado}
                </Badge>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-tinta/60">
                <span className="inline-flex items-center gap-1 font-semibold text-mantis-dark">
                  <Award className="h-3.5 w-3.5" /> Cinta {alumno.nivel_cinta}
                </span>
                <span>•</span>
                <span className="capitalize">{alumno.categoria}</span>
                {alumno.fecha_nacimiento && (
                  <>
                    <span>•</span>
                    <span>Nacimiento: {new Date(alumno.fecha_nacimiento).toLocaleDateString("es-CO")}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Grupo y Horarios */}
          {alumno.grupo && (
            <div className="rounded-xl border border-tinta/10 bg-papel/60 p-3.5 text-xs text-tinta sm:max-w-xs">
              <div className="font-bold text-mantis-dark">{alumno.grupo.nombre}</div>
              <div className="mt-1 flex items-center gap-1.5 text-tinta/70">
                <Calendar className="h-3.5 w-3.5 shrink-0 text-dorado" />
                <span>{alumno.grupo.dias}</span>
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-tinta/70">
                <Clock className="h-3.5 w-3.5 shrink-0 text-dorado" />
                <span>
                  {alumno.grupo.hora_inicio} - {alumno.grupo.hora_fin}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SECCIÓN ESTRELLA: Deudas por Eventos / Préstamos Especiales */}
      <div className="rounded-2xl border-2 border-dorado/40 bg-papel-claro p-6 shadow-md">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-dorado/20 text-dorado">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-tinta">
                Deudas por Eventos & Préstamos
              </h2>
              <p className="text-xs text-tinta/60">
                Conceptos adicionales asignados (dotación, torneos, préstamos) y avance de pago
              </p>
            </div>
          </div>

          {saldoDeudasTotal > 0 ? (
            <div className="rounded-xl bg-rojo/10 px-3.5 py-1.5 text-xs font-bold text-rojo border border-rojo/20 self-start sm:self-auto">
              Saldo pendiente: {formatearCOP(saldoDeudasTotal)}
            </div>
          ) : (
            <div className="rounded-xl bg-mantis/15 px-3.5 py-1.5 text-xs font-bold text-mantis-dark border border-mantis/30 self-start sm:self-auto">
              Al día en préstamos y eventos ✓
            </div>
          )}
        </div>

        {deudas.length === 0 ? (
          <div className="mt-5 rounded-xl border border-dashed border-tinta/15 bg-papel/40 p-6 text-center text-sm text-tinta/50">
            No tienes préstamos ni cobros por eventos asignados en este momento.
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {deudas.map((d) => {
              const montoTotal = Number(d.monto_total || 0);
              const montoPagado = Number(d.monto_pagado || 0);
              const saldo = Math.max(0, montoTotal - montoPagado);
              const pct =
                montoTotal > 0
                  ? Math.min(100, Math.round((montoPagado / montoTotal) * 100))
                  : 0;

              return (
                <div
                  key={d.id}
                  className="rounded-xl border border-tinta/10 bg-papel p-4 shadow-sm"
                >
                  <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-tinta text-base">
                          {d.deuda?.nombre || "Evento Especial"}
                        </span>
                        <Badge
                          variant={
                            d.estado === "pagado"
                              ? "exito"
                              : d.estado === "parcial"
                              ? "alerta"
                              : "peligro"
                          }
                        >
                          {d.estado === "pagado" ? "Pagado ✓" : d.estado}
                        </Badge>
                      </div>
                      {d.deuda?.descripcion && (
                        <p className="mt-1 text-xs text-tinta/70">{d.deuda.descripcion}</p>
                      )}
                    </div>

                    <div className="text-right text-xs">
                      <span className="font-semibold text-tinta/60">Saldo restante: </span>
                      <span className="font-black text-sm text-rojo">{formatearCOP(saldo)}</span>
                    </div>
                  </div>

                  {/* BARRA DE PROGRESO DE PAGO */}
                  <div className="mt-3">
                    <div className="flex justify-between text-xs font-semibold text-tinta/70 mb-1">
                      <span>Pagado: {formatearCOP(montoPagado)}</span>
                      <span>Total: {formatearCOP(montoTotal)}</span>
                    </div>
                    <div className="h-4 w-full overflow-hidden rounded-full bg-tinta/10 p-0.5 border border-tinta/10">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ease-out flex items-center justify-end pr-2 text-[10px] font-extrabold text-papel ${
                          pct === 100
                            ? "bg-mantis"
                            : pct > 40
                            ? "bg-gradient-to-r from-dorado to-mantis"
                            : "bg-dorado"
                        }`}
                        style={{ width: `${Math.max(8, pct)}%` }}
                      >
                        {pct}%
                      </div>
                    </div>
                  </div>

                  {/* Detalle de pagos realizados si hay */}
                  {d.pagos && d.pagos.length > 0 && (
                    <div className="mt-3 border-t border-tinta/10 pt-2 text-xs">
                      <span className="font-semibold text-tinta/60">Abonos realizados:</span>
                      <div className="mt-1 space-y-1">
                        {d.pagos.map((p: { id: string; monto: number; fecha: string; nota: string | null }) => (
                          <div
                            key={p.id}
                            className="flex items-center justify-between text-tinta/70"
                          >
                            <span>
                              {new Date(p.fecha).toLocaleDateString("es-CO")}{" "}
                              {p.nota ? `(${p.nota})` : ""}
                            </span>
                            <span className="font-bold text-mantis-dark">
                              +{formatearCOP(p.monto)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Grid: Mensualidades & Asistencia */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Mensualidades */}
        <div className="rounded-2xl border border-tinta/10 bg-papel-claro p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CircleDollarSign className="h-5 w-5 text-mantis" />
              <h3 className="font-bold text-tinta">Mensualidades</h3>
            </div>
            <span className="text-xs text-tinta/50">Historial reciente</span>
          </div>

          <div className="mt-4 space-y-2.5">
            {pagos.length === 0 ? (
              <p className="py-6 text-center text-xs text-tinta/40">
                No hay pagos de mensualidad registrados aún.
              </p>
            ) : (
              pagos.slice(0, 6).map((pago) => (
                <div
                  key={pago.id}
                  className="flex items-center justify-between rounded-xl border border-tinta/5 bg-papel p-3 text-sm"
                >
                  <div>
                    <div className="font-bold capitalize text-tinta">{pago.mes}</div>
                    <div className="text-xs text-tinta/50">
                      Vence: {new Date(pago.fecha_vencimiento).toLocaleDateString("es-CO")}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-tinta">
                      {formatearCOP(pago.monto)}
                    </span>
                    <Badge
                      variant={
                        pago.estado === "pagado"
                          ? "exito"
                          : pago.estado === "pendiente"
                          ? "alerta"
                          : "peligro"
                      }
                    >
                      {pago.estado}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Asistencia */}
        <div className="rounded-2xl border border-tinta/10 bg-papel-claro p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-dorado" />
              <h3 className="font-bold text-tinta">Asistencia & Disciplina</h3>
            </div>
            <span className="text-xs text-tinta/50">Sesiones registradas</span>
          </div>

          <div className="mt-6 flex flex-col items-center justify-center p-4">
            <div className="relative flex h-28 w-28 items-center justify-center rounded-full border-4 border-mantis bg-mantis/10 shadow-inner">
              <span className="text-3xl font-black text-tinta">
                {asistencia.porcentajeAsistencia}%
              </span>
            </div>
            <p className="mt-3 text-sm font-semibold text-tinta">
              {asistencia.totalPresente} de {asistencia.totalSesiones} clases asistidas
            </p>
            <p className="text-xs text-tinta/50">
              {asistencia.porcentajeAsistencia >= 85
                ? "¡Excelente constancia y disciplina marcial!"
                : "Se recomienda mayor regularidad en los entrenamientos."}
            </p>
          </div>
        </div>
      </div>

      {/* Banner de Contacto / Pagos */}
      <div className="flex items-start gap-3 rounded-xl border border-dorado/30 bg-dorado/10 p-4 text-xs text-tinta/80">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-dorado" />
        <div>
          <p className="font-bold text-tinta">¿Cómo realizar abonos o pagos?</p>
          <p className="mt-0.5">
            Puedes efectuar tus transferencias a la cuenta oficial de Mantis Box Sabanalarga o abonar directamente en la academia. El comprobante será verificado por el maestro y verás tu barra de progreso actualizarse automáticamente aquí.
          </p>
        </div>
      </div>
    </div>
  );
}
