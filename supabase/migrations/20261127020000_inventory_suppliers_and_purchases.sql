create table if not exists public.inventory_suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_person text not null default '',
  phone text not null default '',
  email text not null default '',
  address text not null default '',
  notes text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists inventory_suppliers_active_name_idx on public.inventory_suppliers(is_active,name);
create table if not exists public.inventory_purchases (
  id uuid primary key default gen_random_uuid(),
  purchase_code text not null unique,
  supplier_id uuid references public.inventory_suppliers(id) on delete set null,
  purchased_at date not null default current_date,
  total_amount bigint not null default 0 check(total_amount >= 0),
  notes text not null default '',
  actor_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists inventory_purchases_created_idx on public.inventory_purchases(created_at desc);
create index if not exists inventory_purchases_supplier_idx on public.inventory_purchases(supplier_id);
create table if not exists public.inventory_purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.inventory_purchases(id) on delete restrict,
  item_id uuid not null references public.inventory_items(id) on delete restrict,
  quantity integer not null check(quantity > 0),
  unit_cost bigint not null default 0 check(unit_cost >= 0),
  line_total bigint generated always as (quantity::bigint * unit_cost) stored
);
create index if not exists inventory_purchase_items_purchase_idx on public.inventory_purchase_items(purchase_id);
alter table public.inventory_suppliers enable row level security;
alter table public.inventory_purchases enable row level security;
alter table public.inventory_purchase_items enable row level security;
create policy "Admins manage inventory suppliers" on public.inventory_suppliers for all to authenticated using (public.has_role((select auth.uid()), 'admin'::public.app_role)) with check (public.has_role((select auth.uid()), 'admin'::public.app_role));
create policy "Admins read inventory purchases" on public.inventory_purchases for select to authenticated using (public.has_role((select auth.uid()), 'admin'::public.app_role));
create policy "Admins insert inventory purchases" on public.inventory_purchases for insert to authenticated with check (actor_id = (select auth.uid()) and public.has_role((select auth.uid()), 'admin'::public.app_role));
create policy "Admins read inventory purchase items" on public.inventory_purchase_items for select to authenticated using (public.has_role((select auth.uid()), 'admin'::public.app_role));
create policy "Admins insert inventory purchase items" on public.inventory_purchase_items for insert to authenticated with check (public.has_role((select auth.uid()), 'admin'::public.app_role));
grant select, insert, update, delete on public.inventory_suppliers to authenticated;
grant select, insert on public.inventory_purchases to authenticated;
grant select, insert on public.inventory_purchase_items to authenticated;
create or replace function public.inventory_receive_purchase(p_supplier_id uuid,p_items jsonb,p_purchased_at date default current_date,p_notes text default '')
returns public.inventory_purchases language plpgsql security invoker set search_path = '' as $function$
declare
 v_purchase public.inventory_purchases; v_line jsonb; v_item_id uuid; v_qty integer; v_cost bigint; v_previous integer; v_new integer; v_total bigint:=0; v_code text;
begin
 if auth.uid() is null or not public.has_role(auth.uid(),'admin'::public.app_role) then raise exception 'Akses Admin diperlukan' using errcode='42501'; end if;
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'Minimal satu barang pembelian wajib diisi'; end if;
 if p_supplier_id is not null and not exists(select 1 from public.inventory_suppliers where id=p_supplier_id and is_active=true) then raise exception 'Supplier tidak ditemukan atau nonaktif'; end if;
 for v_line in select value from jsonb_array_elements(p_items) loop
  v_item_id:=(v_line->>'item_id')::uuid; v_qty:=(v_line->>'quantity')::integer; v_cost:=coalesce((v_line->>'unit_cost')::bigint,0);
  if v_qty<=0 or v_cost<0 then raise exception 'Jumlah atau harga pembelian tidak valid'; end if;
  if not exists(select 1 from public.inventory_items where id=v_item_id and is_active=true) then raise exception 'Barang tidak ditemukan atau nonaktif'; end if;
  v_total:=v_total+(v_qty::bigint*v_cost);
 end loop;
 v_code:='PO-'||to_char(clock_timestamp(),'YYMMDD-HH24MISS')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,4));
 insert into public.inventory_purchases(purchase_code,supplier_id,purchased_at,total_amount,notes,actor_id) values(v_code,p_supplier_id,coalesce(p_purchased_at,current_date),v_total,coalesce(trim(p_notes),''),auth.uid()) returning * into v_purchase;
 for v_line in select value from jsonb_array_elements(p_items) loop
  v_item_id:=(v_line->>'item_id')::uuid; v_qty:=(v_line->>'quantity')::integer; v_cost:=coalesce((v_line->>'unit_cost')::bigint,0);
  update public.inventory_items set quantity=quantity+v_qty,unit_cost=v_cost,updated_at=now() where id=v_item_id and is_active=true returning quantity-v_qty,quantity into v_previous,v_new;
  if not found then raise exception 'Gagal menambah stok barang'; end if;
  insert into public.inventory_purchase_items(purchase_id,item_id,quantity,unit_cost) values(v_purchase.id,v_item_id,v_qty,v_cost);
  insert into public.inventory_movements(item_id,movement_type,quantity_change,previous_quantity,new_quantity,reason,reference,actor_id) values(v_item_id,'stock_in',v_qty,v_previous,v_new,'Pembelian inventaris',v_code,auth.uid());
 end loop;
 return v_purchase;
end;
$function$;
revoke all on function public.inventory_receive_purchase(uuid,jsonb,date,text) from public,anon;
grant execute on function public.inventory_receive_purchase(uuid,jsonb,date,text) to authenticated;
