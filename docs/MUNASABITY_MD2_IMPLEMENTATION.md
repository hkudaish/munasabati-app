# MunasabityMD2 implementation status — 17 October 2026

The supplied document is a product specification covering six delivery phases and twenty requirement areas. This change implements the critical order-management foundation in the existing Next.js/Prisma modular monolith. It does **not** complete the entire commercial platform.

## Existing implementation retained

- Arabic RTL interface, service discovery, vendor/service detail pages, account registration and server sessions.
- Invitation design library, saved drafts, private guest lists, RSVP, unique invitation tokens, QR check-in, channel configuration.
- System administrator access, supplier review, feature switches, country/city/category coverage and read-only geographic previews.
- Existing planning, package, RFQ, wallet and entertainment screens remain; their presence does not mean every workflow has production persistence or a configured external integration.

## Implemented in this change

- Service detail requests now use the same cart/checkout flow; simulated direct payment is removed. Empty package/add-on catalogs no longer fabricate discounted tiers or extras.
- Customer checkout now calls the actual server rather than creating confirmed bookings inside browser storage.
- PostgreSQL persists the parent order, independent supplier suborders, price snapshots, creation events, in-app notification records and idempotency record in one serializable transaction.
- Prices come from active catalog services, their packages and enabled add-ons. Browser prices, supplier identifiers, customer identifiers, roles and discounts cannot authorize or price an order.
- Quantity, package ownership, duplicate add-ons, amount bounds, future dates, time format, city coverage, blackout dates, working days and booking notice ranges are checked on the server.
- Requests start as unpaid and awaiting supplier review. Supplier acceptance reserves the time but does not imply payment or a confirmed booking.
- Account-scoped idempotency keys prevent repeated checkout after retries. Changed requests cannot reuse the same key. Keys survive a reload in session storage; operational orders do not live in browser storage.
- Customers can access their orders; suppliers see only their own suborders, prices and event records. Administrators can inspect the order workspace. Actor identity always comes from the server session.
- Allowed state transitions, payment prerequisites, HTTPS delivery links and required delivery proof are checked on the server. Transition, audit event, parent summary and in-app notification record commit atomically.
- Supplier acceptance uses a transaction lock and overlapping execution intervals, including overnight intervals. Simultaneous accepts cannot reserve the same supplier twice. Unpaid reservations can be cancelled to free capacity.
- New parent and booking identifiers use UUIDs. A failed supplier does not overwrite or discard the other suppliers' progress.
- Order lists and tracking use persisted records, with loading, empty and error states. Tracking remains accessible when new checkout is disabled.
- Administrator automation settings persist with validation and audit records. The manually triggered watchdog persists risk flags and deduplicated overdue exceptions without overwriting workflow states.
- Browser-only booking/payment/refund/payout mutations no longer report financial success. Generic payment-signature verification fails closed until a real provider adapter exists.
- A one-time private browser backup retains legacy browser-only bookings under `munasabati_legacy_commerce_backup_v1`. These are not silently imported as real paid orders.

## Database migration

`netlify/database/migrations/202610170004_safe_commerce_defaults.sql` is an additive, transactional upgrade. Netlify owns the deployment transaction; this migration has no top-level transaction control. A standalone SQL file with explicit transaction control is available at `prisma/sql/20261017-commerce-compatibility.sql` for older local installations.

The localhost database was older than the checked-in Prisma schema: it lacked the OMS enums, workflow columns, settings, events, notification logs, exceptions and idempotency table. The migration adds these without deleting records or modifying existing order amounts or legacy booking statuses. Existing completed/cancelled/preparing suborders retain equivalent workflow states; legacy confirmed suborders become accepted reservations. Newly introduced payment state remains **UNPAID** until actual gateway records are reconciled. No migration can establish historical payment evidence.

The migration also changes defaults for future records and adds customer-history, scheduling and supplier-workflow indexes. It can be applied repeatedly. Existing cloud deployments already created from the initial Netlify migration skip objects that already exist.

Run locally against the intended database:

```bash
npx prisma db execute --file prisma/sql/20261017-commerce-compatibility.sql --schema prisma/schema.prisma
npm run dev
```

For a new empty database, follow the existing README setup (`prisma db push` and the seed script). Do not replay the initial Netlify CREATE TABLE migration over an existing local database.

## Order API

