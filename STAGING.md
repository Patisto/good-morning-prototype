# Staging environment

Use the `staging` branch to test changes before merging them to `main`. Staging deploys the frontend to a separate Vercel project and the API to Render, backed by a separate Neon database. The existing GitHub Actions workflows still deploy `main` to the VPS. Do not point staging at the production database or reuse production payment credentials.

## Branch flow

1. Create a feature branch from `staging` and make changes there.
2. Open a pull request into `staging`. **Staging validation** builds both frontend and backend.
3. Merge to `staging`. Vercel and Render automatically deploy their staging projects.
4. Test the deployed staging app, including payment flows with PayChangu test credentials.
5. Open a pull request from `staging` into `main`. After review, merge it. The existing VPS deployment workflows run from `main` as before.

Protect `main` in GitHub and require pull requests. It is also useful to protect `staging` and require the **Staging validation** checks. Avoid direct commits to either shared branch.

## Neon

Create a dedicated Neon project/database for staging. Copy its pooled or direct connection string into Render as `DATABASE_URL`; include `?sslmode=require` if it is not already present. Never use the production Neon/VPS database URL here. Render runs `node dist/db/migrate.js` before starting the service, applying the backend's idempotent schema to the staging database.

## Render API

Create a Render Blueprint using `render-staging.yaml` (keep the existing `render.yaml` for its current service), then connect the staging service to `staging` (the staging blueprint specifies this branch). The service root is `good-morning-backend`; Render builds it, applies the schema, and starts `npm start`. Set these values in the Render service environment after creation:

- `DATABASE_URL`: staging Neon connection string.
- `FRONTEND_URL`: the staging Vercel origin, for example `https://good-morning-staging.vercel.app`.
- `CORS_ALLOWED_ORIGINS`: that same exact staging Vercel origin, without a trailing slash or path.
- `PAYCHANGU_SECRET_KEY`, `PAYCHANGU_WEBHOOK_SECRET`: PayChangu **test** credentials only.
- `PAYCHANGU_CALLBACK_URL`: `https://<render-service-host>/api/webhooks/paychangu`; configure this same endpoint in the PayChangu test dashboard.
- `PAYCHANGU_RETURN_URL`: the staging Vercel origin plus `/`.

Render generates `JWT_SECRET` and `LOOKUP_TOKEN_SECRET`. `PAYCHANGU_ENV` is set to `test`. Add SMTP settings only if staging email delivery is needed; use a test mailbox/provider and do not copy production SMTP credentials. Do not configure `SEED_SUPER_*` on a database containing real users. Create a staging manager account through the approved initial account setup for that isolated database.

## Vercel frontend

Create a **separate** Vercel project connected to this repository. Set its root directory to `good-morning-frontend-main`, framework preset to Vite, build command to `npm run build`, and output directory to `dist`. Set the project's Production Branch to `staging`. This keeps the existing production Vercel project and its domain settings separate.

Set `VITE_API_URL` in the staging Vercel project to `https://<render-service-host>/api`. Set it for the Preview and Production environments used by the staging project. After the first Render deploy, add the exact Vercel staging origin to both Render `FRONTEND_URL` and `CORS_ALLOWED_ORIGINS`, then redeploy the Render service.

## What runs on each branch

- `staging`: GitHub validation plus automatic Vercel and Render staging deployments. It does not run the VPS deployment workflows.
- `main`: existing VPS workflows only for the backend and payment portal paths they already watch. Vercel's existing production project behavior is managed separately in that project's Git settings.
