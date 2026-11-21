create table if not exists public.ai_sync_settings (
 id uuid primary key default gen_random_uuid(),
 jalur_1_active boolean not null default true,
 jalur_2_active boolean not null default true,
 jalur_3_active boolean not null default true,
 anti_loop_active boolean not null default true,
 send_delay_seconds integer not null default 4 check (send_delay_seconds between 0 and 120),
 bot_wa_number text not null default '',
 trigger_keyword text not null default 'Pendaftaran Mabar Berhasil',
 waha_api_url text not null default '',
 wa_group_id text not null default '',
 instagram_page_id text not null default '',
 updated_at timestamptz not null default now()
);
insert into public.ai_sync_settings (id) values ('00000000-0000-4000-8000-000000000001') on conflict (id) do nothing;
create table if not exists public.ai_sync_logs (
 id uuid primary key default gen_random_uuid(),
 channel_flow text not null,
 description text not null,
 payload_json jsonb not null default '{}'::jsonb,
 status text not null check (status in ('Sukses','Aman','Gagal')),
 created_at timestamptz not null default now()
);
alter table public.ai_sync_settings enable row level security;
alter table public.ai_sync_logs enable row level security;
create policy "Admin membaca pengaturan sinkronisasi" on public.ai_sync_settings for select to authenticated using (has_role((select auth.uid()), 'admin'::app_role));
create policy "Admin mengubah pengaturan sinkronisasi" on public.ai_sync_settings for update to authenticated using (has_role((select auth.uid()), 'admin'::app_role)) with check (has_role((select auth.uid()), 'admin'::app_role));
create policy "Admin membaca log sinkronisasi" on public.ai_sync_logs for select to authenticated using (has_role((select auth.uid()), 'admin'::app_role));
grant select, update on public.ai_sync_settings to authenticated;
grant select on public.ai_sync_logs to authenticated;
grant all on public.ai_sync_settings to service_role;
grant all on public.ai_sync_logs to service_role;
do $$ begin if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='ai_sync_logs') then alter publication supabase_realtime add table public.ai_sync_logs; end if; end $$;
