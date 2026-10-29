import { Router } from 'express';
import { pool } from '../db/pool';
import { requireAuth, requireSection } from '../middleware/auth';
import { allowedBusinesses } from '../types';
import { check, date, route, transaction } from '../utils/http';
const router = Router();
router.use(requireAuth, requireSection('finance'));
router.get('/', route(async (req, res) => {
    const businesses = allowedBusinesses(req.user!.role);
    const from = date(req.query.from), to = date(req.query.to);
    check(from <= to, 'Start date must be before end date.');
    const selected = req.query.business;
    check(!selected || businesses.includes(selected as typeof businesses[number]), 'You cannot view this business.', 403);
    const scope = selected ? [selected] : businesses;
    // Each row represents cash received or spent; rent charges themselves are not income.
    const ledger = `WITH ledger AS (
        SELECT p.id,'HOSTEL'::text AS business,p.payment_date AS date,'INCOME'::text AS kind,p.amount,
            t.first_name || ' ' || t.last_name || ' · Rent ' || c.month AS description,p.payment_method,''::text AS notes,p.created_at
        FROM rent_receipts p JOIN rent_charges c ON c.id=p.charge_id JOIN tenants t ON t.id=c.tenant_id
        UNION ALL SELECT s.id,s.business,s.date,'INCOME',s.total,'Sale · ' || COALESCE(s.cashier,'Unknown cashier'),s.payment_method,'',s.created_at
        FROM sales s WHERE s.status='COMPLETED'
        UNION ALL SELECT e.id,e.business,e.date,'EXPENSE',e.amount,e.description,e.payment_method,COALESCE(e.notes,''),e.created_at FROM expenses e
    )`;
    const args = [scope, from, to];
    const [summary, entries] = await Promise.all([
        pool.query(`${ledger} SELECT business,COALESCE(SUM(amount) FILTER (WHERE kind='INCOME'),0) AS income,
            COALESCE(SUM(amount) FILTER (WHERE kind='EXPENSE'),0) AS expenses,COUNT(*)::int AS count
            FROM ledger WHERE business=ANY($1::text[]) AND date BETWEEN $2 AND $3 GROUP BY business`, args),
        pool.query(`${ledger} SELECT * FROM ledger WHERE business=ANY($1::text[]) AND date BETWEEN $2 AND $3
            ORDER BY date DESC,created_at DESC,id DESC LIMIT 200`, args),
    ]);
    res.json({ businesses, summary: summary.rows, entries: entries.rows });
}));
router.post('/transactions/erase', route(async (req, res) => {
    const role = req.user!.role;
    const mayErase = ['OWNER','ADMINISTRATOR','SUPER_MANAGER','HOSTEL_MANAGER','RESTAURANT_MANAGER','GROCERY_MANAGER'].includes(role);
    check(mayErase, 'Manager access is required to erase transactions.', 403);
    const configuredKey = process.env.SALE_ERASE_KEY;
    check(!!configuredKey && typeof req.body.key === 'string' && req.body.key === configuredKey, 'The manager erase key is missing or incorrect.', 403);
    const businesses = allowedBusinesses(role);
    const from = date(req.body.from), to = date(req.body.to);
    check(from <= to, 'Start date must be before end date.');
    const selected = req.body.business;
    check(!selected || businesses.includes(selected), 'You cannot erase transactions for this business.', 403);
    const scope = selected ? [selected] : businesses;
    const deleted = await transaction(async db => {
        const sales = await db.query("DELETE FROM sales WHERE status='COMPLETED' AND business=ANY($1::text[]) AND date BETWEEN $2 AND $3", [scope, from, to]);
        const expenses = await db.query('DELETE FROM expenses WHERE business=ANY($1::text[]) AND date BETWEEN $2 AND $3', [scope, from, to]);
        let hostelReceiptCount = 0;
        if (scope.includes('HOSTEL')) {
            const receipts = await db.query<{ legacy_payment_id: string | null }>('DELETE FROM rent_receipts WHERE payment_date BETWEEN $1 AND $2 RETURNING legacy_payment_id', [from, to]);
            hostelReceiptCount = receipts.rowCount ?? 0;
            const legacyIds = receipts.rows.map(receipt => receipt.legacy_payment_id).filter((id): id is string => !!id);
            if (legacyIds.length) await db.query('DELETE FROM hostel_payments WHERE id=ANY($1::uuid[])', [legacyIds]);
        }
        return { sales: sales.rowCount ?? 0, expenses: expenses.rowCount ?? 0, hostelReceipts: hostelReceiptCount };
    });
    res.json({ ok: true, deleted });
}));
export default router;
