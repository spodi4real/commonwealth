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

- [x] Phase 1 — Skeleton: auth, DB, force-change PIN on first login
- [ ] Phase 2 — Exchange rate system
- [ ] Phase 3 — Transaction CRUD
- [ ] Phase 4 — Mom's "Can I spend this?" flow
- [ ] Phase 5 — Budgets
- [ ] Phase 6 — Goals + savings lock
- [ ] Phase 7 — Owner dashboard + KPIs
- [ ] Phase 8 — Decision friction engine
- [ ] Phase 9 — Data-maturity-gated reports
- [ ] Phase 10 — Daily principles + monthly reviews
- [ ] Phase 11 — Polish
