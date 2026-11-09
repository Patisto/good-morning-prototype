-- Rollback for a disposable installation only. Do not run in production: financial records are retained by policy.
DROP TABLE IF EXISTS payment_events;
DROP TABLE IF EXISTS payment_allocations;
DROP TABLE IF EXISTS payment_attempts;
DROP INDEX IF EXISTS uq_rent_receipts_payment_attempt;
DROP TRIGGER IF EXISTS tenants_phone_normalized_trigger ON tenants;
DROP FUNCTION IF EXISTS sync_tenant_phone_normalized();
DROP FUNCTION IF EXISTS normalize_malawi_phone_sql(text);
DROP INDEX IF EXISTS idx_tenants_phone_normalized;
ALTER TABLE tenants DROP COLUMN IF EXISTS phone_normalized;
ALTER TABLE rent_receipts DROP COLUMN IF EXISTS payment_attempt_id;
