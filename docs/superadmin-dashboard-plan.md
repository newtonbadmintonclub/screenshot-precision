# Newton Badminton Club — SuperAdmin and Admin dashboard plan

Status: approved role model; implementation not yet applied  
Target branch: `development`  
Date: 2026-11-22

## Confirmed product decision

- **SuperAdmin** is the owner account and has full access to the club platform.
- **Admin** is the operational team role and can manage daily club operations.
- **User** is a normal member/player account.

The owner has approved this distinction. This document is a design and implementation plan only. It does not grant any account a role and does not change the live database.

## Role model and boundaries

| Capability | User | Admin | SuperAdmin |
| --- | :---: | :---: | :---: |
| Member-facing pages, own profile, own bookings/orders | Yes | Yes | Yes |
| View operational dashboard | No | Yes | Yes |
| Create/edit/publish events and schedules | No | Yes | Yes |
| View/manage bookings and booking requests | Own only | Yes | Yes |
| Verify/manage operational payment status | No | Yes, with audit trail | Yes |
| Manage products, stock and orders | No | Yes | Yes |
| View member directory and operational member details | Own profile | Yes, minimum necessary | Yes |
| Manage notifications for members | Own notifications | Operational announcements | Full |
| View financial summaries and exports | No | Limited operational view | Full |
| Create, disable, and change Admin accounts | No | No | Yes |
| Assign/remove SuperAdmin | No | No | Owner-controlled only |
| Change global system/security settings | No | No | Yes |
| View audit log | No | Operational subset | Full |

Admin permissions should be granular and implemented as explicit server/database permissions, not inferred from a broad UI role check. Admin must never be able to promote themselves, another user, or change the SuperAdmin owner.

## Dashboard routes and navigation

Suggested routes:
- `/admin` — shared operational dashboard shell, protected server-side.
- `/admin/overview` — KPIs, upcoming events, pending booking requests, order queue.
- `/admin/events` — event CRUD, capacity, schedule, publish state.
- `/admin/bookings` — bookings, waitlist, check-in, booking requests.
- `/admin/orders` — store orders and fulfilment.
- `/admin/products` — catalog and stock.
- `/admin/members` — member directory and member detail.
- `/admin/payments` — payment reconciliation and exception queue.
- `/superadmin/admins` — create/disable Admin accounts and permissions; SuperAdmin only.
- `/superadmin/settings` — global settings; SuperAdmin only.
- `/superadmin/audit-log` — security-sensitive actions; SuperAdmin only.
- `/superadmin/finance` — full financial reporting; SuperAdmin only.

Non-authorized users must be denied by server-side route loaders/functions and RLS/RPC policies. Hiding navigation links is only a presentation detail, not access control.

## Database/security design

Current database enum `app_role` contains `admin` and `user`; current `user_roles` stores one role row per user in the current app model. Before migration:
1. Inspect uniqueness constraints and every policy/function that references `app_role` or `has_role`.
2. Decide whether to extend the enum with `superadmin` or replace it with a normalized permission model. Prefer a small explicit role model first; add permission granularity only where needed.
3. Make role reads available only through a safe self-role function or trusted server-side authorization. Never let a user INSERT/UPDATE/DELETE their own `user_roles` row.
4. Fix `has_role(_user_id, _role)` so ordinary authenticated callers cannot probe arbitrary UUIDs. A caller-facing helper should derive `auth.uid()` internally. Any privileged arbitrary-user role lookup must be server-only.
5. Protect SuperAdmin assignment with a one-time owner bootstrap procedure using a verified Auth user UUID, not an email string or user-editable metadata.
6. Add a last-SuperAdmin safeguard: the final SuperAdmin cannot be disabled, demoted, or deleted.
7. Record role changes and privileged actions in an append-only audit log with actor, target, action, timestamp, and relevant before/after values. Never log secrets or payment credentials.
8. Use SECURITY DEFINER only where required, with fixed `search_path`, strict caller checks, and minimal EXECUTE grants.
9. Revisit all RLS policies and SQL RPCs for events, bookings, booking requests, products, orders, profiles, notifications, and user_roles. Test user/admin/superadmin access with separate test accounts.
10. Keep service-role credentials server-only. Do not place them in `VITE_*` variables or client bundles.

## Owner bootstrap

No owner account has been assigned by this plan. Before the first SuperAdmin role is granted, the owner must provide/confirm the exact account identity and verify that the account can sign in. The bootstrap should use the Auth UUID read from the trusted Supabase dashboard or a verified server-side admin process. Never grant SuperAdmin based only on a submitted email, profile name, or user metadata.

## Delivery sequence

1. **Security foundation:** resolve project config mismatch, create a reviewed migration baseline, add role model and safe authorization helpers, add audit log, test RLS.
2. **Admin shell:** protected routes, role-aware navigation, responsive layout, overview.
3. **Operational modules:** events, bookings, booking requests, products, orders, member directory.
4. **SuperAdmin-only modules:** admin management, finance, global settings, audit log.
5. **Acceptance testing:** user vs admin vs SuperAdmin access matrix, direct URL access, RPC calls, simultaneous actions, role revocation/session refresh, and last-SuperAdmin protection.
6. **Release:** deploy Preview from `development`, test end-to-end, then open PR to `main`. No production migration or role grant without explicit review/approval.

## Current status

- Existing UI dashboard: not found in the inspected `development` branch.
- Existing database roles: `admin`, `user`; no `superadmin` role yet.
- No role changes, schema changes, production data changes, or deployment changes have been made as part of this plan.
- Xendit activation remains deferred.
