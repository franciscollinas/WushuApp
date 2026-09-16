-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 003: autorización por rol + RLS endurecido
-- Requisito: tener aplicado schema.sql (v1) y 002_deudas_y_padres.sql.
-- Ejecuta en el SQL Editor de Supabase (una sola vez). Es idempotente.
--
-- Qué corrige:
-- 1. Las políticas "for all por escuela" permitían que cualquier usuario de la
--    escuela (incluido un padre) leyera y escribiera TODA la data vía la anon
--    key / API. Ahora: admin administra, entrenador opera, padre lee solo a
--    sus hijos.
-- 2. Reemplaza la política de lectura de `deuda` (era escuela-completa) por una
--    restringida a las deudas de los hijos del padre.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── helpers ──────────────────────────────────────────────────────────────────
create or replace function public.usuario_es_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.usuario where id = auth.uid() and rol in ('admin', 'entrenador')
  )
$$;

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
  )
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
    where a.sesion_id = p_sesion and ap.usuario_id = auth.uid()
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
    where a.grupo_id = p_grupo and ap.usuario_id = auth.uid()
  )
$$;

-- ── grupo ────────────────────────────────────────────────────────────────────
drop policy if exists "grupo_por_escuela" on public.grupo;
drop policy if exists "allow_all_grupo" on public.grupo;
drop policy if exists "grupo_admin" on public.grupo;
drop policy if exists "grupo_staff_read" on public.grupo;
drop policy if exists "grupo_padre_read" on public.grupo;

create policy "grupo_admin" on public.grupo
  for all using (
    public.usuario_es_admin() and escuela_id = public.usuario_escuela_id()
  )
  with check (
    public.usuario_es_admin() and escuela_id = public.usuario_escuela_id()
  );
create policy "grupo_staff_read" on public.grupo
  for select using (
    public.usuario_es_staff() and escuela_id = public.usuario_escuela_id()
  );
create policy "grupo_padre_read" on public.grupo
  for select using (
    public.usuario_ve_grupo(id) and escuela_id = public.usuario_escuela_id()
  );

-- ── alumno ───────────────────────────────────────────────────────────────────
drop policy if exists "alumno_por_escuela" on public.alumno;
drop policy if exists "allow_all_alumno" on public.alumno;
drop policy if exists "alumno_admin" on public.alumno;
drop policy if exists "alumno_staff_read" on public.alumno;
drop policy if exists "alumno_padre_read" on public.alumno;

create policy "alumno_admin" on public.alumno
  for all using (
    public.usuario_es_admin() and escuela_id = public.usuario_escuela_id()
  )
  with check (
    public.usuario_es_admin() and escuela_id = public.usuario_escuela_id()
  );
create policy "alumno_staff_read" on public.alumno
  for select using (
    public.usuario_es_staff() and escuela_id = public.usuario_escuela_id()
  );
create policy "alumno_padre_read" on public.alumno
  for select using (
    public.usuario_es_padre_de(id) and escuela_id = public.usuario_escuela_id()
  );

-- ── sesion ───────────────────────────────────────────────────────────────────
drop policy if exists "sesion_por_escuela" on public.sesion;
drop policy if exists "allow_all_sesion" on public.sesion;
drop policy if exists "sesion_admin" on public.sesion;
drop policy if exists "sesion_staff_read_write" on public.sesion;
drop policy if exists "sesion_padre_read" on public.sesion;

create policy "sesion_admin" on public.sesion
  for all using (
    public.usuario_es_admin() and escuela_id = public.usuario_escuela_id()
  )
  with check (
    public.usuario_es_admin() and escuela_id = public.usuario_escuela_id()
  );
create policy "sesion_staff_read_write" on public.sesion
  for select, insert using (
    public.usuario_es_staff() and escuela_id = public.usuario_escuela_id()
  )
  with check (
    public.usuario_es_staff() and escuela_id = public.usuario_escuela_id()
  );
create policy "sesion_padre_read" on public.sesion
  for select using (
    public.usuario_ve_sesion(id) and escuela_id = public.usuario_escuela_id()
  );

-- ── asistencia ───────────────────────────────────────────────────────────────
drop policy if exists "asistencia_por_escuela" on public.asistencia;
drop policy if exists "allow_all_asistencia" on public.asistencia;
drop policy if exists "asistencia_admin" on public.asistencia;
drop policy if exists "asistencia_staff" on public.asistencia;
drop policy if exists "asistencia_padre_read" on public.asistencia;

