# Commonwealth — Architecture Notes

These notes capture the *why* behind decisions. The *what* lives in the code.

## North star

Commonwealth is a decision-enforcement system, not a ledger. The product
succeeds when users **don't make a spending decision** because the app made
them stop and think. Every architectural choice serves that goal.

## Canonical money

- All amounts are stored as **integer USD cents** in the database.
- IQD is a **display layer only**, computed at render time using the exchange
  rate active on the transaction's `created_at` date (the largest
  `exchange_rates.effective_date <= tx.created_at`).
- Historical transactions are never re-priced when a new rate is entered.
  The rate that was true that day stays true forever for that transaction.
- Owner enters in USD by default with an IQD toggle (canonical-first input).
- Mom enters in IQD only — conversion happens on save using the latest rate.

Rationale: IQD floats daily. Mixing currencies in storage would either lose
historical accuracy (re-converting old transactions when the rate changes) or
require per-row currency tracking that complicates every query. Pick one
canonical unit, pin rates to dates, render the rest.

## Auth

- Two seeded users with `role IN ('owner', 'mom')`.
- PINs hashed with bcryptjs (pure JS — no native compile pain on Windows).
- Default PIN `0000` with `must_change_pin = 1` flag. The login flow refuses to
  proceed to dashboard until PIN is changed.
- Session = random 32-byte hex token stored in `sessions` table, set as a
  signed HTTP-only `cw_sess` cookie with 30-day expiry.
- No JWTs. No external auth providers. This is a family app on a private
  network; complexity buys nothing.

## Data maturity gating

Reports are explicitly gated by `days_since_first_transaction`. The gate is
computed once per request from the earliest non-deleted transaction. This is a
**feature**, not a limitation — surfacing what unlocks at 30/60/90/180/365 days
turns "the app feels empty" into "I'm building toward something."

Implementation: one helper, `getDataMaturity(db)`, returns
`{ days, unlocks: { monthlySummary, trends, projections, seasonal, yoY } }`.
Every report screen calls it and renders accordingly.

## Soft delete + audit

- `transactions.deleted_at` for soft deletes. Nothing is ever hard-deleted —
  patterns over years matter more than a clean current list.
- Every mutation writes to `audit_log` with `before_json` and `after_json` so
  the user can reconstruct any state.

## Decision Friction Engine (Phase 8 preview)

The friction engine is the product. Sketch:

- Owner enters a transaction → if `amount_usd >= 20`, a modal blocks save:
  classify (need/want/investment), can-it-wait (yes/no), why-now (text).
- `want + can-wait=yes` → row goes to `pending_desires`, **not** `transactions`.
- 24h later, a server-computed status flags it: app asks "do you still want
  this?" — user answers, `kept=1` promotes it to a real transaction, `kept=0`
  closes it as "saved by friction".
- KPI: sum of `pending_desires.amount_usd` where `kept=0` = money the app saved
  you this month. This is the headline number that proves the system works.

## Wealth Principles

- 60 seeded principles in `seeds/wealth_principles.json`.
- Daily selection: `dayOfYear % count` — deterministic so the same day shows
  the same principle (feels intentional, not random).

## Wealth language

The vocabulary table in the spec is enforced at the UI layer, not the data
layer. Server returns neutral keys (`category`, `amount_usd_cents`), client
labels them with the "allocation / capital / paid yourself" vocabulary.
Translation files would be overkill for a two-user app.

## Tailscale-friendly deployment

- Dev: client (Vite, 5173) + server (Express, 4000), both bound to `0.0.0.0`.
  Vite proxies `/api` → `:4000` so the browser only sees one origin.
- Prod: `npm run build` produces `client/dist`. Server serves it statically and
  exposes `/api/*`. Single port (4000), single Tailscale ACL rule.

## What we explicitly are not building

- Cloud sync, multi-device sync, backups other than SQLite file copy.
- OAuth, magic links, password resets — PINs only.
- Mobile apps. The Vite build runs fine in mobile browsers over Tailscale.
- Bank integrations / Plaid / automatic transaction import. The user is in a
  geography that wouldn't be served by any of them, and manual entry is part
  of the friction-engine design.
