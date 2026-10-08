-- Mantis Box Manager - Esquema de base de datos (Supabase)
-- Ejecuta en el SQL Editor de Supabase.
-- Multi-tenant: cada escuela se identifica por slug (venv ESCUELA_SLUG en la app).
--
-- Este archivo es ÚNICO y canónico: incluye el módulo de deudas + rol padre
-- (antes migración 002). Para bases ya existentes que corrieron schema.sql + 002,
-- aplica además supabase/migrations/003_autorizacion_por_rol.sql para endurecer
-- las políticas RLS por rol.

create extension if not exists "pgcrypto";

-- ── escuelas (tenants) ───────────────────────────────────────────────────────
create table if not exists public.escuela (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  slug text not null unique,
  plan text not null default 'basico',   -- basico / pro
  activa boolean not null default true,
  created_at timestamptz not null default now()
);

-- seed: la primera escuela
insert into public.escuela (nombre, slug) values ('Mantis Box Sabanalarga', 'mantisbox')
on conflict (slug) do nothing;

-- ── Usuarios (Supabase Auth + rol por escuela) ───────────────────────────────
-- Crea la cuenta primero en Supabase (Authentication > Users > Add user, con
-- correo y contraseña). Después inserta su fila aquí con el id de auth.users:
--
--   insert into public.usuario (id, escuela_id, email, rol)
--   values (
--     '<uuid del usuario de auth.users>',
--     (select id from public.escuela where slug = 'mantisbox'),
--     'correo@escuela.com',
--     'admin'  -- 'entrenador' o 'padre'
--   );
--
-- Esa fila es la que permite el login: sin ella, el usuario no entra a la app.
create table if not exists public.usuario (
  id uuid primary key references auth.users (id) on delete cascade,
  escuela_id uuid not null references public.escuela (id) on delete cascade,
  email text not null unique,
  rol text not null default 'entrenador' check (rol in ('admin', 'entrenador', 'padre')),
  username text,
  created_at timestamptz not null default now()
);
create index if not exists idx_usuario_escuela on public.usuario (escuela_id);
create unique index if not exists uq_usuario_username
  on public.usuario (escuela_id, lower(username)) where username is not null;

