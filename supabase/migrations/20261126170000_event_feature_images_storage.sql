alter table public.events
  add column if not exists image_url text,
  add column if not exists image_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-posters', 'event-posters', true, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can view event posters" on storage.objects;
create policy "Public can view event posters"
on storage.objects for select to anon, authenticated
using (bucket_id = 'event-posters');

drop policy if exists "Admins upload event posters" on storage.objects;
create policy "Admins upload event posters"
on storage.objects for insert to authenticated
with check (bucket_id = 'event-posters' and public.has_role((select auth.uid()), 'admin'::public.app_role));

drop policy if exists "Admins update event posters" on storage.objects;
create policy "Admins update event posters"
on storage.objects for update to authenticated
using (bucket_id = 'event-posters' and public.has_role((select auth.uid()), 'admin'::public.app_role))
with check (bucket_id = 'event-posters' and public.has_role((select auth.uid()), 'admin'::public.app_role));

drop policy if exists "Admins delete event posters" on storage.objects;
create policy "Admins delete event posters"
on storage.objects for delete to authenticated
using (bucket_id = 'event-posters' and public.has_role((select auth.uid()), 'admin'::public.app_role));
