"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const pool_1 = require("../db/pool");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.requireAuth, (0, auth_1.requireSection)('grocery'));
router.get('/products', async (_req, res) => {
    const result = await pool_1.pool.query(`
    SELECT id, name, category, selling_price, buying_price, current_stock, low_stock_level, unit
    FROM grocery_products
    ORDER BY category, name
  `);
    res.json({ products: result.rows });
});
exports.default = router;
//# sourceMappingURL=grocery.routes.js.map