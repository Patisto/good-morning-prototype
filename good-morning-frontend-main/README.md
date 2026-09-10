# Good Morning — Frontend (mock data)

Vue 3 + TypeScript + Vite + Pinia + Tailwind, matching the stack from the
project spec. All data is in-memory mock data (`src/data/mock.ts`) —
nothing is persisted or synced yet.

## Run it

```bash
npm install
npm run dev
```

## What's here

- **Dashboard** — today's sales, food cost/gross, hostel balances, room
  occupancy, low stock.
- **Hostel** — room grid by housing unit (all 49 rooms, real
  identifiers), tenant list with search, payments tab with
  expected/paid/balance and a "record payment" action.
- **Restaurant** — POS-style sell screen (tap menu item → cart →
  checkout), menu list, daily food records.
- **Grocery** — POS sell screen with product search, products/stock
  list with an "add stock" action and low-stock flags.
- **Expenses** — totals by business, a form to add one, and a list.
- **Settings** — a role switcher standing in for real auth, so you can
  see the sidebar's role-based visibility (`src/stores/auth.ts`).
- **Sync badge** (top right) — click it to simulate going offline;
  making a sale/payment while offline bumps the "N changes waiting"
  counter, and it clears a beat after you go back online. This is a
  stand-in for the real SQLite `sync_queue` from the schema — wiring
  it up for real is the natural next step.

## Wiring to the real stack

Every store (`src/stores/*.ts`) is where the mock arrays would be
replaced with SQLite queries (via Tauri's `invoke` or a `sql.js`/
`tauri-plugin-sql` binding) reading/writing the schema from
`sqlite-schema.sql`. The component layer shouldn't need to change —
they just call store actions and read store getters.
