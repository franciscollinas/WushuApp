-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 009: pagos flexibles
-- - alumno.modalidad_pago: 'mensual' | 'semanal' | 'becado'.
-- - alumno.acceso_manual: 'auto' (según pagos) | 'activo' | 'suspendido'.
-- - grupo.dia_limite_pago: día del mes desde el que se exige estar al día (5 por defecto).
-- - pago_abono: cada pago recibido (con su comprobante); el mes se completa al sumar
--   el valor de la mensualidad. pago.monto_pagado y pago.estado se calculan solos.
-- - alumno_al_dia() v2: aplica todo lo anterior (RLS y portal usan esta misma función).
-- - Valor de la mensualidad: 80.000 si aún estaba en 0.
-- Requisito: migraciones 007 y 008. Ejecuta en el SQL Editor. Es idempotente.
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
