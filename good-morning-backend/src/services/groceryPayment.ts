import crypto from 'crypto';
import { pool } from '../db/pool';
import { config } from '../config';
import { check, HttpError, transaction } from '../utils/http';
import { normalizeMalawiPhone } from './phone';
import { payChangu, payChanguOperators, DirectCharge } from './paychangu';

type PaymentNetwork = keyof typeof payChanguOperators;
type SaleLine = { itemId: string; name: string; quantity: number; unitPrice: number };

const cents = (value: string | number) => {
  const match = String(value).match(/^\d+(?:\.\d{1,2})?$/);
  check(!!match, 'Invalid monetary amount.');
  return Math.round(Number(value) * 100);
};
const canonicalCurrency = (value: string) => value.toUpperCase() === 'MK' ? 'MWK' : value.toUpperCase();

export class GroceryPaymentService {
  async initiate(input: { amount: unknown; network: unknown; phone: unknown; items: unknown; requestId?: unknown; userId: string; cashier: string }) {
    check(config.paychanguDirectConfigured, 'PayChangu payments are not configured.', 503);
    check(input.network === 'AIRTEL_MONEY' || input.network === 'TNM_MPAMBA', 'Unsupported mobile money network.');
    const phone = normalizeMalawiPhone(input.phone);
    const amount = Number(input.amount);
    check(Number.isFinite(amount) && amount > 0, 'Invalid payment amount.');
    check(Array.isArray(input.items) && input.items.length > 0 && input.items.length <= 100, 'A sale must contain items.');
    const requestId = typeof input.requestId === 'string' && input.requestId.length <= 100 ? input.requestId : null;
    const created = await transaction(async db => {
      if (requestId) {
        const existing = await db.query('SELECT reference,charge_id,status,amount FROM grocery_payment_attempts WHERE request_id=$1', [requestId]);
        if (existing.rowCount) return { existing: existing.rows[0] };
      }
      const lines: SaleLine[] = [];
      const requested = new Map<string, number>();
      let totalCents = 0;
      for (const raw of input.items as Array<Record<string, unknown>>) {
        check(typeof raw.itemId === 'string' && Number.isFinite(Number(raw.quantity)) && Number(raw.quantity) > 0, 'Invalid sale item.');
        const product = await db.query(`SELECT p.id,p.name,p.selling_price,COALESCE(SUM(e.quantity),0)-COALESCE((SELECT SUM(si.quantity) FROM sale_items si JOIN sales s ON s.id=si.sale_id WHERE si.item_id=p.id::text AND s.inventory_tracked=true AND s.status='COMPLETED'),0) AS available
          FROM business_products p LEFT JOIN stock_entries e ON e.product_id=p.id WHERE p.id=$1 AND p.business='GROCERY' AND p.archived_at IS NULL GROUP BY p.id`, [raw.itemId]);
        check(product.rowCount, 'Product not found.', 404);
        const quantity = Number(raw.quantity), unitPrice = Number(product.rows[0].selling_price);
        const requestedQuantity = (requested.get(product.rows[0].id) || 0) + quantity;
        check(Number(product.rows[0].available) >= requestedQuantity, `${product.rows[0].name} does not have enough stock.`);
        requested.set(product.rows[0].id, requestedQuantity);
        totalCents += Math.round(quantity * unitPrice * 100);
        lines.push({ itemId: product.rows[0].id, name: product.rows[0].name, quantity, unitPrice });
      }
      check(totalCents === cents(amount), 'Payment amount does not match the sale total.');
      const reference = `GMS-${crypto.randomBytes(16).toString('hex')}`;
      const result = await db.query(`INSERT INTO grocery_payment_attempts(reference,charge_id,business,amount,currency,network,phone,items,cashier,status,request_id,expires_at)
        VALUES($1,$1,'GROCERY',$2,$3,$4,$5,$6,$7,'PENDING',$8,now()+interval '30 minutes') RETURNING reference,charge_id,status,amount`, [reference, amount.toFixed(2), config.currency, input.network, phone, JSON.stringify(lines), input.cashier, requestId]);
      return { created: result.rows[0] };
    });
    if (created.existing) return created.existing;
    try {
      const direct = await payChangu.initializeDirectCharge({ mobile: phone, operatorRef: payChanguOperators[input.network as PaymentNetwork], amount: Number(created.created.amount).toFixed(2), chargeId: created.created.charge_id });
      await pool.query('UPDATE grocery_payment_attempts SET provider_transaction_id=$2,status=$3,updated_at=now() WHERE reference=$1', [created.created.reference, direct.providerReference, direct.status === 'success' ? 'PROCESSING' : 'PENDING']);
      return { reference: created.created.reference, status: direct.status, amount: Number(created.created.amount), network: input.network };
    } catch (error) {
      await pool.query("UPDATE grocery_payment_attempts SET status='FAILED',failure_reason='PayChangu charge could not be initiated',updated_at=now() WHERE reference=$1 AND status='PENDING'", [created.created.reference]);
      throw new HttpError(503, 'Payment service is temporarily unavailable.');
    }
  }