All endpoints require a valid session, return `Cache-Control: no-store`, and reject unauthorized account access. Writes reject cross-site origins and coverage previews. Creation and transitions have account-based rate limits. Validation errors return 400, unauthenticated calls 401, denied actions 403, missing/inaccessible orders 404, conflicts 409, illegal transitions 422, and unavailable persistence 503.

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/api/oms/orders` | Latest 200 orders in the caller's account scope; supplier responses contain only that supplier's values |
| GET | `/api/oms/orders/{id}` | Owned order by ID, order number or suborder identifier, plus latest 100 scoped audit events |
| POST | `/api/oms/orders` | Atomic, retry-safe unpaid order creation; requires `idempotencyKey`, `items`, `customerInfo` |
| POST | `/api/oms/orders/transition` | Validated update by `suborderId`, `targetState`, optional `noteAr`, `deliverablesUrl`, `proofOfDelivery`; ignores caller-supplied roles/actor IDs |
| GET/POST | `/api/oms/settings` | Administrator read/update of durable automation settings |
| GET | `/api/oms/watchdog` | Administrator list of latest 200 unresolved order exceptions |
| POST | `/api/oms/watchdog` | Administrator-triggered durable risk/overdue scan |

Example creation body:

```json
{
  "idempotencyKey": "a-stable-random-key-for-this-checkout",
  "items": [
    { "serviceId": "catalog-service-id", "packageId": "catalog-package-id", "quantity": 1, "addons": [] }
  ],
  "customerInfo": {
    "customerName": "اسم العميل",
    "customerPhone": "0501234567",
    "cityId": "riyadh",
    "eventDate": "2027-01-20",
    "eventTime": "18:00",
    "venueName": "اسم الموقع",
    "paymentMethod": "mada",
    "isDepositOnly": true
  }
}
```

Prices are whole SAR, with the existing 15% tax and 30% deposit convention. Selecting a payment preference does not initiate or confirm payment. Fixed-price packages and fixed/unit add-ons are supported; starting-price services without a fixed package, ambiguous per-person services, hourly/person add-ons and coupons are rejected rather than silently mispriced. The scheduling timezone is Asia/Riyadh.

## Verification

```bash
npm run test:commerce-rules
npm run test:commerce-migration
npm run test:commerce
npm run test:invitations
npm run test:geo-engine
npm run lint
npx tsc --noEmit --incremental false
npm run build
```

Commerce integration and migration tests create randomly named disposable PostgreSQL schemas and remove only those schemas. The integration test starts a separate local server on port 3104. They never send external messages, charge cards, reset the application schema or edit real customer records.

Covered cases: authoritative prices and tax, malformed quantities/packages/add-ons, invalid dates, overnight overlap, concurrent duplicate checkout, transaction rollback, account isolation, supplier isolation, forged roles, unpaid workflow blocking, supplier conflicts (including concurrent acceptance), sibling independence, required delivery evidence, customer acceptance, cancellation and release of reservations, historical upgrade preservation, repeatable migration, durable audit/in-app records, deduplicated overdue exceptions, and access to history after new checkout is disabled.

The commerce rules, legacy migration, real HTTP/database integration, invitation and geographic rule suites passed during implementation. Type checking and the production build passed. Lint completed with existing image-optimization and unrelated reception-screen hook warnings. HTTP smoke checks returned 200 for the home page, checkout, bookings and database health, and 401 for anonymous order access.

## Remaining specification work

| Phase / area | Remaining work |
| --- | --- |
| A — operational foundation | Full dynamic category CRUD/hierarchy/custom fields; persisted vendor product/service editing; inventory; vendor staff and fine-grained permissions; broader admin reporting |
| B — invitations and cards | End-to-end paper printing workflow (sizes, materials, quantities, proof approval, production and delivery); scheduled no-response reminders; Excel import beyond existing CSV support |
| C — bookings and audio | Editable licensed audio catalog/artists, audio samples, custom name recordings, revision/delivery workflow; full venue capacity/availability calendar and booking quote negotiation |
| D — smart occasions and packages | Persist planning tasks, budget, RFQs and curated multi-vendor package definitions; recommendations strictly based on real catalog/availability data; editable assistant identity |
| E — commercial operations | Gateway adapter and signed raw-body webhooks, payment attempts, partial payments, refunds, payouts, commissions, subscriptions, coupons and actual tax invoicing |
| Notifications | Queue/worker, leased jobs, retries, dead-letter queue, automatic scheduler, channel preferences and external order notification delivery. Current in-app records are durable; watchdog runs manually |
| Flowers and B2B | Retail product variants and stock, delivery scheduling, wholesale eligibility, minimum quantities, volume pricing and supply orders |
| Support and reviews | Persisted tickets, disputes/resolution tools, refund requests and moderation; verify reviews against completed purchases |
| Media | Object storage, signed private download URLs, upload validation/limits, scanning, thumbnails/transcoding, cleanup and licensing verification |
| F — production readiness | Load and browser/device tests, full-text search, dynamic SEO/sitemap/structured data, monitoring, backup/restore drill, privacy/retention workflows, deployment infrastructure |

External setup still needed: an approved payment provider and credentials/webhook secret; object storage credentials; licensed audio assets and rights; official email/SMS/WhatsApp channel setup; Google OAuth credentials if enabled; scheduler/queue infrastructure; production monitoring and backup policy. None are provisioned or represented as successful by this change.

Execution overlap uses the longer of the catalog service duration and selected package duration. Duration snapshots and reconciliation after future catalog-duration edits remain necessary when vendor catalog editing is implemented. Capacity is deliberately conservative: one accepted overlapping reservation per supplier, even across different services. Existing slot capacity values and legacy human-readable time-slot labels are not yet a full interval-capacity scheduler. Cancellation of paid orders remains blocked until an auditable refund integration exists. Local browser planning, wallet, promotion and content prototypes elsewhere in the app still need migration to durable workflows; this change does not certify those as production features.
