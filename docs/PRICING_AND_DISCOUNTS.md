# Unified pricing, packages and discounts

One pricing engine decides every price the platform shows or charges: the booking dialog, a package being customised, the cart, checkout and the settlement of a confirmed order. Nothing else computes a price.

## 1. Architecture

| Layer | File | Role |
|---|---|---|
| Pure engine | `src/lib/commerce/pricing-engine.ts` | `calculate(context) → Quote`. No I/O, deterministic, independent of input order. Integer halala only (`src/lib/money.ts` for display). |
| Loaders and persistence | `src/lib/server/commerce-v2/pricing.ts` | Loads policies, rules and redemption usage; `lockLimitedRules`; `persistQuote`; the customer-safe view `publicPricing`. |
| Policy lifecycle | `pricing-policy.ts` | Activate versions, mirror the active policy to the package body, keep the older package editor in sync. |
| Admin operations | `pricing-admin.ts` | Policies, rules, preview, history, scheduled changes, settlement review. |
| Jobs | `pricing-jobs.ts` | Applies due price schedules; releases stale redemptions. Run from the existing `runCron`. |
| Cart / drafts / orders | `cart.ts`, `drafts.ts`, `orders.ts` | Call the engine; orders store `priceQuoteId`. |
| Price watch | `price-watch.ts` | Detects changes with a reason code and notifies through the outbox. |

Pipeline: price each offer → apply the package policy → apply discount rules (stacking rules below) → recompute tax (never on fees) → total.

## 2. ERD

```
Package ──< PackagePricingPolicy (versioned, no overlapping active windows)
Offer ──< OfferPriceVersion ──< PriceSchedule
DiscountRule ──< DiscountRuleTarget (package | service | offer | vendor)
DiscountRule ──< DiscountRedemption >── Order
PriceQuote ──< PriceQuoteComponent (gross, discount, net, vendor/platform funded, commission)
PriceQuote ──< AppliedDiscount (immutable breakdown)
Order ──> PriceQuote
```

