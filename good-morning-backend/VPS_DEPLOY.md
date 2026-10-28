# Deploy the API to your VPS with GitHub Actions and PM2

The workflow is `.github/workflows/deploy-backend.yml`. It builds on GitHub Actions, packages only compiled JavaScript, the schema, and production Node dependencies, copies that archive over SSH, creates the database if it is missing, runs migrations, bootstraps the initial account and rooms, then starts or reloads the API with PM2. It does not copy the frontend or source tree.

A new database receives the six existing hostel units and 49 room records, plus one `SUPER_MANAGER` login configured by you. Tenants, rent payments, restaurant items, grocery products, sales, expenses, and demo accounts are not seeded. Each deploy reruns the safe bootstrap: it leaves existing users and rooms as they are. If `good_morning` already exists, the workflow preserves its data and applies migrations; it will not erase existing sales or accounts.

## 1. Allow network traffic

In Lightsail's Networking firewall, allow TCP `22`, `80`, and `443`. Do not add `5432` or `4000`. On Ubuntu, inspect the existing firewall before changing rules:

```bash
sudo ufw status verbose
```

If UFW is inactive, add the OpenSSH, HTTP, and HTTPS allow rules before enabling it. If it is active or has custom rules, review them before making changes so SSH remains accessible.

The API binds to `127.0.0.1:4000`. Nginx should proxy your API hostname to that address; PostgreSQL stays local on `127.0.0.1:5432`.

## 2. Create PostgreSQL login roles once

SSH to the VPS and open PostgreSQL as its administrator:

```bash
sudo -u postgres psql
```

Create two separate login roles. The migration role can create the application database; the API role cannot create databases or alter the schema.

```sql
CREATE ROLE good_morning_migrator LOGIN CREATEDB;
\password good_morning_migrator
CREATE ROLE good_morning_app LOGIN;
\password good_morning_app
\quit
```

Use a strong password for each. When entering them into connection URLs below, URL-encode special characters. Use the same passwords in the matching environment files. PostgreSQL must accept loopback connections, which is the Ubuntu default; do not expose it publicly.

The GitHub deployment calls the compiled `dist/db/provision.js` to connect to the local PostgreSQL server as the migration role, create `good_morning` when absent, and set up runtime grants. The following migration step applies `schema.sql`.

## 3. Prepare a dedicated deploy account and directories

Use the Linux account that will receive the GitHub SSH key. For example, if it is `ubuntu`, SSH in as `ubuntu` and run:

```bash
sudo mkdir -p /srv/good-morning/releases /srv/good-morning/shared
sudo chown -R "$USER":"$USER" /srv/good-morning
chmod 750 /srv/good-morning /srv/good-morning/releases /srv/good-morning/shared
```

The deployment workflow extracts releases and runs PM2 as that SSH account, not as root. PM2 must be installed for that same account. Configure it to start after reboot once:

```bash
pm2 startup systemd
```

Run the `sudo ...` command PM2 prints, exactly as shown. The deploy workflow runs `pm2 save` after it starts the API.

## 4. Put application and bootstrap credentials on the VPS

Create `/srv/good-morning/shared/app.env`:

```dotenv
DATABASE_URL=postgres://good_morning_app:APP_PASSWORD@127.0.0.1:5432/good_morning
JWT_SECRET=PASTE_A_LONG_RANDOM_SECRET
JWT_EXPIRES_IN=12h
PORT=4000
FRONTEND_URL=https://www.goodmorningmw.online,https://goodmorningmw.online
```

Create `/srv/good-morning/shared/deploy.env`:

```dotenv
MIGRATION_DATABASE_URL=postgres://good_morning_migrator:MIGRATOR_PASSWORD@127.0.0.1:5432/good_morning
SEED_SUPER_EMAIL=your-admin-email@example.com
SEED_SUPER_PASSWORD=CHOOSE_A_LONG_UNIQUE_PASSWORD
SEED_SUPER_NAME=Your Name
```

The initial login uses `SEED_SUPER_EMAIL` and `SEED_SUPER_PASSWORD`. Use a password with at least 12 characters. The seed skips account creation if any user already exists. Never put these database or login credentials in GitHub Actions secrets: the workflow reads them from these server-side files, and the API process only receives `app.env` values.

Create and protect the files as the same Linux account that runs PM2:

```bash
nano /srv/good-morning/shared/app.env
nano /srv/good-morning/shared/deploy.env
chmod 600 /srv/good-morning/shared/app.env /srv/good-morning/shared/deploy.env
```

Generate a JWT secret on the VPS with `openssl rand -hex 32`. `FRONTEND_URL` accepts a comma-separated list of exact browser origins; include both the `www` and apex domains if users may open either. Keep each origin exact, including `https://` and any non-default port. The app and deployment connection URLs should use the role passwords from step 2.

## 5. Configure GitHub Actions access

Add an SSH public key for the VPS login account to that account's `~/.ssh/authorized_keys`. Keep its matching private key on your computer and register it in the repository at **Settings → Secrets and variables → Actions**.

Add these Actions variables:

- `VPS_HOST`: the VPS static IPv4 address or DNS name.
- `VPS_USER`: the Linux account prepared in step 3, for example `ubuntu`.
- `VPS_SSH_PORT`: SSH port; optional when it is `22`. Do not set this to the API port (`3000` is commonly used by the app, not SSH).
- `VPS_KNOWN_HOSTS`: the verified SSH host key line for this host.

Add the private deployment key as an Actions variable or secret:

- `VPS_SSH_KEY`: the unencrypted OpenSSH private deployment key paired with the public key installed on the VPS. The workflow accepts the raw multiline key or a one-line base64-encoded key. It checks the variables `VPS_SSH_KEY_ACTION2`, `VPS_SSH_KEY_B64`, and `VPS_SSH_KEY`, then secrets named `VPS_SSH_KEY_B64` or `VPS_SSH_KEY`.

Get the host key line from a trusted connection, or inspect `ssh-keyscan -H -p 22 YOUR_VPS_HOST` and compare its fingerprint with the server before saving it. Never disable host-key checking in the workflow.

## 6. Set up Nginx for the API hostname

Point a DNS A record such as `api.example.com` to the VPS static IP. Add an Nginx site that proxies the API hostname to `http://127.0.0.1:4000`, forwarding the original `Host`, `X-Real-IP`, `X-Forwarded-For`, and `X-Forwarded-Proto` headers. Then obtain and renew a TLS certificate for that hostname. The Lightsail and Ubuntu firewalls should allow 80/443 for certificate validation and HTTPS requests. Set `FRONTEND_URL` in `app.env` to the frontend's actual origin.

## 7. Deploy

Push the workflow and setup changes to the GitHub repository's `main` branch, or start **Actions → Build and deploy backend → Run workflow**. The release is built on GitHub and copied to `/srv/good-morning/releases/<commit>`. The workflow does not SSH-clone the repository or build on the VPS. Check `/api/health` through the HTTPS API hostname and use `pm2 status` / `pm2 logs good-morning-api` on the server.

The workflow requires Node 22 on the runner and uses the production dependency versions in `package-lock.json`. Change the workflow branch filter if your deployment branch is not `main`.
