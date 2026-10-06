-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 004: datos de inscripción pública
-- Agrega a la tabla alumno los campos que llegan del formulario web
-- (peso, género y documento de identidad).
-- Ejecuta en el SQL Editor de Supabase. Es idempotente.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.alumno add column if not exists documento text;
alter table public.alumno add column if not exists genero text check (
  genero is null or genero in ('masculino', 'femenino', 'otro')
);
alter table public.alumno add column if not exists peso_kg numeric check (
  peso_kg is null or (peso_kg > 0 and peso_kg < 400)
);

create index if not exists idx_alumno_documento on public.alumno (escuela_id, documento);