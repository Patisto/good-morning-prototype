"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const pool_1 = require("./db/pool");
const singleRooms = (prefix, count) => Array.from({ length: count }, (_, i) => ({ id: `${prefix}-${String(i + 1).padStart(2, '0')}`, type: 'SINGLE', capacity: 1 }));
const units = [
    { name: 'Area 90', rooms: [...singleRooms('AREA90', 8), { id: 'AREA90-YEKHAI', label: 'Yekhai', type: 'SINGLE', capacity: 1 }, { id: 'AREA90-YEKHAI-NEBA', label: 'Yekhai Neba', type: 'SINGLE', capacity: 1 }] },
    { name: 'Terrazo', rooms: singleRooms('TERRAZO', 8) },
    { name: 'Area 50', rooms: [...singleRooms('AREA50', 9), { id: 'AREA50-DOUBLE', label: 'Double', type: 'DOUBLE', capacity: 2 }] },
    { name: 'Chibus', rooms: [...singleRooms('CHIBUS', 9), { id: 'CHIBUS-DOUBLE', label: 'Double', type: 'DOUBLE', capacity: 2 }] },
    { name: 'Shop', rooms: singleRooms('SHOP', 4) },
    { name: 'Outer Rooms', rooms: [...singleRooms('OUTER', 5), { id: 'OUTER-WATHU', label: 'Wathu', type: 'SINGLE', capacity: 1 }, { id: 'OUTER-MARY', label: 'Mary', type: 'SINGLE', capacity: 1 }] },
];
async function seedRooms() {
    const existing = await pool_1.pool.query('SELECT COUNT(*)::int AS count FROM rooms');
    if (existing.rows[0].count > 0) {
        console.log('Room records already exist; starter inventory skipped.');
        return;
    }
    for (const unit of units) {
        await pool_1.pool.query('INSERT INTO housing_units(name) VALUES ($1) ON CONFLICT DO NOTHING', [unit.name]);
        const result = await pool_1.pool.query('SELECT id FROM housing_units WHERE lower(btrim(name))=lower($1)', [unit.name]);
        for (const room of unit.rooms) {
            const identifier = room.label ?? room.id;
            await pool_1.pool.query(`INSERT INTO rooms(id,housing_unit,identifier,label,type,capacity,housing_unit_id)
                VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO NOTHING`, [room.id, unit.name, identifier, room.label ?? null, room.type, room.capacity, result.rows[0].id]);
        }
    }
    console.log('Starter housing units and rooms created.');
}
async function seedSuperManager() {
    const existing = await pool_1.pool.query('SELECT 1 FROM users LIMIT 1');
    if (existing.rowCount) {
        console.log('User records already exist; initial super manager skipped.');
        return;
    }
    const email = process.env.SEED_SUPER_EMAIL?.trim().toLowerCase();
    const password = process.env.SEED_SUPER_PASSWORD;
    if (!email || !password || password.length < 12) {
        throw new Error('Set SEED_SUPER_EMAIL and SEED_SUPER_PASSWORD (at least 12 characters) in the server deploy environment before the first deployment.');
    }
    await pool_1.pool.query("INSERT INTO users(name,email,role,password_hash) VALUES ($1,$2,'SUPER_MANAGER',$3)", [
        process.env.SEED_SUPER_NAME?.trim() || 'Super Manager', email, await bcryptjs_1.default.hash(password, 12)
    ]);
    console.log('Initial super manager created.');
}
async function seed() {
    await seedRooms();
    await seedSuperManager();
    console.log('No tenants, sales, products, payments, or expenses were seeded.');
}
seed().catch(error => { console.error('Initial data setup failed:', error); process.exitCode = 1; }).finally(() => pool_1.pool.end());
//# sourceMappingURL=seed.js.map