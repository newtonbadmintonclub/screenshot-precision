insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('booking-payment-proofs', 'booking-payment-proofs', false, 5242880, array['image/jpeg','image/png','application/pdf'])
on conflict (id) do update set public=false, file_size_limit=5242880, allowed_mime_types=excluded.allowed_mime_types;

alter table public.bookings
  add column if not exists payment_proof_path text,
  add column if not exists payment_proof_uploaded_at timestamptz;

drop policy if exists "Players upload own booking payment proofs" on storage.objects;
create policy "Players upload own booking payment proofs"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'booking-payment-proofs'
  and (storage.foldername(name))[1] = auth.uid()::text
  and (storage.foldername(name))[2] is not null
  and exists (
    select 1 from public.bookings b
    where b.id = (storage.foldername(name))[2]::uuid
      and b.user_id = auth.uid()
      and b.payment_method = 'transfer'
      and b.status = 'pending_verification'
  )
);

drop policy if exists "Players and admins read booking payment proofs" on storage.objects;
create policy "Players and admins read booking payment proofs"
on storage.objects for select to authenticated
using (
  bucket_id = 'booking-payment-proofs'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.has_role(auth.uid(), 'admin'::public.app_role)
  )
);

create or replace function public.submit_booking_transfer_proof(_booking_id uuid, _proof_path text)
returns jsonb
language plpgsql
security definer
set search_path = public, storage
as $function$
declare
  _uid uuid := auth.uid();
  _b public.bookings;
begin
  if _uid is null then raise exception 'Silakan login terlebih dahulu'; end if;
  select * into _b from public.bookings
    where id = _booking_id and user_id = _uid
    for update;
  if not found then raise exception 'Booking tidak ditemukan'; end if;
  if _b.payment_method <> 'transfer' or _b.status <> 'pending_verification' then
    raise exception 'Booking ini tidak sedang menunggu bukti transfer';
  end if;
  if _proof_path !~ ('^' || _uid::text || '/' || _booking_id::text || '/[A-Za-z0-9._-]+$') then
    raise exception 'Lokasi file bukti pembayaran tidak valid';
  end if;
  if not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'booking-payment-proofs' and o.name = _proof_path
      and o.owner_id = _uid::text
  ) then
    raise exception 'File bukti pembayaran tidak ditemukan atau bukan milik akun ini';
  end if;
  update public.bookings
    set payment_proof_path = _proof_path,
        payment_proof_uploaded_at = now(),
        updated_at = now()
    where id = _booking_id;
  return jsonb_build_object('booking_id', _booking_id, 'uploaded_at', now());
end;
$function$;

revoke all on function public.submit_booking_transfer_proof(uuid,text) from public, anon;
grant execute on function public.submit_booking_transfer_proof(uuid,text) to authenticated;

create or replace function public.admin_review_booking(
  _booking_id uuid, _action text, _request_id uuid default null, _reason text default null
) returns jsonb
language plpgsql security definer set search_path to 'public'
as $function$
declare
  _actor uuid := auth.uid();
  _b public.bookings;
  _r public.booking_requests;
  _restore_status text;
  _message text;
