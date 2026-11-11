# Payment Service: Design and Implementation Plan

## 1. Goal

A payment service shared by multiple projects. It supports several PSPs behind one unified API, covers one-time payments and subscriptions, and lets each project expose its own combination of PSPs on its checkout page.

The deliverable is a design plus a small MVP: schema, DTOs, endpoints, and a working skeleton with a mock PSP.

## 2. Decisions

| Area                  | Decision                                                                                                                                                                                                                                     |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Language / HTTP       | TypeScript, Express (Node 20+)                                                                                                                                                                                                               |
| Monorepo              | pnpm workspaces                                                                                                                                                                                                                              |
| Database              | PostgreSQL, Drizzle ORM, `drizzle-kit` migrations                                                                                                                                                                                            |
| DB ownership          | Each app owns its own DB access. No shared db package                                                                                                                                                                                        |
| App structure         | Feature-based folders. Each feature has controller(s), service, repository, with worker and provider files optional                                                                                                                          |
| Database              | One Postgres instance, separate schemas: `payments` (payments-api), `adapter` (psp-adapter), `pgboss` (queue). Each app uses its own role limited to its schema                                                                              |
| Services              | Two: `payments-api` and `psp-adapter`. No separate webhook receiver                                                                                                                                                                          |
| Validation            | Zod, schemas shared via `contracts`, types inferred                                                                                                                                                                                          |
| Queue                 | pg-boss, behind an `EventQueue` interface                                                                                                                                                                                                    |
| PSP integration       | Standalone HTTP service (`psp-adapter`) that owns PSP credentials                                                                                                                                                                            |
| First PSP             | Generic mock adapter (v1). Stripe later                                                                                                                                                                                                      |
| Logging               | pino with correlation IDs                                                                                                                                                                                                                    |
| Config                | Env vars validated with Zod                                                                                                                                                                                                                  |
| Credential ownership  | `psp-adapter` stores PSP credentials and webhook secrets (encrypted) in its own schema. Credentials are entered through payments-api project configuration, which forwards them to the adapter in transit only and never stores or logs them |
| Credential encryption | AES-256-GCM, key from env (`CREDENTIALS_ENC_KEY`) held by psp-adapter only. Key version stored per value. KMS later                                                                                                                          |
| Money                 | Integer minor units, ISO 4217 currency                                                                                                                                                                                                       |
| Local dev             | docker-compose: postgres plus the services                                                                                                                                                                                                   |
| Tests                 | Deferred out of v1 (see section 10)                                                                                                                                                                                                          |

## 3. Architecture

```
Project backend / checkout page
        | API key
        v
+-----------------+  projectId +     +-------------------+        +-----+
| payments-api    |  providerCode    | psp-adapter       | -----> | PSP |
| (schema payments) | ---------------> | (schema adapter)  | <----- |     |
+-----------------+  unified DTOs    +-------------------+  raw   +-----+
        ^                                    |             webhook
        |                                    | publishes normalized event
        +---- consumes "webhook-events" <----+   (pg-boss)
```

### payments-api (core)

- Single owner of the business database: projects, provider config, customers, plans, payments, subscriptions, refunds, webhook log.
- Organized by feature (see section 4).
- Stores only business-side provider config (enabled, order, methods, currencies). Never persists or logs PSP secrets and holds no encryption key.
- **Project configuration:** when an admin configures a provider for a project, payments-api receives the credentials, forwards them to the adapter over the adapter's internal API, and saves only the business config. Secrets exist in payments-api memory only for the duration of that request (redacted from logs and error reports).
- Calls the adapter with `projectId`, `providerCode` and the unified DTO. The adapter resolves credentials itself.
- Workers: `webhook-events` (dedup, apply state transition on already-normalized events) and `outbound-webhooks` (signed delivery to project backends with retries).

### psp-adapter

