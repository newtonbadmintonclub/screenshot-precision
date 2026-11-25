CREATE OR REPLACE FUNCTION public.book_event(_event_id uuid, _player_name text, _whatsapp text, _level text, _payment_method text)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _evt public.events;
  _filled int;
  _row public.bookings;
  _pos int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Silakan login terlebih dahulu'; END IF;
  _player_name := btrim(coalesce(_player_name, ''));
  _whatsapp := btrim(coalesce(_whatsapp, ''));
  IF length(_player_name) < 2 OR length(_player_name) > 80 THEN RAISE EXCEPTION 'Nama tidak valid'; END IF;
  IF _whatsapp !~ '^[0-9+ -]{8,20}$' THEN RAISE EXCEPTION 'Nomor WhatsApp tidak valid'; END IF;
  IF _level NOT IN ('Beginner','Intermediate','Advance') THEN RAISE EXCEPTION 'Level tidak valid'; END IF;

  PERFORM public.process_waitlist_expirations();

  SELECT * INTO _evt FROM public.events WHERE id = _event_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Jadwal tidak ditemukan'; END IF;
  IF _evt.starts_at < now() - interval '3 hours' THEN RAISE EXCEPTION 'Jadwal ini sudah lewat'; END IF;

  UPDATE public.bookings SET status = 'cancelled', updated_at = now()
    WHERE event_id = _event_id AND status = 'awaiting_payment' AND payment_expires_at <= now();

  IF EXISTS (SELECT 1 FROM public.bookings WHERE event_id = _event_id AND user_id = _uid AND status <> 'cancelled') THEN
    RAISE EXCEPTION 'Kamu sudah terdaftar di jadwal ini';
  END IF;

  SELECT _evt.base_filled + count(*) INTO _filled FROM public.bookings
    WHERE event_id = _event_id
      AND (status IN ('confirmed','pending_verification','cancel_requested','swap_requested')
           OR (status = 'awaiting_payment' AND payment_expires_at > now())
           OR (status = 'waiting_list' AND waitlist_offer_expires_at > now()));

  IF _filled >= _evt.quota_max THEN
    SELECT COALESCE(max(waitlist_position), 0) + 1 INTO _pos
      FROM public.bookings WHERE event_id = _event_id AND status = 'waiting_list';
    INSERT INTO public.bookings (event_id, user_id, player_name, whatsapp, level, payment_method, status, waitlist_position, amount)
      VALUES (_event_id, _uid, _player_name, _whatsapp, _level, NULL, 'waiting_list', _pos, 0)
      RETURNING * INTO _row;
    INSERT INTO public.notifications (user_id, kind, title, message)
      VALUES (_uid, 'waitlist', 'Masuk Waiting List #' || _pos,
        'Kuota ' || _evt.title || ' sedang penuh. Kamu antrean ke-' || _pos || '. Kami kabari kalau ada slot kosong.');
    RETURN _row;
  END IF;

  IF _payment_method NOT IN ('qris','transfer') THEN RAISE EXCEPTION 'Pilih metode pembayaran'; END IF;

  IF _payment_method = 'qris' THEN
    INSERT INTO public.bookings (event_id, user_id, player_name, whatsapp, level, payment_method, status, amount, payment_expires_at)
      VALUES (_event_id, _uid, _player_name, _whatsapp, _level, 'qris', 'awaiting_payment', _evt.price, now() + interval '15 minutes')
      RETURNING * INTO _row;
  ELSE
    INSERT INTO public.bookings (event_id, user_id, player_name, whatsapp, level, payment_method, status, amount)
      VALUES (_event_id, _uid, _player_name, _whatsapp, _level, 'transfer', 'pending_verification', _evt.price)
      RETURNING * INTO _row;
    INSERT INTO public.notifications (user_id, kind, title, message)
      VALUES (_uid, 'payment', 'Menunggu Verifikasi Pembayaran',
        'Transfer untuk booking ' || _row.code || ' lalu unggah bukti melalui halaman Tiket Saya. Tiket aktif setelah diverifikasi.');
  END IF;
  RETURN _row;
END;
$function$;

revoke all on function public.book_event(uuid,text,text,text,text) from public, anon;
grant execute on function public.book_event(uuid,text,text,text,text) to authenticated;