-- ── grupos ───────────────────────────────────────────────────────────────────
create table if not exists public.grupo (
  id uuid primary key default gen_random_uuid(),
  escuela_id uuid not null references public.escuela (id) on delete cascade,
  nombre text not null,
  categoria_edad text not null default 'infantil',
  dias text not null default '',
  hora_inicio time not null,
  hora_fin time not null,
  entrenador text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists idx_grupo_escuela on public.grupo (escuela_id);

-- ── alumnos ──────────────────────────────────────────────────────────────────
create table if not exists public.alumno (
  id uuid primary key default gen_random_uuid(),
  escuela_id uuid not null references public.escuela (id) on delete cascade,
  nombre text not null,
  fecha_nacimiento date,
  categoria text not null default 'infantil' check (categoria in ('infantil', 'juvenil', 'adulto')),
  nivel_cinta text not null default '',
  fecha_ingreso date,
  estado text not null default 'activo' check (estado in ('prospecto', 'activo', 'inactivo')),
  grupo_id uuid references public.grupo (id) on delete set null,
  padre_nombre text,
  padre_telefono text,
  padre_email text,
  codigo_inscripcion text,
  documento text,
  genero text,
  peso_kg numeric,
  notas text,
  created_at timestamptz not null default now()
);
create index if not exists idx_alumno_escuela on public.alumno (escuela_id);
create unique index if not exists uq_alumno_codigo
  on public.alumno (escuela_id, codigo_inscripcion) where codigo_inscripcion is not null;

-- ── sesiones de entrenamiento ────────────────────────────────────────────────
create table if not exists public.sesion (
  id uuid primary key default gen_random_uuid(),
  escuela_id uuid not null references public.escuela (id) on delete cascade,
  grupo_id uuid not null references public.grupo (id) on delete cascade,
  fecha date not null,
  tema text not null default '',
  entrenador text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists idx_sesion_escuela on public.sesion (escuela_id);

-- ── asistencia ───────────────────────────────────────────────────────────────
create table if not exists public.asistencia (
  id uuid primary key default gen_random_uuid(),
  escuela_id uuid not null references public.escuela (id) on delete cascade,
  sesion_id uuid not null references public.sesion (id) on delete cascade,
  alumno_id uuid not null references public.alumno (id) on delete cascade,
  presente boolean not null default false,
  unique (sesion_id, alumno_id)
);
create index if not exists idx_asistencia_escuela on public.asistencia (escuela_id);

-- ── pagos ────────────────────────────────────────────────────────────────────
create table if not exists public.pago (
  id uuid primary key default gen_random_uuid(),
  escuela_id uuid not null references public.escuela (id) on delete cascade,
  alumno_id uuid not null references public.alumno (id) on delete cascade,
  mes text not null,                    -- formato YYYY-MM
  monto numeric not null default 0,
  estado text not null default 'pendiente' check (estado in ('pagado', 'pendiente', 'vencido')),
  fecha_pago date,
  fecha_vencimiento date not null default (date_trunc('month', now()) + interval '15 days')::date,
  metodo_pago text,
  observaciones text,
  comprobante_numero bigint,
  created_at timestamptz not null default now(),
  unique (alumno_id, mes)
);
create index if not exists idx_pago_escuela on public.pago (escuela_id);
create unique index if not exists uq_pago_comprobante
  on public.pago (comprobante_numero) where comprobante_numero is not null;

-- Número consecutivo del comprobante: se asigna cuando el pago pasa a 'pagado'.
create sequence if not exists public.pago_comprobante_seq;
create or replace function public.pago_asignar_comprobante()
returns trigger
language plpgsql
as $$
begin
  if new.estado = 'pagado' and new.comprobante_numero is null then
    new.comprobante_numero := nextval('public.pago_comprobante_seq');
  end if;
  return new;
end;
$$;
drop trigger if exists trg_pago_comprobante on public.pago;
create trigger trg_pago_comprobante
  before insert or update on public.pago
  for each row execute function public.pago_asignar_comprobante();

-- ── evaluaciones de cinturones ───────────────────────────────────────────────
create table if not exists public.evaluacion (
  id uuid primary key default gen_random_uuid(),
  escuela_id uuid not null references public.escuela (id) on delete cascade,
  alumno_id uuid not null references public.alumno (id) on delete cascade,
  fecha date not null default current_date,
  tipo text not null default 'cinta',   -- cinta / tecnica / fisico / general
  tecnica_json jsonb not null default '[]'::jsonb,
  fisico_json jsonb not null default '[]'::jsonb,
  actitud_json jsonb not null default '[]'::jsonb,
  resultado text not null default 'no_apto' check (resultado in ('apto', 'no_apto')),
  nueva_cinta text,
  observaciones text,
  created_at timestamptz not null default now()
);
create index if not exists idx_evaluacion_escuela on public.evaluacion (escuela_id);

-- ── biblioteca de entrenamiento ──────────────────────────────────────────────
create table if not exists public.ejercicio (
  id uuid primary key default gen_random_uuid(),
  escuela_id uuid not null references public.escuela (id) on delete cascade,
  nombre text not null,
  categoria text not null default 'tecnica',  -- calentamiento / tecnica / fisico / actitud
  dificultad text not null default 'basica',  -- basica / intermedia / avanzada
  descripcion text,
  duracion text,
  created_at timestamptz not null default now()
);
create index if not exists idx_ejercicio_escuela on public.ejercicio (escuela_id);

-- ── eventos ──────────────────────────────────────────────────────────────────
create table if not exists public.evento (
  id uuid primary key default gen_random_uuid(),
  escuela_id uuid not null references public.escuela (id) on delete cascade,
  nombre text not null,
  fecha date not null,
  tipo text not null default 'otro',    -- examen / torneo / seminario / otro
  lugar text,
  descripcion text,
  created_at timestamptz not null default now()
);
create index if not exists idx_evento_escuela on public.evento (escuela_id);

-- ── módulo deudas por evento + rol padre ─────────────────────────────────────
-- Vincula un usuario padre con el alumno de su hijo.
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

-- Deudas/eventos adicionales creados por el admin.
create table if not exists public.deuda (
  id              uuid primary key default gen_random_uuid(),
  escuela_id      uuid not null references public.escuela (id) on delete cascade,
  nombre          text not null,
  descripcion     text,
  fecha_creacion  date not null default current_date,
  created_at      timestamptz not null default now()
);
create index if not exists idx_deuda_escuela on public.deuda (escuela_id);

-- Asignación de deuda por alumno (monto individual).
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

-- Registro de abonos realizados.
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
-- RLS: aislamiento por escuela + rol (admin gestiona, entrenador opera,
-- padre lee solo a sus hijos)
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.escuela           enable row level security;
alter table public.usuario           enable row level security;
alter table public.grupo             enable row level security;
alter table public.alumno            enable row level security;
alter table public.sesion            enable row level security;
alter table public.asistencia        enable row level security;
alter table public.pago              enable row level security;
alter table public.evaluacion        enable row level security;
alter table public.ejercicio         enable row level security;
alter table public.evento            enable row level security;
alter table public.alumno_padre      enable row level security;
alter table public.deuda             enable row level security;
alter table public.deuda_alumno      enable row level security;
alter table public.deuda_alumno_pago enable row level security;

-- Funciones de ayuda (security definer para leer `usuario` aun con RLS).
create or replace function public.usuario_escuela_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select escuela_id from public.usuario where id = auth.uid()
$$;

create or replace function public.usuario_es_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.usuario where id = auth.uid() and rol = 'admin'
  )
$$;

-- Staff = admin o entrenador (puede operar la escuela, no administrar).
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

-- ¿El usuario autenticado es padre del alumno p?
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

-- ¿El padre puede ver la sesión? (tiene un hijo con asistencia en ella)
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

-- ¿El padre puede ver el grupo? (tiene un hijo asignado)
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

-- ── escuela: solo la fila de la propia escuela ───────────────────────────────
drop policy if exists "escuela_select_propia" on public.escuela;
create policy "escuela_select_propia" on public.escuela
  for select using (id = public.usuario_escuela_id());

-- ── usuario: cada quien ve su fila; los admins administran su escuela ────────
drop policy if exists "usuario_select_own" on public.usuario;
create policy "usuario_select_own" on public.usuario
  for select using (
    id = auth.uid()
    or (
      public.usuario_es_admin()
      and escuela_id = public.usuario_escuela_id()
    )
  );

drop policy if exists "usuario_insert_admin" on public.usuario;
create policy "usuario_insert_admin" on public.usuario
  for insert with check (
    public.usuario_es_admin() and escuela_id = public.usuario_escuela_id()
  );

drop policy if exists "usuario_update_admin" on public.usuario;
create policy "usuario_update_admin" on public.usuario
  for update using (
    public.usuario_es_admin() and escuela_id = public.usuario_escuela_id()
  )
  with check (
    public.usuario_es_admin() and escuela_id = public.usuario_escuela_id()
  );

drop policy if exists "usuario_delete_admin" on public.usuario;
create policy "usuario_delete_admin" on public.usuario
  for delete using (
    public.usuario_es_admin() and escuela_id = public.usuario_escuela_id()
  );

-- ── grupo ────────────────────────────────────────────────────────────────────
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

-- ── alumno_padre ─────────────────────────────────────────────────────────────
drop policy if exists "alumno_padre_admin" on public.alumno_padre;
drop policy if exists "alumno_padre_self" on public.alumno_padre;
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

-- ── deuda ────────────────────────────────────────────────────────────────────
drop policy if exists "deuda_admin" on public.deuda;
drop policy if exists "deuda_padre_read" on public.deuda;
create policy "deuda_admin" on public.deuda
  for all using (
    escuela_id = public.usuario_escuela_id() and public.usuario_es_admin()
  )
  with check (
    escuela_id = public.usuario_escuela_id() and public.usuario_es_admin()
  );
create policy "deuda_padre_read" on public.deuda
  for select using (
    escuela_id = public.usuario_escuela_id()
    and exists (
      select 1 from public.deuda_alumno da
      join public.alumno_padre ap on ap.alumno_id = da.alumno_id
      where da.deuda_id = deuda.id and ap.usuario_id = auth.uid()
    )
  );

-- ── deuda_alumno ─────────────────────────────────────────────────────────────
drop policy if exists "deuda_alumno_admin" on public.deuda_alumno;
drop policy if exists "deuda_alumno_padre_read" on public.deuda_alumno;
create policy "deuda_alumno_admin" on public.deuda_alumno
  for all using (
    escuela_id = public.usuario_escuela_id() and public.usuario_es_admin()
  )
  with check (
    escuela_id = public.usuario_escuela_id() and public.usuario_es_admin()
  );
create policy "deuda_alumno_padre_read" on public.deuda_alumno
  for select using (
    escuela_id = public.usuario_escuela_id()
    and exists (
      select 1 from public.alumno_padre ap
      where ap.alumno_id = deuda_alumno.alumno_id
        and ap.usuario_id = auth.uid()
    )
  );

-- ── deuda_alumno_pago ────────────────────────────────────────────────────────
drop policy if exists "deuda_pago_admin" on public.deuda_alumno_pago;
drop policy if exists "deuda_pago_padre_read" on public.deuda_alumno_pago;
create policy "deuda_pago_admin" on public.deuda_alumno_pago
  for all using (
    escuela_id = public.usuario_escuela_id() and public.usuario_es_admin()
  )
  with check (
    escuela_id = public.usuario_escuela_id() and public.usuario_es_admin()
  );
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

-- ─────────────────────────────────────────────────────────────────────────────
-- Pagos flexibles (migración 009): se repite aquí para que schema.sql quede completo.
-- ─────────────────────────────────────────────────────────────────────────────
-- ── Alumno ───────────────────────────────────────────────────────────────────
alter table public.alumno add column if not exists modalidad_pago text not null default 'mensual';
alter table public.alumno drop constraint if exists alumno_modalidad_pago_check;
alter table public.alumno add constraint alumno_modalidad_pago_check
  check (modalidad_pago in ('mensual', 'semanal', 'becado'));

alter table public.alumno add column if not exists acceso_manual text not null default 'auto';
alter table public.alumno drop constraint if exists alumno_acceso_manual_check;
alter table public.alumno add constraint alumno_acceso_manual_check
  check (acceso_manual in ('auto', 'activo', 'suspendido'));

-- ── Grupo ────────────────────────────────────────────────────────────────────
alter table public.grupo add column if not exists dia_limite_pago int not null default 5;
alter table public.grupo drop constraint if exists grupo_dia_limite_pago_check;
alter table public.grupo add constraint grupo_dia_limite_pago_check
  check (dia_limite_pago between 1 and 28);

-- ── Pago: estado 'parcial' y total abonado ───────────────────────────────────
alter table public.pago add column if not exists monto_pagado numeric not null default 0;
alter table public.pago drop constraint if exists pago_estado_check;
alter table public.pago add constraint pago_estado_check
  check (estado in ('pagado', 'parcial', 'pendiente', 'vencido'));

-- ── Abonos: cada pago recibido, con su comprobante ───────────────────────────
create table if not exists public.pago_abono (
  id uuid primary key default gen_random_uuid(),
  escuela_id uuid not null references public.escuela (id) on delete cascade,
  pago_id uuid not null references public.pago (id) on delete cascade,
  monto numeric not null check (monto > 0),
  fecha_pago date not null default current_date,
  metodo_pago text,
  observaciones text,
  comprobante_numero bigint,
  created_at timestamptz not null default now()
);
create index if not exists idx_pago_abono_pago on public.pago_abono (pago_id);
create index if not exists idx_pago_abono_escuela on public.pago_abono (escuela_id);
create unique index if not exists uq_pago_abono_comprobante
  on public.pago_abono (comprobante_numero) where comprobante_numero is not null;

alter table public.pago_abono enable row level security;
drop policy if exists "pago_abono_admin" on public.pago_abono;
create policy "pago_abono_admin" on public.pago_abono
  for all using (public.usuario_es_admin() and escuela_id = public.usuario_escuela_id())
  with check (public.usuario_es_admin() and escuela_id = public.usuario_escuela_id());
drop policy if exists "pago_abono_staff_read" on public.pago_abono;
create policy "pago_abono_staff_read" on public.pago_abono
  for select using (public.usuario_es_staff() and escuela_id = public.usuario_escuela_id());

-- Número consecutivo del comprobante: ahora se asigna por abono (antes, por pago).
drop trigger if exists trg_pago_comprobante on public.pago;
create or replace function public.pago_abono_asignar_comprobante()
returns trigger
language plpgsql
as $$
begin
  if new.comprobante_numero is null then
    new.comprobante_numero := nextval('public.pago_comprobante_seq');
  end if;
  return new;
end;
$$;
drop trigger if exists trg_abono_comprobante on public.pago_abono;
create trigger trg_abono_comprobante
  before insert on public.pago_abono
  for each row execute function public.pago_abono_asignar_comprobante();

-- El total abonado y el estado del pago se recalculan con cada abono.
create or replace function public.pago_recalcular(p_pago uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total numeric;
  v_ultima date;
  v_monto numeric;
  v_estado text;
begin
  select coalesce(sum(monto), 0), max(fecha_pago)
    into v_total, v_ultima
    from public.pago_abono where pago_id = p_pago;
  select monto, estado into v_monto, v_estado from public.pago where id = p_pago;
  if not found then return; end if;

  update public.pago set
    monto_pagado = v_total,
    estado = case
      when v_monto > 0 and v_total >= v_monto then 'pagado'
      when v_total > 0 then 'parcial'
      when v_estado in ('pagado', 'parcial') then 'pendiente'
      else v_estado
    end,
    fecha_pago = case when v_monto > 0 and v_total >= v_monto then v_ultima else null end
  where id = p_pago;
end;
$$;

create or replace function public.pago_abono_recalcular()
returns trigger
language plpgsql
as $$
begin
  perform public.pago_recalcular(coalesce(new.pago_id, old.pago_id));
  if tg_op = 'UPDATE' and new.pago_id is distinct from old.pago_id then
    perform public.pago_recalcular(old.pago_id);
  end if;
  return null;
end;
$$;
drop trigger if exists trg_abono_recalcular on public.pago_abono;
create trigger trg_abono_recalcular
  after insert or update or delete on public.pago_abono
  for each row execute function public.pago_abono_recalcular();

-- Los pagos que ya estaban pagados reciben un abono equivalente (conservan su número).
insert into public.pago_abono
  (escuela_id, pago_id, monto, fecha_pago, metodo_pago, observaciones, comprobante_numero)
select p.escuela_id, p.id, p.monto,
       coalesce(p.fecha_pago, p.fecha_vencimiento), p.metodo_pago, p.observaciones,
       p.comprobante_numero
from public.pago p
where p.estado = 'pagado'
  and p.monto > 0
  and not exists (select 1 from public.pago_abono a where a.pago_id = p.id);

-- ── ¿El alumno está al día? v2 ───────────────────────────────────────────────
-- 1) acceso_manual 'activo' / 'suspendido' manda sobre todo lo demás.
-- 2) becado: nunca debe nada.
-- 3) El día límite sale del grupo (5 si no tiene). Desde ese día se exige el mes en
--    curso; antes, el mes anterior.
-- 4) mensual: el pago del mes debe estar 'pagado'. semanal: debe llevar abonado al
--    menos un cuarto del mes por cada semana transcurrida (mes anterior: completo).
create or replace function public.alumno_al_dia(p_alumno uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  a record;
  v_hoy date := (now() at time zone 'America/Bogota')::date;
  v_dia int := extract(day from (now() at time zone 'America/Bogota'))::int;
  v_limite int;
  v_mes_ref text;
  v_mes_ingreso text;
  v_monto numeric;
  v_pagado numeric;
  v_estado text;
  v_cuotas int;
begin
  select al.modalidad_pago, al.acceso_manual, al.fecha_ingreso, al.created_at, al.grupo_id
    into a
    from public.alumno al where al.id = p_alumno;
  if not found then return false; end if;

  if a.acceso_manual = 'activo' then return true; end if;
  if a.acceso_manual = 'suspendido' then return false; end if;
  if a.modalidad_pago = 'becado' then return true; end if;

  select g.dia_limite_pago into v_limite from public.grupo g where g.id = a.grupo_id;
  v_limite := coalesce(v_limite, 5);

  if v_dia >= v_limite then
    v_mes_ref := to_char(v_hoy, 'YYYY-MM');
  else
    v_mes_ref := to_char(v_hoy - interval '1 month', 'YYYY-MM');
  end if;

  v_mes_ingreso := to_char(coalesce(a.fecha_ingreso, a.created_at::date), 'YYYY-MM');
  if v_mes_ingreso > v_mes_ref then return true; end if;

  select p.monto, p.monto_pagado, p.estado into v_monto, v_pagado, v_estado
    from public.pago p
    where p.alumno_id = p_alumno and p.mes = v_mes_ref;
  if not found then return false; end if;
  if v_estado = 'pagado' then return true; end if;

  if a.modalidad_pago = 'semanal' and v_monto > 0 then
    if v_mes_ref = to_char(v_hoy, 'YYYY-MM') then
      v_cuotas := least(4, ceil(v_dia / 7.0)::int);
    else
      v_cuotas := 4;
    end if;
    return coalesce(v_pagado, 0) >= v_monto * v_cuotas / 4.0;
  end if;

  return false;
end;
$$;

-- ── Valor de la mensualidad ──────────────────────────────────────────────────
update public.escuela set mensualidad_monto = 80000 where mensualidad_monto = 0;
