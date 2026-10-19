# Legacy cart and checkout: sunset plan

**Status (2026-10-19):** being phased out. **Planned removal: 2027-01-17** (90 days), if the gate below passes.

## Why it still exists
- The new flow is `/commerce` (server cart, versioned offers and packages, `/api/commerce/*`).
- `addToCart()` in `src/lib/store.tsx` no longer fills the local cart; it redirects to the new service page.
- The old cart can therefore only hold items already saved in someone's browser (localStorage).
  `/checkout/legacy` still turns them into real orders through `POST /api/oms/orders`, so deleting it
  early would strand those items.
- Today the old cart link appears in `/commerce/cart` only when saved legacy items exist, and both
  legacy pages show a "being phased out" notice.

## Gate: remove only when all are true
1. Today is on or after 2027-01-17.
2. No legacy order was placed through `/checkout/legacy` for the last 30 days. Check the OMS orders
   table for orders created in the last 30 days that were not created from `/commerce` (the legacy
   checkout posts `cartGroups`/`items` with `customerInfo`; the new checkout does not), or ask support
   whether customers still mention the old cart.
3. A final notice has been visible on both legacy pages for at least 30 days.
4. A fresh database backup exists (see "Database backup" below).

## Removal checklist (one commit)
- Delete `src/app/cart/legacy/` and `src/app/checkout/legacy/`.
- Remove the legacy link from `src/components/commerce/Cart.tsx`.
- In `src/lib/store.tsx` remove the local cart state and helpers (`cart`, `savedForLater`,
  `appliedCoupon`, `addToCart`, `updateCartItemQuantity`, `removeFromCart`, `clearCart`,
  `checkoutCart`) and the localStorage keys they use. Keep the `munasabati_legacy_*_backup_v1` keys.
- Update the callers of `addToCart`: `src/app/compare/page.tsx`, `src/app/vendor/[id]/page.tsx`,
  `src/app/zaffah/page.tsx`, `src/components/ai/LumaAIDrawer.tsx`,
  `src/components/marketplace/ServiceCard.tsx` (link to the service page instead).
- Replace the cart count badge in `src/components/layout/Navbar.tsx` with the server cart count.
- Run `tsc`, lint, build, `npm run test:commerce`, `test:service-commerce`, then the 390px/1280px
  crawl before pushing.

## Database backup
Take a fresh backup before schema changes or this removal:

```
npm run db:backup          # read-only pg_dump of production to ~/Backups/munasabati (outside the repo)
npm run db:verify-backup   # restores the newest dump into a temporary local database, counts rows, drops it
```

`db:backup` fetches the production connection through the Netlify login on this machine and never prints it.
The dump contains customer data: keep it private. Last verified backup: 2026-10-19 (62 tables restored).