create policy "asistencia_admin" on public.asistencia
  for all using (
    public.usuario_es_admin() and escuela_id = public.usuario_escuela_id()
  )
  with check (
    public.usuario_es_admin() and escuela_id = public.usuario_escuela_id()
  );
create policy "asistencia_staff" on public.asistencia
  for select, insert, update using (
    public.usuario_es_staff() and escuela_id = public.usuario_escuela_id()
  )
  with check (
    public.usuario_es_staff() and escuela_id = public.usuario_escuela_id()
  );
create policy "asistencia_padre_read" on public.asistencia
  for select using (
    public.usuario_es_padre_de(alumno_id) and escuela_id = public.usuario_escuela_id()
  );

-- ── pago ─────────────────────────────────────────────────────────────────────
drop policy if exists "pago_por_escuela" on public.pago;
drop policy if exists "allow_all_pago" on public.pago;
drop policy if exists "pago_admin" on public.pago;
drop policy if exists "pago_staff_read" on public.pago;
drop policy if exists "pago_padre_read" on public.pago;

create policy "pago_admin" on public.pago
  for all using (
    public.usuario_es_admin() and escuela_id = public.usuario_escuela_id()
  )
  with check (
    public.usuario_es_admin() and escuela_id = public.usuario_escuela_id()
  );
create policy "pago_staff_read" on public.pago
  for select using (
    public.usuario_es_staff() and escuela_id = public.usuario_escuela_id()
  );
create policy "pago_padre_read" on public.pago
  for select using (
    public.usuario_es_padre_de(alumno_id) and escuela_id = public.usuario_escuela_id()
  );

-- ── evaluacion ───────────────────────────────────────────────────────────────
drop policy if exists "evaluacion_por_escuela" on public.evaluacion;
drop policy if exists "allow_all_evaluacion" on public.evaluacion;
drop policy if exists "evaluacion_admin" on public.evaluacion;
drop policy if exists "evaluacion_staff_read" on public.evaluacion;

create policy "evaluacion_admin" on public.evaluacion
  for all using (
    public.usuario_es_admin() and escuela_id = public.usuario_escuela_id()
  )
  with check (
    public.usuario_es_admin() and escuela_id = public.usuario_escuela_id()
  );
create policy "evaluacion_staff_read" on public.evaluacion
  for select using (
    public.usuario_es_staff() and escuela_id = public.usuario_escuela_id()
  );

-- ── ejercicio ────────────────────────────────────────────────────────────────
drop policy if exists "ejercicio_por_escuela" on public.ejercicio;
drop policy if exists "allow_all_ejercicio" on public.ejercicio;
drop policy if exists "ejercicio_admin" on public.ejercicio;
drop policy if exists "ejercicio_staff_read" on public.ejercicio;

create policy "ejercicio_admin" on public.ejercicio
  for all using (
    public.usuario_es_admin() and escuela_id = public.usuario_escuela_id()
  )
  with check (
    public.usuario_es_admin() and escuela_id = public.usuario_escuela_id()
  );
create policy "ejercicio_staff_read" on public.ejercicio
  for select using (
    public.usuario_es_staff() and escuela_id = public.usuario_escuela_id()
  );

-- ── evento ───────────────────────────────────────────────────────────────────
drop policy if exists "evento_por_escuela" on public.evento;
drop policy if exists "allow_all_evento" on public.evento;
drop policy if exists "evento_admin" on public.evento;
drop policy if exists "evento_staff_read" on public.evento;

create policy "evento_admin" on public.evento
  for all using (
    public.usuario_es_admin() and escuela_id = public.usuario_escuela_id()
  )
  with check (
    public.usuario_es_admin() and escuela_id = public.usuario_escuela_id()
  );
create policy "evento_staff_read" on public.evento
  for select using (
    public.usuario_es_staff() and escuela_id = public.usuario_escuela_id()
  );

-- ── deuda: endurecer la lectura del padre ────────────────────────────────────
drop policy if exists "deuda_padre_read" on public.deuda;
create policy "deuda_padre_read" on public.deuda
  for select using (
    escuela_id = public.usuario_escuela_id()
    and exists (
      select 1 from public.deuda_alumno da
      join public.alumno_padre ap on ap.alumno_id = da.alumno_id
      where da.deuda_id = deuda.id and ap.usuario_id = auth.uid()
    )
  );