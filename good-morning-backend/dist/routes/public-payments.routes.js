"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const config_1 = require("../config");
const pool_1 = require("../db/pool");
const publicRateLimit_1 = require("../middleware/publicRateLimit");
const http_1 = require("../utils/http");
const phone_1 = require("../services/phone");
const payment_1 = require("../services/payment");
const router = (0, express_1.Router)();
router.post('/lookup', (0, publicRateLimit_1.publicRateLimit)('lookup-ip', config_1.config.rateLimitLookup), (0, publicRateLimit_1.publicRateLimit)('lookup-phone', config_1.config.rateLimitLookup, req => { try {
    return (0, phone_1.normalizeMalawiPhone)(req.body?.phone_number);
}
catch {
    return 'invalid';
} }), (0, http_1.route)(async (req, res) => {
    const phone = (0, phone_1.normalizeMalawiPhone)(req.body?.phone_number);
    const result = await payment_1.lookupService.lookup(phone);
    if (!result)
        return res.status(200).json({ error: 'We could not find a payable rental account. Please contact the hostel office.' });
    if (result.status === 'no_balance')
        return res.status(200).json(result);
    res.json(result);
}));
router.post('/initiate', (0, publicRateLimit_1.publicRateLimit)('initiate', config_1.config.rateLimitInitiate), (0, http_1.route)(async (req, res) => {
    (0, http_1.check)(typeof req.body?.lookup_token === 'string' && (typeof req.body?.amount === 'number' || typeof req.body?.amount === 'string'), 'Invalid payment request.');
    const result = await payment_1.paymentInitiationService.initiate(req.body.lookup_token, req.body.amount, req.ip);
    res.json(result);
}));
router.get('/status/:reference', (0, publicRateLimit_1.publicRateLimit)('status', config_1.config.rateLimitStatus), (0, http_1.route)(async (req, res) => {
    const result = await pool_1.pool.query(`SELECT p.status,p.amount,p.currency,c.month AS period,p.reference,p.provider_transaction_id,p.paid_at,p.created_at
    FROM payment_attempts p JOIN rent_charges c ON c.id=p.rental_invoice_id WHERE p.reference=$1`, [req.params.reference]);
    (0, http_1.check)(result.rowCount, 'Payment not found.', 404);
    const p = result.rows[0];
    let verification = 'not_required';
    if (['PENDING', 'PROCESSING'].includes(p.status) && Date.now() - new Date(p.created_at).getTime() > 15000) {
        verification = await payment_1.paymentVerificationService.verifyAndPost(p.reference);
    }
    const latest = await pool_1.pool.query(`SELECT status,amount,currency, (SELECT month FROM rent_charges WHERE id=rental_invoice_id) AS period, reference AS transaction_reference,paid_at FROM payment_attempts WHERE reference=$1`, [p.reference]);
    res.json({ ...latest.rows[0], verification });
}));
exports.default = router;
//# sourceMappingURL=public-payments.routes.js.map