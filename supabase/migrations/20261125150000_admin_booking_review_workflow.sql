alter table public.booking_requests add column if not exists previous_booking_status text;

create table if not exists public.booking_admin_actions (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  request_id uuid references public.booking_requests(id) on delete set null,
  actor_id uuid not null,
  action text not null check (action in ('approve_transfer','reject_transfer','approve_cancel','reject_cancel','approve_swap','reject_swap')),
  reason text,
  created_at timestamptz not null default now()
);
alter table public.booking_admin_actions enable row level security;
revoke all on public.booking_admin_actions from anon, authenticated;
grant select on public.booking_admin_actions to authenticated;
drop policy if exists "Admins read booking action history" on public.booking_admin_actions;
create policy "Admins read booking action history" on public.booking_admin_actions for select to authenticated
using (public.has_role(auth.uid(), 'admin'::public.app_role));

-- request_booking_change is replaced by the same user flow, while recording the original booking status.
create or replace function public.request_booking_change(
  _booking_id uuid, _request_type text, _reason text, _replacement_name text, _replacement_whatsapp text
) returns public.booking_requests
language plpgsql security definer set search_path to 'public'
as $function$
declare
  _uid uuid := auth.uid();
  _b public.bookings;
  _row public.booking_requests;
begin
  if _uid is null then raise exception 'Silakan login terlebih dahulu'; end if;
  select * into _b from public.bookings where id=_booking_id and user_id=_uid for update;
  if not found then raise exception 'Tiket tidak ditemukan'; end if;
  if _b.status='awaiting_payment' and _request_type='cancel' then
    update public.bookings set status='cancelled',updated_at=now() where id=_booking_id;
    insert into public.booking_requests(booking_id,user_id,request_type,reason,status,previous_booking_status)
      values(_booking_id,_uid,'cancel',coalesce(nullif(btrim(coalesce(_reason,'')),''),'Batal sebelum bayar'),'approved',_b.status)
      returning * into _row;
    return _row;
  end if;
  if _b.status not in ('confirmed','pending_verification','waiting_list') then
    raise exception 'Tiket ini sudah punya permintaan yang sedang diproses';
  end if;
  if _request_type='cancel' then
    _reason:=btrim(coalesce(_reason,''));
    if length(_reason)<3 or length(_reason)>500 then raise exception 'Tulis alasan cancel (3–500 karakter)'; end if;
    insert into public.booking_requests(booking_id,user_id,request_type,reason,previous_booking_status)
      values(_booking_id,_uid,'cancel',_reason,_b.status) returning * into _row;
    update public.bookings set status='cancel_requested',updated_at=now() where id=_booking_id;
    insert into public.notifications(user_id,kind,title,message)
      values(_uid,'request','Pengajuan Cancel Terkirim','Permintaan cancel & refund tiket '||_b.code||' sedang ditinjau Admin.');
  elsif _request_type='swap' then
    _replacement_name:=btrim(coalesce(_replacement_name,''));
    _replacement_whatsapp:=btrim(coalesce(_replacement_whatsapp,''));
    if length(_replacement_name)<2 or length(_replacement_name)>80 then raise exception 'Nama pengganti tidak valid'; end if;
    if _replacement_whatsapp !~ '^[0-9+ -]{8,20}$' then raise exception 'Nomor WA pengganti tidak valid'; end if;
    if _b.status='waiting_list' then raise exception 'Slot waiting list tidak bisa dioper'; end if;
    insert into public.booking_requests(booking_id,user_id,request_type,reason,replacement_name,replacement_whatsapp,previous_booking_status)
      values(_booking_id,_uid,'swap',nullif(btrim(coalesce(_reason,'')),''),_replacement_name,_replacement_whatsapp,_b.status)
      returning * into _row;
    update public.bookings set status='swap_requested',updated_at=now() where id=_booking_id;
    insert into public.notifications(user_id,kind,title,message)
      values(_uid,'request','Pengajuan Oper Slot Terkirim','Permintaan oper slot '||_b.code||' ke '||_replacement_name||' sedang ditinjau Admin.');
  else
    raise exception 'Jenis permintaan tidak valid';
  end if;
  return _row;
end;
$function$;

create or replace function public.admin_review_booking(
  _booking_id uuid, _action text, _request_id uuid default null, _reason text default null
) returns jsonb
language plpgsql security definer set search_path to 'public'
as $function$
declare
  _actor uuid:=auth.uid();
  _b public.bookings;
  _r public.booking_requests;
  _restore_status text;
  _message text;