- Owns its own schema (`adapter`, Drizzle, own migrations) containing PSP credentials and webhook secrets, encrypted with AES-256-GCM. Only the adapter holds the encryption key.
- One provider class per PSP behind a single `PaymentProvider` interface and a registry keyed by `providerCode`.
- **Outbound calls:** payments-api sends `projectId`, `providerCode` and the unified request. The adapter loads and decrypts that project's credentials, calls the PSP, and returns a unified response. Internal network only, shared service token (MVP).
- **Inbound webhooks:** receives PSP webhooks at `POST /webhooks/:providerCode/:projectId`, loads the project's webhook secret from its own DB, verifies the signature, converts the payload to the standard `NormalizedWebhookEvent` contract, publishes it to the `webhook-events` queue, and returns 200. Invalid signatures get 401 and nothing is published.
- **Credential management:** internal endpoints, called by payments-api only, to save, rotate and delete a project's credentials. Secrets are write-only and never returned.
- Maps PSP states to normalized internal statuses.
- Uses Postgres for its own tables and, via `packages/queue`, for pg-boss (restricted access to the `pgboss` schema, no migrations).

### Communication

- payments-api to psp-adapter: synchronous HTTP with timeouts and limited retries. The idempotency key is forwarded to the PSP.
- psp-adapter to payments-api: asynchronous normalized events via the queue only. No synchronous calls back.
- payments-api to project backends: outbound webhooks via the queue.

### Trade-offs

- Provider config is split: business settings live in payments-api (`project_providers`), secrets in the adapter (`provider_credentials`). They can drift (provider enabled but no credentials).
- Saving a provider config is a two-step operation: first the adapter saves the credentials, then payments-api saves `project_providers`. If step 2 fails, the credentials are orphaned but harmless, and the call can be retried (the adapter save is an idempotent upsert). The adapter returns `CREDENTIALS_NOT_FOUND` if a provider is used without credentials.
- Because secrets pass through payments-api, it must keep them out of logs, error traces and the idempotency or audit stores. Request body logging is disabled on the configuration endpoints.

## 4. Repo layout and structure

Both apps are organized **by feature**. Each feature folder holds everything for that feature, and the files are named `<feature>.<role>.ts`.

```
apps/
  payments-api/
    src/
      main.ts                           composition root, manual DI
      projects/
        projects.external-controller.ts   admin auth: create project, configure providers + credentials
        projects.service.ts
        projects.repository.ts
      checkout/
        checkout.external-controller.ts     GET /v1/checkout/providers
        checkout.service.ts
      payments/
        payments.external-controller.ts
        payments.service.ts
        payments.repository.ts
        payments.state-machine.ts
      refunds/
        refunds.external-controller.ts
        refunds.service.ts
        refunds.repository.ts
      customers/
        customers.service.ts
        customers.repository.ts
      plans/
        plans.external-controller.ts
        plans.service.ts
        plans.repository.ts
      subscriptions/
        subscriptions.external-controller.ts
        subscriptions.service.ts
        subscriptions.repository.ts
      webhook-events/
        webhook-events.worker.ts          consumes "webhook-events"
        webhook-events.service.ts         dedup, dispatch to payments/subscriptions
        webhook-events.repository.ts
      outbound-webhooks/
        outbound-webhooks.worker.ts       consumes "outbound-webhooks"
        outbound-webhooks.service.ts
        outbound-webhooks.repository.ts
      shared/
        db/                               Drizzle client, schema, migrations (schema `payments`)
        auth/                             API-key and service-token middleware
        adapter-client/                   HTTP client for psp-adapter
        errors/, logging/
  psp-adapter/
    src/
      main.ts
      payments/
        payments.internal-controller.ts
        payments.service.ts
      subscriptions/
        subscriptions.internal-controller.ts
        subscriptions.service.ts
      refunds/
        refunds.internal-controller.ts
        refunds.service.ts
      credentials/
        credentials.internal-controller.ts  save / rotate / delete / status
        credentials.service.ts
        credentials.repository.ts
      webhooks/
        webhooks.external-controller.ts       PSP signature auth: POST /webhooks/:providerCode/:projectId
        webhooks.service.ts                 verify, normalize, publish
      providers/                            PSP integration boundary
        payment-provider.ts                 interface
        provider-registry.ts
        mock/
        stripe/                             later
      shared/
        db/                                 Drizzle client, schema, migrations (schema `adapter`)
        crypto/                             AES-256-GCM with key versioning
        auth/, errors/, logging/
packages/
  contracts/           Zod schemas, DTO and event types, EventQueue interface
  queue/               PgBossQueue, InMemoryQueue, factory
  config/              env validation helpers
docs/
  PLAN.md
docker-compose.yml
```

File roles:

- **`*.external-controller.ts`:** endpoints called from outside the system: project backends, operators and PSPs. Reachable from outside the network, so every route must authenticate its caller. The auth scheme is declared per route group by middleware:
  - project backends: API key
  - operators (project and plan configuration): admin token
  - PSP webhooks: signature verification
- **`*.internal-controller.ts`:** endpoints for service-to-service calls only (payments-api calling psp-adapter). Service-token auth, on the internal network, never routed publicly.

Naming note: `external` / `internal` describes the network boundary, which is what decides exposure and auth. `public` was avoided because it suggests unauthenticated access. Controllers are not split further by caller type. If an app later grows many admin-only endpoints, an `*.admin-controller.ts` can be added.

- **`*.service.ts`:** business logic and orchestration. Calls its own repository and other features' services. No Express or Drizzle types.
- **`*.repository.ts`:** the only place that runs queries for that feature's tables. Returns plain domain objects.
- **`*.worker.ts`:** queue consumer, thin, delegates to the service.
- Controllers only parse and validate input (Zod from `contracts`), call one service method, and map the response. No business logic, no DB access.

Rules:

- A feature owns its tables. Other features go through its service, never its repository.
- Dependencies point inward: controller to service to repository or provider. Wiring is manual constructor injection in `main.ts`.
- Cross-feature calls are service to service. If two features start depending on each other in both directions, extract the shared logic or use an event.
- `shared/` holds only technical infrastructure, no business logic.
- Features without a DB table (`checkout`, adapter `payments`) have no repository.
- Apps never import from each other, only from `packages/*`.
- `packages/*` contain no DB schema and no business logic. `contracts` is types and Zod only.
- Each app manages its own connection, schema, and migrations. Neither reads the other's tables.

## 5. Queue design (pg-boss, replaceable)

The interface lives in `packages/contracts`. Only `packages/queue` imports pg-boss.

```ts
export type QueueName = 'webhook-events' | 'outbound-webhooks';

export interface PublishOptions {
  dedupKey?: string;
  delaySeconds?: number;
  retryLimit?: number;
  retryBackoff?: boolean;
}
export interface QueueMessage<T> {
  id: string;
  data: T;
  attempt: number;
}

export interface EventQueue {
  publish<T>(queue: QueueName, payload: T, opts?: PublishOptions): Promise<string | null>;
  subscribe<T>(
    queue: QueueName,
    handler: (msg: QueueMessage<T>) => Promise<void>,
    opts?: SubscribeOptions,
  ): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
}
```

- Both apps use the interface: psp-adapter publishes, payments-api subscribes.
- A factory picks the driver by `QUEUE_DRIVER=pgboss|memory`. Business code only sees `EventQueue`.
- Delivery is at-least-once, so every handler must be idempotent. This holds for any future driver (SQS, BullMQ).
- Retry options are generic, not pg-boss-specific. Payloads are plain JSON validated with Zod.
- Transactional publish is not exposed in the interface. Idempotency relies on job dedup keys plus DB unique constraints.
- pg-boss lives in its own `pgboss` schema, so it does not collide with Drizzle migrations. Only payments-api runs pg-boss schema setup. The adapter connects with a restricted role and does not migrate.
- Whether the adapter and payments-api share one Postgres instance or the queue gets its own database is a deployment choice. Config is just a connection string.

## 6. Database schema

### Schema `payments` (owned by payments-api)

| Table                    | Key columns                                                                                                                                                                    | Purpose                                                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `projects`               | id, name, api_key_hash, webhook_url, webhook_secret                                                                                                                            | A consumer of the service                                                                                         |
| `providers`              | id, code, name, is_active                                                                                                                                                      | Catalog of supported PSPs                                                                                         |
| `project_providers`      | id, project_id, provider_id, is_enabled, sort_order, supported_methods, currencies                                                                                             | Per-project PSP combination (business config only, no secrets). Drives checkout. Unique (project_id, provider_id) |
| `customers`              | id, project_id, external_ref, email                                                                                                                                            | Our identity of the project's end user. Unique (project_id, external_ref)                                         |
| `provider_customers`     | id, customer_id, provider_id, provider_customer_id                                                                                                                             | The same person's ID inside a PSP. Indexed on (provider_id, provider_customer_id) for webhook lookups             |
| `plans`                  | id, project_id, code, name, amount, currency, interval, interval_count, trial_days                                                                                             | Catalog template                                                                                                  |
| `plan_provider_mappings` | plan_id, provider_id, provider_price_id                                                                                                                                        | PSP-side price or plan IDs                                                                                        |
| `subscriptions`          | id, project_id, customer_id, plan_id, provider_id, provider_subscription_id, status, amount and currency snapshot, current_period_start/end, cancel_at_period_end, canceled_at | A customer's instance of a plan, with its own lifecycle                                                           |
| `payments`               | id, project_id, customer_id, provider_id, subscription_id (nullable), amount, currency, status, provider_payment_id, idempotency_key, metadata JSONB, created_at               | One-time and recurring charges. Unique (project_id, idempotency_key)                                              |
| `refunds`                | id, payment_id, amount, status, provider_refund_id, reason                                                                                                                     | Refunds                                                                                                           |
| `webhook_events`         | id, provider_id, provider_event_id, payload, status, received_at, processed_at, error                                                                                          | Inbound log. Unique (provider_id, provider_event_id) gives dedup                                                  |
| `outbound_webhooks`      | id, project_id, event_type, payload, status, attempts, last_error, delivered_at                                                                                                | Delivery log. pg-boss handles retries                                                                             |

