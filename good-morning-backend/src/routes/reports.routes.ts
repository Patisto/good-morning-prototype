import { Router } from 'express';
import { pool } from '../db/pool';
import { requireAuth, requireSection } from '../middleware/auth';
import { check, date, route } from '../utils/http';
const router = Router();
router.use(requireAuth, requireSection('reports'));
router.get('/', route(async (req, res) => {
    const from = date(req.query.from), to = date(req.query.to);
    check(from <= to, 'Start date must be before end date.');
    const [revenue, expenses, balances] = await Promise.all([
        pool.query(`SELECT business,SUM(total) AS amount FROM sales WHERE status='COMPLETED' AND payment_method<>'MEAL_CARD' AND date BETWEEN $1 AND $2 GROUP BY business
      UNION ALL SELECT f.business,SUM(f.amount) FROM restaurant_meal_card_funding f WHERE f.date BETWEEN $1 AND $2 GROUP BY f.business
      UNION ALL SELECT 'HOSTEL',COALESCE(SUM(amount),0) FROM rent_receipts WHERE payment_date BETWEEN $1 AND $2
      UNION ALL SELECT 'HOSTEL',COALESCE(SUM(amount),0) FROM hostel_bookings WHERE status IN ('PAID','USED') AND paid_at::date BETWEEN $1 AND $2`, [from, to]),
        pool.query('SELECT business,SUM(amount) AS amount FROM expenses WHERE date BETWEEN $1 AND $2 GROUP BY business', [from, to]),
        pool.query(`WITH accounts AS (
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
export default router;
