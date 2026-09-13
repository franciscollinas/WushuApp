"use client";

import { ArrowLeft, MessageCircle, Copy } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import toast from "react-hot-toast";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import KPI from "@/components/ui/KPI";

export default function AlumnoFicha() {
  const { id } = useParams<{ id: string }>();
  const hoy = new Date();
  const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
  const [mes, setMes] = useState(mesActual);

  const { data: reporte } = trpc.reporte.deAlumno.useQuery(
    { alumno_id: id, mes },
    { enabled: !!id }
  );
  const { data: evaluaciones } = trpc.evaluacion.listByAlumno.useQuery(id, {
    enabled: !!id,
  });
  const { data: pagos } = trpc.pago.list.useQuery();
  const { data: grupos } = trpc.grupo.list.useQuery();

  if (!reporte) {
    return <p className="py-16 text-center text-sm text-tinta/40">Cargando ficha…</p>;
  }

  const alumno = reporte.alumno;
  const grupoNombre =
    reporte.grupoNombre ??
    (grupos ?? []).find((g) => g.id === alumno.grupo_id)?.nombre ??
    null;
  const pagosAlumno = (pagos ?? []).filter((p) => p.alumno_id === id);

  const historial: { fecha: string; texto: string; tipo: string }[] = [];
  if (alumno.fecha_ingreso) {
    historial.push({ fecha: alumno.fecha_ingreso, texto: "Inscripción a la escuela", tipo: "alta" });
  }
  for (const ev of evaluaciones ?? []) {
    if (ev.resultado === "apto" && ev.nueva_cinta) {
      historial.push({
        fecha: ev.fecha,
        texto: `Cambio a cinta ${ev.nueva_cinta} (evaluada: ${ev.tipo})`,
        tipo: "cinta",
      });
    }
  }
  historial.sort((a, b) => b.fecha.localeCompare(a.fecha));

  const textoReporteCrudo = () => {
    const nombreMes = new Date(Number(mes.slice(0, 4)), Number(mes.slice(5)) - 1, 1).toLocaleDateString(
      "es-CO",
      { month: "long" }
    );
    const asis = reporte.asistenciaMes;
    const ultima = reporte.ultimaEvaluacion;
    const pago = reporte.pagoMes;
    return [
      `*Reporte de progreso — Mantis Box Sabanalarga*`,
      ``,
      `${alumno.nombre} — grupo ${grupoNombre ?? "sin asignar"}`,
      `Cinta actual: ${alumno.nivel_cinta}`,
      ``,
      `*Asistencia del mes (${nombreMes}):*`,
      `${asis.porcentaje}% (${asis.presentes} de ${asis.total} clases${ultima && ultima.resultado === "apto" ? "" : ""})`,
      ``,
      ultima
        ? `*Última evaluación (${ultima.fecha}):* ${ultima.resultado === "apto" ? "APTO ✔" : "No apto"}${ultima.nueva_cinta ? ` — nueva cinta: ${ultima.nueva_cinta}` : ""}`
        : "*Última evaluación:* sin registros",
      pago
        ? `*Mensualidad (${nombreMes}):* ${pago.estado === "pagado" ? "pagada ✔" : pago.estado}`
        : `*Mensualidad (${nombreMes}):* sin registrar`,
      ``,
      `Más información en la escuela. ¡Saludos!`,
    ].join("\n");
  };

  const enviarWhatsApp = () => {
    const telefono = alumno.padre_telefono;
    if (!telefono) {
      toast.error("El alumno no tiene teléfono del acudiente registrado");
      return;
    }
    window.open(
      `https://wa.me/57${telefono.replace(/[^\d]/g, "")}?text=${encodeURIComponent(textoReporteCrudo())}`,
      "_blank"
    );
  };

  const enviarWhatsAppApi = trpc.whatsapp.enviarMensaje.useMutation({
    onSuccess: () => toast.success("Reporte enviado por WhatsApp API"),
    onError: (e) => toast.error(e.message),
  });

  const enviarPorApi = () => {
    const telefono = alumno.padre_telefono;
    if (!telefono) {
      toast.error("El alumno no tiene teléfono del acudiente registrado");
      return;
    }
    enviarWhatsAppApi.mutate({ telefono, mensaje: textoReporteCrudo() });
  };

  const copiarReporte = async () => {
    try {
      await navigator.clipboard.writeText(textoReporteCrudo());
      toast.success("Reporte copiado al portapapeles");
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  return (
    <>
      <Link
        href="/alumnos"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-mantis transition-colors hover:text-mantis-dark"
      >
        <ArrowLeft className="h-4 w-4" /> Volver a alumnos
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-tinta">{alumno.nombre}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="info">{alumno.nivel_cinta}</Badge>
            <Badge variant={alumno.estado === "activo" ? "ok" : "estado"}>{alumno.estado}</Badge>
            <span className="text-sm text-tinta/60">
              {alumno.categoria} · grupo: {grupoNombre ?? "—"}
            </span>
          </div>
          {(alumno.padre_nombre || alumno.padre_telefono) && (
            <p className="mt-2 text-sm text-tinta/50">
              Acudiente: {alumno.padre_nombre ?? "—"} · {alumno.padre_telefono ?? "sin teléfono"}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secundario" onClick={copiarReporte}>
            <Copy className="h-4 w-4" /> Copiar reporte
          </Button>
          <Button variant="secundario" onClick={enviarPorApi} disabled={enviarWhatsAppApi.isPending}>
            <MessageCircle className="h-4 w-4" />
            {enviarWhatsAppApi.isPending ? "Enviando…" : "Enviar por API"}
          </Button>
          <Button onClick={enviarWhatsApp}>
            <MessageCircle className="h-4 w-4" /> Enviar a WhatsApp
          </Button>
        </div>
      </div>

      <div className="mb-8 flex items-center gap-3">
        <p className="text-sm font-semibold text-tinta/60">Asistencia del mes</p>
        <input
          type="month"
          value={mes}
          onChange={(e) => setMes(e.target.value)}
          className="rounded-lg border border-tinta/15 bg-papel-claro px-3 py-2 text-sm text-tinta outline-none focus:border-mantis"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KPI
          label="Asistencia del mes"
          valor={`${reporte.asistenciaMes.porcentaje}%`}
          detalle={`${reporte.asistenciaMes.presentes} de ${reporte.asistenciaMes.total} clases`}
        />
        <KPI
          label="Última evaluación"
          valor={reporte.ultimaEvaluacion ? (reporte.ultimaEvaluacion.resultado === "apto" ? "Apto" : "No apto") : "—"}
          detalle={
            reporte.ultimaEvaluacion
              ? `${reporte.ultimaEvaluacion.fecha} · ${reporte.ultimaEvaluacion.tipo}`
              : "Sin evaluaciones"
          }
        />
        <KPI
          label="Mensualidad del mes"
          valor={reporte.pagoMes ? (reporte.pagoMes.estado === "pagado" ? "Pagada" : reporte.pagoMes.estado) : "Sin registro"}
          detalle={reporte.pagoMes ? `$${Number(reporte.pagoMes.monto).toLocaleString("es-CO")}` : undefined}
        />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="overflow-hidden rounded-xl border border-tinta/10 bg-papel-claro">
          <header className="border-b border-tinta/10 px-5 py-4">
            <h2 className="font-bold text-tinta">Historial</h2>
            <p className="text-xs text-tinta/50">Inscripción y cambios de cinta</p>
          </header>
          <ul className="divide-y divide-tinta/5">
            {historial.length === 0 && (
              <li className="px-5 py-8 text-center text-sm text-tinta/40">Sin registros</li>
            )}
            {historial.map((h, i) => (
              <li key={i} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <span className="text-tinta/70">{h.texto}</span>
                <span className="shrink-0 text-xs text-tinta/40">{h.fecha}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="overflow-hidden rounded-xl border border-tinta/10 bg-papel-claro">
          <header className="border-b border-tinta/10 px-5 py-4">
            <h2 className="font-bold text-tinta">Evaluaciones</h2>
            <p className="text-xs text-tinta/50">Últimas evaluaciones registradas</p>
          </header>
          <ul className="divide-y divide-tinta/5">
            {(evaluaciones ?? []).length === 0 && (
              <li className="px-5 py-8 text-center text-sm text-tinta/40">Sin evaluaciones</li>
            )}
            {(evaluaciones ?? []).map((ev) => (
              <li key={ev.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <div>
                  <span className="font-medium text-tinta">
                    {ev.tipo} ·{" "}
                    <span className={ev.resultado === "apto" ? "text-ok" : "text-falta"}>
                      {ev.resultado}
                    </span>
                  </span>
                  {ev.nueva_cinta && (
                    <p className="text-xs text-tinta/50">Nueva cinta: {ev.nueva_cinta}</p>
                  )}
                </div>
                <span className="shrink-0 text-xs text-tinta/40">{ev.fecha}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="overflow-hidden rounded-xl border border-tinta/10 bg-papel-claro lg:col-span-2">
          <header className="border-b border-tinta/10 px-5 py-4">
            <h2 className="font-bold text-tinta">Pagos del alumno</h2>
          </header>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-tinta/10 text-left text-xs uppercase tracking-wide text-tinta/50">
                <th className="px-5 py-2.5 font-semibold">Mes</th>
                <th className="px-5 py-2.5 font-semibold">Monto</th>
                <th className="px-5 py-2.5 font-semibold">Estado</th>
                <th className="px-5 py-2.5 font-semibold">Vence</th>
              </tr>
            </thead>
            <tbody>
              {pagosAlumno.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-sm text-tinta/40">
                    Sin pagos registrados
                  </td>
                </tr>
              )}
              {pagosAlumno.slice(0, 6).map((p) => (
                <tr key={p.id} className="border-b border-tinta/5 last:border-0">
                  <td className="px-5 py-3 text-tinta">{p.mes}</td>
                  <td className="px-5 py-3">${Number(p.monto).toLocaleString("es-CO")}</td>
                  <td className="px-5 py-3">
                    <Badge
                      variant={p.estado === "pagado" ? "ok" : p.estado === "vencido" ? "falta" : "estado"}
                    >
                      {p.estado}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 text-tinta/60">{p.fecha_vencimiento}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </>
  );
}