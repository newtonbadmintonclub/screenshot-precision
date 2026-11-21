# Newton Badminton Club — technical and Supabase audit

Audit date: 2026-11-22  
Repository: `newtonbadmintonclub/screenshot-precision`  
Audited branch: `development`  
Live Supabase project: `newtonbadmintonclub` (`urijsqkxagpmxxmfhwcv`, `ap-southeast-1`)  
Scope: read-only database/catalog inspection and static source review.

> No production rows, tables, policies, functions, secrets, or deployment settings were changed during this audit.

## Executive summary

The application has a sound starting point: all eight application tables in `public` have RLS enabled; player-owned SELECT policies are present; booking and change-request RPCs bind operations to `auth.uid()`; the auth trigger provisions a basic profile and user role; and the QR webhook checks its callback token before calling a service-role-only RPC.

The audit nevertheless found high-priority business-logic issues in the store and QRIS flows, an incorrect Supabase project reference in repository config, and incomplete migration management. These should be addressed before treating the system as production-hardened.

## 1. Repository / Supabase project alignment

- Live Supabase project ref: `urijsqkxagpmxxmfhwcv`.
- `supabase/config.toml` on `development` currently says `project_id = "texbwbhhhbdsnfonmkge"`.
- This is a confirmed mismatch. Do not run linked CLI migrations, `db push`, or `db reset --linked` until the intended project link is corrected and re-verified.
- Supabase migration history for the live project is empty.
- There is no `supabase/migrations/` directory in the repository.
- A file exists at `drizzle/migrations/0001_qris_payment_status.sql`, but this is a Drizzle migration, not an applied Supabase CLI migration history. It includes DDL and RPC definitions; it must not be replayed against the live project without a careful baseline/reconciliation.
- The previous audit's table count is corrected here: there are **8 application tables** in `public`, not 9.

## 2. Database inventory

### Public tables

All 8 tables have RLS enabled:

| Table | Purpose inferred from columns |
| --- | --- |
| `events` | Public badminton event schedules and quota |
| `bookings` | Player event bookings and payment state |
| `booking_requests` | Cancel / player-swap requests |
| `profiles` | Player profile |
| `user_roles` | Admin / user role assignment |
| `notifications` | Per-user notifications |
| `products` | Public club store catalog and stock |
| `orders` | Player store orders |

### Relationships / referential integrity

Foreign keys observed:
- `profiles.id -> auth.users.id ON DELETE CASCADE`
- `user_roles.user_id -> auth.users.id ON DELETE CASCADE`
- `bookings.event_id -> events.id ON DELETE CASCADE`
- `booking_requests.booking_id -> bookings.id ON DELETE CASCADE`
- `orders.product_id -> products.id`

No FK was found for `user_id` in `bookings`, `booking_requests`, `orders`, or `notifications`. This may be intentional to preserve transactional history after account deletion, but it should be an explicit data-retention decision. Without FKs, orphan rows are possible.

### Constraints and data validation

Positive checks observed include:
- Event price is non-negative, quota is positive, and base-filled is non-negative.
- Product price is non-negative and slug is unique.
- Profile level is limited to `Beginner`, `Intermediate`, or `Advance`.
- Booking status and payment method have enumerated allowed values.
- Booking request type/status have enumerated allowed values.
- Order quantity is limited to 1–20 and order status is enumerated.
- Notification kind is enumerated.
- Booking and order reference codes are unique.

No public-table row triggers were found. The auth schema has an `AFTER INSERT ON auth.users` trigger named `on_auth_user_created` which calls `public.handle_new_user()`.

The project also has an enabled event trigger `ensure_rls` which calls `public.rls_auto_enable()` for newly created public tables. This is a useful safety net, but new tables still need deliberate policies and grants.

## 3. RLS policy inventory

15 policies were observed across the eight public tables. All are enabled under RLS.

| Table | Policy behavior |
| --- | --- |
| `user_roles` | Authenticated users can read their own role rows |
| `profiles` | Users read/insert/update own profile; admins read profiles |
| `events` | Anonymous and authenticated users can read events |
| `bookings` | Users read own bookings; admins read bookings |
| `booking_requests` | Users read own requests; admins read requests |
| `products` | Anonymous and authenticated users can read products |
| `orders` | Users read own orders; admins read orders |
| `notifications` | Users read and update their own notifications |

Important observations:
- There are no direct client INSERT/UPDATE/DELETE policies for bookings, booking requests, orders, events, products, or user roles. Booking/order workflows are intended to use RPCs or trusted server operations.
- The notification UPDATE policy checks row ownership in both `USING` and `WITH CHECK`, so it does not permit changing a notification's `user_id` to another account. However, the role has table-level UPDATE rather than an `is_read`-only column grant; a user can modify other columns on their own notification. Restrict this to the `is_read` column if the intended UI action is only marking read.
- Admin SELECT policies call `has_role(auth.uid(), 'admin')`. That helper is callable by authenticated users and accepts an arbitrary user UUID. This creates a role-membership probing surface for known UUIDs. Prefer a helper that derives the caller identity internally or otherwise prevents arbitrary-user role checks, while preserving its use in RLS.
- Public read access to events/products and aggregate quota is consistent with the public schedule/store use case, assuming no private fields are added to those tables.

