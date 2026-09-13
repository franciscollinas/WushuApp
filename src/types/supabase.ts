export type Categoria = "infantil" | "juvenil" | "adulto";
export type EstadoAlumno = "activo" | "inactivo";
export type EstadoPago = "pagado" | "pendiente" | "vencido";

export type PlanEscuela = "basico" | "pro";

export interface EscuelaRow {
  id: string;
  nombre: string;
  slug: string;
  plan: PlanEscuela;
  activa: boolean;
  created_at: string;
}

export interface GrupoRow {
  id: string;
  escuela_id: string;
  nombre: string;
  categoria_edad: string;
  dias: string;
  hora_inicio: string;
  hora_fin: string;
  entrenador: string;
  created_at: string;
}

export interface AlumnoRow {
  id: string;
  escuela_id: string;
  nombre: string;
  fecha_nacimiento: string | null;
  categoria: Categoria;
  nivel_cinta: string;
  fecha_ingreso: string | null;
  estado: EstadoAlumno;
  grupo_id: string | null;
  padre_nombre: string | null;
  padre_telefono: string | null;
  notas: string | null;
  created_at: string;
}

export interface SesionRow {
  id: string;
  escuela_id: string;
  grupo_id: string;
  fecha: string;
  tema: string;
  entrenador: string;
  created_at: string;
}

export interface AsistenciaRow {
  id: string;
  escuela_id: string;
  sesion_id: string;
  alumno_id: string;
  presente: boolean;
}

export interface PagoRow {
  id: string;
  escuela_id: string;
  alumno_id: string;
  mes: string;
  monto: number;
  estado: EstadoPago;
  fecha_pago: string | null;
  fecha_vencimiento: string;
  created_at: string;
}

export interface AsistenciaConAlumno extends AsistenciaRow {
  alumno: AlumnoRow | null;
}

export interface SesionConAsistencia extends SesionRow {
  asistencia: AsistenciaConAlumno[];
}

export interface PagoConAlumno extends PagoRow {
  alumno: AlumnoRow | null;
}

export interface GrupoConAlumnos extends GrupoRow {
  alumnos: AlumnoRow[];
}

export interface AlumnoConFaltas {
  alumno_id: string;
  faltas: number;
  alumno: Pick<AlumnoRow, "id" | "nombre" | "grupo_id"> | undefined;
}

export interface CriterioEval {
  nombre: string;
  nota: number;
}

export type ResultadoEval = "apto" | "no_apto";

export interface EvaluacionRow {
  id: string;
  escuela_id: string;
  alumno_id: string;
  fecha: string;
  tipo: string;
  tecnica_json: CriterioEval[];
  fisico_json: CriterioEval[];
  actitud_json: CriterioEval[];
  resultado: ResultadoEval;
  nueva_cinta: string | null;
  observaciones: string | null;
  created_at: string;
}

export interface EjercicioRow {
  id: string;
  escuela_id: string;
  nombre: string;
  categoria: string;
  dificultad: string;
  descripcion: string | null;
  duracion: string | null;
  created_at: string;
}

export interface EventoRow {
  id: string;
  escuela_id: string;
  nombre: string;
  fecha: string;
  tipo: string;
  lugar: string | null;
  descripcion: string | null;
  created_at: string;
}

export interface EvaluacionConAlumno extends EvaluacionRow {
  alumno: AlumnoRow | null;
}

export type RolUsuario = "admin" | "entrenador";

export interface UsuarioRow {
  id: string;
  escuela_id: string;
  email: string;
  rol: RolUsuario;
  created_at: string;
}