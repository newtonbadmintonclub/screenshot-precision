-- Allow authenticated Admin users to create and edit public mabar events.
-- Public read access remains governed by the existing "Anyone reads events" policy.
create policy "Admins create events"
on public.events
for insert
to authenticated
with check (has_role((select auth.uid()), 'admin'::app_role));

create policy "Admins update events"
on public.events
for update
to authenticated
using (has_role((select auth.uid()), 'admin'::app_role))
with check (has_role((select auth.uid()), 'admin'::app_role));
