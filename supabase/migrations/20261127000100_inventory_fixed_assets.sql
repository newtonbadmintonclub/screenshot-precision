-- Fixed asset register and maintenance history
create table if not exists public.fixed_assets (
  id uuid primary key default gen_random_uuid(),
  asset_code text not null unique,
  name text not null,
  category text not null default 'Peralatan',
  description text not null default '',
  serial_number text,
  purchase_date date not null default current_date,
  purchase_cost bigint not null default 0 check (purchase_cost >= 0),
  salvage_value bigint not null default 0 check (salvage_value >= 0 and salvage_value <= purchase_cost),
  useful_life_months integer not null default 60 check (useful_life_months > 0),
  depreciation_method text not null default 'straight_line' check (depreciation_method = 'straight_line'),
  warranty_expires_at date,
  location text not null default '',
  condition_status text not null default 'baik' check (condition_status in ('baik','perlu_perbaikan','rusak')),
  status text not null default 'active' check (status in ('active','maintenance','disposed')),
  inventory_item_id uuid references public.inventory_items(id) on delete set null,
  supplier_id uuid references public.inventory_suppliers(id) on delete set null,
  notes text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fixed_assets_status_idx on public.fixed_assets(status);
create index if not exists fixed_assets_category_idx on public.fixed_assets(category);
create index if not exists fixed_assets_purchase_date_idx on public.fixed_assets(purchase_date);

create table if not exists public.fixed_asset_maintenance (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.fixed_assets(id) on delete cascade,
  maintenance_date date not null default current_date,
  maintenance_type text not null default 'perawatan' check (maintenance_type in ('perawatan','perbaikan','inspeksi')),
  description text not null,
  cost bigint not null default 0 check (cost >= 0),
  performed_by text not null default '',
  next_maintenance_date date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists fixed_asset_maintenance_asset_date_idx on public.fixed_asset_maintenance(asset_id, maintenance_date desc);

alter table public.fixed_assets enable row level security;
alter table public.fixed_asset_maintenance enable row level security;

create policy "Admins manage fixed assets"
on public.fixed_assets for all to authenticated
using ((select has_role((select auth.uid()), 'admin'::app_role)))
with check ((select has_role((select auth.uid()), 'admin'::app_role)));

create policy "Admins manage fixed asset maintenance"
on public.fixed_asset_maintenance for all to authenticated
using ((select has_role((select auth.uid()), 'admin'::app_role)))
with check ((select has_role((select auth.uid()), 'admin'::app_role)));

grant select, insert, update, delete on public.fixed_assets to authenticated;
grant select, insert, update, delete on public.fixed_asset_maintenance to authenticated;
