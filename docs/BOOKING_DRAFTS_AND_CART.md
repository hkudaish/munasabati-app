# Booking drafts, persistent cart, price tracking and notifications

Delivery report for the "enterprise booking, cart and notification" prompt. It states what was **built and tested**, what was **deliberately not built** (and why), and what is **outstanding**. Nothing here is claimed unless a test or a browser run covers it.

## 1. Findings: what the application already had

The application is Next.js 14 + PostgreSQL (Prisma schema, raw SQL for the commerce modules). The prompt's reference stack (NestJS, Redis, BullMQ) was **not introduced**: the rules of the prompt itself say to keep the existing stack unless a capability is missing, and the host (Netlify) cannot run long-lived workers.

Already present and reused as is:

| Requirement | Existing component |
|---|---|
| Service → offer → package separation, versioned offers/packages | `CommerceService`, `CommerceOffer(+Version)`, `CommercePackage(+Item/Version)` |
| Persistent cart, optimistic concurrency | `CommerceCart` (one row per customer, `version`) |
| Server-side pricing and a quote hash | `quoteLines()` in `commerce-v2/cart.ts` |
| Availability, geography, capacity, holds | availability engine (`assertBookable`, `decideOffering`), advisory locks, `CommerceBooking` holds |
| Idempotent checkout, orders, fulfilment | `checkout()`, `CommerceOrder(+Item)`, `CommerceFulfillmentGroup`, `CommerceBooking` |
| Payments | manual, two-person verified finance entries (`finance.ts`) — **there is no payment gateway** |
| Audit, roles, rate limiting | `SystemAuditLog`, `requireAdmin`, `rateLimit` |
| Scheduled jobs | `netlify/functions/backup-schedule.mjs` pattern (shared secret) |

## 2. What was added

### Database (`netlify/database/migrations/202610230001_booking_drafts_and_cart_notifications.sql`, mirrored in `prisma/sql/` and `schema.prisma`)
Additive and idempotent; ids are TEXT like every other table here (not UUID type).

| Table | Purpose | Key guarantees |
|---|---|---|
| `BookingDraft` | A customer's (or guest's) unfinished booking | exactly one owner (CHECK userId XOR guestTokenHash); `version >= 0`; status CHECK; unique `cartLineId` |
| `BookingSnapshot` | Immutable versioned configuration | UNIQUE(draftId, versionNumber); composite FK so `previousSnapshotId` and `BookingDraft.latestSnapshotId` must belong to the **same draft**; UPDATE/DELETE blocked by trigger |
| `CartPriceSnapshot` | Price history per cart item | append-only trigger |
| `CartPriceChange` | Increase/decrease events | FKs to both snapshots, `acknowledgedAt` |
| `DomainOutbox` | Transactional outbox | status PENDING/DONE/DEAD, retry count, lease |
| `NotificationJob`, `NotificationAttempt` | Jobs and delivery attempts | unique `dedupKey`; status CHECK |
| `NotificationPreference` | Consent per channel | inbox on by default, email only after opt-in |
| `CartNotificationSetting` | Administrator settings (stages, grouping window, channels, template overrides) | versioned |
| `CommerceCart` + `lastActivityAt`, `locale` | Reminder timing and language | — |

ERD (cardinalities): `User 1—N BookingDraft`; `BookingDraft 1—N BookingSnapshot` (each snapshot → 1 draft, ≤1 previous); `BookingDraft N—0..1 CartLine` (line id = draft id, inside `CommerceCart.body.lines`); `User 1—N CartPriceSnapshot`; `CartPriceChange N—1 previous snapshot`, `1—1 new snapshot`; `DomainOutbox 1—N NotificationJob`; `NotificationJob 1—N NotificationAttempt`.

### Behaviour
- **Drafts** (`commerce-v2/drafts.ts`): create/resume, autosave as a new snapshot with `expectedVersion` (stale save → 409 with the newer state; nothing overwritten; identical save → no new version), history, restore (writes a *new* version), validation against the real rules (coverage, availability, capacity, price), guest drafts via an httpOnly token that **merge into the account on sign-in**.
- **Dependency handling**: each field lists what depends on it (`DEPENDENTS`); a change re-checks only those, and only options/choices bound to the old offer/package are cleared (`BOUND_TO`). Changing city keeps notes, guests, date, options.
- **Cart**: add-to-cart binds the cart item to the exact saved snapshot (transaction B); editing a draft already in the cart updates the cart item only if the result is purchasable; **saved for later** keeps the choices exactly, is not priced into the total, is shown with its own price/unavailability, and survives checkout.
- **Prices**: every cart open and every checkout (plus a 15-minute job) compares current prices with the last shown; a change writes an immutable snapshot and an event. An **increase blocks checkout until the customer acknowledges it**; a decrease applies at once. Confirmed orders keep their own snapshot (unchanged behaviour).
- **Notifications**: outbox → jobs → in-app inbox (always) and email (opt-in, provider via `NOTIFY_EMAIL_API_KEY` / `NOTIFY_EMAIL_FROM`, otherwise skipped). Price changes in the same window are grouped into one message; replays add nothing; every job is **re-checked at send time** (customer returned, cart emptied, change acknowledged, consent withdrawn → skipped); failures retry with backoff and are parked as DEAD; a failed delivery never touches cart or booking data. Reminder stages default to 24 h and 72 h, optional final stage, all configurable. Text is Arabic or English according to the language of the customer's last cart activity.
- **Admin**: `/admin/booking-insights` and the `/api/admin/*` endpoints (analytics with filters by city/service/vendor/date, abandoned carts, price-change events, notification settings, jobs). Cart and draft values are reported separately from sales.
- **Customer**: cart page shows price-change notices with acknowledgement and price history, saved-for-later, unfinished bookings, recent messages and the email consent switch; the add-to-cart dialog autosaves with a visible status and resumes from `?draft=`. English included.

