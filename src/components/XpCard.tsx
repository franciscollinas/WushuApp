import { Flame, Medal, Trophy, Zap } from "lucide-react";
import { XP_POR_NIVEL, type Insignia } from "@/lib/xp";

export interface XpFicha {
  total: number;
  nivel: number;
  xpEnNivel: number;
  xpParaSiguiente: number;
  asistidas: number;
  rachaActual: number;
  mejorRacha: number;
  posicion: number;
  totalAlumnos: number;
  insignias: Insignia[];
  movimientos: { id: string; puntos: number; motivo: string; fecha: string }[];
  ranking: { posicion: number; nombre: string; total: number; rachaActual: number; esYo: boolean }[];
}

// Tarjeta de puntos del portal del padre: nivel, barra de XP, racha, ranking e insignias.
export default function XpCard({ xp, nombre }: { xp: XpFicha; nombre: string }) {
  const pct = Math.round((xp.xpEnNivel / XP_POR_NIVEL) * 100);
  const ganadas = xp.insignias.filter((i) => i.ganada).length;

  return (
    <section className="overflow-hidden rounded-2xl border border-tinta/10 bg-papel-claro shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-tinta/10 bg-tinta px-5 py-4 text-papel">
        <div className="flex items-center gap-3">
          <Zap className="h-6 w-6 text-dorado" />
          <div>
            <h3 className="text-lg font-extrabold leading-tight">Puntos XP de {nombre.split(" ")[0]}</h3>
            <p className="text-xs text-papel/60">Se ganan asistiendo a clase y manteniendo la racha</p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-mono text-3xl font-black text-dorado">{xp.total}</p>
          <p className="text-xs text-papel/60">XP totales</p>
        </div>
      </div>

      <div className="space-y-5 p-5">
        <div>
          <div className="mb-1.5 flex items-center justify-between text-sm">
            <span className="font-bold text-tinta">Nivel {xp.nivel}</span>
            <span className="text-xs text-tinta/60">
              Faltan {xp.xpParaSiguiente} XP para el nivel {xp.nivel + 1}
            </span>
          </div>
          <div
            className="h-3 overflow-hidden rounded-full bg-tinta/10"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progreso al siguiente nivel"
          >
            <div className="h-full rounded-full bg-mantis transition-[width] duration-500" style={{ width: `${pct}%` }} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-xl bg-papel p-3">
            <Flame className="mx-auto h-5 w-5 text-falta" />
            <p className="mt-1 text-xl font-black text-tinta">{xp.rachaActual}</p>
            <p className="text-[11px] text-tinta/60">clases seguidas</p>
          </div>
          <div className="rounded-xl bg-papel p-3">
            <Medal className="mx-auto h-5 w-5 text-dorado" />
            <p className="mt-1 text-xl font-black text-tinta">{xp.mejorRacha}</p>
            <p className="text-[11px] text-tinta/60">mejor racha</p>
          </div>
          <div className="rounded-xl bg-papel p-3">
            <Trophy className="mx-auto h-5 w-5 text-mantis" />
            <p className="mt-1 text-xl font-black text-tinta">
              #{xp.posicion}
              <span className="text-xs font-semibold text-tinta/50"> de {xp.totalAlumnos}</span>
            </p>
            <p className="text-[11px] text-tinta/60">en el club</p>
          </div>
        </div>

        <div>
          <h4 className="mb-2 text-sm font-bold text-tinta">Ranking del club</h4>
          <ol className="divide-y divide-tinta/10 overflow-hidden rounded-xl border border-tinta/10">
            {xp.ranking.map((r) => (
              <li
                key={`${r.posicion}-${r.nombre}`}
                className={`flex items-center gap-3 px-3 py-2 text-sm ${r.esYo ? "bg-mantis-light/60 font-bold" : "bg-papel"}`}
              >
                <span className="w-7 text-center font-mono text-xs font-bold text-tinta/60">#{r.posicion}</span>
                <span className="flex-1 truncate text-tinta">{r.nombre}</span>
                <span className="flex items-center gap-1 text-xs text-tinta/60">
                  <Flame className="h-3.5 w-3.5 text-falta" /> {r.rachaActual}
                </span>
                <span className="w-14 text-right font-mono font-bold text-mantis-dark">{r.total}</span>
              </li>
            ))}
          </ol>
        </div>

        <div>
          <h4 className="mb-2 text-sm font-bold text-tinta">
            Insignias <span className="font-normal text-tinta/50">({ganadas} de {xp.insignias.length})</span>
          </h4>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {xp.insignias.map((i) => (
              <li
                key={i.id}
                title={i.descripcion}
                className={`rounded-xl border p-3 text-center ${
                  i.ganada ? "border-dorado/50 bg-dorado/10" : "border-tinta/10 bg-papel opacity-50"
                }`}
              >
                <Medal className={`mx-auto h-5 w-5 ${i.ganada ? "text-dorado" : "text-tinta/40"}`} />
                <p className="mt-1 text-xs font-bold text-tinta">{i.nombre}</p>
                <p className="text-[10px] text-tinta/60">{i.descripcion}</p>
              </li>
            ))}
          </ul>
        </div>

        {xp.movimientos.length > 0 && (
          <div>
            <h4 className="mb-2 text-sm font-bold text-tinta">Puntos extra del club</h4>
            <ul className="space-y-1 text-sm">
              {xp.movimientos.map((m) => (
                <li key={m.id} className="flex items-center justify-between rounded-lg bg-papel px-3 py-2">
                  <span className="text-tinta/80">{m.motivo}</span>
                  <span className={`font-mono font-bold ${m.puntos > 0 ? "text-mantis-dark" : "text-falta"}`}>
                    {m.puntos > 0 ? "+" : ""}
                    {m.puntos}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
