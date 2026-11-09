"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const pool_1 = require("../db/pool");
const auth_1 = require("../middleware/auth");
const types_1 = require("../types");
const http_1 = require("../utils/http");
const router = (0, express_1.Router)();
router.use(auth_1.requireAuth, (0, auth_1.requireSection)('expenses'));
router.get('/', (0, http_1.route)(async (req, res) => {
    const businesses = (0, types_1.allowedBusinesses)(req.user.role);
    const from = (0, http_1.date)(req.query.from), to = (0, http_1.date)(req.query.to);
    (0, http_1.check)(from <= to, 'Start date must be before end date.');
    const result = await pool_1.pool.query('SELECT * FROM expenses WHERE business=ANY($1::text[]) AND date BETWEEN $2 AND $3 ORDER BY date DESC,created_at DESC', [businesses, from, to]);
    res.json({ expenses: result.rows, businesses });
}));
router.post('/', (0, http_1.route)(async (req, res) => {
    const b = req.body;
    (0, http_1.check)((0, types_1.allowedBusinesses)(req.user.role).includes(b.business), 'You cannot record expenses for this business.', 403);
    (0, http_1.check)(b.business !== 'RESTAURANT', 'Choose Upper Restaurant or Lower Restaurant for new expenses.');
    await (0, http_1.transaction)(async (db) => {
        if (!await (0, http_1.claimRequest)(db, b.requestId, req.user.id, `expense:${b.business}`))
            return;
        await db.query('INSERT INTO expenses(description,amount,business,date,payment_method,notes) VALUES ($1,$2,$3,$4,$5,$6)', [
            (0, http_1.text)(b.description, 'Description'), (0, http_1.number)(b.amount, 'Amount', 0.01), b.business, (0, http_1.date)(b.date), (0, http_1.method)(b.paymentMethod), typeof b.notes === 'string' ? b.notes.slice(0, 2000) : ''
        ]);
    });
    res.json({ ok: true });
}));
exports.default = router;
//# sourceMappingURL=expenses.routes.js.map