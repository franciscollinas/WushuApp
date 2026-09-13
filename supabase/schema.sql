-- Mantis Box Manager - Esquema de base de datos (Supabase)
-- Ejecuta en el SQL Editor de Supabase.
-- Multi-tenant: cada escuela se identifica por slug (venv ESCUELA_SLUG en la app).

create extension if not exists "pgcrypto";

-- escuelas (tenants)
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

-- ---------------------------------------------------------------------------
-- Usuarios (Supabase Auth + rol por escuela)
-- ---------------------------------------------------------------------------
-- Crea la cuenta primero en Supabase (Authentication > Users > Add user, con
-- correo y contraseña). Después inserta su fila aquí con el id de auth.users:
--
--   insert into public.usuario (id, escuela_id, email, rol)
--   values (
--     '<uuid del usuario de auth.users>',
--     (select id from public.escuela where slug = 'mantisbox'),
--     'correo@escuela.com',
--     'admin'  -- o 'entrenador'
--   );
--
-- Esa fila es la que permite el login: sin ella, el usuario no entra a la app.
create table if not exists public.usuario (
  id uuid primary key references auth.users (id) on delete cascade,
  escuela_id uuid not null references public.escuela (id) on delete cascade,
  email text not null unique,
  rol text not null default 'entrenador' check (rol in ('admin', 'entrenador')),
  created_at timestamptz not null default now()
);
create index if not exists idx_usuario_escuela on public.usuario (escuela_id);

-- grupos
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

-- alumnos
create table if not exists public.alumno (
  id uuid primary key default gen_random_uuid(),
  escuela_id uuid not null references public.escuela (id) on delete cascade,
  nombre text not null,
  fecha_nacimiento date,
  categoria text not null default 'infantil' check (categoria in ('infantil', 'juvenil', 'adulto')),
  nivel_cinta text not null default '',
  fecha_ingreso date,
  estado text not null default 'activo' check (estado in ('activo', 'inactivo')),
  grupo_id uuid references public.grupo (id) on delete set null,
  padre_nombre text,
  padre_telefono text,
  notas text,
  created_at timestamptz not null default now()
);
create index if not exists idx_alumno_escuela on public.alumno (escuela_id);

-- sesiones de entrenamiento
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

-- asistencia
create table if not exists public.asistencia (
  id uuid primary key default gen_random_uuid(),
  escuela_id uuid not null references public.escuela (id) on delete cascade,
  sesion_id uuid not null references public.sesion (id) on delete cascade,
  alumno_id uuid not null references public.alumno (id) on delete cascade,
  presente boolean not null default false,
  unique (sesion_id, alumno_id)
);
create index if not exists idx_asistencia_escuela on public.asistencia (escuela_id);

-- pagos
create table if not exists public.pago (
  id uuid primary key default gen_random_uuid(),
  escuela_id uuid not null references public.escuela (id) on delete cascade,
  alumno_id uuid not null references public.alumno (id) on delete cascade,
  mes text not null,                    -- formato YYYY-MM
  monto numeric not null default 0,
  estado text not null default 'pendiente' check (estado in ('pagado', 'pendiente', 'vencido')),
  fecha_pago date,
  fecha_vencimiento date not null default (date_trunc('month', now()) + interval '15 days')::date,
  created_at timestamptz not null default now(),
  unique (alumno_id, mes)
);
create index if not exists idx_pago_escuela on public.pago (escuela_id);

-- evaluaciones de cinturones (Fase 2)
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

-- biblioteca de entrenamiento (Fase 2)
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

-- eventos (Fase 2)
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

-- ---------------------------------------------------------------------------
-- RLS: aislamiento por escuela según el usuario autenticado
-- ---------------------------------------------------------------------------
-- Cada fila es visible/editable solo si su escuela_id coincide con la escuela
-- del usuario autenticado (resuelta desde la tabla `usuario`). El filtro por
-- escuela_id a nivel de aplicación se mantiene como defensa adicional.
alter table public.escuela enable row level security;
alter table public.grupo enable row level security;
alter table public.alumno enable row level security;
alter table public.sesion enable row level security;
alter table public.asistencia enable row level security;
alter table public.pago enable row level security;
alter table public.evaluacion enable row level security;
alter table public.ejercicio enable row level security;
alter table public.evento enable row level security;
alter table public.usuario enable row level security;

-- Funciones de ayuda (su seguridad definer les permite leer `usuario`).
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

-- ── escuela: solo la fila de la propia escuela ──────────────────────────────
drop policy if exists "allow_all_escuela" on public.escuela;
create policy "escuela_select_propia" on public.escuela
  for select using (id = public.usuario_escuela_id());

-- ── tablas de datos: solo filas de la escuela del usuario ───────────────────
drop policy if exists "allow_all_grupo" on public.grupo;
create policy "grupo_por_escuela" on public.grupo
  for all using (escuela_id = public.usuario_escuela_id())
  with check (escuela_id = public.usuario_escuela_id());

drop policy if exists "allow_all_alumno" on public.alumno;
create policy "alumno_por_escuela" on public.alumno
  for all using (escuela_id = public.usuario_escuela_id())
  with check (escuela_id = public.usuario_escuela_id());

drop policy if exists "allow_all_sesion" on public.sesion;
create policy "sesion_por_escuela" on public.sesion
  for all using (escuela_id = public.usuario_escuela_id())
  with check (escuela_id = public.usuario_escuela_id());

drop policy if exists "allow_all_asistencia" on public.asistencia;
create policy "asistencia_por_escuela" on public.asistencia
  for all using (escuela_id = public.usuario_escuela_id())
  with check (escuela_id = public.usuario_escuela_id());

drop policy if exists "allow_all_pago" on public.pago;
create policy "pago_por_escuela" on public.pago
  for all using (escuela_id = public.usuario_escuela_id())
  with check (escuela_id = public.usuario_escuela_id());

drop policy if exists "allow_all_evaluacion" on public.evaluacion;
create policy "evaluacion_por_escuela" on public.evaluacion
  for all using (escuela_id = public.usuario_escuela_id())
  with check (escuela_id = public.usuario_escuela_id());

drop policy if exists "allow_all_ejercicio" on public.ejercicio;
create policy "ejercicio_por_escuela" on public.ejercicio
  for all using (escuela_id = public.usuario_escuela_id())
  with check (escuela_id = public.usuario_escuela_id());

drop policy if exists "allow_all_evento" on public.evento;
create policy "evento_por_escuela" on public.evento
  for all using (escuela_id = public.usuario_escuela_id())
  with check (escuela_id = public.usuario_escuela_id());

-- ── usuario: cada quien ve su fila; los admins administran su escuela ───────
create policy "usuario_select_own" on public.usuario
  for select using (
    id = auth.uid()
    or (
      public.usuario_es_admin()
      and escuela_id = public.usuario_escuela_id()
    )
  );

create policy "usuario_insert_admin" on public.usuario
  for insert with check (
    public.usuario_es_admin() and escuela_id = public.usuario_escuela_id()
  );

create policy "usuario_update_admin" on public.usuario
  for update using (
    public.usuario_es_admin() and escuela_id = public.usuario_escuela_id()
  )
  with check (
    public.usuario_es_admin() and escuela_id = public.usuario_escuela_id()
  );

create policy "usuario_delete_admin" on public.usuario
  for delete using (
    public.usuario_es_admin() and escuela_id = public.usuario_escuela_id()
  );