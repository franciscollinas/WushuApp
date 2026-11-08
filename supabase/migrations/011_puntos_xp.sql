-- Migración 011: puntos XP (gamificación)
-- Los puntos de asistencia y de racha NO se guardan: se calculan desde la asistencia,
-- así que corregir una asistencia corrige los puntos solo. Aquí solo se guardan
-- los valores configurables y los puntos que el club otorga a mano.

alter table public.escuela add column if not exists xp_por_asistencia int not null default 10;
alter table public.escuela add column if not exists xp_racha_dias int not null default 5;
alter table public.escuela add column if not exists xp_racha_bonus int not null default 20;

create table if not exists public.xp_movimiento (
  id uuid primary key default gen_random_uuid(),
  escuela_id uuid not null references public.escuela (id) on delete cascade,
  alumno_id uuid not null references public.alumno (id) on delete cascade,
  puntos int not null check (puntos <> 0),
  motivo text not null,
  fecha date not null default current_date,
  created_at timestamptz not null default now()
);
create index if not exists idx_xp_movimiento_escuela on public.xp_movimiento (escuela_id);
create index if not exists idx_xp_movimiento_alumno on public.xp_movimiento (alumno_id);

alter table public.xp_movimiento enable row level security;

drop policy if exists "xp_movimiento_admin" on public.xp_movimiento;
create policy "xp_movimiento_admin" on public.xp_movimiento
  for all using (
    public.usuario_es_admin() and escuela_id = public.usuario_escuela_id()
  )
  with check (
    public.usuario_es_admin() and escuela_id = public.usuario_escuela_id()
  );

drop policy if exists "xp_movimiento_staff_read" on public.xp_movimiento;
create policy "xp_movimiento_staff_read" on public.xp_movimiento
  for select using (
    public.usuario_es_staff() and escuela_id = public.usuario_escuela_id()
  );
