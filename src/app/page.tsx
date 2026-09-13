"use client";

import { Users, Wallet, AlertTriangle, ClipboardCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";
import KPI from "@/components/ui/KPI";
import PageHeader from "@/components/PageHeader";
import Badge from "@/components/ui/Badge";

export default function DashboardPage() {
  const hoy = new Date();
  const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;

  const { data: stats, isLoading } = trpc.dashboard.estadisticas.useQuery({
    mes: mesActual,
  });
  const { data: conFaltas } = trpc.asistencia.alumnosConFaltas.useQuery({
    mes: mesActual,
  });
  const { data: pagos } = trpc.pago.listByMes.useQuery(mesActual);

  const pendientes = (pagos ?? []).filter((p) => p.estado !== "pagado");
  const { data: eventos } = trpc.evento.proximos.useQuery();

  return (
    <>
      <PageHeader titulo="Dashboard" descripcion="Resumen de la escuela" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KPI
          label="Alumnos activos"
          valor={isLoading ? "—" : String(stats?.alumnosActivos ?? 0)}
          icono={<Users className="h-4 w-4 text-mantis" />}
          detalle="Inscritos con estado activo"
        />
        <KPI
          label="Ingresos del mes"
          valor={isLoading ? "—" : `$${Number(stats?.ingresosMes ?? 0).toLocaleString("es-CO")}`}
          icono={<Wallet className="h-4 w-4 text-ok" />}
          detalle="Pagos marcados como pagado"
        />
        <KPI
          label="Pagos pendientes"
          valor={isLoading ? "—" : String(stats?.pagosPendientes ?? 0)}
          icono={<AlertTriangle className="h-4 w-4 text-amber-600" />}
          detalle="Pendientes y vencidos del mes"
        />
        <KPI
          label="Asistencia promedio"
          valor={isLoading ? "—" : `${stats?.asistenciaPromedio ?? 0}%`}
          icono={<ClipboardCheck className="h-4 w-4 text-dorado" />}
          detalle="Del mes en curso"
        />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="overflow-hidden rounded-xl border border-tinta/10 bg-papel-claro">
          <header className="border-b border-tinta/10 px-5 py-4">
            <h2 className="font-bold text-tinta">Alertas de inasistencia</h2>
            <p className="text-xs text-tinta/50">3+ faltas en el mes</p>
          </header>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-tinta/10 text-left text-xs uppercase tracking-wide text-tinta/50">
                <th className="px-5 py-2.5 font-semibold">Alumno</th>
                <th className="px-5 py-2.5 font-semibold">Faltas</th>
              </tr>
            </thead>
            <tbody>
              {(conFaltas ?? []).length === 0 && (
                <tr>
                  <td colSpan={2} className="px-5 py-8 text-center text-sm text-tinta/40">
                    Sin alertas este mes
                  </td>
                </tr>
              )}
              {(conFaltas ?? []).map((c) => (
                <tr key={c.alumno_id} className="border-b border-tinta/5 last:border-0">
                  <td className="px-5 py-3 font-medium text-tinta">
                    {c.alumno?.nombre ?? "—"}
                  </td>
                  <td className="px-5 py-3">
                    <Badge variant="falta">{c.faltas} faltas</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="overflow-hidden rounded-xl border border-tinta/10 bg-papel-claro">
          <header className="border-b border-tinta/10 px-5 py-4">
            <h2 className="font-bold text-tinta">Pagos pendientes del mes</h2>
            <p className="text-xs text-tinta/50">Pendientes y vencidos</p>
          </header>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-tinta/10 text-left text-xs uppercase tracking-wide text-tinta/50">
                <th className="px-5 py-2.5 font-semibold">Alumno</th>
                <th className="px-5 py-2.5 font-semibold">Monto</th>
                <th className="px-5 py-2.5 font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody>
              {pendientes.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-5 py-8 text-center text-sm text-tinta/40">
                    Todo al día
                  </td>
                </tr>
              )}
              {pendientes.map((p) => (
                <tr key={p.id} className="border-b border-tinta/5 last:border-0">
                  <td className="px-5 py-3 font-medium text-tinta">
                    {p.alumno?.nombre ?? "—"}
                  </td>
                  <td className="px-5 py-3">${Number(p.monto).toLocaleString("es-CO")}</td>
                  <td className="px-5 py-3">
                    <Badge variant={p.estado === "vencido" ? "falta" : "estado"}>
                      {p.estado}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <section className="mt-6 overflow-hidden rounded-xl border border-tinta/10 bg-papel-claro">
        <header className="border-b border-tinta/10 px-5 py-4">
          <h2 className="font-bold text-tinta">Próximos eventos</h2>
          <p className="text-xs text-tinta/50">Nuevos exámenes, torneos y fechas</p>
        </header>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-tinta/10 text-left text-xs uppercase tracking-wide text-tinta/50">
              <th className="px-5 py-2.5 font-semibold">Fecha</th>
              <th className="px-5 py-2.5 font-semibold">Evento</th>
              <th className="px-5 py-2.5 font-semibold">Tipo</th>
            </tr>
          </thead>
          <tbody>
            {(eventos ?? []).length === 0 && (
              <tr>
                <td colSpan={3} className="px-5 py-8 text-center text-sm text-tinta/40">
                  Sin eventos próximos
                </td>
              </tr>
            )}
            {(eventos ?? []).map((e) => (
              <tr key={e.id} className="border-b border-tinta/5 last:border-0">
                <td className="px-5 py-3 font-medium text-tinta">{e.fecha}</td>
                <td className="px-5 py-3 text-tinta/70">{e.nombre}</td>
                <td className="px-5 py-3">
                  <Badge variant="estado">{e.tipo}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}