  async verifyAndPost(reference: string): Promise<string> {
    const attempt = await pool.query('SELECT * FROM grocery_payment_attempts WHERE reference=$1 OR charge_id=$1', [reference]);
    if (!attempt.rowCount) return 'unknown_reference';
    const row = attempt.rows[0];
    if (['SUCCEEDED', 'FAILED', 'CANCELLED', 'EXPIRED'].includes(row.status)) return row.status.toLowerCase();
    let verified: DirectCharge;
    try { verified = await payChangu.verifyDirectCharge(row.charge_id); } catch { return 'verification_deferred'; }
    const matches = verified.chargeId === row.charge_id && cents(verified.amount) === cents(row.amount) && canonicalCurrency(verified.currency) === canonicalCurrency(row.currency);
    return transaction(async db => {
      const locked = await db.query('SELECT * FROM grocery_payment_attempts WHERE id=$1 FOR UPDATE', [row.id]);
      const current = locked.rows[0];
      if (current.status === 'SUCCEEDED') return 'already_succeeded';
      if (!matches) {
        await db.query("UPDATE grocery_payment_attempts SET status='FAILED',failure_reason='Provider verification mismatch',updated_at=now() WHERE id=$1", [row.id]);
        return 'mismatch';
      }
      if (['failed', 'cancelled', 'expired'].includes(verified.status)) {
        await db.query('UPDATE grocery_payment_attempts SET status=$2,failure_reason=$3,updated_at=now() WHERE id=$1', [row.id, verified.status.toUpperCase(), `Provider status: ${verified.status}`]);
        return verified.status;
      }
      if (!['success', 'succeeded'].includes(verified.status)) {
        await db.query("UPDATE grocery_payment_attempts SET status='PROCESSING',updated_at=now() WHERE id=$1", [row.id]);
        return 'processing';
      }
      const lines = row.items as SaleLine[];
      const requested = new Map<string, number>();
      for (const line of lines) {
        requested.set(line.itemId, (requested.get(line.itemId) || 0) + line.quantity);
      }
      for (const [itemId, quantity] of requested) {
        const available = await db.query(`SELECT COALESCE(SUM(e.quantity),0)-COALESCE((SELECT SUM(si.quantity) FROM sale_items si JOIN sales s ON s.id=si.sale_id WHERE si.item_id=$1 AND s.inventory_tracked=true AND s.status='COMPLETED'),0) AS available FROM stock_entries e WHERE e.product_id=$1`, [itemId]);
        check(Number(available.rows[0].available) >= quantity, 'Stock changed while payment was pending.');
      }
      const sale = await db.query(`INSERT INTO sales(business,date,time,total,payment_method,cashier,inventory_tracked) VALUES('GROCERY',CURRENT_DATE,to_char(now() AT TIME ZONE 'Africa/Blantyre','HH24:MI'),$1,'PAYCHANGU',$2,true) RETURNING id`, [row.amount, row.cashier]);
      for (const line of lines) await db.query('INSERT INTO sale_items(sale_id,item_id,name,quantity,unit_price) VALUES($1,$2,$3,$4,$5)', [sale.rows[0].id, line.itemId, line.name, line.quantity, line.unitPrice]);
      await db.query("UPDATE grocery_payment_attempts SET status='SUCCEEDED',provider_transaction_id=COALESCE($2,provider_transaction_id),sale_id=$3,paid_at=now(),updated_at=now() WHERE id=$1", [row.id, verified.providerReference, sale.rows[0].id]);
      return 'succeeded';
    });
  }
}

export const groceryPaymentService = new GroceryPaymentService();