### API (mapped to the prompt's contracts)
`/api/booking-drafts` (POST, GET), `/:id` (GET, PATCH), `/:id/validate`, `/:id/restore`, `/:id/history`, `/:id/add-to-cart`; `/api/cart/items/:id/save-for-later|restore|price-history|acknowledge-price`; `/api/pricing/quote`; `/api/notifications/preferences`; `/api/admin/booking-analytics|abandoned-carts|price-change-events|notification-settings|notification-jobs`; `/api/internal/notifications-cron` (shared secret). The cart itself stays at `/api/commerce/cart` (existing contract and clients).

### State machines
Draft: `IN_PROGRESS → IN_CART → PURCHASED`; `IN_CART → IN_PROGRESS` when the item leaves the cart; `IN_PROGRESS → EXPIRED` (retention 90 days signed in / 30 days guest; history kept). Cart item: active ⇄ saved-for-later; purchased items leave the cart.
Notification job: `PENDING → SENT | SKIPPED(reason) | PENDING(retry, backoff) → DEAD (after 5)`. Outbox event: `PENDING → DONE | DEAD`.

## 3. Deliberately not built (and why)
- **NestJS, BullMQ, Redis, a separate worker**: not available on the host and not needed; the scheduled function + outbox provides the same at-least-once, idempotent processing.
- **`checkout_sessions`, `checkout_items`, `orders/order_items`, `bookings`, `payment_transactions` as new tables**: they would duplicate `CommerceOrder`, `CommerceOrderItem`, `CommerceBooking` and the finance entries, which already provide idempotency keys, quote-hash validation and capacity holds. The prompt forbids parallel booking systems.
- **Payment gateway, webhooks, provider reconciliation**: no gateway exists in the application; payments remain manual and two-person verified. Gateway integration is a separate project (contract, compliance).
- **New `services`/`sub_services`/`packages` tables**: existing catalogue tables are reused.
- **SMS/WhatsApp notifications**: only in-app and email. The existing channel code is per-user and invitation-specific.
- **Multi-step wizard UI**: the add-to-cart dialog is still one form. The step list per service kind is available from the API (`steps`, `currentStep`) so a wizard can be built on it.
- **`/api/availability/resolve`, `/api/checkout/sessions`**: not added (availability is enforced inside the quote/checkout; the existing `/api/commerce/orders` is the checkout).
- **OpenTelemetry/Pino, OpenAPI document**: not added.
- **Price-change grouping of *different* customers' events, quiet hours, per-channel templates in the database**: templates are defaults with administrator overrides in settings.

## 4. Operations
- Migration: applied by Netlify from `netlify/database/migrations`; rollback = drop the new tables and the two `CommerceCart` columns (nothing else was altered); the application tolerates their absence only before deployment of this release.
- The scheduled function `notifications-schedule.mjs` runs every 15 minutes and reuses `BACKUP_CRON_TOKEN` (optional `NOTIFICATIONS_CRON_TOKEN`). Without a token it does nothing.
- Email needs `NOTIFY_EMAIL_API_KEY` and `NOTIFY_EMAIL_FROM`; without them email jobs are skipped and the in-app inbox still works.
- Dead letters are visible on the administrator page (counts and the jobs table).

## 5. Tests
`npm run test:booking-drafts` (11 groups, isolated schema + mock mail provider): database guarantees, versions and conflicts, six-way concurrent save, guest merge, add-to-cart binding, saved-for-later and checkout, price history and acknowledgement, grouping, replays, re-checks at send time, reminder stages and language, consent, retry and dead-lettering, admin RBAC/filters/audit, expiry. Browser run (`drafts-ui`): autosave status, resume by `?draft=`, add, save for later and back (Arabic and English), price-change notice with checkout disabled until acknowledged, administrator page, customer denied.
