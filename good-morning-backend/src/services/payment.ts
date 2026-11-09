import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { pool } from '../db/pool';
import { config } from '../config';
import { check, HttpError, today, transaction } from '../utils/http';
import { ensureRentCharges, rentAccount } from './rent';
import { payChangu, ProviderPayment } from './paychangu';
import { notifyOwnerOfPayment } from './paymentNotifications';

const cents = (value: string | number) => {
  const s = String(value); const m = s.match(/^(\d+)(?:\.(\d{1,2}))?$/); check(!!m, 'Invalid monetary amount.');
  return BigInt(m![1]) * 100n + BigInt((m![2] || '').padEnd(2, '0') || '0');
};
const money = (value: string | number) => (Number(cents(value)) / 100).toFixed(2);
const outstanding = (account: { expectedAmount: number; openingBalance: number; amountPaid: number }) => money(account.expectedAmount + account.openingBalance - account.amountPaid);

export class LookupService {
  async lookup(phone: string) {
    const matches = await pool.query(`SELECT t.id,t.first_name,t.middle_name,t.last_name,t.reg_number,r.identifier AS room,u.name AS hostel
      FROM tenants t LEFT JOIN rooms r ON r.id=t.room_id LEFT JOIN housing_units u ON u.id=r.housing_unit_id
      WHERE t.phone_normalized=$1 AND t.deleted_at IS NULL AND t.checkout_date IS NULL`, [phone]);
    if (matches.rowCount !== 1) return null;
    const t = matches.rows[0], period = new Date().toISOString().slice(0, 7);
    await transaction(async db => ensureRentCharges(db, t.id, period));
    const account = await rentAccount(pool, t.id, period);
    const balance = outstanding(account);
    if (cents(balance) <= 0n || !account.chargeId) {
      return {
        status: 'no_balance',
        student: { display_name: [t.first_name, t.middle_name, t.last_name].filter(Boolean).join(' '), student_number: t.reg_number || '', hostel: t.hostel || '', room: t.room || '' },
        rental: { period, currency: config.currency, amount_due: money(account.expectedAmount + account.openingBalance), amount_paid: money(account.amountPaid), outstanding_balance: balance },
      };
    }
    const token = jwt.sign({ sub: t.id, charge: account.chargeId, period, balance }, config.lookupTokenSecret, { expiresIn: config.lookupTokenTtl });
    return { student: { display_name: [t.first_name, t.middle_name, t.last_name].filter(Boolean).join(' '), student_number: t.reg_number || '', hostel: t.hostel || '', room: t.room || '' }, rental: { period, currency: config.currency, amount_due: money(account.expectedAmount + account.openingBalance), amount_paid: money(account.amountPaid), outstanding_balance: balance }, lookup_token: token };
  }
}

type Claims = { sub: string; charge: string; period: string; balance: string };
function readToken(raw: unknown): Claims {
  check(typeof raw === 'string' && raw.length <= 2048, 'Invalid lookup token.');
  try { const claims = jwt.verify(raw, config.lookupTokenSecret) as Claims; check(!!claims.sub && !!claims.charge && /^\d{4}-\d{2}$/.test(claims.period), 'Invalid lookup token.'); return claims; }
  catch { throw new HttpError(400, 'Invalid or expired lookup token.'); }
}

export class PaymentInitiationService {
  async initiate(rawToken: unknown, requested: unknown, ip?: string) {
    const token = readToken(rawToken); const amount = money(requested as string | number); check(cents(amount) > 0n, 'Invalid payment amount.');
    const existing = await pool.query(`SELECT reference,checkout_url,status,amount FROM payment_attempts WHERE student_id=$1 AND rental_invoice_id=$2 AND amount=$3 AND status IN ('PENDING','PROCESSING') AND expires_at>now() ORDER BY created_at DESC LIMIT 1`, [token.sub, token.charge, amount]);
    if (existing.rowCount) return { checkout_url: existing.rows[0].checkout_url, reference: existing.rows[0].reference };
    const created = await transaction(async db => {
      await ensureRentCharges(db, token.sub, token.period);
      const account = await rentAccount(db, token.sub, token.period, true); const current = outstanding(account);
      check(cents(current) === cents(token.balance), 'The balance changed. Please look it up again.');
      const requestedCents = cents(amount), balanceCents = cents(current);
      check(config.allowPartial || requestedCents === balanceCents, 'Only the outstanding balance may be paid.');
      check(requestedCents >= cents(config.minPayment), 'Payment is below the minimum allowed amount.');
      check(config.allowOverpayment || requestedCents <= balanceCents, 'Payment exceeds the outstanding balance.');
      check(account.chargeId, 'No payable rental period found.');
      const reference = `GM-${crypto.randomBytes(16).toString('hex')}`;
      const result = await db.query(`INSERT INTO payment_attempts(reference,student_id,rental_invoice_id,amount,currency,status,balance_snapshot,initiated_ip,expires_at)
        VALUES($1,$2,$3,$4,$5,'PENDING',$6,$7,now()+($8 || ' minutes')::interval) RETURNING id,reference`, [reference, token.sub, account.chargeId, amount, config.currency, current, ip || null, String(config.pendingExpiryMinutes)]);
      return { id: result.rows[0].id, reference, amount, student: await db.query('SELECT first_name,last_name,email FROM tenants WHERE id=$1', [token.sub]) };
    });
    try {
      const student = created.student.rows[0];
      const checkoutUrl = await payChangu.createCheckout({ reference: created.reference, amount: created.amount, firstName: student.first_name, lastName: student.last_name, email: student.email });
      await pool.query('UPDATE payment_attempts SET checkout_url=$2,updated_at=now() WHERE id=$1', [created.id, checkoutUrl]);
      return { checkout_url: checkoutUrl, reference: created.reference };
    } catch (error) {
      await pool.query("UPDATE payment_attempts SET status='FAILED',failure_reason='Checkout provider unavailable',updated_at=now() WHERE id=$1 AND status='PENDING'", [created.id]);
      throw new HttpError(503, 'Payment service is temporarily unavailable.');
    }
  }
}

