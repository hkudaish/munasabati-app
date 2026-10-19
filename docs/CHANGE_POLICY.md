# Change policy: safe execution and approval boundaries

How audits, refactors and cleanups are run on this project. The goal is to improve the
application without losing data, behavior or approved design.

## Safe execution workflow

1. **Baseline first.** Before changing anything, record: `npx tsc --noEmit`, `npx next lint`,
   `npx next build` (route sizes), and the `npm run test:*` suites that do not need a browser.
   Commit only when the same checks are at least as good afterwards.
2. **Read-only analysis.** Findings are written down with evidence (file:line, measured
   numbers) before any edit. Recommendations and implemented changes are reported separately.
3. **Small, reversible commits.** One concern per commit (for example accessibility,
   navigation, type scale). Each commit must type-check on its own.
4. **Verify references before removing.** Before deleting a file, dependency or asset, search
   `src`, `scripts`, `prisma`, `netlify`, docs and build/deploy config for it, including dynamic
   and string references. Record the result in the commit message.
5. **Validate after each step.** Type check, lint, the relevant test suites, a production build,
   and a check of the affected screens at 390px and 1280px.
6. **Push only on request,** then check the live site for the new build.

## Approval boundaries

### Proceed without asking
- Accessibility, contrast, focus, label and alt-text fixes that keep layout and behavior.
- Replacing blocking `alert()` / `confirm()` with in-page feedback.
- Type, lint and dead-import cleanups with no behavior change.
- Documentation, tests and tooling that do not touch runtime code.
- Anything fully reversible with `git revert` that stays inside one feature.

### Ask first
- Deleting files, components or dependencies, even when unreferenced. They may be planned
  features (invoicing, wallet, reconciliation).
- Deleting local untracked folders (`.npm-cache`, `.netlify`, `.geo-browser-*`,
  `.geo-test-artifacts`, `.next*`). They are gitignored, but they are the user's machine.
- Changing navigation structure, user flows, pricing, fees, payment, booking or order-state
  rules, or the brand palette and fonts.
- Replacing `<img>` with `next/image` (changes image delivery and hosting cost).
- Changing rendering strategy (static vs dynamic), caching, or middleware.
- Adding dependencies or services.

### Never without explicit, verified instruction
- Destructive database operations (drops, truncates, data rewrites) or editing existing
  migration files. Migrations are additive and repeatable; add a new one instead.
- Touching secrets, `.env`, production data or credentials, or force-pushing.
- Disabling security controls (auth checks, origin checks, rate limits, body limits).
- Removing historical data or recovery assets (`netlify/database/migrations`, `prisma/sql`,
  localStorage legacy backups).
