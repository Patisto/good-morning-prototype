"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const pool_1 = require("../db/pool");
const auth_1 = require("../middleware/auth");
const http_1 = require("../utils/http");
const router = (0, express_1.Router)();
router.use(auth_1.requireAuth, (0, auth_1.requireSection)('reports'));
router.get('/', (0, http_1.route)(async (req, res) => {
    const from = (0, http_1.date)(req.query.from), to = (0, http_1.date)(req.query.to);
    (0, http_1.check)(from <= to, 'Start date must be before end date.');
    const [revenue, expenses, balances] = await Promise.all([
        pool_1.pool.query(`SELECT business,SUM(total) AS amount FROM sales WHERE status='COMPLETED' AND payment_method<>'MEAL_CARD' AND date BETWEEN $1 AND $2 GROUP BY business
      UNION ALL SELECT f.business,SUM(f.amount) FROM restaurant_meal_card_funding f WHERE f.date BETWEEN $1 AND $2 GROUP BY f.business
      UNION ALL SELECT 'HOSTEL',COALESCE(SUM(amount),0) FROM rent_receipts WHERE payment_date BETWEEN $1 AND $2`, [from, to]),
        pool_1.pool.query('SELECT business,SUM(amount) AS amount FROM expenses WHERE date BETWEEN $1 AND $2 GROUP BY business', [from, to]),
        pool_1.pool.query(`WITH accounts AS (
          SELECT c.tenant_id,c.month,c.expected_amount,c.opening_balance,COALESCE(SUM(p.amount),0) AS paid,
            row_number() OVER(PARTITION BY c.tenant_id ORDER BY c.month DESC) AS row_num
          FROM rent_charges c LEFT JOIN rent_receipts p ON p.charge_id=c.id GROUP BY c.id
        ) SELECT COALESCE(SUM(GREATEST(expected_amount-opening_balance-paid,0)),0) AS outstanding,
          COALESCE(SUM(GREATEST(opening_balance+paid-expected_amount,0)),0) AS credit FROM accounts WHERE row_num=1`),
    ]);
    const rows = ['HOSTEL', 'RESTAURANT_A', 'RESTAURANT_B', 'GROCERY', 'GENERAL', 'RESTAURANT'].map(business => ({
        business, revenue: revenue.rows.filter(r => r.business === business).reduce((s, r) => s + Number(r.amount), 0),
        expenses: Number(expenses.rows.find(r => r.business === business)?.amount ?? 0)
    }));
    res.json({ rows, outstanding: Number(balances.rows[0].outstanding), credit: Number(balances.rows[0].credit) });
}));
exports.default = router;
//# sourceMappingURL=reports.routes.js.map