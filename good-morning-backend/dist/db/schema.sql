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