export class PaymentVerificationService {
  async verifyAndPost(reference: string, eventId?: string): Promise<string> {
    const attempt = await pool.query(`SELECT p.*,t.first_name,t.last_name,c.month AS rental_month
      FROM payment_attempts p JOIN tenants t ON t.id=p.student_id LEFT JOIN rent_charges c ON c.id=p.rental_invoice_id
      WHERE p.reference=$1`, [reference]);
    if (!attempt.rowCount) return 'unknown_reference';
    const a = attempt.rows[0]; let verified: ProviderPayment;
    try { verified = await payChangu.verify(reference); } catch { return 'verification_deferred'; }
    const amountMatches = config.allowOverpayment ? cents(verified.amount) >= cents(a.amount) : cents(verified.amount) === cents(a.amount), identityMatches = verified.txRef === a.reference && verified.currency === a.currency;
    const result = await transaction(async db => {
      const locked = await db.query('SELECT * FROM payment_attempts WHERE id=$1 FOR UPDATE', [a.id]); const row = locked.rows[0];
      if (row.status === 'SUCCEEDED') return 'already_succeeded';
      if (!identityMatches || !amountMatches) { await db.query("UPDATE payment_attempts SET status='PROCESSING',failure_reason='Provider verification mismatch; review required',updated_at=now() WHERE id=$1", [row.id]); return 'mismatch'; }
      const status = verified.status;
      if (status === 'success' || status === 'succeeded') {
        await db.query("UPDATE payment_attempts SET status='SUCCEEDED',provider_transaction_id=COALESCE($2,provider_transaction_id),paid_at=now(),updated_at=now() WHERE id=$1", [row.id, verified.reference]);
        const allocation = await db.query(`INSERT INTO payment_allocations(payment_attempt_id,student_id,rental_invoice_id,amount) VALUES($1,$2,$3,$4) ON CONFLICT(payment_attempt_id) DO NOTHING RETURNING id`, [row.id, row.student_id, row.rental_invoice_id, row.amount]);
        if (allocation.rowCount) await db.query(`INSERT INTO rent_receipts(charge_id,amount,payment_method,payment_date,payment_attempt_id) VALUES($1,$2,'PAYCHANGU',CURRENT_DATE,$3) ON CONFLICT (payment_attempt_id) WHERE payment_attempt_id IS NOT NULL DO NOTHING`, [row.rental_invoice_id, row.amount, row.id]);
        return 'succeeded';
      }
      if (['failed', 'cancelled', 'expired'].includes(status)) { await db.query('UPDATE payment_attempts SET status=$2,failure_reason=$3,updated_at=now() WHERE id=$1', [row.id, status.toUpperCase(), `Provider status: ${status}`]); return status; }
      await db.query("UPDATE payment_attempts SET status='PROCESSING',updated_at=now() WHERE id=$1", [row.id]); return 'processing';
    });
    if (result === 'succeeded') {
      await notifyOwnerOfPayment({
        business: 'HOSTEL',
        amount: Number(a.amount),
        paymentMethod: 'PAYCHANGU',
        paymentDate: today(),
        reference: a.reference,
        details: `${a.first_name} ${a.last_name} · rent ${a.rental_month}`,
      });
    }
    return result;
  }
}

export const lookupService = new LookupService();
export const paymentInitiationService = new PaymentInitiationService();
export const paymentVerificationService = new PaymentVerificationService();
