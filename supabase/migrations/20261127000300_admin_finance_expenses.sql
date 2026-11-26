create table if not exists public.finance_expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null default current_date,
  category text not null,
  description text not null,
  amount bigint not null check (amount > 0),
  vendor text not null default '',
  payment_method text not null default 'transfer' check (payment_method in ('cash','transfer','qris','other')),
  reference text not null default '',
  notes text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists finance_expenses_date_idx on public.finance_expenses(expense_date desc);
alter table public.finance_expenses enable row level security;
drop policy if exists "Admins can manage finance expenses" on public.finance_expenses;
create policy "Admins can manage finance expenses"
on public.finance_expenses for all to authenticated
using (has_role((select auth.uid()), 'admin'::app_role))
with check (has_role((select auth.uid()), 'admin'::app_role));
grant select, insert, update, delete on public.finance_expenses to authenticated;