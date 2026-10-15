import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db/pool';
import { requireAuth } from '../middleware/auth';
import { check, route, text } from '../utils/http';
const roles = ['OWNER', 'ADMINISTRATOR', 'SUPER_MANAGER', 'HOSTEL_MANAGER', 'RESTAURANT_MANAGER', 'RESTAURANT_CASHIER', 'GROCERY_MANAGER', 'GROCERY_CASHIER', 'ACCOUNTANT', 'SYSTEM_ADMINISTRATOR'];
const router = Router();
router.use(requireAuth, (req, res, next) => {
    if (!['OWNER', 'ADMINISTRATOR', 'SYSTEM_ADMINISTRATOR'].includes(req.user!.role))
        return res.status(403).json({ error: 'Administrator access required.' });
    next();
});
router.get('/', route(async (_req, res) => {
    const result = await pool.query('SELECT id,name,email,role,active FROM users ORDER BY name');
    res.json({ users: result.rows, roles });
}));
router.post('/', route(async (req, res) => {
    const b = req.body, name = text(b.name, 'Name'), email = text(b.email, 'Email').toLowerCase();
    check(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), 'Enter a valid email address.');
    check(roles.includes(b.role), 'Select a valid role.');
    check(b.id !== req.user!.id, 'Use another administrator to change your own account.');
    check(typeof b.active === 'boolean', 'Active must be true or false.');
    const password = b.password ? text(b.password, 'Password') : '';
    check((b.id && !password) || password.length >= 12, 'A new password must have at least 12 characters.');
    const hash = password ? await bcrypt.hash(password, 12) : null;
    if (b.id) {
        const result = await pool.query('UPDATE users SET name=$2,email=$3,role=$4,active=$5,password_hash=COALESCE($6,password_hash),updated_at=now() WHERE id=$1 RETURNING id', [b.id, name, email, b.role, b.active, hash]);
        check(result.rowCount, 'User not found.', 404);
    }
    else {
        await pool.query('INSERT INTO users(name,email,role,active,password_hash) VALUES ($1,$2,$3,$4,$5)', [name, email, b.role, b.active, hash]);
    }
    res.json({ ok: true });
}));
export default router;
