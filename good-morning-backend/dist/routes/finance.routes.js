"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const pool_1 = require("../db/pool");
const auth_1 = require("../middleware/auth");
const types_1 = require("../types");
const http_1 = require("../utils/http");
const router = (0, express_1.Router)();
router.use(auth_1.requireAuth, (0, auth_1.requireSection)('finance'));
router.get('/', (0, http_1.route)(async (req, res) => {
    const businesses = (0, types_1.allowedBusinesses)(req.user.role);
    const from = (0, http_1.date)(req.query.from), to = (0, http_1.date)(req.query.to);
    (0, http_1.check)(from <= to, 'Start date must be before end date.');
    const selected = req.query.business;
    (0, http_1.check)(!selected || businesses.includes(selected), 'You cannot view this business.', 403);
    const scope = selected ? [selected] : businesses;
    // Each row represents cash received or spent; rent charges themselves are not income.
    const ledger = `WITH ledger AS (
        SELECT p.id,'HOSTEL'::text AS business,p.payment_date AS date,'INCOME'::text AS kind,p.amount,
            t.first_name || ' ' || t.last_name || ' · Rent ' || c.month AS description,p.payment_method,''::text AS notes,p.created_at
        FROM rent_receipts p JOIN rent_charges c ON c.id=p.charge_id JOIN tenants t ON t.id=c.tenant_id
        UNION ALL SELECT s.id,s.business,s.date,CASE WHEN s.payment_method='CREDIT' THEN 'CREDIT' ELSE 'INCOME' END,s.total,'Sale · ' || COALESCE(s.credit_customer || ' · ', '') || COALESCE(s.cashier,'Unknown cashier'),s.payment_method,'',s.created_at
        FROM sales s WHERE s.status='COMPLETED' AND s.payment_method<>'MEAL_CARD'
        UNION ALL SELECT f.id,f.business,f.date,'INCOME',f.amount,'Meal card prepaid · ' || c.customer_name,'MEAL_CARD','',f.created_at
        FROM restaurant_meal_card_funding f JOIN restaurant_meal_cards c ON c.id=f.meal_card_id
        UNION ALL SELECT e.id,e.business,e.date,'EXPENSE',e.amount,e.description,e.payment_method,COALESCE(e.notes,''),e.created_at FROM expenses e
    )`;
    const args = [scope, from, to];
    const [summary, entries] = await Promise.all([
        pool_1.pool.query(`${ledger} SELECT business,COALESCE(SUM(amount) FILTER (WHERE kind='INCOME'),0) AS income,
            COALESCE(SUM(amount) FILTER (WHERE kind='EXPENSE'),0) AS expenses,COALESCE(SUM(amount) FILTER (WHERE kind='CREDIT'),0) AS credit,COUNT(*)::int AS count
            FROM ledger WHERE business=ANY($1::text[]) AND date BETWEEN $2 AND $3 GROUP BY business`, args),
        pool_1.pool.query(`${ledger} SELECT * FROM ledger WHERE business=ANY($1::text[]) AND date BETWEEN $2 AND $3
            ORDER BY date DESC,created_at DESC,id DESC LIMIT 200`, args),
    ]);
    res.json({ businesses, summary: summary.rows, entries: entries.rows });
}));
router.get('/payment-attempts/:reference', (0, http_1.route)(async (req, res) => {
    const result = await pool_1.pool.query(`SELECT p.reference,p.provider,p.provider_transaction_id,p.status,p.amount,p.currency,p.created_at,p.paid_at,
      t.id AS student_id,t.first_name,t.last_name,c.month AS period,COALESCE(json_agg(e ORDER BY e.received_at) FILTER (WHERE e.id IS NOT NULL),'[]') AS events
      FROM payment_attempts p JOIN tenants t ON t.id=p.student_id JOIN rent_charges c ON c.id=p.rental_invoice_id LEFT JOIN payment_events e ON e.payment_attempt_id=p.id
      WHERE p.reference=$1 GROUP BY p.id,t.id,c.month`, [req.params.reference]);
    (0, http_1.check)(result.rowCount, 'Payment not found.', 404);
    res.json(result.rows[0]);
}));
router.post('/transactions/erase', (0, http_1.route)(async (req, res) => {
    const role = req.user.role;
    const mayErase = ['OWNER', 'ADMINISTRATOR', 'SUPER_MANAGER', 'HOSTEL_MANAGER', 'RESTAURANT_MANAGER', 'GROCERY_MANAGER'].includes(role);
    (0, http_1.check)(mayErase, 'Manager access is required to erase transactions.', 403);
    const configuredKey = process.env.SALE_ERASE_KEY;
    (0, http_1.check)(!!configuredKey && typeof req.body.key === 'string' && req.body.key === configuredKey, 'The manager erase key is missing or incorrect.', 403);
    const businesses = (0, types_1.allowedBusinesses)(role);
    const from = (0, http_1.date)(req.body.from), to = (0, http_1.date)(req.body.to);
    (0, http_1.check)(from <= to, 'Start date must be before end date.');
    const selected = req.body.business;
    (0, http_1.check)(!selected || businesses.includes(selected), 'You cannot erase transactions for this business.', 403);
    const scope = selected ? [selected] : businesses;
    const deleted = await (0, http_1.transaction)(async (db) => {
        await db.query(`UPDATE restaurant_meal_cards c SET balance=c.balance+sales.amount FROM (
            SELECT meal_card_id,SUM(total) AS amount FROM sales WHERE payment_method='MEAL_CARD' AND meal_card_id IS NOT NULL AND business=ANY($1::text[]) AND date BETWEEN $2 AND $3 GROUP BY meal_card_id
        ) sales WHERE c.id=sales.meal_card_id`, [scope, from, to]);
        const sales = await db.query("DELETE FROM sales WHERE status='COMPLETED' AND business=ANY($1::text[]) AND date BETWEEN $2 AND $3", [scope, from, to]);
        const expenses = await db.query('DELETE FROM expenses WHERE business=ANY($1::text[]) AND date BETWEEN $2 AND $3', [scope, from, to]);
        let hostelReceiptCount = 0;
        if (scope.includes('HOSTEL')) {
            const receipts = await db.query('DELETE FROM rent_receipts WHERE payment_date BETWEEN $1 AND $2 RETURNING legacy_payment_id', [from, to]);
            hostelReceiptCount = receipts.rowCount ?? 0;
            const legacyIds = receipts.rows.map(receipt => receipt.legacy_payment_id).filter((id) => !!id);
            if (legacyIds.length)
                await db.query('DELETE FROM hostel_payments WHERE id=ANY($1::uuid[])', [legacyIds]);
        }
        return { sales: sales.rowCount ?? 0, expenses: expenses.rowCount ?? 0, hostelReceipts: hostelReceiptCount };
    });
    res.json({ ok: true, deleted });
}));
exports.default = router;
//# sourceMappingURL=finance.routes.js.map