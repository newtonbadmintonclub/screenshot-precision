-- AI Agent Setup Center tables. Secrets are intentionally not stored in public tables.
create table if not exists public.ai_agent_profiles (id uuid primary key default gen_random_uuid(), agent_key text not null unique, name text not null default 'Newton Assistant', model text not null default 'gemini-2.5-flash', system_prompt text not null default 'Kamu adalah asisten resmi Newton Badminton Club Malang. Jawab dalam Bahasa Indonesia dengan ramah, akurat, dan ringkas. Jangan mengarang jadwal, harga, ketersediaan, status pembayaran, atau data member. Jika data tidak tersedia, arahkan ke Admin.', welcome_message text not null default 'Halo! Selamat datang di Newton Badminton Club. Ada yang bisa saya bantu?', is_active boolean not null default false, temperature numeric(3,2) not null default 0.2 check (temperature between 0 and 1), max_output_tokens integer not null default 700 check (max_output_tokens between 100 and 4096), updated_at timestamptz not null default now(), updated_by uuid references auth.users(id) on delete set null);
insert into public.ai_agent_profiles (agent_key) values ('newton-main') on conflict (agent_key) do nothing;
create table if not exists public.ai_integration_status (id uuid primary key default gen_random_uuid(), provider text not null unique check (provider in ('gemini','waha','meta_instagram')), display_name text not null, configured boolean not null default false, endpoint_url text, external_account_id text, last_checked_at timestamptz, last_error text, updated_at timestamptz not null default now());
insert into public.ai_integration_status(provider,display_name) values ('gemini','Google Gemini'),('waha','WAHA WhatsApp Gateway'),('meta_instagram','Meta Instagram Messaging') on conflict(provider) do nothing;
alter table public.ai_agent_profiles enable row level security;
alter table public.ai_integration_status enable row level security;
drop policy if exists "Admin reads AI agent profiles" on public.ai_agent_profiles;
create policy "Admin reads AI agent profiles" on public.ai_agent_profiles for select to authenticated using (has_role((select auth.uid()), 'admin'::app_role));
drop policy if exists "Admin updates AI agent profiles" on public.ai_agent_profiles;
create policy "Admin updates AI agent profiles" on public.ai_agent_profiles for update to authenticated using (has_role((select auth.uid()), 'admin'::app_role)) with check (has_role((select auth.uid()), 'admin'::app_role));
drop policy if exists "Admin reads AI integration status" on public.ai_integration_status;
create policy "Admin reads AI integration status" on public.ai_integration_status for select to authenticated using (has_role((select auth.uid()), 'admin'::app_role));
drop policy if exists "Admin updates AI integration status" on public.ai_integration_status;
create policy "Admin updates AI integration status" on public.ai_integration_status for update to authenticated using (has_role((select auth.uid()), 'admin'::app_role)) with check (has_role((select auth.uid()), 'admin'::app_role));
grant select, update on public.ai_agent_profiles to authenticated;
grant select, update on public.ai_integration_status to authenticated;
grant all on public.ai_agent_profiles to service_role;
grant all on public.ai_integration_status to service_role;
