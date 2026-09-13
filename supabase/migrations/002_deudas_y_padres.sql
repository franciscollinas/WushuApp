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
