import { Router } from 'express';
import crypto from 'crypto';
import { pool } from '../db/pool';
import { payChangu } from '../services/paychangu';
import { paymentVerificationService } from '../services/payment';
const router = Router();
router.post('/', async (req, res, next) => {
  try {
    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from('');
    const signature = req.get('Signature') || req.get('signature') || undefined;
    const valid = payChangu.validWebhookSignature(raw, signature); const hash = crypto.createHash('sha256').update(raw).digest('hex');
    let payload: any = {}; try { payload = JSON.parse(raw.toString('utf8')); } catch { /* event is still auditable */ }
    const reference = typeof payload.tx_ref === 'string' ? payload.tx_ref : (typeof payload.reference === 'string' ? payload.reference : null);
    const eventId = typeof payload.charge_id === 'string' ? payload.charge_id : null;
    const attempt = reference ? await pool.query('SELECT id FROM payment_attempts WHERE reference=$1', [reference]) : { rows: [] as any[] };
    const auditPayload = { event_type: payload.event_type, tx_ref: payload.tx_ref, reference: payload.reference, charge_id: payload.charge_id, status: payload.status, amount: payload.amount, currency: payload.currency };
    await pool.query(`INSERT INTO payment_events(payment_attempt_id,provider_event_id,event_type,payload_hash,raw_payload,signature_valid,processed,processing_result)
      VALUES($1,$2,$3,$4,$5,$6,false,$7) ON CONFLICT DO NOTHING`, [attempt.rows[0]?.id || null, eventId, String(payload.event_type || 'unknown'), hash, JSON.stringify(auditPayload), valid, valid ? 'received' : 'invalid_signature']);
    if (!valid) return res.status(401).json({ error: 'Invalid webhook signature.' });
    if (reference) {
      const result = await paymentVerificationService.verifyAndPost(reference, eventId || undefined);
      await pool.query('UPDATE payment_events SET processed=true,processing_result=$2 WHERE payload_hash=$1', [hash, result]);
    }
    return res.sendStatus(200);
  } catch (error) { return next(error); }
});
export default router;
