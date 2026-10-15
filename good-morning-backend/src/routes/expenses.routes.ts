import { Router } from 'express';
import { pool } from '../db/pool';
import { requireAuth, requireSection } from '../middleware/auth';
import { allowedBusinesses } from '../types';
import { claimRequest, check, date, method, number, route, text, transaction } from '../utils/http';
const router = Router();
router.use(requireAuth, requireSection('expenses'));
router.get('/', route(async (req, res) => {
    const businesses = allowedBusinesses(req.user!.role);
    const from = date(req.query.from), to = date(req.query.to);
    check(from <= to, 'Start date must be before end date.');
    const result = await pool.query('SELECT * FROM expenses WHERE business=ANY($1::text[]) AND date BETWEEN $2 AND $3 ORDER BY date DESC,created_at DESC', [businesses, from, to]);
    res.json({ expenses: result.rows, businesses });
}));
router.post('/', route(async (req, res) => {
    const b = req.body;
    check(allowedBusinesses(req.user!.role).includes(b.business), 'You cannot record expenses for this business.', 403);
    check(b.business !== 'RESTAURANT', 'Choose Restaurant A or B for new expenses.');
    await transaction(async (db) => {
        if (!await claimRequest(db, b.requestId, req.user!.id, `expense:${b.business}`))
            return;
        await db.query('INSERT INTO expenses(description,amount,business,date,payment_method,notes) VALUES ($1,$2,$3,$4,$5,$6)', [
            text(b.description, 'Description'), number(b.amount, 'Amount', 0.01), b.business, date(b.date), method(b.paymentMethod), typeof b.notes === 'string' ? b.notes.slice(0, 2000) : ''
        ]);
    });
    res.json({ ok: true });
}));
export default router;
