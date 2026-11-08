import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  calcularXp,
  CONFIG_XP_DEFECTO,
  nombreCorto,
  type ConfigXp,
  type FilaAsistencia,
  type ResumenXp,
} from "@/lib/xp";

export interface FilaRanking extends ResumenXp {
  alumno_id: string;
  nombre: string;
  nombreCorto: string;
  posicion: number;
}

const PAGINA = 1000;

// Supabase corta cada consulta en 1000 filas: se pide por páginas.
async function todas<T>(
  pedir: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const filas: T[] = [];
  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await pedir(desde, desde + PAGINA - 1);
    if (error) throw new Error(error.message);
    filas.push(...(data ?? []));
    if (!data || data.length < PAGINA) break;
  }
  return filas;
}

export async function cargarConfigXp(escuelaId: string): Promise<ConfigXp> {
  const { data } = await supabaseAdmin()
    .from("escuela")
    .select("xp_por_asistencia, xp_racha_dias, xp_racha_bonus")
    .eq("id", escuelaId)
    .maybeSingle();
  return {
    xp_por_asistencia: Number(data?.xp_por_asistencia ?? CONFIG_XP_DEFECTO.xp_por_asistencia),
    xp_racha_dias: Number(data?.xp_racha_dias ?? CONFIG_XP_DEFECTO.xp_racha_dias),
    xp_racha_bonus: Number(data?.xp_racha_bonus ?? CONFIG_XP_DEFECTO.xp_racha_bonus),
  };
}

// Ranking de los alumnos activos de la escuela, ordenado por XP (empate: más clases).
export async function cargarRanking(escuelaId: string): Promise<FilaRanking[]> {
  const admin = supabaseAdmin();
  const config = await cargarConfigXp(escuelaId);

  const { data: alumnos, error } = await admin
    .from("alumno")
    .select("id, nombre")
    .eq("escuela_id", escuelaId)
    .eq("estado", "activo");
  if (error) throw new Error(error.message);
  const ids = new Set((alumnos ?? []).map((a) => a.id as string));

  const asistencias = await todas<{ alumno_id: string; presente: boolean; sesion: { fecha: string } | { fecha: string }[] | null }>(
    (d, h) =>
      admin
        .from("asistencia")
        .select("alumno_id, presente, sesion(fecha)")
        .eq("escuela_id", escuelaId)
        .range(d, h)
  );
  const manuales = await todas<{ alumno_id: string; puntos: number }>((d, h) =>
    admin.from("xp_movimiento").select("alumno_id, puntos").eq("escuela_id", escuelaId).range(d, h)
  );
  const evaluaciones = await todas<{ alumno_id: string }>((d, h) =>
    admin.from("evaluacion").select("alumno_id").eq("escuela_id", escuelaId).range(d, h)
  );

  const porAlumno = new Map<string, FilaAsistencia[]>();
  for (const a of asistencias) {
    if (!ids.has(a.alumno_id)) continue;
    const s = Array.isArray(a.sesion) ? a.sesion[0] : a.sesion;
    const lista = porAlumno.get(a.alumno_id) ?? [];
    lista.push({ fecha: s?.fecha ?? "", presente: a.presente });
    porAlumno.set(a.alumno_id, lista);
  }
  const manualPorAlumno = new Map<string, number>();
  for (const m of manuales) manualPorAlumno.set(m.alumno_id, (manualPorAlumno.get(m.alumno_id) ?? 0) + Number(m.puntos));
  const evalPorAlumno = new Map<string, number>();
  for (const e of evaluaciones) evalPorAlumno.set(e.alumno_id, (evalPorAlumno.get(e.alumno_id) ?? 0) + 1);

  const filas = (alumnos ?? []).map((a) => {
    const resumen = calcularXp(
      porAlumno.get(a.id as string) ?? [],
      manualPorAlumno.get(a.id as string) ?? 0,
      config,
      evalPorAlumno.get(a.id as string) ?? 0
    );
    return {
      ...resumen,
      alumno_id: a.id as string,
      nombre: a.nombre as string,
      nombreCorto: nombreCorto(a.nombre as string),
      posicion: 0,
    };
  });
  filas.sort((a, b) => b.total - a.total || b.asistidas - a.asistidas || a.nombre.localeCompare(b.nombre));
  filas.forEach((f, i) => (f.posicion = i + 1));
  return filas;
}
