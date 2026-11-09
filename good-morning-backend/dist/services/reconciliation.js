"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reconcile = reconcile;
exports.startReconciliationScheduler = startReconciliationScheduler;
const pool_1 = require("../db/pool");
const config_1 = require("../config");
const payment_1 = require("./payment");
async function reconcile(reference) {
    const result = await pool_1.pool.query(`SELECT reference FROM payment_attempts WHERE status IN ('PENDING','PROCESSING') AND ($1::text IS NULL OR reference=$1) ORDER BY created_at LIMIT 100`, [reference || null]);
    const outcomes = {};
    for (const row of result.rows)
        outcomes[row.reference] = await payment_1.paymentVerificationService.verifyAndPost(row.reference);
    await pool_1.pool.query("UPDATE payment_attempts SET status='EXPIRED',failure_reason='Payment window expired',updated_at=now() WHERE status IN ('PENDING','PROCESSING') AND expires_at<now()");
    return outcomes;
}
function startReconciliationScheduler() { setInterval(() => reconcile().catch(error => console.error('Payment reconciliation failed', error)), config_1.config.reconcileIntervalMinutes * 60000).unref(); }
//# sourceMappingURL=reconciliation.js.map