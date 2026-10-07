-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 005: inscripción pública como "prospecto"
-- Las inscripciones de la web ya no crean alumnos activos ni cuentas de padre:
-- quedan como `prospecto` hasta que un admin las aprueba. Al aprobar se crea
-- (o reutiliza) la cuenta del acudiente y se le envía la invitación.
-- Ejecuta en el SQL Editor de Supabase. Es idempotente.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.alumno drop constraint if exists alumno_estado_check;
alter table public.alumno
  add constraint alumno_estado_check check (estado in ('prospecto', 'activo', 'inactivo'));

alter table public.alumno add column if not exists padre_email text;

-- Consultas de la bandeja de prospectos y del límite de inscripciones por hora.
create index if not exists idx_alumno_estado_creado
  on public.alumno (escuela_id, estado, created_at desc);