### Schema `adapter` (owned by psp-adapter)

| Table                  | Key columns                                                                                                             | Purpose                                                                                               |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `provider_credentials` | id, project_id, provider_code, credentials (encrypted), webhook_secret (encrypted), key_version, created_at, rotated_at | Per-project PSP secrets. Unique (project_id, provider_code). Written only via the credentials feature |

`project_id` and `provider_code` are plain identifiers, not foreign keys, because the tables belong to different apps and schemas. Each app's DB role can only access its own schema.

Relationships:

- project 1..N project_providers N..1 providers
- project 1..N customers, plans, subscriptions, payments
- customer 1..N provider_customers
- plan 1..N subscriptions, plan 1..N plan_provider_mappings
- subscription 1..N payments (each renewal is a payment)
- payment 1..N refunds

Notes:

- `customers` vs `provider_customers`: our identity vs the PSP-side identity. One customer can exist in several PSPs.
- `plans` vs `subscriptions`: catalog template vs an instance with its own lifecycle. Subscriptions snapshot price terms at creation.
- An ER diagram in Mermaid will be added to the README.

## 7. One-time vs subscription

Both use the same adapter layer and the same `payments` table.

- **One-time:** create payment, the adapter returns an action (`redirect` or `client_secret`), and the webhook moves the status.
- **Subscription:** create from a plan and provider, which also returns an action. Renewal webhooks create new `payments` rows linked via `subscription_id` and update period dates. Cancel is immediate or at period end.
- Webhooks are the source of truth for status. Return URLs are only hints.

Normalized statuses: `pending`, `requires_action`, `succeeded`, `failed`, `canceled`, `refunded`. Transitions are guarded by a state machine.

## 8. Per-project PSP combinations

`GET /v1/checkout/providers?currency=EUR&amount=1000` is authenticated by project API key. It reads `project_providers` where enabled, filters by currency and amount, and returns the ordered list of providers and methods. The checkout page renders only those. The adapter resolves credentials per project at call time.

## 9. MVP API

### payments-api external (project backends, API key)

```
GET    /v1/checkout/providers
POST   /v1/payments                   (Idempotency-Key header required)
GET    /v1/payments/:id
POST   /v1/payments/:id/refunds
POST   /v1/subscriptions              (Idempotency-Key header required)
GET    /v1/subscriptions/:id
POST   /v1/subscriptions/:id/cancel
```

### psp-adapter (internal, service token)

```
POST   /v1/:providerCode/payments            (body includes projectId)
POST   /v1/:providerCode/subscriptions
POST   /v1/:providerCode/subscriptions/:id/cancel
POST   /v1/:providerCode/payments/:providerPaymentId/refunds
```

### psp-adapter external: inbound webhooks (called by PSPs, signature auth)

```
POST   /webhooks/:providerCode/:projectId
```

### payments-api external: configuration (operators, admin token)

```
POST   /v1/admin/projects
PUT    /v1/admin/projects/:projectId/providers/:providerCode
         body: { isEnabled, sortOrder, supportedMethods, currencies,
                 credentials, webhookSecret }   (credentials forwarded to the adapter, not stored)
DELETE /v1/admin/projects/:projectId/providers/:providerCode
POST   /v1/admin/projects/:projectId/plans
```

