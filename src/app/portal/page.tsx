"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import Badge from "@/components/ui/Badge";
import CambiarClave from "@/components/CambiarClave";
import AvisoPago from "@/components/AvisoPago";
import BloqueoPago from "@/components/BloqueoPago";
import FotoAlumno from "@/components/FotoAlumno";
import { etiquetaCinta, sinCinta, temaCinta } from "@/lib/cinta";
import { MES_INICIO_APP, nombreMes } from "@/lib/pagos";
import {
  User,
  Award,
  Calendar,
  Clock,
  CircleDollarSign,
  TrendingUp,
  CreditCard,
  Info,
} from "lucide-react";

const formateadorCOP = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});
const formatearCOP = (valor: number) => formateadorCOP.format(valor);

const esImagen = (url: string) =>
  /\.(png|jpe?g|webp|gif|avif)(\?.*)?$/i.test(url) || url.includes("/storage/v1/object/public/ejercicios/");

export default function PortalPadrePage() {
  const utils = trpc.useUtils();
  const { data: fichas, isLoading, error } = trpc.portal.mi.useQuery();
  const [hijoActivoIndex, setHijoActivoIndex] = useState(0);
  const [mesVista, setMesVista] = useState<string | null>(null);

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
  const {
    alumno,
    pagos,
    deudas,
    asistencia,
    bloqueado,
    mensualidad,
    recordatorio,
    razon,
    modalidad,
    eventos,
    evaluaciones,
    ejercicios,
  } = fichaActual;
  const tema = temaCinta(alumno.nivel_cinta);

  // Comprobantes: el padre elige el mes, solo desde el lanzamiento de la app.
  const mesElegido =
    mesVista && mensualidad.mesesDisponibles.includes(mesVista) ? mesVista : mensualidad.mesActual;
  const pagoElegido = pagos.find((p) => p.mes === mesElegido) ?? null;
  const hoyBogota = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  const diasPara = (fecha: string) =>
    Math.round(
      (new Date(`${fecha}T00:00:00`).getTime() - new Date(`${hoyBogota}T00:00:00`).getTime()) / 86400000
    );
  const TIPO_EVENTO: Record<string, string> = {
    examen: "Examen / grado",
    torneo: "Torneo",
    seminario: "Seminario",
    otro: "Evento",
  };

  // Cada préstamo se calcula por separado: lo pagado de más en uno NO compensa
  // lo que se debe en otro; se muestra como saldo a favor.
  const saldoDeudasTotal = deudas.reduce(
    (acc, d) => acc + Math.max(0, Number(d.monto_total || 0) - Number(d.monto_pagado || 0)),
    0
  );
  const favorDeudasTotal = deudas.reduce(
    (acc, d) => acc + Math.max(0, Number(d.monto_pagado || 0) - Number(d.monto_total || 0)),
    0
  );

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

      {bloqueado ? (
        <BloqueoPago
          nombre={alumno.nombre}
          monto={mensualidad.monto}
          mes={mensualidad.mes}
          razon={razon}
        />
      ) : (
        <>
      <AvisoPago recordatorio={recordatorio} />
      {modalidad === "becado" && (
        <div className="rounded-xl bg-mantis-light/60 p-4 text-sm font-semibold text-mantis-dark">
          Beca deportiva: no tienes mensualidades por pagar. ¡Gracias por tu esfuerzo!
        </div>
      )}

      {/* Encabezado Ficha del Alumno */}
      <div
        className="overflow-hidden rounded-2xl border border-tinta/10 p-6 shadow-sm"
        style={{ backgroundColor: tema.suave, borderTop: `8px solid ${tema.fondo}` }}
      >
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <FotoAlumno
              alumnoId={alumno.id}
              nombre={alumno.nombre}
              fotoUrl={alumno.foto_url}
              fondo={tema.fondo}
              color={tema.texto}
              onCambio={() => utils.portal.mi.invalidate()}
            />
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
                <span
                  className="inline-flex items-center gap-1 rounded-full border border-tinta/20 px-2.5 py-0.5 font-semibold"
                  style={{ backgroundColor: tema.fondo, color: tema.texto }}
                >
                  <Award className="h-3.5 w-3.5" />{" "}
                  {sinCinta(alumno.nivel_cinta)
                    ? "Sin cinta · primer examen pendiente"
                    : etiquetaCinta(alumno.nivel_cinta, true)}
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

      {/* Próximos eventos del club */}
      <div className="rounded-2xl border border-tinta/10 bg-papel-claro p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-dorado" />
          <h3 className="font-bold text-tinta">Próximos eventos</h3>
        </div>
        {eventos.length === 0 ? (
          <p className="mt-4 text-xs text-tinta/60">
            No hay eventos programados por ahora. Aquí verás los exámenes, grados y torneos del club.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {eventos.map((ev) => {
              const f = new Date(`${ev.fecha}T00:00:00`);
              const dias = diasPara(ev.fecha);
              return (
                <div key={ev.id} className="flex gap-4 rounded-xl border border-tinta/5 bg-papel p-3">
                  <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-mantis text-white">
                    <span className="text-xl font-semibold leading-none">{f.getDate()}</span>
                    <span className="text-[11px] uppercase">
                      {f.toLocaleDateString("es-CO", { month: "short" }).replace(".", "")}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-tinta">{ev.nombre}</span>
                      <Badge variant={ev.tipo === "examen" ? "alerta" : "info"}>
                        {TIPO_EVENTO[ev.tipo] ?? "Evento"}
                      </Badge>
                    </div>
                    {ev.lugar && <p className="text-xs text-tinta/70">{ev.lugar}</p>}
                    {ev.descripcion && (
                      <p className="mt-1 text-xs leading-relaxed text-tinta/70">{ev.descripcion}</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right text-xs font-semibold text-mantis-dark">
                    {dias <= 0 ? "Hoy" : dias === 1 ? "Mañana" : `En ${dias} días`}
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
              {favorDeudasTotal > 0 ? ` · Saldo a favor: ${formatearCOP(favorDeudasTotal)}` : ""}
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
                      {d.deuda?.descripcion && !/^[\d.,\s]+$/.test(d.deuda.descripcion) && (
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
                      <span>Pagado: {formatearCOP(Math.min(montoPagado, montoTotal))}</span>
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

                  {montoPagado > montoTotal && (
                    <p className="mt-2 rounded-lg bg-mantis/10 px-3 py-1.5 text-xs font-semibold text-mantis-dark">
                      Pagaste {formatearCOP(montoPagado - montoTotal)} de más: queda como saldo a
                      favor.
                    </p>
                  )}

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
            <select
              aria-label="Mes de la mensualidad"
              value={mesElegido}
              onChange={(e) => setMesVista(e.target.value)}
              className="min-h-9 rounded-full border border-tinta/20 bg-papel-claro px-3 py-1 text-xs font-semibold capitalize text-tinta outline-none focus:border-mantis"
            >
              {mensualidad.mesesDisponibles.map((m) => (
                <option key={m} value={m}>
                  {nombreMes(m)}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4 space-y-3">
            {!pagoElegido ? (
              <p className="py-6 text-center text-xs text-tinta/60">
                {modalidad === "becado"
                  ? "Tienes beca: no hay mensualidades por pagar."
                  : `No hay pagos registrados en ${nombreMes(mesElegido)}.`}
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between rounded-xl border border-tinta/5 bg-papel p-3 text-sm">
                  <div>
                    <div className="font-bold capitalize text-tinta">{nombreMes(pagoElegido.mes)}</div>
                    <div className="text-xs text-tinta/60">
                      Vence: {new Date(`${pagoElegido.fecha_vencimiento}T00:00:00`).toLocaleDateString("es-CO")}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-tinta">
                      {formatearCOP(pagoElegido.monto_pagado)} de {formatearCOP(pagoElegido.monto)}
                    </span>
                    <Badge
                      variant={
                        pagoElegido.estado === "pagado"
                          ? "exito"
                          : pagoElegido.estado === "pendiente" || pagoElegido.estado === "parcial"
                          ? "alerta"
                          : "peligro"
                      }
                    >
                      {pagoElegido.estado}
                    </Badge>
                  </div>
                </div>

                {(pagoElegido.abonos ?? []).length === 0 ? (
                  <p className="text-xs text-tinta/60">Aún no hay pagos registrados para este mes.</p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-tinta/70">Comprobantes de pago</p>
                    {(pagoElegido.abonos ?? []).map(
                      (ab: { id: string; monto: number; fecha_pago: string; comprobante_numero: number | null }) => (
                        <div
                          key={ab.id}
                          className="flex items-center justify-between rounded-xl border border-tinta/5 bg-papel p-3 text-sm"
                        >
                          <div>
                            <div className="font-semibold text-tinta">{formatearCOP(ab.monto)}</div>
                            <div className="text-xs text-tinta/60">
                              {new Date(`${ab.fecha_pago}T00:00:00`).toLocaleDateString("es-CO")}
                              {ab.comprobante_numero ? ` · #${ab.comprobante_numero}` : ""}
                            </div>
                          </div>
                          <a
                            href={`/comprobante/${ab.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex min-h-9 items-center rounded-full bg-mantis px-4 text-xs font-semibold text-white transition-colors hover:bg-mantis-dark"
                          >
                            Generar comprobante
                          </a>
                        </div>
                      )
                    )}
                  </div>
                )}
              </>
            )}
            <p className="text-xs text-tinta/60">
              Puedes consultar los meses desde {nombreMes(MES_INICIO_APP)}.
            </p>
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
                {asistencia.totalSesiones > 0 ? `${asistencia.porcentajeAsistencia}%` : "—"}
              </span>
            </div>
            <p className="mt-3 text-sm font-semibold text-tinta">
              {asistencia.totalSesiones > 0
                ? `${asistencia.totalPresente} de ${asistencia.totalSesiones} clases asistidas`
                : "Aún sin clases registradas"}
            </p>
            <p className="text-xs text-tinta/50">
              {asistencia.totalSesiones === 0
                ? "Cuando se registren sesiones verás aquí el progreso de asistencia."
                : asistencia.porcentajeAsistencia >= 85
                ? "¡Excelente constancia y disciplina marcial!"
                : "Se recomienda mayor regularidad en los entrenamientos."}
            </p>
          </div>

          {asistencia.recientes.length > 0 && (
            <div className="mt-2 space-y-1.5 border-t border-tinta/10 pt-3">
              <p className="text-xs font-semibold text-tinta/60">Últimas clases</p>
              {asistencia.recientes.slice(0, 6).map((c, i) => (
                <div key={`${c.fecha}-${i}`} className="flex items-center justify-between text-xs">
                  <span className="text-tinta/70">
                    {c.fecha ? new Date(`${c.fecha}T00:00:00`).toLocaleDateString("es-CO") : "—"}
                    {c.tema ? ` · ${c.tema}` : ""}
                  </span>
                  <Badge variant={c.presente ? "exito" : "peligro"}>
                    {c.presente ? "Asistió" : "Faltó"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Progreso: evaluaciones */}
      <div className="rounded-2xl border border-tinta/10 bg-papel-claro p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <Award className="h-5 w-5 text-dorado" />
          <h3 className="font-bold text-tinta">Progreso y evaluaciones</h3>
        </div>
        {evaluaciones.length === 0 ? (
          <p className="mt-4 text-xs text-tinta/50">
            Aún no hay evaluaciones registradas. Aquí verás los resultados y los cambios de cinta.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {evaluaciones.map((ev) => (
              <div key={ev.id} className="rounded-xl border border-tinta/5 bg-papel p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold capitalize text-tinta">
                    {ev.tipo} ·{" "}
                    {new Date(`${ev.fecha}T00:00:00`).toLocaleDateString("es-CO")}
                  </span>
                  <Badge variant={ev.resultado === "apto" ? "exito" : "alerta"}>
                    {ev.resultado === "apto" ? "Apto" : "No apto"}
                  </Badge>
                </div>
                {ev.nueva_cinta && (
                  <p className="mt-1 text-xs font-semibold text-mantis-dark">
                    Nueva cinta: {ev.nueva_cinta}
                  </p>
                )}
                {ev.observaciones && (
                  <p className="mt-1 text-xs text-tinta/70">{ev.observaciones}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ejercicios que está aprendiendo */}
      <div className="rounded-2xl border border-tinta/10 bg-papel-claro p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-mantis" />
          <h3 className="font-bold text-tinta">Lo que está aprendiendo</h3>
        </div>
        {ejercicios.length === 0 ? (
          <p className="mt-4 text-xs text-tinta/50">
            El maestro irá publicando aquí fotos y videos de los ejercicios de su cinta.
          </p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {ejercicios.map((ej) => (
              <div key={ej.id} className="overflow-hidden rounded-xl border border-tinta/10 bg-papel">
                {ej.media_url &&
                  (esImagen(ej.media_url) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={ej.media_url}
                      alt={ej.nombre}
                      loading="lazy"
                      className="h-44 w-full object-cover"
                    />
                  ) : (
                    <a
                      href={ej.media_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block bg-mantis/10 px-4 py-6 text-center text-sm font-semibold text-mantis-dark hover:bg-mantis/20"
                    >
                      Ver video o enlace →
                    </a>
                  ))}
                <div className="p-3">
                  <p className="font-bold text-tinta">{ej.nombre}</p>
                  <p className="text-xs capitalize text-tinta/50">
                    {ej.categoria} · {ej.dificultad}
                  </p>
                  {ej.descripcion && (
                    <p className="mt-1.5 text-xs leading-relaxed text-tinta/70">{ej.descripcion}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
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

        </>
      )}

      <CambiarClave />
    </div>
  );
}
