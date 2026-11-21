# Supabase direct connection setup

This application is configured to use the Newton Badminton Club Supabase project directly.

## Public build/runtime configuration

The repository `.env` contains only the Supabase project URL, project reference, and publishable key. A Supabase publishable key is intended for browser use; access control must be enforced by Row Level Security.

- `SUPABASE_URL` / `VITE_SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_PROJECT_ID` / `VITE_SUPABASE_PROJECT_ID`

For deployments that do not load the repository `.env`, configure the same public values in the hosting environment.

## Required server-only secrets

Never commit these values or expose them through a `VITE_*` variable:

- `SUPABASE_SERVICE_ROLE_KEY`: required by the server-only Supabase admin client for QRIS record updates and the payment webhook.
- `XENDIT_SECRET_KEY`: Xendit secret API key used by the server-only QRIS creation endpoint.
- `XENDIT_CALLBACK_TOKEN`: expected value of Xendit's `x-callback-token` webhook header.

The app intentionally does not contain or commit these secrets. Configure them in the deployment platform's encrypted environment/secrets settings.

## Supabase Auth setup

1. In Supabase Dashboard → Authentication → Providers, enable Google and enter the Google OAuth client ID and client secret.
2. In Authentication → URL Configuration, set the production Site URL and add the deployed app's `/auth` callback URL to the allowed redirect URLs (also add localhost URLs for local development).
3. Ensure the Google OAuth consent screen and Google Cloud OAuth redirect URI include the Supabase Auth callback URL shown by the Supabase dashboard.

Email/password registration and password reset use Supabase Auth directly.

## Xendit setup

1. Configure `XENDIT_SECRET_KEY` as a server-only secret.
2. Configure `XENDIT_CALLBACK_TOKEN` as a server-only secret and set the same value in Xendit's webhook configuration.
3. Point the Xendit QR payment callback to `https://YOUR_APP_HOST/api/public/xendit-webhook`.
4. Test QR creation and a sandbox payment before enabling live credentials.

The webhook uses the Supabase `confirm_qris_payment` RPC through the server-only service-role client. Never make that key available to browser code.
