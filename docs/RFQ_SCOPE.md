# RFQ (request for quotes): scope

**Status:** scoped and decided; ready to start phase 1. Nothing built yet. Effort figures are my estimates, not measurements.

## Where things stand
- `/rfq` is a browser-only demo. Requests, quotes and vendors live in client state (`store.rfqRequests`,
  seeded from `INITIAL_RFQS`); there is no API route, table or vendor-side screen.
- Accepting a quote only flips local state. It now confirms and opens `/commerce`, because checkout takes
  only server-priced offers and packages and must never trust a price sent by the browser.
- The server already has most of what an RFQ needs, for a single service:
  - `ServiceRequest` with the statuses `REQUESTED → AVAILABILITY_PENDING → QUOTE_PENDING →
    CUSTOMER_APPROVAL_PENDING → … → CONFIRMED` (see `docs/CONFIGURABLE_BOOKINGS.md`), idempotent creation,
    availability and conflict checks, an event log, a notification inbox, and halala-integer money.
  - `CommerceOffer` / `CommerceOfferVersion`: versioned, vendor-owned, server-priced offers that checkout,
    orders, bookings and settlements already understand.
  - A feature flag (`rfq`) and geography gating (`feature:rfq` per city).

## Goal
A customer describes one need (occasion, city, date, guests, budget, requirements); selected vendors send
priced quotes; the customer compares and accepts one; the accepted quote proceeds through the existing
checkout, order, booking and settlement path with the vendor-issued price.

## Recommended design: quotes become private offers
A vendor quote is data written by an authorized vendor, so it can be trusted the way any offer is. Accepting
it must not create a parallel order system.

1. **`Rfq`** (one per customer need): customer, occasion link (optional), city, event date/time, guest count,
   budget (halalas), requirements text, status `OPEN | AWARDED | CLOSED | EXPIRED`, `closesAt`, version.
2. **`RfqInvitation`**: one row per invited vendor (chosen by the customer or matched by category + city),
   status `INVITED | DECLINED | QUOTED | EXPIRED`.
3. **`RfqQuote`**: vendor-authored, immutable once submitted: line items, setup/transport fees, VAT (all
   halalas), delivery notes, `validUntil`, status `SUBMITTED | ACCEPTED | DECLINED | EXPIRED | WITHDRAWN`.