### psp-adapter credential management (internal, service token, called by payments-api only)

```
PUT    /internal/projects/:projectId/providers/:providerCode/credentials   (idempotent upsert)
DELETE /internal/projects/:projectId/providers/:providerCode/credentials
GET    /internal/projects/:projectId/providers/:providerCode/credentials/status   (exists: true/false, never the secret)
```

### Core DTOs (Zod in `contracts`, types inferred)

```ts
CreatePaymentDto {
  providerCode: string;
  amount: number;              // minor units
  currency: string;
  customer: { externalRef: string; email?: string };
  returnUrl: string;
  metadata?: Record<string, string>;
}

CreateSubscriptionDto {
  providerCode: string;
  planCode: string;
  customer: { externalRef: string; email?: string };
  returnUrl: string;
  trialDays?: number;
}

PaymentResponseDto {
  id: string;
  status: 'pending' | 'requires_action' | 'succeeded' | 'failed' | 'canceled' | 'refunded';
  amount: number;
  currency: string;
  providerCode: string;
  action?: { type: 'redirect' | 'client_secret'; url?: string; clientSecret?: string };
}
```

Adapter requests and responses, `NormalizedWebhookEvent` (type, providerEventId, providerObjectId, normalized status, amount, raw reference), the `webhook-events` queue payload, and queue payloads are also Zod schemas in `contracts`.

## 10. Scope

### Essential for v1

- Project API-key auth (hashed keys) and per-project isolation
- Idempotency keys on create endpoints
- Webhook signature verification (in the adapter), dedup (in payments-api), and retry-safe processing
- Status state machine with guarded transitions
- Outbound webhooks to projects (signed, with retries)
- Encrypted PSP credentials, stored and decrypted only in psp-adapter. Secrets forwarded through payments-api are never persisted or logged there
- Refunds (full and partial)
- Structured logging with correlation IDs, and an event log
- No card data stored (PCI scope stays with the PSP's hosted fields)
- Basic reconciliation job for stale pending payments

### Deferred (nice to have)

- **Automated tests** (adapter contract tests, webhook replay, idempotency, state transitions). Deliberately deferred from v1.
- Stripe adapter (first real PSP after the mock)
- Smart routing and failover between PSPs
- Dunning and retry for failed renewals
- Plan changes with proration, coupons
- Multi-currency and FX, tax/VAT, invoices and receipts
- Saved payment methods and one-click checkout
- Admin dashboard, analytics
- Fraud rules, 3DS tuning, disputes and chargebacks
- Per-project rate limiting, sandbox mode
- Extract inbound webhook handling into a standalone service or Lambda, and swap pg-boss for SQS or another broker at that point
- KMS-based credential encryption and key rotation tooling
- Ledger and double-entry accounting, payouts
- Webhook replay UI, daily reconciliation reports

## 11. Implementation order

1. Monorepo scaffold (pnpm workspaces, tsconfig, lint), `packages/config`, docker-compose with Postgres
2. `packages/contracts`: DTOs, adapter contract, `NormalizedWebhookEvent`, `EventQueue` interface
3. `packages/queue`: `PgBossQueue`, `InMemoryQueue`, factory
4. `apps/payments-api` shared db and the `projects`, `customers`, `plans` features: Drizzle schema, initial migration, seed for a project and mock provider
5. `apps/psp-adapter`: Drizzle schema for `provider_credentials`, crypto helper, `credentials` feature, `PaymentProvider` interface, registry, mock provider, `payments`, `subscriptions`, `refunds` features
6. `apps/payments-api`: `payments` feature (controller, service, repository, adapter client), idempotency, state machine, provider configuration flow in `projects`
7. Inbound webhooks: adapter `webhooks` feature (verify, normalize, publish), payments-api `webhook-events` feature (dedup, transition)
8. `subscriptions` feature and `checkout` feature
9. `outbound-webhooks` feature

## 12. Open questions for discussion

- Is the service the merchant of record, or do projects bring their own PSP accounts? Assumed the latter (credentials per project).
- Which PSPs and regions come after Stripe? Dont worry about it
- Should the service host the checkout page, or only provide the API? Api for v1, hosted checkout later
- Who calls the payments-api `/v1/admin` endpoints (an admin UI, a script, another service) and how are operators authenticated beyond a static admin token? Will have a separate admin UI, will need to implement a proper auth scheme later
