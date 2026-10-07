-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 007: mensualidad única, bloqueo del día 5 y ejercicios con foto
-- Requisito: migraciones 002 y 003 aplicadas (helpers usuario_es_padre_de, etc.).
-- Ejecuta en el SQL Editor de Supabase. Es idempotente.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Valor único de la mensualidad (lo edita el admin) ────────────────────────
alter table public.escuela
  add column if not exists mensualidad_monto numeric not null default 0
  check (mensualidad_monto >= 0);

-- ── Ejercicios: cinta a la que pertenecen y foto/URL de muestra ──────────────
alter table public.ejercicio add column if not exists nivel_cinta text;
alter table public.ejercicio add column if not exists media_url text;

-- ── ¿El alumno está al día? (hora de Colombia) ───────────────────────────────
-- Mes de referencia: el mes en curso desde el día 5; antes del 5, el mes anterior.
-- Está al día si ese mes tiene un pago 'pagado', o si el alumno ingresó después
-- de ese mes (no debe nada todavía).
create or replace function public.alumno_al_dia(p_alumno uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with hoy as (
    select (now() at time zone 'America/Bogota')::date as d
  ),
  ref as (
    select case
      when extract(day from d) >= 5 then to_char(d, 'YYYY-MM')
      else to_char(d - interval '1 month', 'YYYY-MM')
    end as mes_ref
    from hoy
  ),
  al as (
    select to_char(coalesce(a.fecha_ingreso, a.created_at::date), 'YYYY-MM') as mes_ingreso
    from public.alumno a
    where a.id = p_alumno
  )
  select coalesce(
    (select mes_ingreso from al) > (select mes_ref from ref)
    or exists (
      select 1 from public.pago p, ref
      where p.alumno_id = p_alumno and p.mes = ref.mes_ref and p.estado = 'pagado'
    ),
    false
  )
$$;

-- ── Los padres solo ven datos de hijos que están al día ──────────────────────
create or replace function public.usuario_es_padre_de(p_alumno uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.alumno_padre ap
    where ap.alumno_id = p_alumno and ap.usuario_id = auth.uid()
  ) and public.alumno_al_dia(p_alumno)
$$;

create or replace function public.usuario_ve_sesion(p_sesion uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.asistencia a
    join public.alumno_padre ap on ap.alumno_id = a.alumno_id
    where a.sesion_id = p_sesion
      and ap.usuario_id = auth.uid()
      and public.alumno_al_dia(a.alumno_id)
  )
$$;

create or replace function public.usuario_ve_grupo(p_grupo uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.alumno a
    join public.alumno_padre ap on ap.alumno_id = a.id
    where a.grupo_id = p_grupo
      and ap.usuario_id = auth.uid()
      and public.alumno_al_dia(a.id)
  )
$$;

-- ── Fotos de ejercicios: bucket público; solo el admin sube y borra ──────────
insert into storage.buckets (id, name, public)
values ('ejercicios', 'ejercicios', true)
on conflict (id) do nothing;

drop policy if exists "ejercicios_admin_insert" on storage.objects;
create policy "ejercicios_admin_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'ejercicios' and public.usuario_es_admin());

drop policy if exists "ejercicios_admin_update" on storage.objects;
create policy "ejercicios_admin_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'ejercicios' and public.usuario_es_admin())
  with check (bucket_id = 'ejercicios' and public.usuario_es_admin());

drop policy if exists "ejercicios_admin_delete" on storage.objects;
create policy "ejercicios_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'ejercicios' and public.usuario_es_admin());