begin
  if _actor is null or not public.has_role(_actor,'admin'::public.app_role) then
    raise exception 'Akses Admin diperlukan';
  end if;
  select * into _b from public.bookings where id=_booking_id for update;
  if not found then raise exception 'Booking tidak ditemukan'; end if;

  if _action in ('approve_transfer','reject_transfer') then
    if _b.status <> 'pending_verification' or _b.payment_method <> 'transfer' then
      raise exception 'Booking bukan transfer yang menunggu verifikasi';
    end if;
    if _action='approve_transfer' then
      if _b.payment_proof_path is null or _b.payment_proof_uploaded_at is null then
        raise exception 'Pemain belum mengunggah bukti transfer';
      end if;
      if not exists (
        select 1 from storage.objects o
        where o.bucket_id='booking-payment-proofs' and o.name=_b.payment_proof_path
      ) then raise exception 'File bukti transfer tidak ditemukan di Storage'; end if;
      update public.bookings set status='confirmed',paid_at=now(),updated_at=now()
        where id=_booking_id returning * into _b;
      _message := 'Pembayaran transfer telah diverifikasi. E-Ticket ' || _b.code || ' aktif.';
    else
      update public.bookings set status='cancelled',updated_at=now()
        where id=_booking_id returning * into _b;
      _message := 'Pembayaran transfer untuk booking ' || _b.code || ' belum dapat diverifikasi. Hubungi Admin jika perlu bantuan.';
    end if;
    insert into public.notifications(user_id,kind,title,message)
      values (_b.user_id,'payment',
        case when _action='approve_transfer' then 'Pembayaran Terkonfirmasi 🎉' else 'Pembayaran Belum Terverifikasi' end,
        _message);
  elsif _action in ('approve_cancel','reject_cancel','approve_swap','reject_swap') then
    if _request_id is null then raise exception 'ID pengajuan wajib diisi'; end if;
    select * into _r from public.booking_requests
      where id=_request_id and booking_id=_booking_id and status='pending' for update;
    if not found then raise exception 'Pengajuan tidak ditemukan atau sudah diproses'; end if;
    if (_action in ('approve_cancel','reject_cancel') and _r.request_type<>'cancel')
       or (_action in ('approve_swap','reject_swap') and _r.request_type<>'swap') then
      raise exception 'Jenis tindakan tidak sesuai pengajuan';
    end if;
    _restore_status := coalesce(_r.previous_booking_status,'confirmed');
    if _restore_status not in ('confirmed','pending_verification','waiting_list') then
      raise exception 'Status booking asal tidak valid';
    end if;
    if _action='approve_cancel' then
      update public.bookings set status='cancelled',updated_at=now() where id=_booking_id returning * into _b;
      update public.booking_requests set status='approved' where id=_request_id;
      _message := 'Pengajuan pembatalan booking ' || _b.code || ' disetujui Admin.';
    elsif _action='reject_cancel' then
      update public.bookings set status=_restore_status,updated_at=now() where id=_booking_id returning * into _b;
      update public.booking_requests set status='rejected' where id=_request_id;
      _message := 'Pengajuan pembatalan booking ' || _b.code || ' belum disetujui. Tiket kembali ke status sebelumnya.';
    elsif _action='approve_swap' then
      if _r.replacement_name is null or _r.replacement_whatsapp is null then
        raise exception 'Data pemain pengganti tidak lengkap';
      end if;
      update public.bookings set player_name=_r.replacement_name,whatsapp=_r.replacement_whatsapp,
        status=_restore_status,updated_at=now() where id=_booking_id returning * into _b;
      update public.booking_requests set status='approved' where id=_request_id;
      _message := 'Pengajuan oper slot booking ' || _b.code || ' disetujui Admin. Data peserta telah diperbarui.';
    else
      update public.bookings set status=_restore_status,updated_at=now() where id=_booking_id returning * into _b;
      update public.booking_requests set status='rejected' where id=_request_id;
      _message := 'Pengajuan oper slot booking ' || _b.code || ' ditolak. Tiket kembali ke status sebelumnya.';
    end if;
    insert into public.notifications(user_id,kind,title,message)
      values (_b.user_id,'request','Pembaruan Pengajuan Booking',_message);
  else
    raise exception 'Tindakan Admin tidak dikenal';
  end if;

  insert into public.booking_admin_actions(booking_id,request_id,actor_id,action,reason)
    values (_booking_id,_request_id,_actor,_action,nullif(btrim(coalesce(_reason,'')),''));
  return jsonb_build_object('booking_id',_b.id,'booking_code',_b.code,'booking_status',_b.status,'action',_action);
end;
$function$;

revoke all on function public.admin_review_booking(uuid,text,uuid,text) from public,anon;
grant execute on function public.admin_review_booking(uuid,text,uuid,text) to authenticated;
