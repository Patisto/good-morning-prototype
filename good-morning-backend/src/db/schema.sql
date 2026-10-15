-- Good Morning — central PostgreSQL schema.
-- Postgres is the authoritative long-term store; the local SQLite copy in the
-- offline client mirrors this shape and syncs into it. Safe to re-run.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN (
    'OWNER', 'ADMINISTRATOR', 'HOSTEL_MANAGER', 'RESTAURANT_MANAGER',
    'RESTAURANT_CASHIER', 'GROCERY_MANAGER', 'GROCERY_CASHIER',
    'ACCOUNTANT', 'SYSTEM_ADMINISTRATOR'
  )),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rooms (
  id text PRIMARY KEY, -- e.g. AREA90-01
  housing_unit text NOT NULL,
  identifier text NOT NULL,
  label text,
  type text NOT NULL CHECK (type IN ('SINGLE', 'DOUBLE')),
  capacity int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  middle_name text,
  last_name text NOT NULL,
  gender text,
  date_of_birth date,
  phone text,
  alt_phone text,
  email text,
  home_district text,
  home_address text,
  emergency_contact_name text,
  emergency_contact_phone text,
  emergency_contact_relationship text,
  institution text,
  programme text,
  faculty text,
  department text,
  year_of_study int,
  reg_number text,
  academic_year text,
  room_id text REFERENCES rooms(id),
  move_in_date date,
  monthly_amount numeric(12, 2) NOT NULL DEFAULT 0,
  deposit numeric(12, 2) NOT NULL DEFAULT 0,
  agreement_status text NOT NULL DEFAULT 'PENDING' CHECK (agreement_status IN ('PENDING', 'SIGNED', 'EXPIRED')),
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hostel_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  period_label text NOT NULL, -- e.g. "September 2026"
  expected_amount numeric(12, 2) NOT NULL DEFAULT 0,
  amount_paid numeric(12, 2) NOT NULL DEFAULT 0,
  payment_method text CHECK (payment_method IN ('CASH', 'AIRTEL_MONEY', 'TNM_MPAMBA', 'BANK', 'OTHER')),
  payment_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS food_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  unit text NOT NULL CHECK (unit IN ('kg', 'g', 'litre', 'piece')),
  cost numeric(12, 2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS daily_food_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  food_item_id uuid NOT NULL REFERENCES food_items(id),
  quantity numeric(12, 2) NOT NULL,
  cost numeric(12, 2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  selling_price numeric(12, 2) NOT NULL DEFAULT 0,
  available boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS grocery_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  selling_price numeric(12, 2) NOT NULL DEFAULT 0,
  buying_price numeric(12, 2) NOT NULL DEFAULT 0,
  current_stock numeric(12, 2) NOT NULL DEFAULT 0,
  low_stock_level numeric(12, 2) NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'piece',
  barcode text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business text NOT NULL CHECK (business IN ('RESTAURANT', 'GROCERY')),
  date date NOT NULL,
  time text NOT NULL,
  total numeric(12, 2) NOT NULL DEFAULT 0,
  payment_method text NOT NULL CHECK (payment_method IN ('CASH', 'AIRTEL_MONEY', 'TNM_MPAMBA', 'BANK', 'OTHER')),
  status text NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('COMPLETED', 'CANCELLED')),
  cashier text,
  sync_status text NOT NULL DEFAULT 'SYNCED' CHECK (sync_status IN ('SYNCED', 'PENDING', 'FAILED')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  item_id text NOT NULL,
  name text NOT NULL,
  quantity numeric(12, 2) NOT NULL,
  unit_price numeric(12, 2) NOT NULL
);

CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  description text NOT NULL,
  amount numeric(12, 2) NOT NULL,
  business text NOT NULL CHECK (business IN ('HOSTEL', 'RESTAURANT', 'GROCERY', 'GENERAL')),
  date date NOT NULL,
  payment_method text NOT NULL CHECK (payment_method IN ('CASH', 'AIRTEL_MONEY', 'TNM_MPAMBA', 'BANK', 'OTHER')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id),
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenants_room_id ON tenants(room_id);
CREATE INDEX IF NOT EXISTS idx_hostel_payments_tenant_id ON hostel_payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_daily_food_records_date ON daily_food_records(date);
CREATE INDEX IF NOT EXISTS idx_sales_business_date ON sales(business, date);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_expenses_business_date ON expenses(business, date);

-- Operational management upgrade. Additive and safe to apply to existing data.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('OWNER','ADMINISTRATOR','SUPER_MANAGER','HOSTEL_MANAGER','RESTAURANT_MANAGER','RESTAURANT_CASHIER','GROCERY_MANAGER','GROCERY_CASHIER','ACCOUNTANT','SYSTEM_ADMINISTRATOR'));
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS checkout_date date;
CREATE TABLE IF NOT EXISTS hostel_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  default_monthly_price numeric(12,2) NOT NULL DEFAULT 0 CHECK (default_monthly_price >= 0)
);
INSERT INTO hostel_settings(id) VALUES (true) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS room_rates (
  room_id text REFERENCES rooms(id),
  effective_month text NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  PRIMARY KEY(room_id, effective_month)
);
INSERT INTO room_rates(room_id,effective_month,amount)
SELECT r.id, '0001-01', COALESCE(MAX(t.monthly_amount),0) FROM rooms r LEFT JOIN tenants t ON t.room_id=r.id
GROUP BY r.id ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS rent_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  month text NOT NULL CHECK (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  expected_amount numeric(12,2) NOT NULL CHECK (expected_amount >= 0),
  notes text NOT NULL DEFAULT '',
  UNIQUE(tenant_id,month)
);
CREATE TABLE IF NOT EXISTS rent_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  charge_id uuid NOT NULL REFERENCES rent_charges(id),
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  payment_method text NOT NULL CHECK (payment_method IN ('CASH','AIRTEL_MONEY','TNM_MPAMBA','BANK','OTHER')),
  payment_date date NOT NULL,
  recorded_by uuid REFERENCES users(id),
  legacy_payment_id uuid UNIQUE REFERENCES hostel_payments(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Preserve recognized legacy monthly balances and receipts. Unrecognized labels
-- remain in hostel_payments for manual reconciliation; nothing is deleted.
INSERT INTO rent_charges(tenant_id,month,expected_amount)
SELECT tenant_id, to_char(to_date(period_label,'FMMonth YYYY'),'YYYY-MM'), MAX(expected_amount)
FROM hostel_payments WHERE period_label ~ '^(January|February|March|April|May|June|July|August|September|October|November|December) [0-9]{4}$'
GROUP BY tenant_id,period_label ON CONFLICT DO NOTHING;
INSERT INTO rent_receipts(charge_id,amount,payment_method,payment_date,legacy_payment_id)
SELECT c.id,h.amount_paid,COALESCE(h.payment_method,'OTHER'),COALESCE(h.payment_date,h.created_at::date),h.id
FROM hostel_payments h JOIN rent_charges c ON c.tenant_id=h.tenant_id
AND c.month=CASE WHEN h.period_label ~ '^(January|February|March|April|May|June|July|August|September|October|November|December) [0-9]{4}$' THEN to_char(to_date(h.period_label,'FMMonth YYYY'),'YYYY-MM') END
WHERE h.amount_paid>0 AND h.period_label ~ '^(January|February|March|April|May|June|July|August|September|October|November|December) [0-9]{4}$'
ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS business_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business text NOT NULL CHECK (business IN ('RESTAURANT_A','RESTAURANT_B','GROCERY')),
  name text NOT NULL,
  category text NOT NULL DEFAULT '',
  unit text NOT NULL DEFAULT 'piece',
  selling_price numeric(12,2) NOT NULL CHECK (selling_price >= 0),
  buying_price numeric(12,2) NOT NULL DEFAULT 0 CHECK (buying_price >= 0),
  low_stock_level numeric(12,2) NOT NULL DEFAULT 0 CHECK (low_stock_level >= 0),
  archived_at timestamptz,
  legacy_id uuid UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS stock_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES business_products(id),
  date date NOT NULL,
  quantity numeric(12,2) NOT NULL CHECK (quantity > 0),
  notes text NOT NULL DEFAULT '',
  legacy_id uuid UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO business_products(id,business,name,category,unit,selling_price,buying_price,low_stock_level,legacy_id)
SELECT id,'GROCERY',name,category,unit,GREATEST(selling_price,0),GREATEST(buying_price,0),GREATEST(low_stock_level,0),id FROM grocery_products ON CONFLICT DO NOTHING;
INSERT INTO stock_entries(product_id,date,quantity,notes,legacy_id)
SELECT id,CURRENT_DATE,current_stock,'Opening stock imported from legacy grocery catalogue',id FROM grocery_products WHERE current_stock>0 ON CONFLICT DO NOTHING;
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_business_check;
ALTER TABLE sales ADD CONSTRAINT sales_business_check CHECK (business IN ('RESTAURANT','RESTAURANT_A','RESTAURANT_B','GROCERY'));
-- Only new sales reduce the new inventory ledger; legacy stock is already net of old sales.
ALTER TABLE sales ADD COLUMN IF NOT EXISTS inventory_tracked boolean NOT NULL DEFAULT false;
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_business_check;
ALTER TABLE expenses ADD CONSTRAINT expenses_business_check CHECK (business IN ('HOSTEL','RESTAURANT','RESTAURANT_A','RESTAURANT_B','GROCERY','GENERAL'));
CREATE INDEX IF NOT EXISTS idx_stock_product_date ON stock_entries(product_id,date);
CREATE INDEX IF NOT EXISTS idx_product_business ON business_products(business) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sale_items_item ON sale_items(item_id);
CREATE INDEX IF NOT EXISTS idx_receipts_charge ON rent_receipts(charge_id);
CREATE INDEX IF NOT EXISTS idx_receipts_date ON rent_receipts(payment_date);

-- Keep room assignment history so a later room move cannot change an unbilled past month.
CREATE TABLE IF NOT EXISTS tenant_room_history (
  tenant_id uuid REFERENCES tenants(id),
  effective_month text NOT NULL,
  room_id text NOT NULL REFERENCES rooms(id),
  PRIMARY KEY(tenant_id,effective_month)
);
INSERT INTO tenant_room_history(tenant_id,effective_month,room_id)
SELECT id,to_char(move_in_date,'YYYY-MM'),room_id FROM tenants WHERE room_id IS NOT NULL AND move_in_date IS NOT NULL
ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS request_receipts (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id),
  operation text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Housing units have stable IDs; changing a name keeps every room associated.
CREATE TABLE IF NOT EXISTS housing_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_housing_units_name ON housing_units(lower(btrim(name)));
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS housing_unit_id uuid REFERENCES housing_units(id);
INSERT INTO housing_units(name)
SELECT MIN(COALESCE(NULLIF(btrim(housing_unit),''),'Unassigned')) FROM rooms
WHERE housing_unit_id IS NULL
GROUP BY lower(COALESCE(NULLIF(btrim(housing_unit),''),'Unassigned')) ON CONFLICT DO NOTHING;
UPDATE rooms r SET housing_unit_id=u.id, housing_unit=u.name FROM housing_units u
WHERE r.housing_unit_id IS NULL AND lower(COALESCE(NULLIF(btrim(r.housing_unit),''),'Unassigned'))=lower(btrim(u.name));
ALTER TABLE rooms ALTER COLUMN housing_unit_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rooms_housing_unit ON rooms(housing_unit_id);
