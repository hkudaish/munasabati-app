# Advance-notice exceptions, rescheduling and vendor approval

How the platform decides whether a time is early enough to book, what happens when a customer needs it sooner, how a confirmed booking is moved, and how vendor accounts are approved. Everything here is built on the existing booking, cart, order, finance and availability code. No second booking system exists.

**Status of the feature switch.** The exception workflow is behind the feature `booking_exceptions` (System administration > Services), **hidden and off by default**. While it is off: nothing new is shown, no exception can be requested, and customers who pick a time that is too close see the notice dialog with only the "OK" button. The notice rule itself (below) is always enforced, on or off.

## 1. The minimum-notice rule

One function decides, everywhere: `checkNotice` (`src/lib/server/exceptions/notice.ts`) over the pure `evaluateNotice` (`src/lib/booking/advance-notice.ts`). The **longest** of these sources applies:

| Source | Where it is set |
|---|---|
| Service rule: value + unit (minute, hour, day, week), preparation time | Service form, section "الحجز المسبق" (`CommerceService.body.advanceNotice`) |
| Offer calendar: `minNoticeHours` | Offer policy (existing) |
| Vendor / legacy service availability: `minNoticeDays` | Existing availability settings |
| Availability policy: `minLeadHours` | System administration > availability (existing) |
| People / resources: calendar `minNoticeHours` | Booking settings (existing) |

Service rule fields (all optional, off by default so nothing changes for existing services):

| Requested field | Stored as |
|---|---|
| `minimum_advance_notice_value` / `_unit` | `advanceNotice.value` / `.unit` |
| `advance_notice_enabled` | `advanceNotice.enabled` |
| `allow_exception_requests` | `advanceNotice.allowExceptionRequests` (default true) |
| `service_timezone` | `advanceNotice.timezone` (IANA, default `Asia/Riyadh`) |
| `booking_cutoff_at` | `advanceNotice.cutoffAt`: after this instant the service takes **no** booking and **no** exception |
| `preparation_time` | `advanceNotice.preparationMinutes`: the required notice is never shorter than this |
| `service_duration` | `advanceNotice.serviceDurationMinutes` (informational, for the form and calendar) |
| `availability_rules` | existing availability policies and schedules (not duplicated) |
| `applicable_cities` | existing service cities and the geographic coverage rules (not duplicated) |

**Where it is enforced (server side, always):** the storefront check (`GET /api/booking-notice`, information only), saving the cart (`PUT /api/commerce/cart`), checkout (`POST /api/commerce/orders`), and booking confirmation and every reschedule (`calendarAndConflict`). A violation returns a 409 with `code: "ADVANCE_NOTICE"`, the required and remaining minutes, the earliest time and whether an exception can be requested; the storefront turns that into the dialog.

**Packages** are judged component by component (`evaluatePackageNotice`): each mandatory component against its own notice; the screen names the failing components and the one needing the longest preparation; an exception is possible only if every failing component accepts exceptions; each failing component's own provider approves its part.

## 2. The exception workflow

```
customer submits ──► stage 1 ─────────────► stage 2 ──────────────► stage 3
                     operational approval    final price approval     final confirmation
                     (provider / platform)   (customer, e-approval)    (system, after payment)
```

Three mandatory stages, none can be skipped (`src/lib/exceptions/machine.ts`, one state machine, unit-tested):

| Status | Meaning |
|---|---|
| `submitted` → `under_review` → `awaiting_provider_approval` | stage 1 (the first two steps are automatic at submission) |
| `feasibility_approved` → `assigned_to_coordinator` → `negotiating` → `offer_prepared` | between stages 1 and 2: a coordinator agrees time and price |
| `awaiting_customer_approval` → `customer_approved` | stage 2: the customer approves **that exact version** of the offer |
| `awaiting_payment` → `confirmed` → `completed` | stage 3: the booking is confirmed only when the booking system confirms it; the exception then closes as "مكتمل ومؤكد" |
| `information_required`, `alternative_proposed`, `offer_expired` | detours |
| `rejected`, `customer_declined`, `cancelled`, `execution_unavailable` | final, nothing can leave them |

