-- Migración 010: foto de perfil del alumno
-- La subida se hace con URL firmada generada por el servidor (valida que quien
-- sube es admin o el padre del alumno), por eso el bucket no necesita políticas
-- de escritura. Lectura pública: las fotos se ven en el portal.

alter table public.alumno add column if not exists foto_url text;

insert into storage.buckets (id, name, public)
values ('fotos-alumnos', 'fotos-alumnos', true)
on conflict (id) do nothing;
