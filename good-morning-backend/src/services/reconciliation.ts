import { pool } from '../db/pool';
import { config } from '../config';
import { paymentVerificationService } from './payment';
export async function reconcile(reference?: string) {
  const result = await pool.query(`SELECT reference FROM payment_attempts WHERE status IN ('PENDING','PROCESSING') AND ($1::text IS NULL OR reference=$1) ORDER BY created_at LIMIT 100`, [reference || null]);
  const outcomes: Record<string, string> = {};
  for (const row of result.rows) outcomes[row.reference] = await paymentVerificationService.verifyAndPost(row.reference);
  await pool.query("UPDATE payment_attempts SET status='EXPIRED',failure_reason='Payment window expired',updated_at=now() WHERE status IN ('PENDING','PROCESSING') AND expires_at<now()");
  return outcomes;
}
export function startReconciliationScheduler() {
  if (!config.paychanguConfigured) {
    console.warn('PayChangu reconciliation is disabled until payment settings are configured.');
    return;
  }
  setInterval(() => reconcile().catch(error => console.error('Payment reconciliation failed', error)), config.reconcileIntervalMinutes * 60000).unref();
}
