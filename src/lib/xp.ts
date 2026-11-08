// Puntos XP. Se calculan desde la asistencia (no se guardan): corregir una
// asistencia corrige los puntos solos. Solo los puntos manuales se guardan.

export const XP_POR_NIVEL = 200;

export interface ConfigXp {
  xp_por_asistencia: number;
  xp_racha_dias: number;
  xp_racha_bonus: number;
}

export const CONFIG_XP_DEFECTO: ConfigXp = {
  xp_por_asistencia: 10,
  xp_racha_dias: 5,
  xp_racha_bonus: 20,
};

export interface FilaAsistencia {
  fecha: string;
  presente: boolean;
}

export interface ResumenXp {
  asistidas: number;
  xpAsistencia: number;
  xpRacha: number;
  xpManual: number;
  total: number;
  rachaActual: number;
  mejorRacha: number;
  nivel: number;
  xpEnNivel: number;
  xpParaSiguiente: number;
  evaluaciones: number;
}

// Recorre las clases en orden: cada asistencia suma, y cada vez que la racha llega
// a un múltiplo de `xp_racha_dias` se suma el bono. Faltar corta la racha.
export function calcularXp(
  filas: FilaAsistencia[],
  xpManual: number,
  config: ConfigXp,
  evaluaciones = 0
): ResumenXp {
  const orden = [...filas].filter((f) => f.fecha).sort((a, b) => a.fecha.localeCompare(b.fecha));
  let asistidas = 0;
  let racha = 0;
  let mejor = 0;
  let xpRacha = 0;
  for (const f of orden) {
    if (f.presente) {
      asistidas += 1;
      racha += 1;
      if (racha > mejor) mejor = racha;
      if (config.xp_racha_dias > 0 && racha % config.xp_racha_dias === 0) xpRacha += config.xp_racha_bonus;
    } else {
      racha = 0;
    }
  }
  const xpAsistencia = asistidas * config.xp_por_asistencia;
  const total = Math.max(0, xpAsistencia + xpRacha + xpManual);
  return {
    asistidas,
    xpAsistencia,
    xpRacha,
    xpManual,
    total,
    rachaActual: racha,
    mejorRacha: mejor,
    nivel: Math.floor(total / XP_POR_NIVEL) + 1,
    xpEnNivel: total % XP_POR_NIVEL,
    xpParaSiguiente: XP_POR_NIVEL - (total % XP_POR_NIVEL),
    evaluaciones,
  };
}

export interface Insignia {
  id: string;
  nombre: string;
  descripcion: string;
  ganada: boolean;
}

// Insignias por hitos reales (nada se gana solo por entrar a la app).
export function insignias(r: ResumenXp): Insignia[] {
  return [
    { id: "primera", nombre: "Primer paso", descripcion: "Primera clase asistida", ganada: r.asistidas >= 1 },
    { id: "diez", nombre: "Constante", descripcion: "10 clases asistidas", ganada: r.asistidas >= 10 },
    { id: "veinticinco", nombre: "Guerrero", descripcion: "25 clases asistidas", ganada: r.asistidas >= 25 },
    { id: "cincuenta", nombre: "Maestro del tatami", descripcion: "50 clases asistidas", ganada: r.asistidas >= 50 },
    { id: "racha5", nombre: "Racha de fuego", descripcion: "5 clases seguidas", ganada: r.mejorRacha >= 5 },
    { id: "racha10", nombre: "Imparable", descripcion: "10 clases seguidas", ganada: r.mejorRacha >= 10 },
    { id: "examen", nombre: "Examen presentado", descripcion: "Presentó un examen de cinta", ganada: r.evaluaciones >= 1 },
  ];
}

// "Valentina Rojas Pérez" -> "Valentina R." (en el ranking no se muestra el nombre completo).
export function nombreCorto(nombre: string): string {
  const partes = nombre.trim().split(/\s+/);
  if (partes.length < 2) return partes[0] ?? "";
  return `${partes[0]} ${partes[1][0].toUpperCase()}.`;
}
