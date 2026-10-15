# Good Morning frontend

Vue 3, TypeScript, Pinia, Vue Router, and Tailwind. Operational data comes from the authenticated PostgreSQL API.

```bash
npm install
npm run dev
```

Set `VITE_API_URL` to the backend API URL when it differs from `http://localhost:4000/api`.

See [setup and workflows](../SETUP.md) for migration instructions, role permissions, hostel billing rules, restaurant A/B inventory, and existing browser-record reconciliation.

The restaurant and grocery screens share `components/management/TradingWorkspace.vue` and `composables/useTrading.ts`. Hostel configuration and monthly payments are separate components. `lib/api.ts` handles requests and converts database values at the API boundary.
