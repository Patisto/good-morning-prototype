"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const pool_1 = require("../db/pool");
const jwt_1 = require("../utils/jwt");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.post('/login', async (req, res) => {
    const { email, password } = req.body ?? {};
    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
    }
    const result = await pool_1.pool.query('SELECT id, name, email, password_hash, role, active FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    const user = result.rows[0];
    // Same generic message whether the email doesn't exist or the password is
    // wrong, so we don't reveal which accounts exist.
    const invalid = () => res.status(401).json({ error: 'Invalid email or password.' });
    if (!user || !user.active)
        return invalid();
    const passwordMatches = await bcryptjs_1.default.compare(password, user.password_hash);
    if (!passwordMatches)
        return invalid();
    const token = (0, jwt_1.signToken)({ sub: user.id, role: user.role, name: user.name, email: user.email });
    res.json({
        token,
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
});
router.get('/me', auth_1.requireAuth, async (req, res) => {
    const result = await pool_1.pool.query('SELECT id, name, email, role FROM users WHERE id = $1', [req.user.id]);
    const user = result.rows[0];
    if (!user)
        return res.status(404).json({ error: 'User not found.' });
    res.json({ user });
});
exports.default = router;
//# sourceMappingURL=auth.routes.js.map