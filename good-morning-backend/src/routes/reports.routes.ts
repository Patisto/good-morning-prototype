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
        pool.query(`SELECT business,SUM(total) AS amount FROM sales WHERE status='COMPLETED' AND date BETWEEN $1 AND $2 GROUP BY business
      UNION ALL SELECT 'HOSTEL',COALESCE(SUM(amount),0) FROM rent_receipts WHERE payment_date BETWEEN $1 AND $2`, [from, to]),
        pool.query('SELECT business,SUM(amount) AS amount FROM expenses WHERE date BETWEEN $1 AND $2 GROUP BY business', [from, to]),
        pool.query(`SELECT COALESCE(SUM(GREATEST(c.expected_amount-COALESCE(p.paid,0),0)),0) AS outstanding,
      COALESCE(SUM(GREATEST(COALESCE(p.paid,0)-c.expected_amount,0)),0) AS credit
      FROM rent_charges c LEFT JOIN (SELECT charge_id,SUM(amount) AS paid FROM rent_receipts GROUP BY charge_id) p ON p.charge_id=c.id`),
    ]);
    const rows = ['HOSTEL', 'RESTAURANT_A', 'RESTAURANT_B', 'GROCERY', 'GENERAL', 'RESTAURANT'].map(business => ({
        business, revenue: revenue.rows.filter(r => r.business === business).reduce((s, r) => s + Number(r.amount), 0),
        expenses: Number(expenses.rows.find(r => r.business === business)?.amount ?? 0)
    }));
    res.json({ rows, outstanding: Number(balances.rows[0].outstanding), credit: Number(balances.rows[0].credit) });
}));
export default router;
