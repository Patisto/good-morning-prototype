"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const pool_1 = require("../db/pool");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.requireAuth, (0, auth_1.requireSection)('hostel'));
router.get('/rooms', async (_req, res) => {
    const result = await pool_1.pool.query(`
    SELECT
      r.id, r.housing_unit, r.identifier, r.label, r.type, r.capacity,
      COUNT(t.id) FILTER (WHERE t.deleted_at IS NULL) AS occupants
    FROM rooms r
    LEFT JOIN tenants t ON t.room_id = r.id
    GROUP BY r.id
    ORDER BY r.housing_unit, r.identifier
  `);
    res.json({ rooms: result.rows });
});
router.get('/tenants', async (_req, res) => {
    const result = await pool_1.pool.query(`
    SELECT id, first_name, last_name, phone, institution, programme, room_id,
           monthly_amount, move_in_date, agreement_status
    FROM tenants
    WHERE deleted_at IS NULL
    ORDER BY last_name, first_name
  `);
    res.json({ tenants: result.rows });
});
router.get('/payments', async (_req, res) => {
    const result = await pool_1.pool.query(`
    SELECT hp.id, hp.tenant_id, hp.period_label, hp.expected_amount, hp.amount_paid,
           hp.payment_method, hp.payment_date, t.first_name, t.last_name
    FROM hostel_payments hp
    JOIN tenants t ON t.id = hp.tenant_id
    ORDER BY hp.period_label DESC, t.last_name
  `);
    res.json({ payments: result.rows });
});
exports.default = router;
//# sourceMappingURL=hostel.routes.js.map