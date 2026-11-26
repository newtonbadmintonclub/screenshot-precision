alter table public.fixed_assets
  add column if not exists disposal_date date,
  add column if not exists disposal_method text,
  add column if not exists disposal_value bigint not null default 0,
  add column if not exists disposal_reason text not null default '',
  add column if not exists disposed_by uuid references auth.users(id) on delete set null;

alter table public.fixed_assets
  add constraint fixed_assets_disposal_method_check
  check (disposal_method is null or disposal_method in ('sale','donation','write_off','other'));

alter table public.fixed_assets
  add constraint fixed_assets_disposal_value_check
  check (disposal_value >= 0);

create index if not exists fixed_assets_disposal_date_idx
  on public.fixed_assets(disposal_date)
  where status = 'disposed';