### Grants

Catalog inspection shows broad table-level privileges for `anon` and `authenticated` on public tables, including operations such as TRUNCATE, REFERENCES, and TRIGGER. RLS policies prevent normal PostgREST row operations when no matching policy exists, but RLS does not govern TRUNCATE. API keys do not by themselves grant a direct PostgreSQL SQL connection, so this is not proof that anonymous visitors can truncate tables through the website. Still, least-privilege grants should be reviewed and unnecessary table privileges revoked, especially TRUNCATE/REFERENCES/TRIGGER, after confirming Supabase/PostgREST requirements.

## 4. Database functions and authorization

Eight public functions were found. All eight are SECURITY DEFINER; their execution grants differ.

| Function | Execution grants observed | Review |
| --- | --- | --- |
| `book_event(...)` | authenticated, service_role | Checks `auth.uid()`, validates player input, locks event row, checks duplicate booking, calculates quota, inserts booking/waitlist |
| `request_booking_change(...)` | authenticated, service_role | Selects booking by ID and `auth.uid()` with row lock; validates cancel/swap request |
| `place_order(...)` | authenticated, service_role | Authenticates caller and validates product, quantity, size, note; stock handling is incomplete (see critical finding) |
| `event_quota()` | anon, authenticated, service_role | SECURITY DEFINER aggregate exposed publicly; appears intentional for public event schedule |
| `has_role(...)` | authenticated, service_role | Checks role for caller-supplied UUID; arbitrary UUID probing concern |
| `confirm_qris_payment(...)` | service_role only | Correctly unavailable to anon/authenticated; amount/status validation needs tightening |
| `handle_new_user()` | service_role (trigger execution context) | Creates profile, default user role, and welcome notification |
| `rls_auto_enable()` | service_role (event trigger) | Enables RLS for newly created public tables |

All inspected SECURITY DEFINER functions set a fixed `search_path` (`public` or `pg_catalog`). This is good practice. Do not remove SECURITY DEFINER or revoke grants indiscriminately: the application relies on these RPCs and triggers.

### High-priority function findings

**P1 — `place_order` does not reserve/decrement stock.**  
The function reads the product stock, checks `_quantity <= stock`, and inserts an order, but it does not lock the product row or update stock. Concurrent orders can both pass the check and oversell. Implement an atomic stock reservation (conditional UPDATE with `stock >= quantity` and RETURNING, or an explicit row lock) before accepting the order. Also define how stock is restored when an order is cancelled.

**P1 — `confirm_qris_payment` accepts an amount greater than the booking amount.**  
It rejects only `_amount < _b.amount`; a payment greater than the expected amount is accepted. Require exact currency/amount matching against the expected transaction unless the payment provider's contract explicitly requires another rule.

**P1 — `confirm_qris_payment` does not require the booking to still be in `awaiting_payment`.**  
After finding a QR ID/reference pair, it returns early if already confirmed, otherwise it confirms the booking regardless of its current state or QR expiry. A delayed callback could potentially confirm a cancelled/expired booking. Validate the expected state and expiry/payment timing before transitioning; define handling for late-but-successful provider payments.

**P2 — `has_role` accepts arbitrary user IDs.**  
Authenticated callers can ask whether any known UUID has a given role. Limit the helper to the current caller or use a separate privileged-only lookup where needed.

**Positive — `book_event` serializes quota allocation.**  
It locks the event row with `FOR UPDATE`, which helps prevent two concurrent bookings from both claiming the same last slot. Keep this lock behavior if the function is refactored.

## 5. Application source review

### Authentication and session

- `src/routes/auth.tsx` uses Supabase Auth directly for email/password, sign-up, Google OAuth, and password reset. It is not using Lovable Auth for the actual login flow.
- Sign-up validates name, WhatsApp, email, and password in the browser; the database trigger independently limits profile name/WhatsApp lengths and validates level.
- `src/integrations/supabase/auth-middleware.ts` requires a Bearer token and calls Supabase `auth.getClaims(token)` before providing a user-scoped client to server functions. This is a positive server-side authorization check.
- `src/routes/_authenticated/route.tsx` protects authenticated page navigation in the client. This is not the security boundary by itself; RLS and server middleware are the actual data protections.
- `safeRedirect` rejects off-site and protocol-relative redirect targets, reducing open-redirect risk.
- `use-auth.tsx` subscribes to auth state and separately calls `getSession()`. A timing race could let a slower initial session read overwrite a newer auth event; consider sequencing/guarding initialization.

### Notifications

- RLS scopes notification reads and updates to the owner.
- The UI only updates `is_read`, but database privileges permit updates to other columns on the same user's row. Narrow the update privilege to `is_read` if no other player-editable notification fields are intended.
- `useUnreadCount()` filters only `is_read = false`; RLS scopes the result to the current user, so this is not by itself a cross-user data leak.

### QRIS and webhook (code present, not configured/tested live)

