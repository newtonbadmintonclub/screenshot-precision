-- ===== Roles =====
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- ===== Profiles =====
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  whatsapp text NOT NULL DEFAULT '',
  level text NOT NULL DEFAULT 'Intermediate' CHECK (level IN ('Beginner','Intermediate','Advance')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins read profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ===== Events =====
CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  event_type text NOT NULL DEFAULT 'Fun Mabar',
  starts_at timestamptz NOT NULL,
  time_slots text NOT NULL,
  courts text[] NOT NULL DEFAULT '{}',
  venue text NOT NULL DEFAULT 'Galaxy Badminton Arena',
  address text NOT NULL DEFAULT 'Jl. Simpang Sulfat Selatan No.5, Kota Malang',
  maps_url text NOT NULL DEFAULT 'https://maps.app.goo.gl/h9wgTx991t6qWHf39',
  price integer NOT NULL CHECK (price >= 0),
  quota_max integer NOT NULL CHECK (quota_max > 0),
  base_filled integer NOT NULL DEFAULT 0 CHECK (base_filled >= 0),
  is_featured boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.events TO anon, authenticated;
GRANT ALL ON public.events TO service_role;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads events" ON public.events FOR SELECT TO anon, authenticated USING (true);

-- ===== Bookings =====
CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE DEFAULT ('NBC-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6))),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  player_name text NOT NULL,
  whatsapp text NOT NULL,
  level text NOT NULL,
  channel text NOT NULL DEFAULT 'website',
  payment_method text CHECK (payment_method IN ('qris','transfer')),
  status text NOT NULL CHECK (status IN ('confirmed','pending_verification','waiting_list','cancel_requested','swap_requested','cancelled')),
  waitlist_position integer,
  amount integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bookings_event_idx ON public.bookings(event_id);
CREATE INDEX bookings_user_idx ON public.bookings(user_id);
GRANT SELECT ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own bookings" ON public.bookings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins read bookings" ON public.bookings FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ===== Booking requests (cancel / swap) =====
CREATE TABLE public.booking_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  request_type text NOT NULL CHECK (request_type IN ('cancel','swap')),
  reason text,
  replacement_name text,
  replacement_whatsapp text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.booking_requests TO authenticated;
GRANT ALL ON public.booking_requests TO service_role;
ALTER TABLE public.booking_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own requests" ON public.booking_requests FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins read requests" ON public.booking_requests FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ===== Products =====
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  category text NOT NULL,
  description text NOT NULL DEFAULT '',
  price integer NOT NULL CHECK (price >= 0),
  stock integer NOT NULL DEFAULT 0,
  badge text,
  sizes text[] NOT NULL DEFAULT '{}',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.products TO anon, authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads products" ON public.products FOR SELECT TO anon, authenticated USING (true);

-- ===== Orders =====
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE DEFAULT ('ORD-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6))),
  user_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id),
  product_name text NOT NULL,
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 20),
  size text,
  unit_price integer NOT NULL,
  total integer NOT NULL,
  note text,
  status text NOT NULL DEFAULT 'menunggu_pembayaran' CHECK (status IN ('menunggu_pembayaran','diproses','selesai','dibatalkan')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own orders" ON public.orders FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins read orders" ON public.orders FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ===== Notifications =====
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'info' CHECK (kind IN ('booking','payment','waitlist','reminder','request','order','info')),
  title text NOT NULL,
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON public.notifications(user_id, created_at DESC);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ===== Quota (public) =====
CREATE OR REPLACE FUNCTION public.event_quota()
RETURNS TABLE (event_id uuid, filled integer, waitlist integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT e.id,
    LEAST(e.quota_max, e.base_filled + COALESCE((SELECT count(*) FROM public.bookings b WHERE b.event_id = e.id AND b.status IN ('confirmed','pending_verification','cancel_requested','swap_requested')), 0))::int,
    COALESCE((SELECT count(*) FROM public.bookings b WHERE b.event_id = e.id AND b.status = 'waiting_list'), 0)::int
  FROM public.events e
$$;
REVOKE ALL ON FUNCTION public.event_quota() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.event_quota() TO anon, authenticated;

-- ===== Book an event (quota check + payment) =====
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

  IF EXISTS (SELECT 1 FROM public.bookings WHERE event_id = _event_id AND user_id = _uid AND status <> 'cancelled') THEN
    RAISE EXCEPTION 'Kamu sudah terdaftar di jadwal ini';
  END IF;

  SELECT _evt.base_filled + count(*) INTO _filled FROM public.bookings
    WHERE event_id = _event_id AND status IN ('confirmed','pending_verification','cancel_requested','swap_requested');

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

  INSERT INTO public.bookings (event_id, user_id, player_name, whatsapp, level, payment_method, status, amount)
    VALUES (_event_id, _uid, _player_name, _whatsapp, _level, _payment_method,
      CASE WHEN _payment_method = 'qris' THEN 'confirmed' ELSE 'pending_verification' END, _evt.price)
    RETURNING * INTO _row;

  IF _payment_method = 'qris' THEN
    INSERT INTO public.notifications (user_id, kind, title, message)
      VALUES (_uid, 'booking', 'Booking Terkonfirmasi 🎉',
        'Pembayaran QRIS diterima. E-Ticket ' || _row.code || ' untuk ' || _evt.title || ' sudah aktif.');
  ELSE
    INSERT INTO public.notifications (user_id, kind, title, message)
      VALUES (_uid, 'payment', 'Menunggu Verifikasi Pembayaran',
        'Kirim bukti transfer ' || _row.code || ' ke WA Admin. Tiket aktif setelah diverifikasi.');
  END IF;
  RETURN _row;
END;
$$;
REVOKE ALL ON FUNCTION public.book_event(uuid, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.book_event(uuid, text, text, text, text) TO authenticated;

-- ===== Cancel / swap request =====
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

-- ===== Place an order =====
CREATE OR REPLACE FUNCTION public.place_order(_product_id uuid, _quantity int, _size text, _note text)
RETURNS public.orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _p public.products;
  _row public.orders;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Silakan login terlebih dahulu'; END IF;
  SELECT * INTO _p FROM public.products WHERE id = _product_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Produk tidak ditemukan'; END IF;
  IF _quantity IS NULL OR _quantity < 1 OR _quantity > 20 THEN RAISE EXCEPTION 'Jumlah tidak valid'; END IF;
  IF _quantity > _p.stock THEN RAISE EXCEPTION 'Stok tidak cukup'; END IF;
  IF array_length(_p.sizes, 1) > 0 AND (_size IS NULL OR NOT (_size = ANY(_p.sizes))) THEN RAISE EXCEPTION 'Pilih ukuran'; END IF;
  IF length(coalesce(_note,'')) > 300 THEN RAISE EXCEPTION 'Catatan terlalu panjang'; END IF;
  INSERT INTO public.orders (user_id, product_id, product_name, quantity, size, unit_price, total, note)
    VALUES (_uid, _p.id, _p.name, _quantity, NULLIF(_size,''), _p.price, _p.price * _quantity, NULLIF(btrim(coalesce(_note,'')),''))
    RETURNING * INTO _row;
  INSERT INTO public.notifications (user_id, kind, title, message)
    VALUES (_uid, 'order', 'Pesanan ' || _row.code || ' Diterima',
      _quantity || 'x ' || _p.name || '. Admin akan menghubungi via WA untuk pembayaran & pengambilan.');
  RETURN _row;
END;
$$;
REVOKE ALL ON FUNCTION public.place_order(uuid, int, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.place_order(uuid, int, text, text) TO authenticated;

-- ===== New user -> profile =====
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _lvl text := coalesce(NEW.raw_user_meta_data->>'level', 'Intermediate');
BEGIN
  IF _lvl NOT IN ('Beginner','Intermediate','Advance') THEN _lvl := 'Intermediate'; END IF;
  INSERT INTO public.profiles (id, full_name, whatsapp, level)
  VALUES (NEW.id,
    left(coalesce(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1), ''), 80),
    left(coalesce(NEW.raw_user_meta_data->>'whatsapp', ''), 20),
    _lvl)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  INSERT INTO public.notifications (user_id, kind, title, message)
  VALUES (NEW.id, 'info', 'Selamat datang di Newton BC! 🏸', 'Mabar No Pressure, Malang Semua Teman For Sure! Yuk pilih jadwal mabar pertamamu.');
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===== Seed =====
INSERT INTO public.events (title, event_type, starts_at, time_slots, courts, price, quota_max, base_filled, is_featured) VALUES
('Join Mabar Bulutangkis — Sabtu Malam', 'Fun Mabar', '2026-11-21 19:00:00+07', '19.00–22.00 (Lapangan B & D) • 20.00–22.00 (Lapangan A)', ARRAY['Lapangan A','Lapangan B','Lapangan D'], 20000, 26, 18, true),
('Sunday Morning Smash — Sesi Pagi', 'Fun Mabar', '2026-11-22 08:00:00+07', '08.00–11.00 (Lapangan A & B)', ARRAY['Lapangan A','Lapangan B'], 20000, 26, 26, false),
('Mabar Rabu Malam', 'Fun Mabar', '2026-11-25 19:00:00+07', '19.00–22.00 (Lapangan B & D) • 20.00–22.00 (Lapangan A)', ARRAY['Lapangan A','Lapangan B','Lapangan D'], 20000, 26, 9, false),
('Newton Fun Mini Cup #3 (Ganda Campuran)', 'Mini Tournament', '2026-11-28 18:30:00+07', '18.30–22.30 (Lapangan A, B, C, D)', ARRAY['Lapangan A','Lapangan B','Lapangan C','Lapangan D'], 35000, 16, 12, false);

INSERT INTO public.products (slug, name, category, description, price, stock, badge, sizes, sort_order) VALUES
('jersey-official-2026', 'Jersey Official Newton BC 2026', 'Apparel', 'Bahan Dry-Fit Milano premium, motif Navy-Teal-Orange eksklusif Newton BC.', 145000, 18, 'Best Seller', ARRAY['S','M','L','XL','XXL'], 1),
('shuttlecock-pro-speed-77', 'Shuttlecock Newton Pro Speed 77 (Slop)', 'Shuttlecock', 'Bulu angsa pilihan, laju stabil & awet untuk mabar maupun turnamen. Isi 12.', 135000, 22, 'Grade A', '{}', 2),
('overgrip-anti-slip', 'Overgrip Anti-Slip Newton Edition', 'Aksesoris', 'Nyaman di tangan, menyerap keringat maksimal. Warna Teal & Orange.', 25000, 35, 'Tacky Feel', ARRAY['Teal','Orange'], 3),
('wristband-athletic', 'Wristband Athletic Newton BC', 'Aksesoris', 'Karet elastis lembut dengan bordir logo Newton BC Malang.', 35000, 16, 'Baru', '{}', 4);