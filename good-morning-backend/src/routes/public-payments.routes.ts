import { Router } from 'express';
import { config } from '../config';
import { pool } from '../db/pool';
import { publicRateLimit } from '../middleware/publicRateLimit';
import { check, route } from '../utils/http';
import { normalizeMalawiPhone } from '../services/phone';
import { lookupService, paymentInitiationService, paymentVerificationService } from '../services/payment';
const router = Router();

router.post('/lookup', publicRateLimit('lookup-ip', config.rateLimitLookup), publicRateLimit('lookup-phone', config.rateLimitLookup, req => { try { return normalizeMalawiPhone(req.body?.phone_number); } catch { return 'invalid'; } }), route(async (req, res) => {
  const phone = normalizeMalawiPhone(req.body?.phone_number); const result = await lookupService.lookup(phone);
  if (!result) return res.status(200).json({ error: 'We could not find a payable rental account. Please contact the hostel office.' });
  if (result.status === 'no_balance') return res.status(200).json(result);
  res.json(result);
}));

router.post('/initiate', publicRateLimit('initiate', config.rateLimitInitiate), route(async (req, res) => {
  check(typeof req.body?.lookup_token === 'string' && (typeof req.body?.amount === 'number' || typeof req.body?.amount === 'string'), 'Invalid payment request.');
  const result = await paymentInitiationService.initiate(req.body.lookup_token, req.body.amount, req.ip); res.json(result);
}));

router.get('/status/:reference', publicRateLimit('status', config.rateLimitStatus), route(async (req, res) => {
  const result = await pool.query(`SELECT p.status,p.amount,p.currency,c.month AS period,p.reference,p.provider_transaction_id,p.paid_at,p.created_at
    FROM payment_attempts p JOIN rent_charges c ON c.id=p.rental_invoice_id WHERE p.reference=$1`, [req.params.reference]);
  check(result.rowCount, 'Payment not found.', 404); const p = result.rows[0];
  let verification = 'not_required';
  if (['PENDING', 'PROCESSING'].includes(p.status) && Date.now() - new Date(p.created_at).getTime() > 15000) {
    verification = await paymentVerificationService.verifyAndPost(p.reference);
  }
  const latest = await pool.query(`SELECT status,amount,currency, (SELECT month FROM rent_charges WHERE id=rental_invoice_id) AS period, reference AS transaction_reference,paid_at FROM payment_attempts WHERE reference=$1`, [p.reference]);
  res.json({ ...latest.rows[0], verification });
}));
export default router;
