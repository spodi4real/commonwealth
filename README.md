# Commonwealth (CW)

A wealth-building operating system. Not a budgeting app.

## What this is

Commonwealth is a decision-enforcement system that intercepts spending before it
happens, builds wealthy-person habits over time, and compounds insight the longer
it is used. Two-user (Owner + Mom), local-first, runs over Tailscale.

See [`docs/architecture.md`](docs/architecture.md) for the design rationale.

## Stack

- **Client**: React (Vite) + Tailwind + Recharts
- **Server**: Node + Express + better-sqlite3
- **DB**: Local SQLite at `db/commonwealth.sqlite` (gitignored — family data)
- **Auth**: PIN, signed HTTP-only cookie sessions

## First-time setup

```sh
npm install           # installs root + server + client (workspaces)
npm run seed          # creates DB, seeds users + 60 wealth principles
npm run dev           # starts server (4000) and client (5173) together
```

Open `http://localhost:5173`. On first login both users have PIN `0000` — you'll
be forced to change it before anything else loads.

## Tailscale access

Both server and Vite bind to `0.0.0.0`. Once you're on Tailscale, peers reach the
app at `http://<this-machine's-tailscale-ip>:5173` (dev) or via the production
build (single port):

```sh
npm run build         # builds client into client/dist
npm start             # server serves API + static client on :4000
```

Then peers visit `http://<tailscale-ip>:4000`. No external exposure required.

## Project layout

```
/cw
  /client      React app
  /server      Express API + SQLite
  /db          commonwealth.sqlite (gitignored)
  /docs        architecture notes
  /seeds       wealth_principles.json
```

## Phase status

- [x] Phase 1  — Skeleton: auth, DB, force-change PIN on first login
- [x] Phase 2  — Exchange rate system
- [x] Phase 3  — Transaction CRUD
- [x] Phase 4  — Mom's "Can I spend this?" flow + Owner approvals
- [x] Phase 5  — Budgets + burn-rate dashboard
- [x] Phase 6  — Goals + contributions + maturity-gated projections
- [x] Phase 7  — Owner dashboard with KPIs + data maturity
- [x] Phase 8  — Decision Friction Engine + Pending Desires
- [x] Phase 9  — Data-maturity-gated reports
- [x] Phase 10 — Monthly review prompt + Wealth Journal
- [x] Phase 11 — Polish: Settings page, refined monogram, nav, base styles

## First-time usage

1. Run `npm install && npm run seed && npm run dev`.
2. Open `http://localhost:5173`.
3. Sign in as **Owner** with PIN `0000` — you'll be forced to set a new PIN.
4. **First-run Wizard** runs automatically: rate → cash position → opening
   savings → primary income source → review → finish. The dashboard lands
   already grounded in your reality.
5. Log a few **Allocations** to start filling the ledger. Anything ≥ the
   friction threshold triggers the justification ritual; Wants that "can
   wait" move to **Pending Desires** instead.
6. Log income on the **Income** page when it arrives — you'll be prompted
   to pay yourself first (allocate any portion straight to a goal).
7. Sign out, sign in as **Mom** with PIN `0000`, set her PIN, and try
   "Can I spend this?" — small amounts go green, medium amounts hit AMBER
   and queue for Owner's approval back on the Owner dashboard.

### v1.1 — Reality grounding

- **First-run Wizard** seeds your actual starting position (exchange rate,
  cash accounts, opening savings, primary income source).
- **Cash accounts** snapshot where your money actually sits (cash IQD, cash
  USD, bank). Editable from Settings → Current position.
- **Income system** with sources + entries: log actual receipts (received,
  partial, pending, overdue, missed). KPIs use real income, not assumed.
- **Pay-yourself-first ritual** fires on every received income entry —
  allocate to goals before money gets absorbed into spending.
- **Reliability score** over the last six months: % of expected paychecks
  received on time and in full. **Avg delay days** alongside.
- **Overdue income banner** on the dashboard the moment an expected
  paycheck is past due.
- **Owner edits anything**: contributions, income entries, cash accounts,
  approvals — all with full `audit_log` entries.
- **Mom is read-only on her own purchases**; she asks Owner to amend.

Reports unlock as your transaction history matures (30 / 60 / 90 / 180 / 365
days). The Wealth Journal prompts a five-question monthly review on the
first of each new month and stores it for you to re-read years later.
