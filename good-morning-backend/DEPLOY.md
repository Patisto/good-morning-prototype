# Prototype deployment

This deployment has three pieces:

```text
Vercel (Vue app)  ->  Render (Express API)  ->  Neon (PostgreSQL)
```

## 1. Create and prepare Neon

1. Create a Neon project and copy its pooled connection string from **Connect**.
   Keep `sslmode=require` (and any `channel_binding` parameter) in the URL.
2. From this directory, run the schema migration against Neon. Do not commit the
   connection string or put it in a frontend `VITE_` variable:

   ```bash
   DATABASE_URL='paste-your-neon-connection-string-here' npm run migrate
   DATABASE_URL='paste-your-neon-connection-string-here' npm run seed
   ```

   The seed command creates the demo accounts only when no users exist.

## 2. Deploy the API to Render

Push the repository root (the directory containing both projects) to GitHub,
then create a Render **Blueprint** from it. The root-level `render.yaml` creates
the API service. In Render, enter:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | The Neon connection string (secret) |
| `FRONTEND_URL` | Your production Vercel URL, for example `https://good-morning.vercel.app` |

After deployment, open `https://YOUR-API.onrender.com/api/health`. It must return
`{"status":"ok"}`. This URL is the API base URL used in the next step.

## 3. Deploy the frontend to Vercel

Import the same GitHub repository into Vercel, choosing
`good-morning-frontend-main` as the **Root Directory**. Vercel detects Vite.

Set this production environment variable before deploying:

| Variable | Value |
| --- | --- |
| `VITE_API_URL` | `https://YOUR-API.onrender.com/api` |

Redeploy after setting it. The `VITE_` prefix is required because Vite embeds
the API URL into the browser bundle. It is public by design; never put Neon or
JWT secrets in a `VITE_` variable.

## Verification

1. Visit the Vercel URL and sign in with `owner@goodmorning.mw` / `password123`.
2. In browser developer tools, confirm `POST /api/auth/login` returns `200`.
3. Confirm the API rejects a request from an origin other than `FRONTEND_URL`.
