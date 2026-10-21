# Sample data (local development and demos)

`npm run db:seed-sample -- --base http://localhost:3000` fills your **local** database with demo accounts and a
ready-to-buy catalog. It refuses any database that is not on localhost, only touches records starting with
`sample`, and can be re-run safely. Start the app against the local database first.

All sample accounts use the password `Sample-Pass-2026!` (override with `SAMPLE_PASSWORD`).

| Role | Accounts |
|---|---|
| Administrators | `admin@sample.munasabati.test` (super admin), `admin2@sample.munasabati.test` (reviews payments) |
| Customers | `noura@`, `faisal@`, `reem@`, `abdullah@` + `sample.munasabati.test` |
| Vendors | `lens.vendor@` (photography), `feast.vendor@` (hospitality), `bloom.vendor@` (decor), `hall.vendor@` (wedding hall), `beats.vendor@` (DJ and sound, Jeddah), `sweet.vendor@` (cakes, Jeddah) + `sample.munasabati.test` |

Catalog: 8 services with 10 offers (fixed, hourly, per night, and a custom-quote offer) and 2 multi-vendor packages
(wedding, graduation). Vendors create their services through the app's own API; an administrator approves them,
as in production. Visitors must choose a city (Riyadh shows 9 of the 11 items) before they see city-specific items.

## What a purchase looks like
1. Visitor browses `/commerce`, picks an offer, fills date, time and place, sees the server-priced total.
2. "Add to cart" asks them to sign in or sign up, then finishes the add automatically.
3. Cart shows the quote; accepting the terms creates the order (`WAITING_APPROVAL`). One order can hold several
   vendors; each vendor sees only its own part.
4. The vendor approves its booking request.
5. The deposit is recorded by one administrator and verified by a second one (a different person is required).
6. An administrator confirms the booking (`CONFIRMED`); the vendor slot is then taken for everyone else.
