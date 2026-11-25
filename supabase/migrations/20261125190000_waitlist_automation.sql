alter table public.bookings
  add column if not exists waitlist_offered_at timestamptz,
  add column if not exists waitlist_offer_expires_at timestamptz;

create index if not exists bookings_waitlist_queue_idx
  on public.bookings (event_id, waitlist_position, created_at)
  where status = 'waiting_list';

create index if not exists bookings_waitlist_offer_expiry_idx
  on public.bookings (waitlist_offer_expires_at)
  where status = 'waiting_list' and waitlist_offer_expires_at is not null;

create or replace function public.promote_waitlist_for_event(_event_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare
  _event public.events;
  _booking public.bookings;
  _filled integer;
  _slots integer;
  _promoted integer := 0;
begin
  select * into _event from public.events where id = _event_id for update;
  if not found then return 0; end if;

  -- A slot offer expires after 30 minutes; expired players leave the queue.
  for _booking in
    update public.bookings
      set status = 'cancelled', waitlist_offer_expires_at = null, updated_at = now()
      where event_id = _event_id and status = 'waiting_list'
        and waitlist_offer_expires_at <= now()
      returning *
  loop
    insert into public.notifications(user_id, kind, title, message)
      values (_booking.user_id, 'waitlist', 'Tawaran Waiting List Kedaluwarsa',
        'Batas waktu 30 menit untuk mengambil slot ' || _booking.code || ' telah berakhir. Slot ditawarkan kepada pemain berikutnya.');
  end loop;

  select _event.base_filled + count(*) into _filled
  from public.bookings b
  where b.event_id = _event_id
    and (
      b.status in ('confirmed','pending_verification','cancel_requested','swap_requested')
      or (b.status = 'awaiting_payment' and b.payment_expires_at > now())
      or (b.status = 'waiting_list' and b.waitlist_offer_expires_at > now())
    );

  _slots := greatest(0, _event.quota_max - coalesce(_filled, _event.base_filled));
  while _slots > 0 loop
    select * into _booking
    from public.bookings
    where event_id = _event_id and status = 'waiting_list'
      and waitlist_offer_expires_at is null
    order by waitlist_position nulls last, created_at asc
    for update skip locked
    limit 1;

    exit when not found;

    update public.bookings
      set waitlist_offered_at = now(),
          waitlist_offer_expires_at = now() + interval '30 minutes',
          updated_at = now()
      where id = _booking.id
      returning * into _booking;

    insert into public.notifications(user_id, kind, title, message)
      values (_booking.user_id, 'waitlist', 'Slot Mabar Tersedia! 🎉',
        'Ada slot kosong untuk ' || _event.title || '. Ambil slot dalam 30 menit melalui menu Tiket & Mabar Saya. Kode antrean: ' || _booking.code || '.');

    _promoted := _promoted + 1;
    _slots := _slots - 1;
  end loop;

  return _promoted;
end;
$function$;

revoke all on function public.promote_waitlist_for_event(uuid) from public, anon, authenticated;

create or replace function public.handle_booking_slot_release()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  _was_occupying boolean;
  _is_occupying boolean;
begin
  _was_occupying :=
    old.status in ('confirmed','pending_verification','cancel_requested','swap_requested')
    or (old.status = 'awaiting_payment' and old.payment_expires_at > now())
    or (old.status = 'waiting_list' and old.waitlist_offer_expires_at > now());

  _is_occupying :=
    new.status in ('confirmed','pending_verification','cancel_requested','swap_requested')
    or (new.status = 'awaiting_payment' and new.payment_expires_at > now())
    or (new.status = 'waiting_list' and new.waitlist_offer_expires_at > now());

  if _was_occupying and not _is_occupying then
    perform public.promote_waitlist_for_event(new.event_id);
  end if;
  return new;
end;
$function$;

drop trigger if exists bookings_promote_waitlist_after_slot_release on public.bookings;
create trigger bookings_promote_waitlist_after_slot_release
after update of status on public.bookings
for each row execute function public.handle_booking_slot_release();

create or replace function public.process_waitlist_expirations()
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare
  _event_id uuid;
  _processed integer := 0;
begin
  for _event_id in
    select distinct event_id from public.bookings
    where (status = 'awaiting_payment' and payment_expires_at <= now())
       or (status = 'waiting_list' and waitlist_offer_expires_at <= now())
  loop
    update public.bookings
      set status = 'cancelled', updated_at = now()
      where event_id = _event_id and status = 'awaiting_payment'
        and payment_expires_at <= now();

    _processed := _processed + public.promote_waitlist_for_event(_event_id);
  end loop;
  return _processed;
end;
$function$;

revoke all on function public.process_waitlist_expirations() from public, anon;
grant execute on function public.process_waitlist_expirations() to authenticated;

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
  if _payment_method not in ('qris','transfer') then raise exception 'Pilih metode pembayaran'; end if;

  select * into _booking from public.bookings
    where id = _booking_id and user_id = _uid for update;
  if not found then raise exception 'Booking waiting list tidak ditemukan'; end if;

  perform public.promote_waitlist_for_event(_booking.event_id);
  select * into _booking from public.bookings where id = _booking_id for update;

  if _booking.status <> 'waiting_list' or _booking.waitlist_offer_expires_at is null
     or _booking.waitlist_offer_expires_at <= now() then
    raise exception 'Tawaran slot sudah berakhir atau tidak tersedia. Periksa status antrean terbaru.';
  end if;

  select * into _event from public.events where id = _booking.event_id for update;
  if not found then raise exception 'Jadwal tidak ditemukan'; end if;

  if _payment_method = 'qris' then
    update public.bookings
      set status = 'awaiting_payment', payment_method = 'qris',
          amount = _event.price, payment_expires_at = now() + interval '15 minutes',
          waitlist_offer_expires_at = null, updated_at = now()
      where id = _booking_id;
  else
    update public.bookings
      set status = 'pending_verification', payment_method = 'transfer',
          amount = _event.price, payment_expires_at = null,
          waitlist_offer_expires_at = null, updated_at = now()
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

create or replace function public.event_quota()
returns table(event_id uuid, filled integer, waitlist integer)
language plpgsql
volatile
security definer
set search_path = public
as $function$
begin
  perform public.process_waitlist_expirations();
  return query
    select e.id,
      least(e.quota_max, e.base_filled + coalesce((
        select count(*) from public.bookings b where b.event_id = e.id
          and (b.status in ('confirmed','pending_verification','cancel_requested','swap_requested')
            or (b.status = 'awaiting_payment' and b.payment_expires_at > now())
            or (b.status = 'waiting_list' and b.waitlist_offer_expires_at > now()))
      ),0))::int,
      coalesce((select count(*) from public.bookings b where b.event_id = e.id and b.status='waiting_list'),0)::int
    from public.events e;
end;
$function$;

revoke all on function public.event_quota() from public, anon;
grant execute on function public.event_quota() to anon, authenticated;
