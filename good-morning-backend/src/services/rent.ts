import type { PoolClient } from 'pg';
import { check } from '../utils/http';
/** Read an existing invoice or calculate the rent for one tenant and month. */
export async function rentAccount(db: Pick<PoolClient, 'query'>, tenantId: string, period: string, lockTenant = false) {
    const tenant = await db.query(`SELECT * FROM tenants WHERE id::text=$1 AND deleted_at IS NULL ${lockTenant ? 'FOR UPDATE' : ''}`, [tenantId]);
    check(tenant.rowCount, 'Tenant not found.', 404);
    const t = tenant.rows[0];
    const invoice = await db.query(`SELECT c.id,c.expected_amount,COALESCE(SUM(p.amount),0) AS amount_paid
        FROM rent_charges c LEFT JOIN rent_receipts p ON p.charge_id=c.id
        WHERE c.tenant_id=$1 AND c.month=$2 GROUP BY c.id`, [t.id, period]);
    if (invoice.rows[0])
        return { tenantId: t.id, chargeId: invoice.rows[0].id, expectedAmount: Number(invoice.rows[0].expected_amount), amountPaid: Number(invoice.rows[0].amount_paid) };
    check(t.move_in_date && period >= t.move_in_date.slice(0, 7), 'This month is before the tenant moved in.');
    check(!t.checkout_date || period <= t.checkout_date.slice(0, 7), 'This month is after the tenant checked out.');
    const rate = await db.query(`SELECT amount FROM room_rates WHERE room_id=COALESCE(
        (SELECT room_id FROM tenant_room_history WHERE tenant_id=$1 AND effective_month <= $2 ORDER BY effective_month DESC LIMIT 1),$3)
        AND effective_month <= $2 ORDER BY effective_month DESC LIMIT 1`, [t.id, period, t.room_id]);
    return { tenantId: t.id, chargeId: null, expectedAmount: Number(rate.rows[0]?.amount ?? t.monthly_amount), amountPaid: 0 };
}
