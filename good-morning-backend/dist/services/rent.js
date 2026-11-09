"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rentAccount = rentAccount;
exports.ensureRentCharges = ensureRentCharges;
const http_1 = require("../utils/http");
/** Read an existing invoice or calculate the rent for one tenant and month. */
async function rentAccount(db, tenantId, period, lockTenant = false) {
    const tenant = await db.query(`SELECT * FROM tenants WHERE id::text=$1 AND deleted_at IS NULL ${lockTenant ? 'FOR UPDATE' : ''}`, [tenantId]);
    (0, http_1.check)(tenant.rowCount, 'Tenant not found.', 404);
    const t = tenant.rows[0];
    const invoice = await db.query(`SELECT c.id,c.expected_amount,c.opening_balance,COALESCE(SUM(p.amount),0) AS amount_paid
        FROM rent_charges c LEFT JOIN rent_receipts p ON p.charge_id=c.id
        WHERE c.tenant_id=$1 AND c.month=$2 GROUP BY c.id`, [t.id, period]);
    if (invoice.rows[0])
        return { tenantId: t.id, chargeId: invoice.rows[0].id, expectedAmount: Number(invoice.rows[0].expected_amount), amountPaid: Number(invoice.rows[0].amount_paid), openingBalance: Number(invoice.rows[0].opening_balance) };
    (0, http_1.check)(t.move_in_date && period >= t.move_in_date.slice(0, 7), 'This month is before the tenant moved in.');
    (0, http_1.check)(!t.checkout_date || period <= t.checkout_date.slice(0, 7), 'This month is after the tenant checked out.');
    const rate = await db.query(`SELECT amount FROM room_rates WHERE room_id=COALESCE(
        (SELECT room_id FROM tenant_room_history WHERE tenant_id=$1 AND effective_month <= $2 ORDER BY effective_month DESC LIMIT 1),$3)
        AND effective_month <= $2 ORDER BY effective_month DESC LIMIT 1`, [t.id, period, t.room_id]);
    const previous = await db.query(`SELECT c.opening_balance+COALESCE(SUM(p.amount),0)-c.expected_amount AS closing_balance
        FROM rent_charges c LEFT JOIN rent_receipts p ON p.charge_id=c.id WHERE c.tenant_id=$1 AND c.month<$2
        GROUP BY c.id ORDER BY c.month DESC LIMIT 1`, [t.id, period]);
    return { tenantId: t.id, chargeId: null, expectedAmount: Number(rate.rows[0]?.amount ?? t.monthly_amount), amountPaid: 0, openingBalance: Number(previous.rows[0]?.closing_balance ?? 0) };
}
/** Fill missing monthly charges through the requested month so old balances carry forward. */
async function ensureRentCharges(db, tenantId, period) {
    const tenant = await db.query(`SELECT to_char(move_in_date,'YYYY-MM') AS move_month,to_char(checkout_date,'YYYY-MM') AS checkout_month
        FROM tenants WHERE id=$1 AND deleted_at IS NULL`, [tenantId]);
    (0, http_1.check)(tenant.rowCount, 'Tenant not found.', 404);
    let cursor = tenant.rows[0].move_month;
    const lastMonth = tenant.rows[0].checkout_month ? tenant.rows[0].checkout_month : period;
    while (cursor <= period && cursor <= lastMonth) {
        const account = await rentAccount(db, tenantId, cursor);
        await db.query(`INSERT INTO rent_charges(tenant_id,month,expected_amount,opening_balance) VALUES($1,$2,$3,$4)
            ON CONFLICT(tenant_id,month) DO NOTHING`, [tenantId, cursor, account.expectedAmount, account.openingBalance]);
        if (cursor === period)
            break;
        const [year, monthNumber] = cursor.split('-').map(Number);
        const next = new Date(Date.UTC(year, monthNumber, 1));
        cursor = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`;
    }
}
//# sourceMappingURL=rent.js.map