- `startQrisPayment` uses authenticated middleware and first reads the booking through the user-scoped Supabase client, so RLS must permit the owner to see it before the server-only admin client writes the QR metadata.
- The QR creation and database update are separate operations. Concurrent requests may create multiple provider QR codes for one booking, and a provider QR could be orphaned if the database update fails. Add an idempotency/locking strategy before enabling live payment.
- The webhook checks `x-callback-token`, validates the payload shape, checks `event === "qr.payment"` and `status === "SUCCEEDED"`, then calls the service-role-only `confirm_qris_payment` RPC. This is a positive baseline.
- The webhook does not compare a currency field because the accepted payload schema does not include one. Confirm provider payload semantics and validate IDR/currency where available.
- The service-role client is in a server-only module and is dynamically imported only inside server handlers in the inspected call sites. Keep the service-role key out of every `VITE_*` variable and browser bundle.

### Lovable remnants / portability

- `package.json` still depends on `@lovable.dev/cloud-auth-js` and `@lovable.dev/vite-tanstack-config`.
- `vite.config.ts` imports the Lovable TanStack config package; it appears to supply substantial TanStack Start/Nitro/Vite setup, so removing it without replacing those behaviors is risky.
- The Supabase client and auth middleware error messages still say “Connect Supabase in Lovable Cloud”.
- `src/lib/lovable-error-reporting.ts` forwards errors to Lovable-specific browser hooks.
- The README still instructs development through Lovable. These are portability/documentation dependencies, not proof that user authentication still depends on Lovable.

## 6. Supabase Advisor results

### Security

- Advisor warning for `event_quota()` callable by anon.
- Advisor warnings for SECURITY DEFINER functions `book_event`, `event_quota`, `has_role`, `place_order`, and `request_booking_change` callable by authenticated users.
- These are review warnings, not proof of exploitability. The function-specific authorization review above is more informative than blanket removal of SECURITY DEFINER.

### Performance

- Missing FK indexes: `booking_requests(booking_id)`, `orders(product_id)`.
- 13 RLS policies have auth/current-setting calls that can be evaluated per row. Consider wrapping stable calls as `(select auth.uid())` and `(select public.has_role(...))` where semantics and plans support it.
- Four tables have multiple permissive SELECT policies (admin + owner): `profiles`, `bookings`, `booking_requests`, `orders`. This is expected for the current access model but may be consolidated if needed.
- Advisor marks `bookings_user_idx` and `notifications_user_idx` unused. Do not drop solely on this signal; current traffic may be low and the indexes match owner lookup patterns. Check workload and query plans first.

### Health

- Supabase health advisor returned no lints at the time of inspection.

### Extensions

Observed extensions: `pg_stat_statements`, `pgcrypto`, `plpgsql`, `supabase_vault`, `uuid-ossp`.

## 7. Tests and limitations

Reviewed repository tests:
- `src/test/booking-rules.test.ts` covers quota calculations, slot-hold logic, cancel/swap eligibility, WhatsApp link formatting, currency formatting, and redirect validation.
- `src/test/app-routing.test.tsx` checks that the root route matches.

Not performed in this read-only audit:
- No production sign-up/login/OAuth/password-reset test with real test accounts.
- No two-account RLS penetration test (player A vs player B vs admin).
- No concurrent booking/order load test.
- No live Xendit QR creation, webhook replay, amount-mismatch, late-callback, or duplicate-callback test.
- No local `npm install`, `npm run lint`, `npm test`, or `npm run build` was run in this audit environment.
- Supabase Auth provider and URL allowlist settings, Vercel environment values, and actual deployment runtime were not read/verified here.

Therefore, this is a comprehensive static/database catalog audit, not a certified penetration test or runtime acceptance test.

## 8. Prioritized remediation plan

1. **P1 — Fix order stock concurrency and reservation.** Implement atomic stock reservation and cancellation/restock behavior.
2. **P1 — Harden QRIS confirmation.** Require exact amount, correct pending state, and a defined expiry/late-payment policy.
3. **P1 — Resolve project ID mismatch.** Correct `supabase/config.toml` only after confirming this repo is intended to target the live project ref `urijsqkxagpmxxmfhwcv`.
4. **P1 — Establish migration baseline safely.** Generate/compare a complete schema baseline (tables, types, constraints, indexes, policies, functions, triggers, grants, extensions). Do not blindly push it to production because remote migration history is empty.
5. **P2 — Restrict notification UPDATE to `is_read`.**
6. **P2 — Reduce `has_role` role-probing surface.**
7. **P2 — Add indexes for the two missing FK columns after validating workload.**
8. **P2 — Optimize the 13 RLS init-plan warnings and review broad grants.**
9. **P3 — Remove Lovable-only dependencies/telemetry and update README only after replacing the Vite/TanStack config functionality and confirming a successful build.**
10. **P3 — Run two-account RLS, admin, payment, and concurrent order/booking tests in a non-production environment.**

## Safety statement

This document is an audit record only. It contains no passwords, API secrets, service-role keys, or payment credentials. No live database or production deployment was modified during the audit.
