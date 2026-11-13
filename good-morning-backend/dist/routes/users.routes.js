"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const pool_1 = require("../db/pool");
const auth_1 = require("../middleware/auth");
const http_1 = require("../utils/http");
const roles = ['OWNER', 'ADMINISTRATOR', 'SUPER_MANAGER', 'HOSTEL_MANAGER', 'RESTAURANT_MANAGER', 'RESTAURANT_CASHIER', 'GROCERY_MANAGER', 'GROCERY_CASHIER', 'ACCOUNTANT', 'SYSTEM_ADMINISTRATOR'];
const router = (0, express_1.Router)();
router.use(auth_1.requireAuth, (req, res, next) => {
    if (!['OWNER', 'ADMINISTRATOR', 'SYSTEM_ADMINISTRATOR'].includes(req.user.role))
        return res.status(403).json({ error: 'Administrator access required.' });
    next();
});
router.get('/', (0, http_1.route)(async (_req, res) => {
    const result = await pool_1.pool.query('SELECT id,name,email,role,active FROM users ORDER BY name');
    res.json({ users: result.rows, roles });
}));
router.post('/', (0, http_1.route)(async (req, res) => {
    const b = req.body, name = (0, http_1.text)(b.name, 'Name'), email = (0, http_1.text)(b.email, 'Email').toLowerCase();
    (0, http_1.check)(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), 'Enter a valid email address.');
    (0, http_1.check)(roles.includes(b.role), 'Select a valid role.');
    (0, http_1.check)(b.id !== req.user.id, 'Use another administrator to change your own account.');
    (0, http_1.check)(typeof b.active === 'boolean', 'Active must be true or false.');
    const password = b.password ? (0, http_1.text)(b.password, 'Password') : '';
    (0, http_1.check)((b.id && !password) || password.length >= 12, 'A new password must have at least 12 characters.');
    const hash = password ? await bcryptjs_1.default.hash(password, 12) : null;
    if (b.id) {
        const result = await pool_1.pool.query('UPDATE users SET name=$2,email=$3,role=$4,active=$5,password_hash=COALESCE($6,password_hash),updated_at=now() WHERE id=$1 RETURNING id', [b.id, name, email, b.role, b.active, hash]);
        (0, http_1.check)(result.rowCount, 'User not found.', 404);
    }
    else {
        await pool_1.pool.query('INSERT INTO users(name,email,role,active,password_hash) VALUES ($1,$2,$3,$4,$5)', [name, email, b.role, b.active, hash]);
    }
    res.json({ ok: true });
}));
exports.default = router;
//# sourceMappingURL=users.routes.js.map