drop policy if exists "Admins delete events without bookings" on public.events;

create policy "Admins delete events without bookings"
on public.events
for delete
to authenticated
using (
  has_role((select auth.uid()), 'admin'::app_role)
  and not exists (
    select 1
    from public.bookings
    where bookings.event_id = events.id
  )
);
