# Supabase schema and security audit

Audit date: 2026-11-22  
Target Supabase project: `newtonbadmintonclub`  
Project ref: `urijsqkxagpmxxmfhwcv`  
Region: `ap-southeast-1`

This document records a read-only inspection of the live Supabase project. No production schema, rows, policies, or functions were changed during this audit.

## Repository / project alignment

- The live Supabase project ref is `urijsqkxagpmxxmfhwcv`.
- The repository's current `supabase/config.toml` contains `project_id = "texbwbhhhbdsnfonmkge"`.
- These identifiers do not match. Verify the intended CLI project link before running any Supabase CLI command that targets a linked project. Do not run `db push`, `db reset --linked`, or other remote schema mutations until this mismatch is resolved.
- Supabase reports no migration history for the inspected project.
- There is currently no `supabase/migrations/` directory on the `development` branch.

## Tables inspected

All nine inspected public tables have Row Level Security enabled:

- `user_roles`
- `profiles`
- `events`
- `bookings`
- `booking_requests`
- `products`
- `orders`
- `notifications`

## RLS policy inventory

| Table | Policies observed |
| --- | --- |
| user_roles | Users read own roles |
| profiles | Admins read profiles; Users insert own profile; Users read own profile; Users update own profile |
| events | Anyone reads events |
| bookings | Admins read bookings; Users read own bookings |
| booking_requests | Admins read requests; Users read own requests |
| products | Anyone reads products |
| orders | Admins read orders; Users read own orders |
| notifications | Users read own notifications; Users update own notifications |

The observed owner-scoped policies compare `auth.uid()` with the row's `user_id` (or `profiles.id`). Admin read policies call `has_role(auth.uid(), 'admin')`. RLS is enabled, but this inventory alone does not prove every application workflow is correctly authorized; perform authenticated/anonymous role tests before changing policies.

## SECURITY DEFINER functions

The Security Advisor reported these callable functions:

- `public.event_quota()` — executable by `anon` and `authenticated`.
- `public.book_event(uuid, text, text, text, text)` — executable by `authenticated`.
- `public.has_role(uuid, app_role)` — executable by `authenticated`.
- `public.place_order(uuid, integer, text, text)` — executable by `authenticated`.
- `public.request_booking_change(uuid, text, text, text, text)` — executable by `authenticated`.

Initial source review:
- `book_event` checks `auth.uid()` is present, validates player fields, locks the selected event row, checks duplicate booking for the current user, and creates the booking for `auth.uid()`.
- `place_order` checks `auth.uid()` is present and creates the order with that user ID. Review stock concurrency and whether stock should be decremented/reserved in this function.
- `request_booking_change` selects the booking using both booking ID and `auth.uid()`, which is a useful ownership check.
- `has_role` checks the supplied user ID against `user_roles`. Review whether callers can use this RPC to probe arbitrary users' role membership; admin RLS usage also depends on this helper.
- `event_quota` aggregates booking occupancy and waitlist counts and is exposed to `anon`. Confirm that aggregate quota information is intended to be public.

Do not revoke execution or change function security mode blindly: these functions are used by application workflows and some are intentionally called from the browser. Determine the minimum required grants and validate behavior first.

## Advisor findings

### Security
- One warning: anonymous users can execute the SECURITY DEFINER function `event_quota()`.
- Five warnings for SECURITY DEFINER functions callable by authenticated users: `book_event`, `event_quota`, `has_role`, `place_order`, and `request_booking_change`.

These are review warnings, not proof of an exploitable vulnerability. Each function must be assessed against its intended public/authenticated workflow and its authorization checks.

### Performance
- Missing covering index on `booking_requests.booking_id`.
- Missing covering index on `orders.product_id`.
- Advisor reported 13 RLS policies with per-row re-evaluation of auth/current-setting calls. Consider wrapping stable auth calls as `(select auth.uid())` after confirming generated query plans and preserving policy semantics.

## Recommended next steps

1. Resolve the `supabase/config.toml` project-ref mismatch and verify the target explicitly.
2. Capture a complete schema baseline from the live database, including tables, types, constraints, indexes, policies, triggers, functions, grants, and relevant extensions.
3. Review the generated baseline against the live schema. Do not push it to production as a new migration without reconciling the fact that the remote migration history is empty.
4. Test authorization using anonymous, ordinary authenticated, and admin sessions.
5. Apply narrowly scoped security/performance changes only after tests and a reviewed migration are ready.

## Safety note

This file is documentation only. It does not contain credentials or payment secrets. It does not modify the live database.
