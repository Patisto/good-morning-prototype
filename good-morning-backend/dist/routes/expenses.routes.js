"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const pool_1 = require("../db/pool");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.requireAuth, (0, auth_1.requireSection)('expenses'));
router.get('/', async (_req, res) => {
    const result = await pool_1.pool.query(`
    SELECT id, description, amount, business, date, payment_method, notes
    FROM expenses
    ORDER BY date DESC
  `);
    res.json({ expenses: result.rows });
});
exports.default = router;
//# sourceMappingURL=expenses.routes.js.map