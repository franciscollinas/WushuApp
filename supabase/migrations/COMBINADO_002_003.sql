-- ═══════════════════════════════════════════════════════════════════
--  COMBINADO: MIGRACION 002 + 003 (ejecutar UNA sola vez en este DB)
--  Podria correr 002 y luego 003 por separado; aqui estan en orden.
--  Este archivo es SOLO para bases ya existentes (schema.sql v1 aplicado).
--  Las instalaciones nuevas deben usar supabase/schema.sql.
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 002: Deudas por evento + rol padre
-- Ejecuta en el SQL Editor de Supabase (una sola vez).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Ampliar el rol de usuario para incluir 'padre'
alter table public.usuario drop constraint if exists usuario_rol_check;
alter table public.usuario add constraint usuario_rol_check
  check (rol in ('admin', 'entrenador', 'padre'));

-- 2. Tabla que vincula un usuario padre con el alumno de su hijo
create table if not exists public.alumno_padre (
  id          uuid primary key default gen_random_uuid(),
  escuela_id  uuid not null references public.escuela (id) on delete cascade,
  alumno_id   uuid not null references public.alumno (id) on delete cascade,
  usuario_id  uuid not null references public.usuario (id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (alumno_id, usuario_id)
);
create index if not exists idx_alumno_padre_escuela on public.alumno_padre (escuela_id);
create index if not exists idx_alumno_padre_usuario on public.alumno_padre (usuario_id);

-- 3. Tabla de deudas/eventos adicionales creados por el admin
create table if not exists public.deuda (
  id              uuid primary key default gen_random_uuid(),
  escuela_id      uuid not null references public.escuela (id) on delete cascade,
  nombre          text not null,
  descripcion     text,
  fecha_creacion  date not null default current_date,
  created_at      timestamptz not null default now()
);
create index if not exists idx_deuda_escuela on public.deuda (escuela_id);

-- 4. Asignación de deuda por alumno (monto individual)
create table if not exists public.deuda_alumno (
  id           uuid primary key default gen_random_uuid(),
  escuela_id   uuid not null references public.escuela (id) on delete cascade,
  deuda_id     uuid not null references public.deuda (id) on delete cascade,
  alumno_id    uuid not null references public.alumno (id) on delete cascade,
  monto_total  numeric not null check (monto_total > 0),
  monto_pagado numeric not null default 0 check (monto_pagado >= 0),
  estado       text not null default 'pendiente'
               check (estado in ('pendiente', 'parcial', 'pagado')),
  created_at   timestamptz not null default now(),
  unique (deuda_id, alumno_id)
);
create index if not exists idx_deuda_alumno_escuela on public.deuda_alumno (escuela_id);
create index if not exists idx_deuda_alumno_alumno  on public.deuda_alumno (alumno_id);

-- 5. Registro de abonos realizados
create table if not exists public.deuda_alumno_pago (
  id               uuid primary key default gen_random_uuid(),
  escuela_id       uuid not null references public.escuela (id) on delete cascade,
  deuda_alumno_id  uuid not null references public.deuda_alumno (id) on delete cascade,
  monto            numeric not null check (monto > 0),
  fecha            date not null default current_date,
  nota             text,
  created_at       timestamptz not null default now()
);
create index if not exists idx_deuda_pago_escuela on public.deuda_alumno_pago (escuela_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.alumno_padre       enable row level security;
alter table public.deuda              enable row level security;
alter table public.deuda_alumno       enable row level security;
alter table public.deuda_alumno_pago  enable row level security;

-- alumno_padre: admin gestiona, padre lee solo sus filas
create policy "alumno_padre_admin" on public.alumno_padre
  for all using (
    escuela_id = public.usuario_escuela_id()
    and public.usuario_es_admin()
  )
  with check (
    escuela_id = public.usuario_escuela_id()
    and public.usuario_es_admin()
  );

create policy "alumno_padre_self" on public.alumno_padre
  for select using (usuario_id = auth.uid());

-- deuda: admin gestiona; padre lee deudas de su escuela (filtro por alumno en app)
create policy "deuda_admin" on public.deuda
  for all using (escuela_id = public.usuario_escuela_id() and public.usuario_es_admin())
  with check (escuela_id = public.usuario_escuela_id() and public.usuario_es_admin());

create policy "deuda_padre_read" on public.deuda
  for select using (escuela_id = public.usuario_escuela_id());

-- deuda_alumno: admin gestiona; padre lee filas de su alumno
create policy "deuda_alumno_admin" on public.deuda_alumno
  for all using (escuela_id = public.usuario_escuela_id() and public.usuario_es_admin())
  with check (escuela_id = public.usuario_escuela_id() and public.usuario_es_admin());

create policy "deuda_alumno_padre_read" on public.deuda_alumno
  for select using (
    escuela_id = public.usuario_escuela_id()
    and exists (
      select 1 from public.alumno_padre ap
      where ap.alumno_id = deuda_alumno.alumno_id
        and ap.usuario_id = auth.uid()
    )
  );

-- deuda_alumno_pago: admin gestiona; padre lee sus abonos
create policy "deuda_pago_admin" on public.deuda_alumno_pago
  for all using (escuela_id = public.usuario_escuela_id() and public.usuario_es_admin())
  with check (escuela_id = public.usuario_escuela_id() and public.usuario_es_admin());

create policy "deuda_pago_padre_read" on public.deuda_alumno_pago
  for select using (
    escuela_id = public.usuario_escuela_id()
    and exists (
      select 1
      from public.deuda_alumno da
      join public.alumno_padre ap on ap.alumno_id = da.alumno_id
      where da.id = deuda_alumno_pago.deuda_alumno_id
        and ap.usuario_id = auth.uid()
    )
  );


-- ───────────────────────────────────────────────────────────────────
--  003 — Autorización por rol (RLS endurecido)
-- ───────────────────────────────────────────────────────────────────

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
drop policy if exists "sesion_staff_read" on public.sesion;
drop policy if exists "sesion_staff_insert" on public.sesion;
drop policy if exists "sesion_padre_read" on public.sesion;

create policy "sesion_admin" on public.sesion
  for all using (
    public.usuario_es_admin() and escuela_id = public.usuario_escuela_id()
  )
  with check (
    public.usuario_es_admin() and escuela_id = public.usuario_escuela_id()
  );
create policy "sesion_staff_read" on public.sesion
  for select using (
    public.usuario_es_staff() and escuela_id = public.usuario_escuela_id()
  );
create policy "sesion_staff_insert" on public.sesion
  for insert with check (
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
drop policy if exists "asistencia_staff_read" on public.asistencia;
drop policy if exists "asistencia_staff_insert" on public.asistencia;
drop policy if exists "asistencia_staff_update" on public.asistencia;
drop policy if exists "asistencia_padre_read" on public.asistencia;

create policy "asistencia_admin" on public.asistencia
  for all using (
    public.usuario_es_admin() and escuela_id = public.usuario_escuela_id()
  )
  with check (
    public.usuario_es_admin() and escuela_id = public.usuario_escuela_id()
  );
create policy "asistencia_staff_read" on public.asistencia
  for select using (
    public.usuario_es_staff() and escuela_id = public.usuario_escuela_id()
  );
create policy "asistencia_staff_insert" on public.asistencia
  for insert with check (
    public.usuario_es_staff() and escuela_id = public.usuario_escuela_id()
  );
create policy "asistencia_staff_update" on public.asistencia
  for update using (
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