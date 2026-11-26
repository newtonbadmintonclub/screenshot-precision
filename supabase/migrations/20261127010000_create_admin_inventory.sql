create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  sku text unique,
  name text not null,
  category text not null default 'Perlengkapan',
  description text not null default '',
  unit text not null default 'pcs',
  quantity integer not null default 0 check (quantity >= 0),
  minimum_quantity integer not null default 0 check (minimum_quantity >= 0),
  location text not null default '',
  condition_status text not null default 'baik' check (condition_status in ('baik','perlu_perbaikan','rusak')),
  unit_cost integer check (unit_cost is null or unit_cost >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items(id) on delete restrict,
  movement_type text not null check (movement_type in ('stock_in','stock_out','adjustment')),
  quantity_change integer not null check (quantity_change <> 0),
  previous_quantity integer not null check (previous_quantity >= 0),
  new_quantity integer not null check (new_quantity >= 0),
  reason text not null,
  reference text,
  actor_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists inventory_items_active_name_idx on public.inventory_items (is_active, name);
create index if not exists inventory_movements_item_created_idx on public.inventory_movements (item_id, created_at desc);
create index if not exists inventory_movements_created_idx on public.inventory_movements (created_at desc);

alter table public.inventory_items enable row level security;
alter table public.inventory_movements enable row level security;

create policy "Admins manage inventory items" on public.inventory_items
for all to authenticated
using (public.has_role((select auth.uid()), 'admin'::public.app_role))
with check (public.has_role((select auth.uid()), 'admin'::public.app_role));

create policy "Admins read inventory movements" on public.inventory_movements
for select to authenticated
using (public.has_role((select auth.uid()), 'admin'::public.app_role));

create policy "Admins insert inventory movements" on public.inventory_movements
for insert to authenticated
with check (
  actor_id = (select auth.uid())
  and public.has_role((select auth.uid()), 'admin'::public.app_role)
);

grant select, insert, update, delete on public.inventory_items to authenticated;
grant select, insert on public.inventory_movements to authenticated;

create or replace function public.inventory_adjust_stock(
  p_item_id uuid,
  p_movement_type text,
  p_quantity_change integer,
  p_reason text,
  p_reference text default null
)
returns public.inventory_movements
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_previous integer;
  v_new integer;
  v_movement public.inventory_movements;
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'Akses Admin diperlukan' using errcode = '42501';
  end if;
  if p_movement_type not in ('stock_in','stock_out','adjustment') then
    raise exception 'Jenis pergerakan stok tidak valid';
  end if;
  if p_quantity_change = 0 then
    raise exception 'Perubahan stok tidak boleh nol';
  end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'Alasan perubahan stok wajib diisi';
  end if;
  if p_movement_type = 'stock_in' and p_quantity_change < 0 then
    raise exception 'Stok masuk harus bernilai positif';
  end if;
  if p_movement_type = 'stock_out' and p_quantity_change > 0 then
    raise exception 'Stok keluar harus bernilai negatif';
  end if;

  update public.inventory_items
     set quantity = quantity + p_quantity_change,
         updated_at = now()
   where id = p_item_id
     and is_active = true
     and quantity + p_quantity_change >= 0
   returning quantity - p_quantity_change, quantity
        into v_previous, v_new;

  if not found then
    raise exception 'Barang tidak ditemukan, nonaktif, atau stok tidak mencukupi';
  end if;

  insert into public.inventory_movements (
    item_id, movement_type, quantity_change, previous_quantity,
    new_quantity, reason, reference, actor_id
  ) values (
    p_item_id, p_movement_type, p_quantity_change, v_previous,
    v_new, trim(p_reason), nullif(trim(coalesce(p_reference, '')), ''), auth.uid()
  )
  returning * into v_movement;

  return v_movement;
end;
$function$;

revoke all on function public.inventory_adjust_stock(uuid,text,integer,text,text) from public, anon;
grant execute on function public.inventory_adjust_stock(uuid,text,integer,text,text) to authenticated;
