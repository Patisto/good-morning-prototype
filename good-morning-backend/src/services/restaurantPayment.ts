import crypto from 'crypto';
import { pool } from '../db/pool';
import { config } from '../config';
import { check, HttpError, today, transaction } from '../utils/http';
import { business, pricedLines, type SalesBusiness } from './inventory';
import { payChangu, ProviderPayment } from './paychangu';
import { notifyOwnerOfPayment } from './paymentNotifications';

const cents = (value: unknown) => {
  const parsed = Number(value);
  check(Number.isFinite(parsed) && parsed > 0, 'Invalid payment amount.');
  return Math.round(parsed * 100);
};
const canonicalCurrency = (value: string) => value.toUpperCase() === 'MK' ? 'MWK' : value.toUpperCase();

export class RestaurantPaymentService {
  async initiate(input: { business: unknown; amount: unknown; items: unknown; requestId?: unknown; cashier: string }) {
    check(config.paychanguConfigured, 'PayChangu checkout payments are not configured.', 503);
    const scope = business(input.business);
    check(scope !== 'GROCERY', 'Choose a restaurant business.');
    const requestedAmount = cents(input.amount);
    const requestId = typeof input.requestId === 'string' && input.requestId.length <= 100 ? input.requestId : null;
    const created = await transaction(async db => {
      if (requestId) {
        const existing = await db.query('SELECT reference,charge_id,checkout_url,status,amount FROM restaurant_payment_attempts WHERE request_id=$1', [requestId]);
        if (existing.rowCount) return { existing: existing.rows[0] };
      }
      const lines = await pricedLines(db, scope, today(), input.items);
      const total = Math.round(lines.reduce((sum, line) => sum + line.quantity * line.unitPrice * 100, 0));
      check(total === requestedAmount, 'Payment amount does not match the sale total.');
      const reference = `GMR-${crypto.randomBytes(16).toString('hex')}`;
      const result = await db.query(`INSERT INTO restaurant_payment_attempts
        (reference,charge_id,business,amount,currency,items,cashier,status,request_id,expires_at)
        VALUES($1,$1,$2,$3,$4,$5,$6,'PENDING',$7,now()+interval '30 minutes')
        RETURNING reference,charge_id,status,amount`, [
        reference, scope, (requestedAmount / 100).toFixed(2), config.currency,
        JSON.stringify(lines), input.cashier, requestId,
      ]);
      return { created: result.rows[0] };
    });
    if (created.existing) return created.existing;
    try {
      const checkoutUrl = await payChangu.createCheckout({
        reference: created.created.reference,
        amount: String(created.created.amount),
        firstName: 'Restaurant', lastName: 'Customer',
        title: 'Good Morning Restaurant', description: 'Restaurant POS payment',
      });
      await pool.query("UPDATE restaurant_payment_attempts SET checkout_url=$2,updated_at=now() WHERE reference=$1", [created.created.reference, checkoutUrl]);
      return { reference: created.created.reference, checkout_url: checkoutUrl, status: 'PENDING', amount: Number(created.created.amount) };
    }
    catch (error) {
      console.error('Restaurant PayChangu initiation failed', {
        reference: created.created.reference,
        reason: error instanceof Error ? error.message : String(error),
      });
      await pool.query("UPDATE restaurant_payment_attempts SET status='FAILED',failure_reason='PayChangu charge could not be initiated',updated_at=now() WHERE reference=$1 AND status='PENDING'", [created.created.reference]);
      throw new HttpError(503, 'Payment service is temporarily unavailable.');
    }
  }

  async verifyAndPost(reference: string): Promise<string> {
    const attempt = await pool.query('SELECT * FROM restaurant_payment_attempts WHERE reference=$1 OR charge_id=$1', [reference]);
    if (!attempt.rowCount) return 'unknown_reference';
    const row = attempt.rows[0];
    if (['SUCCEEDED', 'FAILED', 'CANCELLED', 'EXPIRED'].includes(row.status)) return row.status.toLowerCase();
    let verified: ProviderPayment;
    try { verified = await payChangu.verify(row.reference); }
    catch { return 'verification_deferred'; }
    const matches = verified.txRef === row.reference
      && cents(verified.amount) === cents(row.amount)
      && canonicalCurrency(verified.currency) === canonicalCurrency(row.currency);
    const result = await transaction(async db => {
      const locked = await db.query('SELECT * FROM restaurant_payment_attempts WHERE id=$1 FOR UPDATE', [row.id]);
      const current = locked.rows[0];
      if (current.status === 'SUCCEEDED') return 'already_succeeded';
      if (!matches) {
        await db.query("UPDATE restaurant_payment_attempts SET status='FAILED',failure_reason='Provider verification mismatch',updated_at=now() WHERE id=$1", [row.id]);
        return 'mismatch';
      }
      if (['failed', 'cancelled', 'expired'].includes(verified.status)) {
        await db.query('UPDATE restaurant_payment_attempts SET status=$2,failure_reason=$3,updated_at=now() WHERE id=$1', [row.id, verified.status.toUpperCase(), `Provider status: ${verified.status}`]);
        return verified.status;
      }
      if (!['success', 'succeeded'].includes(verified.status)) {
        await db.query("UPDATE restaurant_payment_attempts SET status='PROCESSING',updated_at=now() WHERE id=$1", [row.id]);
        return 'processing';
      }
      const requestedLines = row.items as Array<{ itemId: string; quantity: number }>;
      const lines = await pricedLines(db, row.business as SalesBusiness, today(), requestedLines);
      const currentTotal = Math.round(lines.reduce((sum, line) => sum + line.quantity * line.unitPrice * 100, 0));
      check(currentTotal === cents(row.amount), 'Sale changed while payment was pending.');
      const sale = await db.query(`INSERT INTO sales(business,date,time,total,payment_method,cashier,inventory_tracked)
        VALUES($1,$2,to_char(now() AT TIME ZONE 'Africa/Blantyre','HH24:MI'),$3,'PAYCHANGU',$4,true) RETURNING id`, [row.business,today(),row.amount,row.cashier]);
      for (const line of lines) await db.query('INSERT INTO sale_items(sale_id,item_id,name,quantity,unit_price) VALUES($1,$2,$3,$4,$5)', [sale.rows[0].id, line.itemId, line.name, line.quantity, line.unitPrice]);
      await db.query("UPDATE restaurant_payment_attempts SET status='SUCCEEDED',provider_transaction_id=COALESCE($2,provider_transaction_id),sale_id=$3,paid_at=now(),updated_at=now() WHERE id=$1", [row.id, verified.reference, sale.rows[0].id]);
      return 'succeeded';
    });
    if (result === 'succeeded') {
      await notifyOwnerOfPayment({ business: row.business as SalesBusiness, amount: Number(row.amount), paymentMethod: 'PAYCHANGU', paymentDate: new Date().toISOString().slice(0, 10), reference: row.reference, details: `Restaurant sale recorded by ${row.cashier}` });
    }
    return result;
  }
}

export const restaurantPaymentService = new RestaurantPaymentService();
