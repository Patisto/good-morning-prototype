"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentVerificationService = exports.paymentInitiationService = exports.lookupService = exports.PaymentVerificationService = exports.PaymentInitiationService = exports.LookupService = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const pool_1 = require("../db/pool");
const config_1 = require("../config");
const http_1 = require("../utils/http");
const rent_1 = require("./rent");
const paychangu_1 = require("./paychangu");
const cents = (value) => {
    const s = String(value);
    const m = s.match(/^(\d+)(?:\.(\d{1,2}))?$/);
    (0, http_1.check)(!!m, 'Invalid monetary amount.');
    return BigInt(m[1]) * 100n + BigInt((m[2] || '').padEnd(2, '0') || '0');
};
const money = (value) => (Number(cents(value)) / 100).toFixed(2);
const outstanding = (account) => money(account.expectedAmount + account.openingBalance - account.amountPaid);
class LookupService {
    async lookup(phone) {
        const matches = await pool_1.pool.query(`SELECT t.id,t.first_name,t.middle_name,t.last_name,t.reg_number,r.identifier AS room,u.name AS hostel
      FROM tenants t LEFT JOIN rooms r ON r.id=t.room_id LEFT JOIN housing_units u ON u.id=r.housing_unit_id
      WHERE t.phone_normalized=$1 AND t.deleted_at IS NULL AND t.checkout_date IS NULL`, [phone]);
        if (matches.rowCount !== 1)
            return null;
        const t = matches.rows[0], period = new Date().toISOString().slice(0, 7);
        await (0, http_1.transaction)(async (db) => (0, rent_1.ensureRentCharges)(db, t.id, period));
        const account = await (0, rent_1.rentAccount)(pool_1.pool, t.id, period);
        const balance = outstanding(account);
        if (cents(balance) <= 0n || !account.chargeId) {
            return {
                status: 'no_balance',
                student: { display_name: [t.first_name, t.middle_name, t.last_name].filter(Boolean).join(' '), student_number: t.reg_number || '', hostel: t.hostel || '', room: t.room || '' },
                rental: { period, currency: config_1.config.currency, amount_due: money(account.expectedAmount + account.openingBalance), amount_paid: money(account.amountPaid), outstanding_balance: balance },
            };
        }
        const token = jsonwebtoken_1.default.sign({ sub: t.id, charge: account.chargeId, period, balance }, config_1.config.lookupTokenSecret, { expiresIn: config_1.config.lookupTokenTtl });
        return { student: { display_name: [t.first_name, t.middle_name, t.last_name].filter(Boolean).join(' '), student_number: t.reg_number || '', hostel: t.hostel || '', room: t.room || '' }, rental: { period, currency: config_1.config.currency, amount_due: money(account.expectedAmount + account.openingBalance), amount_paid: money(account.amountPaid), outstanding_balance: balance }, lookup_token: token };
    }
}
exports.LookupService = LookupService;
function readToken(raw) {
    (0, http_1.check)(typeof raw === 'string' && raw.length <= 2048, 'Invalid lookup token.');
    try {
        const claims = jsonwebtoken_1.default.verify(raw, config_1.config.lookupTokenSecret);
        (0, http_1.check)(!!claims.sub && !!claims.charge && /^\d{4}-\d{2}$/.test(claims.period), 'Invalid lookup token.');
        return claims;
    }
    catch {
        throw new http_1.HttpError(400, 'Invalid or expired lookup token.');
    }
}
class PaymentInitiationService {
    async initiate(rawToken, requested, ip) {
        const token = readToken(rawToken);
        const amount = money(requested);
        (0, http_1.check)(cents(amount) > 0n, 'Invalid payment amount.');
        const existing = await pool_1.pool.query(`SELECT reference,checkout_url,status,amount FROM payment_attempts WHERE student_id=$1 AND rental_invoice_id=$2 AND amount=$3 AND status IN ('PENDING','PROCESSING') AND expires_at>now() ORDER BY created_at DESC LIMIT 1`, [token.sub, token.charge, amount]);
        if (existing.rowCount)
            return { checkout_url: existing.rows[0].checkout_url, reference: existing.rows[0].reference };
        const created = await (0, http_1.transaction)(async (db) => {
            await (0, rent_1.ensureRentCharges)(db, token.sub, token.period);
            const account = await (0, rent_1.rentAccount)(db, token.sub, token.period, true);
            const current = outstanding(account);
            (0, http_1.check)(cents(current) === cents(token.balance), 'The balance changed. Please look it up again.');
            const requestedCents = cents(amount), balanceCents = cents(current);
            (0, http_1.check)(config_1.config.allowPartial || requestedCents === balanceCents, 'Only the outstanding balance may be paid.');
            (0, http_1.check)(requestedCents >= cents(config_1.config.minPayment), 'Payment is below the minimum allowed amount.');
            (0, http_1.check)(config_1.config.allowOverpayment || requestedCents <= balanceCents, 'Payment exceeds the outstanding balance.');
            (0, http_1.check)(account.chargeId, 'No payable rental period found.');
            const reference = `GM-${crypto_1.default.randomBytes(16).toString('hex')}`;
            const result = await db.query(`INSERT INTO payment_attempts(reference,student_id,rental_invoice_id,amount,currency,status,balance_snapshot,initiated_ip,expires_at)
        VALUES($1,$2,$3,$4,$5,'PENDING',$6,$7,now()+($8 || ' minutes')::interval) RETURNING id,reference`, [reference, token.sub, account.chargeId, amount, config_1.config.currency, current, ip || null, String(config_1.config.pendingExpiryMinutes)]);
            return { id: result.rows[0].id, reference, amount, student: await db.query('SELECT first_name,last_name,email FROM tenants WHERE id=$1', [token.sub]) };
        });
        try {
            const student = created.student.rows[0];
            const checkoutUrl = await paychangu_1.payChangu.createCheckout({ reference: created.reference, amount: created.amount, firstName: student.first_name, lastName: student.last_name, email: student.email });
            await pool_1.pool.query('UPDATE payment_attempts SET checkout_url=$2,updated_at=now() WHERE id=$1', [created.id, checkoutUrl]);
            return { checkout_url: checkoutUrl, reference: created.reference };
        }
        catch (error) {
            await pool_1.pool.query("UPDATE payment_attempts SET status='FAILED',failure_reason='Checkout provider unavailable',updated_at=now() WHERE id=$1 AND status='PENDING'", [created.id]);
            throw new http_1.HttpError(503, 'Payment service is temporarily unavailable.');
        }
    }
}
exports.PaymentInitiationService = PaymentInitiationService;
class PaymentVerificationService {
    async verifyAndPost(reference, eventId) {
        const attempt = await pool_1.pool.query('SELECT * FROM payment_attempts WHERE reference=$1', [reference]);
        if (!attempt.rowCount)
            return 'unknown_reference';
        const a = attempt.rows[0];
        let verified;
        try {
            verified = await paychangu_1.payChangu.verify(reference);
        }
        catch {
            return 'verification_deferred';
        }
        const amountMatches = config_1.config.allowOverpayment ? cents(verified.amount) >= cents(a.amount) : cents(verified.amount) === cents(a.amount), identityMatches = verified.txRef === a.reference && verified.currency === a.currency;
        return (0, http_1.transaction)(async (db) => {
            const locked = await db.query('SELECT * FROM payment_attempts WHERE id=$1 FOR UPDATE', [a.id]);
            const row = locked.rows[0];
            if (row.status === 'SUCCEEDED')
                return 'already_succeeded';
            if (!identityMatches || !amountMatches) {
                await db.query("UPDATE payment_attempts SET status='PROCESSING',failure_reason='Provider verification mismatch; review required',updated_at=now() WHERE id=$1", [row.id]);
                return 'mismatch';
            }
            const status = verified.status;
            if (status === 'success' || status === 'succeeded') {
                await db.query("UPDATE payment_attempts SET status='SUCCEEDED',provider_transaction_id=COALESCE($2,provider_transaction_id),paid_at=now(),updated_at=now() WHERE id=$1", [row.id, verified.reference]);
                const allocation = await db.query(`INSERT INTO payment_allocations(payment_attempt_id,student_id,rental_invoice_id,amount) VALUES($1,$2,$3,$4) ON CONFLICT(payment_attempt_id) DO NOTHING RETURNING id`, [row.id, row.student_id, row.rental_invoice_id, row.amount]);
                if (allocation.rowCount)
                    await db.query(`INSERT INTO rent_receipts(charge_id,amount,payment_method,payment_date,payment_attempt_id) VALUES($1,$2,'OTHER',CURRENT_DATE,$3) ON CONFLICT (payment_attempt_id) WHERE payment_attempt_id IS NOT NULL DO NOTHING`, [row.rental_invoice_id, row.amount, row.id]);
                return 'succeeded';
            }
            if (['failed', 'cancelled', 'expired'].includes(status)) {
                await db.query('UPDATE payment_attempts SET status=$2,failure_reason=$3,updated_at=now() WHERE id=$1', [row.id, status.toUpperCase(), `Provider status: ${status}`]);
                return status;
            }
            await db.query("UPDATE payment_attempts SET status='PROCESSING',updated_at=now() WHERE id=$1", [row.id]);
            return 'processing';
        });
    }
}
exports.PaymentVerificationService = PaymentVerificationService;
exports.lookupService = new LookupService();
exports.paymentInitiationService = new PaymentInitiationService();
exports.paymentVerificationService = new PaymentVerificationService();
//# sourceMappingURL=payment.js.map