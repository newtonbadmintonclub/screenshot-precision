alter table public.orders
  add column if not exists paid_at timestamptz,
  add column if not exists paid_method text,
  add column if not exists payment_reference text not null default '',
  add column if not exists paid_by uuid references auth.users(id) on delete set null;

alter table public.orders drop constraint if exists orders_paid_method_check;
alter table public.orders add constraint orders_paid_method_check
  check (paid_method is null or paid_method in ('cash','transfer','qris','other'));
create index if not exists orders_paid_at_idx on public.orders(paid_at desc) where paid_at is not null;

create or replace function public.admin_record_order_payment(_order_id uuid, _paid_method text, _payment_reference text default '')
returns public.orders language plpgsql security definer set search_path to 'public'
as $function$
declare
  _uid uuid := auth.uid();
  _row public.orders;
begin
  if _uid is null or not public.has_role(_uid, 'admin'::public.app_role) then raise exception 'Akses Admin diperlukan'; end if;
  if _paid_method not in ('cash','transfer','qris','other') then raise exception 'Metode pembayaran tidak valid'; end if;
  select * into _row from public.orders where id = _order_id for update;
  if not found then raise exception 'Pesanan tidak ditemukan'; end if;
  if _row.status = 'dibatalkan' then raise exception 'Pesanan dibatalkan tidak dapat dicatat pembayarannya'; end if;
  if _row.paid_at is not null then raise exception 'Pembayaran pesanan ini sudah tercatat'; end if;
  update public.orders set paid_at = now(), paid_method = _paid_method, payment_reference = left(coalesce(_payment_reference, ''), 160), paid_by = _uid where id = _order_id returning * into _row;
  return _row;
end;
$function$;
revoke all on function public.admin_record_order_payment(uuid,text,text) from public, anon;
grant execute on function public.admin_record_order_payment(uuid,text,text) to authenticated;
