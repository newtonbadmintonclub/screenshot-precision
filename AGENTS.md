<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules (Newton BC hub)

- Booking, cancel/swap and store orders go through SECURITY DEFINER RPCs (`book_event`, `request_booking_change`, `place_order`); clients have no direct write grants on those tables — keeps quota checks atomic and prices server-side.
- Public schedule/store reads use publishable-key server functions in `src/lib/public.functions.ts` so loaders can SSR them; signed-in pages live under `src/routes/_authenticated/`.
- Ticket status rules live in `src/lib/booking-status.ts` and mirror the SQL quota logic; change both together.
- QRIS: `startQrisPayment` creates a Xendit QR via the connector gateway (`src/lib/xendit.server.ts`); `/api/public/xendit-webhook` verifies `x-callback-token` and calls `confirm_qris_payment` with the service role.
- Club contacts, copy helpers and the optional transfer account live in `src/lib/brand.ts` — single source for contact data.
