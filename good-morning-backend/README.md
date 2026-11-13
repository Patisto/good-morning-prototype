# Good Morning API

Express and TypeScript API backed by PostgreSQL.

- Local development: `npm install`, configure `.env`, then `npm run dev`.
- Production build: `npm ci && npm run build`.
- VPS deployment: follow [VPS_DEPLOY.md](./VPS_DEPLOY.md). GitHub Actions builds the API and deploys compiled files over SSH; PostgreSQL credentials stay on the VPS.

## PayChangu online rent payments

Set every `PAYCHANGU_*`, lookup-token, payment-policy, CORS, and URL variable in `.env` from `.env.example`. In the PayChangu dashboard, choose the matching test/live API keys, add `PAYCHANGU_CALLBACK_URL` under API & Webhooks, and enable payment webhooks. The backend creates Standard/Hosted Checkout sessions and independently verifies every webhook/status before writing one `rent_receipts` ledger row.

Run `npm run migrate`, then `npm run build`. The reconciliation scheduler starts with the API; a single reference can be reconciled with `npm run reconcile -- GM-...`. Test with PayChangu test credentials and a test checkout, confirm the webhook is HTTPS-reachable, and inspect the existing finance hostel ledger. Before go-live, use HTTPS, live keys, the production webhook URL, restricted CORS, production secrets, and one controlled low-value live transaction reconciled against the ledger. The browser never receives a secret and a return URL alone never marks a payment successful.
