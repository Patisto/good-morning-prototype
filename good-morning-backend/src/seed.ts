import bcrypt from 'bcryptjs';
import { pool } from './db/pool';
/** Bootstrap one owner on an empty installation. Never insert sample financial data. */
async function seed() {
    const existing = await pool.query('SELECT 1 FROM users LIMIT 1');
    if (existing.rowCount) {
        console.log('Users already exist; bootstrap skipped.');
        return;
    }
    const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.SEED_ADMIN_PASSWORD;
    if (!email || !password || password.length < 12) {
        console.log('Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD (at least 12 characters), then run npm run seed to create the first owner.');
        return;
    }
    await pool.query("INSERT INTO users(name,email,role,password_hash) VALUES ($1,$2,'OWNER',$3) ON CONFLICT(email) DO NOTHING", [
        process.env.SEED_ADMIN_NAME ?? 'Owner', email, await bcrypt.hash(password, 12)
    ]);
    console.log('Initial owner created. Configure rooms and products, then add staff in Team.');
}
seed().catch(error => { console.error('Bootstrap failed:', error); process.exitCode = 1; }).finally(() => pool.end());
