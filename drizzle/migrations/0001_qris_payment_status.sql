ALTER TABLE public.bookings DROP CONSTRAINT bookings_status_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_status_check CHECK (status IN ('awaiting_payment','confirmed','pending_verification','waiting_list','cancel_requested','swap_requested','cancelled'));
ALTER TABLE public.bookings ADD COLUMN payment_expires_at timestamptz;
ALTER TABLE public.bookings ADD COLUMN xendit_qr_id text;
ALTER TABLE public.bookings ADD COLUMN qr_string text;
ALTER TABLE public.bookings ADD COLUMN paid_at timestamptz;

-- Which bookings occupy a slot right now
CREATE OR REPLACE FUNCTION public.booking_holds_slot(_status text, _expires timestamptz)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT _status IN ('confirmed','pending_verification','cancel_requested','swap_requested')
      OR (_status = 'awaiting_payment' AND _expires IS NOT NULL AND _expires > now())
$$;

CREATE OR REPLACE FUNCTION public.event_quota()
RETURNS TABLE (event_id uuid, filled integer, waitlist integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT e.id,
    LEAST(e.quota_max, e.base_filled + COALESCE((SELECT count(*) FROM public.bookings b WHERE b.event_id = e.id
      AND (b.status IN ('confirmed','pending_verification','cancel_requested','swap_requested')
           OR (b.status = 'awaiting_payment' AND b.payment_expires_at > now()))), 0))::int,
    COALESCE((SELECT count(*) FROM public.bookings b WHERE b.event_id = e.id AND b.status = 'waiting_list'), 0)::int
  FROM public.events e
$$;
DROP FUNCTION public.booking_holds_slot(text, timestamptz);

CREATE OR REPLACE FUNCTION public.book_event(
  _event_id uuid, _player_name text, _whatsapp text, _level text, _payment_method text
) RETURNS public.bookings
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

  SELECT * INTO _evt FROM public.events WHERE id = _event_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Jadwal tidak ditemukan'; END IF;
  IF _evt.starts_at < now() - interval '3 hours' THEN RAISE EXCEPTION 'Jadwal ini sudah lewat'; END IF;

  -- Release this player's expired unpaid QRIS holds
  UPDATE public.bookings SET status = 'cancelled', updated_at = now()
    WHERE event_id = _event_id AND user_id = _uid AND status = 'awaiting_payment' AND payment_expires_at <= now();

  IF EXISTS (SELECT 1 FROM public.bookings WHERE event_id = _event_id AND user_id = _uid AND status <> 'cancelled') THEN
    RAISE EXCEPTION 'Kamu sudah terdaftar di jadwal ini';
  END IF;

  SELECT _evt.base_filled + count(*) INTO _filled FROM public.bookings
    WHERE event_id = _event_id
      AND (status IN ('confirmed','pending_verification','cancel_requested','swap_requested')
           OR (status = 'awaiting_payment' AND payment_expires_at > now()));

  IF _filled >= _evt.quota_max THEN
    SELECT count(*) + 1 INTO _pos FROM public.bookings WHERE event_id = _event_id AND status = 'waiting_list';
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
        'Kirim bukti transfer ' || _row.code || ' ke WA Admin. Tiket aktif setelah diverifikasi.');
  END IF;
  RETURN _row;
