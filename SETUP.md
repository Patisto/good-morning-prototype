# Good Morning management update

The application now saves operational records through the API to PostgreSQL. A connection is required to load and save; there is no background offline sync.

## Run the update

Use the existing backend `.env` with `DATABASE_URL`, `JWT_SECRET`, and `FRONTEND_URL`. The frontend uses `VITE_API_URL` (default `http://localhost:4000/api`).

From the project root:

```bash
cd good-morning-backend
docker compose up -d db
npm run migrate
npm run dev
```

The local `.env` points to PostgreSQL on `localhost:5433`, which is provided by
the `db` service in `docker-compose.yml`. If Docker reports permission denied
for `/var/run/docker.sock`, add your user to the Docker group and start a new
login session before retrying:

```bash
sudo usermod -aG docker "$USER"
```

Alternatively, run the Compose command with an account that has Docker access.

In another terminal:

```bash
cd good-morning-frontend-main
npm run dev
```

For deployment, rebuild both projects using `npm run build` in each directory. The checked-in `dist` files are old generated assets; source changes are the deliverable. Backend `npm start` runs the compiled files, so rebuild before starting it.

Existing users keep their accounts. For a new empty installation, set `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` (at least 12 characters), and optionally `SEED_ADMIN_NAME` in the backend environment, then run `npm run seed`. This creates one owner without inserting sample rooms, menus, sales, or expenses. Owners and administrators can use **Team & roles** to add staff or change roles.

## Workflows

- **Hostel → Configuration:** add or rename housing units, then select an existing unit when adding a room. Add rooms, rename them, set capacity, delete vacant rooms, and set per-room or selected-room batch prices. Each add/edit action opens its own modal; canceling leaves the existing record unchanged. Deletion archives rooms so historical records remain. Default rent is copied into the new-room form; changing the default does not reprice existing rooms.
- **Hostel → Rooms:** select one housing unit or All units to filter the room grid. Existing unit names are imported by the migration, and renaming a unit updates its rooms.
- **Hostel → Tenants:** register tenants, edit profiles, move rooms, download agreements, and check out tenants. Capacity is enforced by the server. Room assignment history is retained for later billing.
- **Hostel → Receive payment:** use the prominent button on the hostel page, a tenant profile, the Payments tab, or Finance. Select the tenant and month, review rent/paid/balance, then record the amount, date, and payment method. A missing monthly charge is created atomically with the payment; generating charges first is no longer required.
- **Hostel → Payments:** optionally generate all charges for a month to list outstanding balances. Record partial or full payments and review receipts. Add balance notes and view individual receipts. Overpayments are shown as credits. Generating the same month again does not duplicate or reprice existing charges.
- **Restaurant:** select A (morning) or B (staff afternoon). Register individual sellable items in Configuration, such as chicken wings or thighs, with a unit and price. Receive that day's quantities in Stock, then record sales. Each date and restaurant has separate stock. Extra receipts add to that day's quantity; unsold stock does not automatically carry to the next day.
- **Grocery:** configure products and prices, receive deliveries, and record sales. Stock carries forward between dates.
- **Finance:** the shared page replaces the separate business expense tabs. Filter by date and permitted business, review income/expenses/net cash and the transaction ledger, and record expenses in a modal. Hostel receipts and completed sales populate income automatically. Receiving stock does not create an expense. Business managers see only their department; supervisors and accountants can see all permitted businesses. The old `/expenses` page redirects to Finance.
- **Feedback:** successful creates, edits, payments, stock receipts, sales, and deletions display notifications only after server confirmation. Errors retain the form and display feedback. Product and staff account editors also use separate modal drafts.
- **Dashboard:** owners, administrators, super managers, and accountants can choose a date range and view combined revenue, expenses, and net cash, with separate A/B rows. Other staff see links to their permitted workspaces.

Rent is per tenant/bed, with full-month charges for move-in and checkout months. Prices have an effective month; existing monthly charges retain their original amount. Charges are created when receiving a payment or explicitly generated for the whole month; there is no automatic billing schedule. Advance payments may create a future monthly charge at the configured rate, which remains fixed after creation. Credits are retained against their charge and are not automatically transferred between months. The same restaurant manager can manage A and B. Dates use Africa/Blantyre. New sales must be recorded on today's date; earlier dates are available for review.

## Existing data

The migration is additive and transactional. It preserves old tables and imports recognized monthly hostel balances/receipts and the grocery catalogue/remaining stock. Run migrations before starting the updated API.

Legacy restaurant sales and expenses remain in a separate **Restaurant · Legacy records** report row because their A/B location is unknown. Old menus and raw food records remain archived in their original tables; they do not populate the new sellable-item catalogue or silently become expenses. Unrecognized legacy rent labels remain in `hostel_payments` for reconciliation.

The old browser database is retained. Administrators see an export notice when that browser has queued changes. Download its JSON and reconcile those records with PostgreSQL before clearing browser data. Browser records are **not automatically imported**: the old app mixed sample records with real changes and used IDs that differ from server IDs. Inspect each used browser separately.

## Code layout

- Backend `routes/hostel.routes.ts` and `services/rent.ts`: housing units, room configuration, tenant profiles, monthly charges, rent quotes, and payment collection.
- Backend `routes/finance.routes.ts`: permission-scoped cash income, expenses, and transaction history.
- Backend `routes/trading.routes.ts` and `services/inventory.ts`: shared restaurant/grocery operations, stock calculation, server prices, and transactional sales.
- Backend `types.ts` and `middleware/auth.ts`: permissions, including active account checks on every request.
- Backend `utils/http.ts`: validation, asynchronous error handling, transactions, and financial retry IDs.
- Frontend `components/management/`: dedicated room/unit, product, account, payment, and expense modals; shared trading workspace. `components/ui/FormModal.vue` provides focus handling and keyboard dismissal. `stores/notifications.ts` centralizes success/error feedback.
- Frontend `views/FinanceView.vue`: the shared income and expense workspace.
- Frontend `composables/`: shared request state and trading data access.
- Frontend `lib/api.ts`: API calls and PostgreSQL field/number conversion.

Financial operations use retry IDs to prevent duplicate submissions when the same browser session retries an unchanged request after a lost response. Product rows are locked during sales so stock checks and sales commit together.

## Verification handoff

Testing is left to you as requested. Earlier frontend and backend builds passed before the final role management, retry handling, and migration refinements; the final source has not been rebuilt or integration-tested. No database migration was applied and no deployment was performed.

Useful scenarios to cover: migration on existing data and a second migration run; room capacity and deletion restrictions; batch pricing without changing old charges; partial payments and credits in different months; room moves and backdated rent generation; A/B separation; concurrent sales of the last available unit; grocery carry-forward; expense permissions; super-manager totals; account deactivation; and exporting old browser records.

### Housing units and Finance follow-up

Run `npm run migrate` in the backend again before using this update. The migration adds `housing_units`, imports existing room unit names, and links every room using `housing_unit_id`. Source changes in this follow-up have not been built or tested, per your testing preference.

Suggested manual scenarios: rename a unit and verify its rooms still belong to it; filter one unit and All units; cancel each edit modal; receive a partial payment for a tenant with no generated charge; retry a payment after a lost response; check that the receipt appears as Finance income on the payment date; verify department managers cannot access another department's Finance data; create a staff account and confirm the notification appears.


## VPS deployment

For GitHub Actions deployment to an AWS VPS, local PostgreSQL provisioning, PM2 startup, server credential files, Nginx routing, and GitHub repository secrets/variables, follow [good-morning-backend/VPS_DEPLOY.md](good-morning-backend/VPS_DEPLOY.md).