4. **`RfqShare`** (friends and family): the owner creates a share link or invites people by phone/email
   (WhatsApp links follow the existing invitation-link pattern). Each share has a role `VIEWER`, an expiry
   (default: the RFQ's `closesAt`), and can be revoked at any time. A viewer needs no vendor or admin rights.
5. **`RfqOpinion`**: a viewer's reaction to one quote (👍 / 👎 or a rating, plus an optional short comment),
   one per viewer per quote. The owner sees the tally and comments; viewers never see each other's contact
   details.
6. **Acceptance** (single transaction, idempotent, **owner only**):
   - re-check the vendor's availability for the event date with the existing conflict check
     (`calendarAndConflict`, under the same locks as bookings); if the slot is gone, refuse with a clear message
     and mark that quote `UNAVAILABLE` so the customer can pick another;
   - mark the quote `ACCEPTED`, the others `DECLINED`, the RFQ `AWARDED`;
   - create a **private `CommerceOffer` version** from the accepted quote, visible only to that customer,
     expiring at `validUntil`, never listed in the catalog;
   - add it to the customer's server cart and send the customer to `/commerce/cart`.
   From there it is the normal flow, with server-side pricing, order, booking, payments and settlements.

Why this over reusing `ServiceRequest` directly: a `ServiceRequest` is one customer ↔ one offering. An RFQ is
one need fanned out to many vendors; the parent `Rfq` groups them, and private offers hand off to the checkout
that already exists. If vendors' availability should be checked during quoting, each invitation can link to a
`ServiceRequest` in `QUOTE_PENDING` instead; that is an optional extension, not required for a first release.

## Rules to carry over from the current engine
- Money is integer halalas; the UI formats riyals. No price is ever accepted from the browser.
- Ownership checks on every read/write (customer sees own RFQs; a vendor sees only RFQs they were invited to
  and only their own quote); admins see all.
- Rate limits, body-size limits, same-origin checks and idempotency keys, as in `/api/commerce/*`.
- Additive migration only (new tables, `CREATE ... IF NOT EXISTS`, new indexes); nothing existing changes.
- Feature flag `rfq` and per-city geography gating stay in force; a disabled flag hides the pages and APIs.
- Expiry: RFQs, invitations and quotes expire on schedule (reuse the existing watchdog pattern).
- Notifications through `ServiceInbox` in the same transaction as each event.
- Sharing privacy: a viewer sees only what the owner chose to share (by default quote totals, items, delivery
  notes and vendor business names; budget and contact details are hidden unless the owner turns them on).
  Share tokens are long random values stored hashed, revocable, rate-limited, never indexed by search engines
  (`noindex`), and give read access to one RFQ only. Viewers cannot accept, decline, edit or pay.
- Quote validity: default 7 days, editable by the owner (RFQ deadline) and by the vendor (quote `validUntil`,
  capped by an admin setting); the admin-set maximum lives in the existing admin configuration.
- Fees: private-offer orders go through the same commission and fee settings as catalog offers.

## Work breakdown
| Phase | Deliverable | Rough effort |
|---|---|---|
| 0. Decisions | Done (all questions answered, see below) | 0 days |
| 1. Data and rules | Migration, `Rfq`/`RfqInvitation`/`RfqQuote`, state machine, pure rules + unit tests | 3–4 days |
| 2. API | Create/list/close RFQ, invite, submit/withdraw quote, accept (with private-offer creation) | 3–4 days |
| 3. Vendor UI | Inbox of invitations, quote form, quote status; reuse vendor portal layout | 3 days |
| 4. Customer UI | Replace the local demo: create RFQ, compare quotes, accept → cart | 3 days |
| 4b. Sharing and opinions | `RfqShare`/`RfqOpinion`, viewer page (no login), revoke and expiry, owner tally | 3 days |
| 5. Private offers | Offer visibility (customer-scoped), expiry, hidden from catalog; checkout accepts them | 2–3 days |
| 6. Hardening | Integration tests (ownership, idempotency, double accept, expiry), crawl, a11y, rollout behind flag | 3 days |
| **Total** | | **about 3.5 weeks for one developer** |

## Acceptance tests (what "done" means)
- A customer cannot read or accept another customer's RFQ; a vendor cannot see RFQs they were not invited to.
- Submitting the same quote twice (same idempotency key) creates one quote; accepting twice creates one offer
  and one cart line.
- The price at checkout equals the accepted quote total, computed server-side; changing it in the browser has
  no effect.
- An expired quote cannot be accepted; a withdrawn quote disappears from comparison.
- A viewer can open only the RFQ they were given, cannot accept/decline/edit/pay, and loses access immediately
  after revocation or expiry; the share URL carries no vendor contact details or the owner's budget unless enabled.
- With the `rfq` flag off or the city unavailable, pages and APIs refuse cleanly.
- Existing suites still pass; a new `test:rfq` runs against an isolated schema like the commerce suites.

## Decisions so far (owner, 2026-10-20)
- **Quote lifetime:** one week by default, customizable (per RFQ and by the vendor when quoting, within an
  admin-set maximum). `closesAt`/`validUntil` therefore default to now + 7 days and are editable fields.
- **Platform fees:** apply as for catalog offers, managed and customizable. Private-offer orders use the same
  commission engine and the same admin controls; a per-vendor or per-RFQ override is allowed only through the
  existing admin-managed fee settings, never from the vendor or customer side.
- **Who is invited:** the customer can share an RFQ with friends, family and other people they choose, so they
  can view the quotes and give their opinion. Vendors are still chosen separately (customer-picked or matched
  by category and city). Only the RFQ owner can accept a quote or close the RFQ.

## Remaining questions: answered (recommendations adopted 2026-10-21)
1. **Availability: check at confirmation, not while quoting.**
   Quoting is many-to-one and costs the vendor nothing; holding a calendar slot for every invited vendor would
   block resources for quotes that are never accepted. Quotes carry the wording "subject to availability".
   The authoritative check happens when the owner accepts, inside the acceptance transaction (see step 6 above),
   which is also where double-booking is actually prevented. A vendor may optionally see an informational
   "you appear free on that date" hint while quoting; it never reserves anything.
2. **After acceptance: no re-quote. Cancel and start again; before acceptance, vendors can replace their quote.**
   - While the RFQ is open a vendor may withdraw or submit a replacement quote (a new immutable version; the
     old one is kept for the record). The owner sees the latest.
   - Once accepted, the quote is final: it becomes a private offer version and is never edited. If plans change,
     the customer cancels under the existing cancellation and refund policy and opens a new RFQ. This keeps the
     order, payment and settlement records consistent with exactly what was agreed.
3. **Demo data: drop it.**
   The sample RFQs exist only in the browser (`INITIAL_RFQS`, the "كوشة وفرح لتنسيق الحفلات" quotes) and show
   invented vendors and prices to real visitors. They are removed when the server feature ships, replaced by an
   empty state with a "request quotes" action. Nothing needs migrating because no RFQ is stored on the server.
   Until then the demo stays visible; it can be hidden immediately behind an empty state if you prefer.

## Risks
- **Scope creep into negotiation** (counter-offers, chat). Keep v1 to submit, compare, accept.
- **Private-offer visibility** touches the catalog queries; it needs focused tests so private offers never leak
  into public listings.
- **Privacy of shared RFQs.** Links leak. Keep tokens revocable and short-lived, expose the minimum, and show
  the owner who has access.
- **Spam / abuse** (an RFQ to every vendor): cap invitations per RFQ and RFQs per customer per day.