END;
$$;
REVOKE ALL ON FUNCTION public.book_event(uuid, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.book_event(uuid, text, text, text, text) TO authenticated;

-- Called only by the payment webhook (service role)
CREATE OR REPLACE FUNCTION public.confirm_qris_payment(_qr_id text, _reference text, _amount integer)
RETURNS public.bookings
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _b public.bookings;
  _title text;
BEGIN
  SELECT * INTO _b FROM public.bookings WHERE xendit_qr_id = _qr_id AND code = _reference FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'booking not found'; END IF;
  IF _b.status = 'confirmed' THEN RETURN _b; END IF;
  IF _amount < _b.amount THEN RAISE EXCEPTION 'amount mismatch'; END IF;
  UPDATE public.bookings SET status = 'confirmed', paid_at = now(), updated_at = now()
    WHERE id = _b.id RETURNING * INTO _b;
  SELECT title INTO _title FROM public.events WHERE id = _b.event_id;
  INSERT INTO public.notifications (user_id, kind, title, message)
    VALUES (_b.user_id, 'booking', 'Booking Terkonfirmasi 🎉',
      'Pembayaran QRIS diterima. E-Ticket ' || _b.code || ' untuk ' || coalesce(_title, 'mabar') || ' sudah aktif.');
  RETURN _b;
END;
$$;
REVOKE ALL ON FUNCTION public.confirm_qris_payment(text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_qris_payment(text, text, integer) TO service_role;

-- Cancel/swap only for settled tickets
CREATE OR REPLACE FUNCTION public.request_booking_change(
  _booking_id uuid, _request_type text, _reason text, _replacement_name text, _replacement_whatsapp text
) RETURNS public.booking_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _b public.bookings;
  _row public.booking_requests;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Silakan login terlebih dahulu'; END IF;
  SELECT * INTO _b FROM public.bookings WHERE id = _booking_id AND user_id = _uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tiket tidak ditemukan'; END IF;

  IF _b.status = 'awaiting_payment' AND _request_type = 'cancel' THEN
    UPDATE public.bookings SET status = 'cancelled', updated_at = now() WHERE id = _booking_id;
    INSERT INTO public.booking_requests (booking_id, user_id, request_type, reason, status)
      VALUES (_booking_id, _uid, 'cancel', coalesce(NULLIF(btrim(coalesce(_reason,'')),''), 'Batal sebelum bayar'), 'approved') RETURNING * INTO _row;
    RETURN _row;
  END IF;

  IF _b.status NOT IN ('confirmed','pending_verification','waiting_list') THEN
    RAISE EXCEPTION 'Tiket ini sudah punya permintaan yang sedang diproses';
  END IF;

  IF _request_type = 'cancel' THEN
    _reason := btrim(coalesce(_reason, ''));
    IF length(_reason) < 3 OR length(_reason) > 500 THEN RAISE EXCEPTION 'Tulis alasan cancel (3–500 karakter)'; END IF;
    INSERT INTO public.booking_requests (booking_id, user_id, request_type, reason)
      VALUES (_booking_id, _uid, 'cancel', _reason) RETURNING * INTO _row;
    UPDATE public.bookings SET status = 'cancel_requested', updated_at = now() WHERE id = _booking_id;
    INSERT INTO public.notifications (user_id, kind, title, message)
      VALUES (_uid, 'request', 'Pengajuan Cancel Terkirim', 'Permintaan cancel & refund tiket ' || _b.code || ' sedang ditinjau Admin.');
  ELSIF _request_type = 'swap' THEN
    _replacement_name := btrim(coalesce(_replacement_name, ''));
    _replacement_whatsapp := btrim(coalesce(_replacement_whatsapp, ''));
    IF length(_replacement_name) < 2 OR length(_replacement_name) > 80 THEN RAISE EXCEPTION 'Nama pengganti tidak valid'; END IF;
    IF _replacement_whatsapp !~ '^[0-9+ -]{8,20}$' THEN RAISE EXCEPTION 'Nomor WA pengganti tidak valid'; END IF;
    IF _b.status = 'waiting_list' THEN RAISE EXCEPTION 'Slot waiting list tidak bisa dioper'; END IF;
    INSERT INTO public.booking_requests (booking_id, user_id, request_type, reason, replacement_name, replacement_whatsapp)
      VALUES (_booking_id, _uid, 'swap', NULLIF(btrim(coalesce(_reason,'')), ''), _replacement_name, _replacement_whatsapp) RETURNING * INTO _row;
    UPDATE public.bookings SET status = 'swap_requested', updated_at = now() WHERE id = _booking_id;
    INSERT INTO public.notifications (user_id, kind, title, message)
      VALUES (_uid, 'request', 'Pengajuan Oper Slot Terkirim', 'Permintaan oper slot ' || _b.code || ' ke ' || _replacement_name || ' sedang ditinjau Admin.');
  ELSE
    RAISE EXCEPTION 'Jenis permintaan tidak valid';
  END IF;
  RETURN _row;
END;
$$;
REVOKE ALL ON FUNCTION public.request_booking_change(uuid, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_booking_change(uuid, text, text, text, text) TO authenticated;