Tables: `package_pricing_policies`, `discount_rules`, `discount_rule_targets`, `price_quote_components`, `applied_discounts`, `discount_redemptions` (plus the quote and schedule tables). Migration: `netlify/database/migrations/202610230003_pricing_engine.sql` (mirrored in `prisma/sql/20261023-pricing-engine.sql`). Triggers: `package_pricing_no_overlap`, `pricing_terms_frozen` (an activated version's terms cannot change), `pricing_record_immutable` (quotes, applied discounts). Existing packages are backfilled into version 1 policies.

## 3. Package pricing models

| Model | Meaning |
|---|---|
| FIXED | One tax-inclusive payable total for the package. |
| SUM | Sum of the components. |
| PERCENT | Components minus a percentage bundle discount. |
| AMOUNT | Components minus a fixed amount. |
| TIERED | Discount grows with quantity or service count (`tierStrategy` FIRST/BEST). |
| BUILD_YOUR_OWN | Customer picks optional components; rules apply to what was chosen. |
| VENDOR | Vendor-specific or multi-vendor components, each priced and settled to its own vendor. |

Packages with a policy window, minimum/maximum selection and availability checks reuse the existing availability engine.

## 4. Calculation rules

- Money is integer halala; percentages are rounded once per component, then the remainder is allocated so components always add up to the total.
- `discountable = subtotal − fees`. Fees are never discounted or taxed.
- A discount can never exceed its eligible amount and the total is never negative.
- Commission is taken on the subtotal plus the platform-funded part of discounts.
- Settlement payable = net + platform-funded − commission.
- Rules are ordered by priority (desc), then value, then id; the result is the same for any input order.

## 5. Precedence and stacking matrix

| Situation | Result |
|---|---|
| Package discount + promotion, neither allows stacking | Two outcomes are computed, `PACKAGE` and `NO_PACKAGE`; the customer gets the better one. A rule with priority > 0 wins; otherwise the lowest payable total wins; a tie goes to `PACKAGE`. |
| Promotion with `allowWithPackageDiscount` | Applies on top of the package discount. |
| Two rules in the same `stackingGroup` | Only the best one applies; the other is reported as rejected. |
| Rules without `stackable` | Only the first by order applies. |
| Package blocks promotions | `soft` blocks automatic rules only; `hard` blocks promo codes too. |
| Rule rejected | The reason code and Arabic text are returned and shown to the customer. |

Package and promotion discounts therefore never stack automatically.

## 6. Discount funding and settlement

Each rule is funded by the PLATFORM, the VENDOR or SHARED (`vendorShareBps`). The engine returns `{platform, vendors, platformByVendor}`; per-component `vendorFundedAmount`, `platformFundedAmount` and `commissionAmount` are stored with the quote. Vendors can create rules only for their own services and only funded by themselves; those rules are saved as drafts until an administrator activates them. `/api/commerce/pricing/settlement` aggregates this per vendor and per campaign.

## 7. Customer behaviour

- The price summary is itemised (services, extras, fees, each discount with its reason, tax, total, savings) and updates as the configuration changes.
- A price change is shown with its direction and amount. **A price increase is never accepted silently**: the cart carries an acknowledgement gate and checkout refuses an unacknowledged increase.
- The quote hash is checked at checkout; a mismatch returns 409 and the customer sees the new price.
- Confirmed orders keep their stored quote; later changes never touch them.
- Promo codes are validated server-side (window, usage limit, per-customer limit, eligibility).
- Limited rules take a per-rule advisory lock before the final quote, so concurrent checkouts cannot exceed a limit; unpaid redemptions are released by the job.
- Carts, saved-for-later and drafts survive navigation as before.

## 8. API contracts

| Route | Methods | Who |
|---|---|---|
| `/api/pricing/quote` | POST | public; `promoCodes` optional |
| `/api/commerce/cart` | GET, PUT | customer; body `{lines, promoCodes}` |
| `/api/commerce/pricing/policies` | GET, POST, PATCH | admin; vendor for own packages |
| `/api/commerce/pricing/rules` | GET, POST, PATCH(activate/disable) | admin; vendor drafts for own services |
| `/api/commerce/pricing/preview` | POST | admin, vendor; unsaved policy/rule → customer view (+ internal funding) |
| `/api/commerce/pricing/history` | GET `?offerId` / `?packageId` | admin, vendor (own); includes affected carts |
| `/api/commerce/pricing/schedule` | POST (create / `action: cancel`) | admin, vendor (own) |
| `/api/commerce/pricing/settlement` | GET `?from&to` | admin, supervisor; vendor sees own |

## 9. Permissions matrix

| Action | Customer | Vendor | Supervisor | Admin |
|---|---|---|---|---|
| See own quote | yes | yes | yes | yes |
| Create/edit package policy | no | own packages | per role | yes |
| Activate policy / rule | no | no | no | yes |
| Create rule | no | own services, self-funded, draft | no | any |
| Schedule price change | no | own offers | no | any |
| Settlement review | no | own | yes | yes |

The server enforces every row; the UI only hides what the server would refuse.

## 10. Admin screens (`/commerce/pricing`)

Package builder (nine guided sections with live preview), discount rules and campaigns, price history and scheduling (with the number of affected carts), settlement review. Duplicate-package and version history are in the builder.

## 11. Tests and results

| Suite | Command | Result |
|---|---|---|
| Engine unit (all models, invariants, 400 random trials) | `npm run test:pricing-engine` | 3739 checks pass |
| Integration (9 groups: models, rules, stacking, race-safe redemption, immutable quotes, settlement, schedules, preview, permissions) | `npm run test:pricing` | pass |
| Browser (admin tabs, rules editor, `/` and `/en`, 390 and 1440 px, signed-out gate) | `npm run test:pricing-browser` | pass |
| Regression | all other `npm run test:*` | all pass (`test:invitation-db` needs the app running on :3000) |
| i18n | `npm run test:i18n` | 29 checks pass |
| Type check, lint, production build | `tsc`, `next lint`, `next build` | clean (one older warning in `reception-screen`) |

## 12. Known limitations

- Dynamic labels (package and discount names, rejection reasons entered by admins) are shown as written; there is no English field for them yet.
- The admin pricing screens are Arabic-only (the route works under `/en`, text is not translated). The customer summary is bilingual.
- Items held under a HOLD-style availability mode are not covered by tests.
- The cancellation settlement path does not yet reverse discount funding.
- In `NO_PACKAGE` mode with several entries, discount rules are applied all-or-nothing per mode.
- `/api/availability/resolve` was not added; package availability reuses the existing engine.
- Email delivery of price-change notices is off until `NOTIFY_EMAIL_API_KEY` / `NOTIFY_EMAIL_FROM` are set; in-app notifications work.
