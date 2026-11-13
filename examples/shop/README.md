# Test shop

Minimal Next.js + Tailwind + TypeScript app that takes payments through the payments service using the `mock` provider.

## Run

1. From the repo root: `pnpm run prep` once (env files, install, postgres, migrations, seed), then `pnpm run dev` (payments-api :3000, psp-adapter :3001, admin-ui, and this shop on :3002).
2. `prep` writes the seeded project's API key to `examples/shop/.env.local` as `PAYMENTS_API_KEY`. Open http://localhost:3002.

## Flow

- `POST /api/pay` (server) calls `POST /v1/payments` with the API key and an `Idempotency-Key`, then returns the redirect URL.
- The mock PSP redirects back to `/return?mock_object=...&payment_id=...`.
- `/return` polls `GET /api/payments/:id` until the status is final. The API key never reaches the browser.

## Subscriptions

- `POST /api/subscribe` calls `POST /v1/subscriptions` for the seeded `basic-monthly` plan and returns the redirect URL.
- The mock PSP redirects to `/subscription?mock_object=...&subscription_id=...`, which polls `GET /api/subscriptions/:id` while the status is `pending` and offers cancel (at period end or immediately) via `POST /api/subscriptions/:id/cancel`.
