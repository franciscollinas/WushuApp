-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 008: datos del comprobante de pago
-- - pago.metodo_pago y pago.observaciones: se llenan al confirmar el pago.
-- - pago.comprobante_numero: número consecutivo que se asigna solo cuando el
--   pago pasa a 'pagado' (trigger), venga de donde venga el cambio.
-- Ejecuta en el SQL Editor de Supabase. Es idempotente.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.pago add column if not exists metodo_pago text;
alter table public.pago add column if not exists observaciones text;
alter table public.pago add column if not exists comprobante_numero bigint;

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

-- Los pagos que ya estaban pagados reciben su número en orden de fecha.
update public.pago p
set comprobante_numero = nextval('public.pago_comprobante_seq')
from (
  select id from public.pago
  where estado = 'pagado' and comprobante_numero is null
  order by coalesce(fecha_pago, fecha_vencimiento), created_at
) orden
where p.id = orden.id;

create unique index if not exists uq_pago_comprobante
  on public.pago (comprobante_numero) where comprobante_numero is not null;
