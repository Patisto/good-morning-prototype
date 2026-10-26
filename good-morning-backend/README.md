# Good Morning API

Express and TypeScript API backed by PostgreSQL.

- Local development: `npm install`, configure `.env`, then `npm run dev`.
- Production build: `npm ci && npm run build`.
- VPS deployment: follow [VPS_DEPLOY.md](./VPS_DEPLOY.md). GitHub Actions builds the API and deploys compiled files over SSH; PostgreSQL credentials stay on the VPS.
