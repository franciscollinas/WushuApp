-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 006: código de inscripción y usuario (login sin correo)
-- - alumno.codigo_inscripcion: código que recibe el padre al llenar el
--   formulario web y que entrega al club al pagar (ej. MB-4F7K).
-- - usuario.username: nombre de usuario con el que el padre inicia sesión.
--   El correo interno (usuario.email) es solo un identificador técnico: la app
--   no envía correos.
-- Ejecuta en el SQL Editor de Supabase. Es idempotente.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.alumno add column if not exists codigo_inscripcion text;
create unique index if not exists uq_alumno_codigo
  on public.alumno (escuela_id, codigo_inscripcion)
  where codigo_inscripcion is not null;

alter table public.usuario add column if not exists username text;
create unique index if not exists uq_usuario_username
  on public.usuario (escuela_id, lower(username))
  where username is not null;