begin
  if _actor is null or not public.has_role(_actor,'admin'::public.app_role) then raise exception 'Akses Admin diperlukan'; end if;
  select * into _b from public.bookings where id=_booking_id for update;
  if not found then raise exception 'Booking tidak ditemukan'; end if;

  if _action in ('approve_transfer','reject_transfer') then
    if _b.status<>'pending_verification' or _b.payment_method<>'transfer' then
      raise exception 'Booking bukan transfer yang menunggu verifikasi';
    end if;
    if _action='approve_transfer' then
      update public.bookings set status='confirmed',paid_at=now(),updated_at=now() where id=_booking_id returning * into _b;
      _message:='Pembayaran transfer telah diverifikasi. E-Ticket '||_b.code||' aktif.';
    else
      update public.bookings set status='cancelled',updated_at=now() where id=_booking_id returning * into _b;
      _message:='Pembayaran transfer untuk booking '||_b.code||' belum dapat diverifikasi. Hubungi Admin jika perlu bantuan.';
    end if;
    insert into public.notifications(user_id,kind,title,message)
      values(_b.user_id,'payment',case when _action='approve_transfer' then 'Pembayaran Terkonfirmasi 🎉' else 'Pembayaran Belum Terverifikasi' end,_message);
  elsif _action in ('approve_cancel','reject_cancel','approve_swap','reject_swap') then
    if _request_id is null then raise exception 'ID pengajuan wajib diisi'; end if;
    select * into _r from public.booking_requests where id=_request_id and booking_id=_booking_id and status='pending' for update;
    if not found then raise exception 'Pengajuan tidak ditemukan atau sudah diproses'; end if;
    if (_action in ('approve_cancel','reject_cancel') and _r.request_type<>'cancel')
      or (_action in ('approve_swap','reject_swap') and _r.request_type<>'swap') then raise exception 'Jenis tindakan tidak sesuai pengajuan'; end if;
    _restore_status:=coalesce(_r.previous_booking_status,'confirmed');
    if _restore_status not in ('confirmed','pending_verification','waiting_list') then raise exception 'Status booking asal tidak valid'; end if;
    if _action='approve_cancel' then
      update public.bookings set status='cancelled',updated_at=now() where id=_booking_id returning * into _b;
      update public.booking_requests set status='approved' where id=_request_id;
      _message:='Pengajuan pembatalan booking '||_b.code||' disetujui Admin.';
    elsif _action='reject_cancel' then
      update public.bookings set status=_restore_status,updated_at=now() where id=_booking_id returning * into _b;
      update public.booking_requests set status='rejected' where id=_request_id;
      _message:='Pengajuan pembatalan booking '||_b.code||' belum disetujui. Tiket kembali ke status sebelumnya.';
    elsif _action='approve_swap' then
      if _r.replacement_name is null or _r.replacement_whatsapp is null then raise exception 'Data pemain pengganti tidak lengkap'; end if;
      update public.bookings set player_name=_r.replacement_name,whatsapp=_r.replacement_whatsapp,status=_restore_status,updated_at=now()
        where id=_booking_id returning * into _b;
      update public.booking_requests set status='approved' where id=_request_id;
      _message:='Pengajuan oper slot booking '||_b.code||' disetujui Admin. Data peserta telah diperbarui.';
    else
      update public.bookings set status=_restore_status,updated_at=now() where id=_booking_id returning * into _b;
      update public.booking_requests set status='rejected' where id=_request_id;
      _message:='Pengajuan oper slot booking '||_b.code||' ditolak. Tiket kembali ke status sebelumnya.';
    end if;
    insert into public.notifications(user_id,kind,title,message) values(_b.user_id,'request','Pembaruan Pengajuan Booking',_message);
  else
    raise exception 'Tindakan Admin tidak dikenal';
  end if;

  insert into public.booking_admin_actions(booking_id,request_id,actor_id,action,reason)
    values(_booking_id,_request_id,_actor,_action,nullif(btrim(coalesce(_reason,'')),''));
  return jsonb_build_object('booking_id',_b.id,'booking_code',_b.code,'booking_status',_b.status,'action',_action);
end;
$function$;

revoke all on function public.admin_review_booking(uuid,text,uuid,text) from public,anon;
grant execute on function public.admin_review_booking(uuid,text,uuid,text) to authenticated;
