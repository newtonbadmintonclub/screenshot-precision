create or replace function public.accept_waitlist_offer(_booking_id uuid, _payment_method text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  _uid uuid := auth.uid();
  _booking public.bookings;
  _event public.events;
begin
  if _uid is null then raise exception 'Silakan login terlebih dahulu'; end if;
  if _payment_method is null or _payment_method not in ('qris','transfer') then
    raise exception 'Pilih metode pembayaran';
  end if;

  select * into _booking from public.bookings
    where id = _booking_id and user_id = _uid for update;
  if not found then raise exception 'Booking waiting list tidak ditemukan'; end if;

  perform public.promote_waitlist_for_event(_booking.event_id);
  select * into _booking from public.bookings where id = _booking_id for update;

  if _booking.status <> 'waiting_list' or _booking.waitlist_offer_expires_at is null
     or _booking.waitlist_offer_expires_at <= now() then
    raise exception 'Tawaran slot sudah berakhir atau tidak tersedia. Periksa status antrean terbaru.';
  end if;

  if exists (
    select 1 from public.bookings b
    where b.event_id = _booking.event_id and b.user_id = _uid
      and b.id <> _booking_id
      and (b.status in ('confirmed','pending_verification','cancel_requested','swap_requested')
        or (b.status = 'awaiting_payment' and b.payment_expires_at > now()))
  ) then
    raise exception 'Kamu sudah memiliki booking aktif untuk jadwal ini';
  end if;

  select * into _event from public.events where id = _booking.event_id for update;
  if not found then raise exception 'Jadwal tidak ditemukan'; end if;
  if _event.starts_at < now() - interval '3 hours' then
    raise exception 'Jadwal ini sudah lewat';
  end if;

  if _payment_method = 'qris' then
    update public.bookings
      set status = 'awaiting_payment', payment_method = 'qris',
          amount = _event.price, payment_expires_at = now() + interval '15 minutes',
          waitlist_position = null, waitlist_offer_expires_at = null, updated_at = now()
      where id = _booking_id;
  else
    update public.bookings
      set status = 'pending_verification', payment_method = 'transfer',
          amount = _event.price, payment_expires_at = null,
          waitlist_position = null, waitlist_offer_expires_at = null, updated_at = now()
      where id = _booking_id;
  end if;

  insert into public.notifications(user_id, kind, title, message)
    values (_uid, 'payment', 'Slot Waiting List Berhasil Diambil',
      'Slot ' || _event.title || ' berhasil diamankan. Selesaikan pembayaran agar tiket aktif.');

  return jsonb_build_object('booking_id', _booking_id, 'payment_method', _payment_method,
    'status', case when _payment_method = 'qris' then 'awaiting_payment' else 'pending_verification' end);
end;
$function$;

revoke all on function public.accept_waitlist_offer(uuid,text) from public, anon;
grant execute on function public.accept_waitlist_offer(uuid,text) to authenticated;
