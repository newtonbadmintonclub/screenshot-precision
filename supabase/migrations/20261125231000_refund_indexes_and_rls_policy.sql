create index if not exists refund_requests_request_id_idx on public.refund_requests(request_id);
create index if not exists refund_requests_reviewed_by_idx on public.refund_requests(reviewed_by);
create index if not exists refund_requests_processed_by_idx on public.refund_requests(processed_by);
create index if not exists refund_requests_completed_by_idx on public.refund_requests(completed_by);
create index if not exists refund_admin_actions_actor_id_idx on public.refund_admin_actions(actor_id);
drop policy if exists "Admins read refund requests" on public.refund_requests;
drop policy if exists "Users read own refund requests" on public.refund_requests;
create policy "Users and admins read refund requests" on public.refund_requests for select to authenticated
using ((select auth.uid()) = user_id or public.has_role((select auth.uid()), 'admin'::public.app_role));
