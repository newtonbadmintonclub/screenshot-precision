create table if not exists public.refund_requests (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete restrict,
  request_id uuid references public.booking_requests(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete restrict,
  amount integer not null check (amount >= 0),
  payment_method text not null check (payment_method in ('qris','transfer')),
  status text not null default 'pending_review' check (status in ('pending_review','approved','processing','completed','rejected')),
  reason text, admin_note text, external_reference text,
  reviewed_by uuid references auth.users(id),
  processed_by uuid references auth.users(id),
  completed_by uuid references auth.users(id),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz, processed_at timestamptz, completed_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists refund_requests_status_requested_idx on public.refund_requests(status, requested_at desc);
create index if not exists refund_requests_user_requested_idx on public.refund_requests(user_id, requested_at desc);
alter table public.refund_requests enable row level security;
revoke all on public.refund_requests from anon, authenticated;
grant select on public.refund_requests to authenticated;
create policy "Admins read refund requests" on public.refund_requests for select to authenticated using (public.has_role((select auth.uid()), 'admin'::public.app_role));
create policy "Users read own refund requests" on public.refund_requests for select to authenticated using ((select auth.uid()) = user_id);

create table if not exists public.refund_admin_actions (
  id uuid primary key default gen_random_uuid(),
  refund_id uuid not null references public.refund_requests(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete restrict,
  action text not null, reason text, external_reference text,
  created_at timestamptz not null default now()
);
create index if not exists refund_admin_actions_refund_created_idx on public.refund_admin_actions(refund_id, created_at desc);
alter table public.refund_admin_actions enable row level security;
revoke all on public.refund_admin_actions from anon, authenticated;
grant select on public.refund_admin_actions to authenticated;
create policy "Admins read refund action history" on public.refund_admin_actions for select to authenticated using (public.has_role((select auth.uid()), 'admin'::public.app_role));

create or replace function public.admin_review_booking(_booking_id uuid,_action text,_request_id uuid default null,_reason text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $function$
declare
  _actor uuid := auth.uid(); _b public.bookings; _r public.booking_requests;
  _restore_status text; _message text; _refund_id uuid;
begin
  if _actor is null or not public.has_role(_actor,'admin'::public.app_role) then raise exception 'Akses Admin diperlukan'; end if;
  select * into _b from public.bookings where id=_booking_id for update;
  if not found then raise exception 'Booking tidak ditemukan'; end if;
  if _action in ('approve_transfer','reject_transfer') then
    if _b.status <> 'pending_verification' or _b.payment_method <> 'transfer' then raise exception 'Booking bukan transfer yang menunggu verifikasi'; end if;
    if _action='approve_transfer' then
      if _b.payment_proof_path is null or _b.payment_proof_uploaded_at is null then raise exception 'Pemain belum mengunggah bukti transfer'; end if;
      if not exists (select 1 from storage.objects o where o.bucket_id='booking-payment-proofs' and o.name=_b.payment_proof_path) then raise exception 'File bukti transfer tidak ditemukan di Storage'; end if;
      update public.bookings set status='confirmed',paid_at=now(),updated_at=now() where id=_booking_id returning * into _b;
      _message := 'Pembayaran transfer telah diverifikasi. E-Ticket ' || _b.code || ' aktif.';
    else
      update public.bookings set status='cancelled',updated_at=now() where id=_booking_id returning * into _b;
      _message := 'Pembayaran transfer untuk booking ' || _b.code || ' belum dapat diverifikasi. Hubungi Admin jika perlu bantuan.';
    end if;
    insert into public.notifications(user_id,kind,title,message) values (_b.user_id,'payment',case when _action='approve_transfer' then 'Pembayaran Terkonfirmasi 🎉' else 'Pembayaran Belum Terverifikasi' end,_message);
  elsif _action in ('approve_cancel','reject_cancel','approve_swap','reject_swap') then
    if _request_id is null then raise exception 'ID pengajuan wajib diisi'; end if;
    select * into _r from public.booking_requests where id=_request_id and booking_id=_booking_id and status='pending' for update;
    if not found then raise exception 'Pengajuan tidak ditemukan atau sudah diproses'; end if;
    if (_action in ('approve_cancel','reject_cancel') and _r.request_type<>'cancel') or (_action in ('approve_swap','reject_swap') and _r.request_type<>'swap') then raise exception 'Jenis tindakan tidak sesuai pengajuan'; end if;
    _restore_status := coalesce(_r.previous_booking_status,'confirmed');
    if _restore_status not in ('confirmed','pending_verification','waiting_list') then raise exception 'Status booking asal tidak valid'; end if;
    if _action='approve_cancel' then
      update public.bookings set status='cancelled',updated_at=now() where id=_booking_id returning * into _b;
      update public.booking_requests set status='approved' where id=_request_id;
      _message := 'Pengajuan pembatalan booking ' || _b.code || ' disetujui Admin.';
      if _b.paid_at is not null and _b.amount > 0 and _b.payment_method in ('qris','transfer') then
        insert into public.refund_requests(booking_id,request_id,user_id,amount,payment_method,reason,status)
        values (_b.id,_request_id,_b.user_id,_b.amount,_b.payment_method,_r.reason,'pending_review')
        on conflict (booking_id) do nothing returning id into _refund_id;
        if _refund_id is not null then
          insert into public.notifications(user_id,kind,title,message) values (_b.user_id,'payment','Pengajuan Refund Dicatat',
            'Pembatalan booking ' || _b.code || ' disetujui. Refund sebesar Rp' || to_char(_b.amount,'FM999G999G999G990') ||
            ' masuk antrean pemeriksaan Admin. Persetujuan pembatalan bukan bukti bahwa dana sudah dikembalikan.');
        end if;
      end if;
    elsif _action='reject_cancel' then
      update public.bookings set status=_restore_status,updated_at=now() where id=_booking_id returning * into _b;
      update public.booking_requests set status='rejected' where id=_request_id;
      _message := 'Pengajuan pembatalan booking ' || _b.code || ' belum disetujui. Tiket kembali ke status sebelumnya.';
    elsif _action='approve_swap' then
      if _r.replacement_name is null or _r.replacement_whatsapp is null then raise exception 'Data pemain pengganti tidak lengkap'; end if;
      update public.bookings set player_name=_r.replacement_name,whatsapp=_r.replacement_whatsapp,status=_restore_status,updated_at=now() where id=_booking_id returning * into _b;
      update public.booking_requests set status='approved' where id=_request_id;
      _message := 'Pengajuan oper slot booking ' || _b.code || ' disetujui Admin. Data peserta telah diperbarui.';
    else
      update public.bookings set status=_restore_status,updated_at=now() where id=_booking_id returning * into _b;
      update public.booking_requests set status='rejected' where id=_request_id;
      _message := 'Pengajuan oper slot booking ' || _b.code || ' ditolak. Tiket kembali ke status sebelumnya.';
    end if;
    insert into public.notifications(user_id,kind,title,message) values (_b.user_id,'request','Pembaruan Pengajuan Booking',_message);
  else raise exception 'Tindakan Admin tidak dikenal';
  end if;
  insert into public.booking_admin_actions(booking_id,request_id,actor_id,action,reason) values (_booking_id,_request_id,_actor,_action,nullif(btrim(coalesce(_reason,'')),''));
  return jsonb_build_object('booking_id',_b.id,'booking_code',_b.code,'booking_status',_b.status,'action',_action,'refund_created',_refund_id is not null,'refund_id',_refund_id);
end;
$function$;

create or replace function public.admin_update_refund_status(_refund_id uuid,_status text,_reason text default null,_external_reference text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $function$
declare
  _actor uuid := auth.uid(); _refund public.refund_requests; _old_status text;
  _clean_reason text := nullif(btrim(coalesce(_reason,'')),'');
  _clean_reference text := nullif(btrim(coalesce(_external_reference,'')),'');
  _notification text;
begin
  if _actor is null or not public.has_role(_actor,'admin'::public.app_role) then raise exception 'Akses Admin diperlukan'; end if;
  if _status not in ('approved','processing','completed','rejected') then raise exception 'Status refund tidak valid'; end if;
  select * into _refund from public.refund_requests where id=_refund_id for update;
  if not found then raise exception 'Data refund tidak ditemukan'; end if;
  _old_status := _refund.status;
  if not ((_old_status='pending_review' and _status in ('approved','rejected')) or (_old_status='approved' and _status in ('processing','rejected')) or (_old_status='processing' and _status='completed')) then
    raise exception 'Perubahan status refund tidak diizinkan: % ke %',_old_status,_status;
  end if;
  if _status='rejected' and _clean_reason is null then raise exception 'Alasan penolakan wajib diisi'; end if;
  if _status='completed' and _clean_reason is null then raise exception 'Catatan bukti pengembalian dana wajib diisi'; end if;
  update public.refund_requests set status=_status,admin_note=coalesce(_clean_reason,admin_note),
    external_reference=coalesce(_clean_reference,external_reference),
    reviewed_by=case when _old_status='pending_review' then _actor else reviewed_by end,
    reviewed_at=case when _old_status='pending_review' then now() else reviewed_at end,
    processed_by=case when _status='processing' then _actor else processed_by end,
    processed_at=case when _status='processing' then now() else processed_at end,
    completed_by=case when _status='completed' then _actor else completed_by end,
    completed_at=case when _status='completed' then now() else completed_at end,updated_at=now()
    where id=_refund_id returning * into _refund;
  insert into public.refund_admin_actions(refund_id,actor_id,action,reason,external_reference)
    values (_refund_id,_actor,_status,_clean_reason,_clean_reference);
  _notification := case
    when _status='approved' then 'Refund booking ' || (select code from public.bookings where id=_refund.booking_id) || ' disetujui dan menunggu proses pengembalian dana.'
    when _status='processing' then 'Refund sedang diproses oleh Admin.'
    when _status='completed' then 'Admin telah mencatat refund selesai. Catatan: ' || coalesce(_clean_reason,'pengembalian dana dikonfirmasi') || '.'
    else 'Pengajuan refund belum dapat disetujui. Catatan Admin: ' || coalesce(_clean_reason,'silakan hubungi Admin') || '.'
  end;
  insert into public.notifications(user_id,kind,title,message) values (_refund.user_id,'payment',
    case when _status='completed' then 'Refund Selesai' when _status='rejected' then 'Refund Tidak Disetujui' else 'Pembaruan Status Refund' end,_notification);
  return jsonb_build_object('refund_id',_refund.id,'previous_status',_old_status,'status',_refund.status);
end;
$function$;
revoke all on function public.admin_update_refund_status(uuid,text,text,text) from public, anon;
grant execute on function public.admin_update_refund_status(uuid,text,text,text) to authenticated;
revoke all on function public.admin_review_booking(uuid,text,uuid,text) from public, anon;
grant execute on function public.admin_review_booking(uuid,text,uuid,text) to authenticated;