The provider's approval never confirms anything. `CONFIRM` is not an action anyone can press: it is performed inside the booking's own confirming transaction, which re-checks availability and payment, then calls `finalConfirmationGuard` (all of: operational approval, the customer's acceptance of the offer whose time matches, fresh availability, required payment). If any is missing the confirmation throws and the booking is **not** confirmed.

**How an approved exception reaches the booking.** The customer presses "متابعة الحجز والدفع": the booking goes into their cart as a line carrying the exception id. On the server the cart and checkout verify that the exception belongs to this customer, covers this very offer, date and time, is price-approved and not expired, then excuse the notice **only** (never coverage, schedule, capacity or availability) and add the agreed exception fee as a priced fee, so VAT, deposit and milestones come from the same pricing engine. A customer is never charged more than the approved total (promotions can only lower it). Payment and confirmation then follow the ordinary order path.

**Offers.** Each negotiation round is a new version (base price, exception fee, discount, VAT, total, date and time, payment/cancellation/change terms, expiry). Once sent, the database refuses any change to its price or terms. The customer decides on the request page (also reachable from the SMS/WhatsApp/email link, which only names the request: the customer must sign in as its owner). Acceptance, refusal and "renegotiate" each store a `CustomerConsent` with the exact wording, offer version, IP and browser. Offers above a configurable amount need a supervisor's approval before they can be sent.

**Coordinators.** After operational approval a coordinator is assigned automatically (fewest open tasks) or by a supervisor/administrator, with a priority from how close the event is and a response target. They record every contact (`NegotiationLog`, append-only), prepare and send offers. Negotiation notes are never shown to customers or providers.

## 3. Rescheduling a confirmed booking

On a booking whose new time does not meet the notice, the customer's reschedule opens the same dialog and creates a request of kind `RESCHEDULE` linked to the booking, with the same three stages. **Until everything is satisfied the booking's time, price and calendar reservation do not change.** If the approved offer adds a charge, the customer pays it through the usual bank-reconciliation flow; when the second administrator verifies that payment the change is applied in one transaction: time, price (tax and commission recomputed, deposit + milestones still equal the total), calendar reservation, reminders, the booking's own history. If the new time was taken meanwhile, or the booking changed, nothing is applied and the request returns to negotiation; if the exception is refused, expires or the customer declines, the original booking stands exactly as it was. A request with no extra charge is applied the moment the customer approves.

## 4. Roles and permissions (checked on the server)

| Role | How it is granted | Can |
|---|---|---|
| Customer | the account | submit, see own, answer information requests, accept/decline/renegotiate offers, cancel, add the approved booking to the cart |
| Provider (vendor) | a vendor account that manages the service | see requests on their services; approve/reject/propose alternative/ask information/mark unavailable for their own part of a package; see offers (not negotiation notes) |
| Coordinator | `StaffRole` COORDINATOR (a plain account is enough) | see and work **only requests assigned to them** |
| Booking supervisor | `StaffRole` BOOKING_SUPERVISOR | see all, assign and re-assign, set priority, approve large offers |
| Support | `StaffRole` SUPPORT | read only |
| Administrator / system administrator | existing roles | everything above, the dashboard export, settings, staff roles, running the deadline check |

Grant staff roles in **Admin > طلبات الاستثناء** (bottom of the page). The unreviewed history tables (events, consents, negotiation log, vendor approval events) cannot be edited or deleted, enforced by database triggers.

## 5. Screens

| Who | Screen |
|---|---|
| Customer | storefront hint under the date picker and the notice dialog and request form (`NoticeFlow`); `/exceptions` list; `/exceptions/<id>` (three-stage progress, next step, offers, decision buttons, history) |
| Provider, coordinator, supervisor | the same pages, showing only the actions the server allows them now |
| Administrator | `/admin/exceptions`: «إدارة طلبات الاستثناء وتعديل المواعيد» with the 14 counters (each filters the table), search, filters, sorting, the table with all requested columns, CSV export, "run the deadline check now", escalation settings and staff roles |
| Vendors | `/vendor` banner with the account review status; admin `/admin/vendor-approvals` |

## 6. Deadlines and escalation

Settings (all editable at `/admin/exceptions`, defaults in `defaultExceptionConfig`): response hours per priority for provider / coordinator / customer, offer validity (24 h), payment window after approval (24 h), unreviewed-request escalation, hours per escalation level, supervisor-approval amount, whether vendor services also need the platform's approval, days before an expired offer is cancelled. The 15-minute notifications cron (`runCron` > `sweepExceptions`) expires offers and payment windows, cancels stale expired offers, escalates late requests to the platform (once per level) and sends queued messages. It is safe to run twice.

## 7. Notifications

Every message is a row in `ExceptionNotification`, unique per person, event and channel, so retries never double-send. The in-app inbox (`GET /api/exceptions/inbox`) is always written. Outside the app:

| Channel | Used for | Needs (environment variables) |
|---|---|---|
| Email | offer link, payment request, confirmation, rejection, alternative, expiry, vendor decisions | `NOTIFY_EMAIL_API_KEY`, `NOTIFY_EMAIL_FROM` (existing); sent only to people who opted in to email |
| SMS (Twilio) | same | `EXCEPTION_SMS_ACCOUNT_SID`, `EXCEPTION_SMS_AUTH_TOKEN`, `EXCEPTION_SMS_FROM` |
| WhatsApp Business (Meta) | same | `EXCEPTION_WHATSAPP_PHONE_NUMBER_ID`, `EXCEPTION_WHATSAPP_TOKEN`, `EXCEPTION_WHATSAPP_TEMPLATE` (a template with two body variables: title, text), optional `EXCEPTION_WHATSAPP_API_VERSION`, `EXCEPTION_WHATSAPP_LANGUAGE` |

Without these a message is marked `SKIPPED` with the reason (`channel_not_configured`); nothing fails. A delivered message is never taken as consent: approval is recorded only when the signed-in customer presses the button. Notification texts are stored in Arabic.

## 8. Vendor and customer accounts

* A new vendor registers as `UNDER_REVIEW` with a `VendorApproval` record in `PENDING` and the platform is notified. Until approved the vendor cannot publish services, receive bookings, confirm or take part in exceptions (the existing server rule that only an `ACTIVE` vendor can manage services applies).
* Decisions (admin > **اعتماد حسابات الموردين**): approve, request information (with a reason the vendor sees on `/vendor` and can answer), put on hold, reject, reopen. Every decision is in `VendorApprovalEvent` and the audit log and notifies the vendor. The two older status switches (admin vendors list, system administration) keep the approval record in step.
* **Account approval and service approval are independent.** Approving a vendor does not approve any service; a service is shown to customers only after the administration approves it (existing `approved` flag).
* Customers are active as soon as they register; no administrator approval. Signing in does not entitle anyone to book: the server checks, per line and again at checkout and confirmation, that the service is published and enabled, the city is covered, the vendor is approved and active, the time is within the availability rules, capacity allows it, the notice is met or covered by an approved exception, the price is the approved one and payment requirements are met.

## 9. Data model (migration `202610300001_exception_requests.sql`)

Additive only, no existing table altered. `ExceptionRequest` (+ one active request per customer/offer/kind/slot by a partial unique index), `ExceptionEvent`, `ExceptionApprovalStep`, `ExceptionOffer` (frozen once sent), `CustomerConsent`, `CoordinatorTask`, `NegotiationLog`, `StaffRole`, `ExceptionConfig`, `ExceptionNotification`, `VendorApproval`, `VendorApprovalEvent`. Existing vendors are recorded as approved (active) or pending. The advance-notice rule lives in the service document (`CommerceService.body`) beside the other service settings, so no booking, order or price row changes. Mapping to the entities in the brief: Services/ServiceOffers/Packages/PackageItems/Bookings/BookingItems/Payments/AuditLogs are the existing `CommerceService`, `CommerceOffer`, `CommercePackage`, `CommercePackageItem`, `ServiceRequest`/`CommerceBooking`/`CommerceOrderItem`, `ServiceFinanceEntry`/`CommerceTransfer`, `SystemAuditLog`; `ServiceAdvanceBookingRules` is the service document's `advanceNotice`; `BookingRescheduleRequests` is `ExceptionRequest` with kind `RESCHEDULE`; `ExceptionOffers`, `ExceptionApprovalSteps`, `CoordinatorAssignments` (= `CoordinatorTask`), `NegotiationLogs`, `CustomerConsents`, `VendorApprovalRequests` (= `VendorApproval` + events) and `Notifications` are the new tables above.

## 10. Rolling it out safely

1. `npm run backup:full` (encrypted, verifiable; restore with `npm run backup:restore`).
2. Deploy. The migration runs by itself. The feature is off, the notice rule keeps working as before, the only visible change is the optional "الحجز المسبق" section in the service form and the vendor approval page.
3. Set the service rules and notification variables; grant the coordinator/supervisor roles; set escalation windows (`/admin/exceptions`, available while the feature is off).
4. Turn the feature on (System administration > Services: both visible and enabled). Watch `/admin/exceptions` counters (late, awaiting) and the audit log.
5. To go back: switch the feature off (instant, nothing is lost). Full removal: `prisma/sql/rollback-20261030-exception-requests.sql` after a backup.

## 11. Tests

| Command | Covers |
|---|---|
| `npm run test:exception-engine` | notice evaluation, packages, time zones, state machine (every transition and every denied one, final states closed), final guard, escalation, offer and price arithmetic |
| `npm run test:exceptions` | end to end in an isolated schema and private server: scenarios 1–22 of the acceptance list, vendor approval, customer registration, feature switch, export, settings. `RUN_EXC_BROWSER=1` adds a real-browser pass at 390 px (`ONLY_UI=1 SHOTS=<dir>` for screenshots only) |
| existing suites | `test:configurable-bookings`, `test:service-commerce`, `test:commerce`, `test:availability`, `test:system-admin`, `test:booking-drafts`, `test:pricing-engine` pass unchanged |

Acceptance list → where it is tested (`scripts/test-exceptions.cjs`): 1 notice met (§ "notice met"), 2 too close (§2), 3 request (§3), 4 provider approves (§4), 5 provider rejects (§9), 6 extra price (§5), 7 customer approves (§6), 8 customer declines (§10, §11), 9 offer expires (§12), 10 payment and confirmation (§7–8), 11 failed payment (§13), 12 availability lost (§14), 13 reschedule (§16), 14 refused reschedule keeps the original (§16), 15 unapproved vendor (§"vendor account approval"), 16 approved vendor, 17 customer registration, 18 outside cities (§2/§3), 19 package with different notices (§15), 20 concurrent requests (duplicate submission §3, race for a slot), 21 repeated confirmation or payment (§8), 22 audit, notifications and permissions (throughout).

## 12. Known limits and what needs your setup

* SMS and WhatsApp need provider accounts and the variables in §7; until then only the in-app inbox (and email if configured and opted in) are used.
* Vendor "documents": a vendor can be asked for more information and answers with a note, but there is no document upload store, so the commercial register and similar papers are exchanged outside the app.
* Customers are not asked to verify their mobile number or email at registration (the platform has no OTP provider); that is a separate integration.
* Notification texts are generated in Arabic; the screens themselves are bilingual.
* Money is whole halalas; an exception's extra fee is added as one priced fee on the first matching component of the booking.
