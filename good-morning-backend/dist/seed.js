"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const pool_1 = require("./db/pool");
const DEMO_PASSWORD = 'password123';
const USERS = [
    { name: 'Patrick K.', email: 'owner@goodmorning.mw', role: 'OWNER' },
    { name: 'Grace M.', email: 'admin@goodmorning.mw', role: 'ADMINISTRATOR' },
    { name: 'Chisomo B.', email: 'hostel.manager@goodmorning.mw', role: 'HOSTEL_MANAGER' },
    { name: 'Thoko N.', email: 'restaurant.manager@goodmorning.mw', role: 'RESTAURANT_MANAGER' },
    { name: 'Grace M.', email: 'restaurant.cashier@goodmorning.mw', role: 'RESTAURANT_CASHIER' },
    { name: 'Yamikani C.', email: 'grocery.manager@goodmorning.mw', role: 'GROCERY_MANAGER' },
    { name: 'Yamikani C.', email: 'grocery.cashier@goodmorning.mw', role: 'GROCERY_CASHIER' },
    { name: 'Esther P.', email: 'accountant@goodmorning.mw', role: 'ACCOUNTANT' },
    { name: 'Blessings T.', email: 'sysadmin@goodmorning.mw', role: 'SYSTEM_ADMINISTRATOR' },
];
function buildRooms() {
    const rooms = [];
    const numbered = (unit, prefix, count) => {
        for (let i = 1; i <= count; i += 1) {
            const n = String(i).padStart(2, '0');
            rooms.push({ id: `${prefix}-${n}`, housingUnit: unit, identifier: `${prefix}-${n}`, type: 'SINGLE', capacity: 1 });
        }
    };
    numbered('Area 90', 'AREA90', 8);
    rooms.push({ id: 'AREA90-YEKHAI', housingUnit: 'Area 90', identifier: 'AREA90-YEKHAI', label: 'Yekhai', type: 'SINGLE', capacity: 1 });
    rooms.push({ id: 'AREA90-YEKHAI-NEBA', housingUnit: 'Area 90', identifier: 'AREA90-YEKHAI-NEBA', label: 'Yekhai Neba', type: 'SINGLE', capacity: 1 });
    numbered('Terrazo', 'TERRAZO', 8);
    numbered('Area 50', 'AREA50', 9);
    rooms.push({ id: 'AREA50-DOUBLE', housingUnit: 'Area 50', identifier: 'AREA50-DOUBLE', label: 'Double', type: 'DOUBLE', capacity: 2 });
    numbered('Chibus', 'CHIBUS', 9);
    rooms.push({ id: 'CHIBUS-DOUBLE', housingUnit: 'Chibus', identifier: 'CHIBUS-DOUBLE', label: 'Double', type: 'DOUBLE', capacity: 2 });
    numbered('Shop', 'SHOP', 4);
    numbered('Outer Rooms', 'OUTER', 5);
    rooms.push({ id: 'OUTER-WATHU', housingUnit: 'Outer Rooms', identifier: 'OUTER-WATHU', label: 'Wathu', type: 'SINGLE', capacity: 1 });
    rooms.push({ id: 'OUTER-MARY', housingUnit: 'Outer Rooms', identifier: 'OUTER-MARY', label: 'Mary', type: 'SINGLE', capacity: 1 });
    return rooms;
}
async function seed() {
    const { rows: existing } = await pool_1.pool.query('SELECT COUNT(*)::int AS count FROM users');
    if (existing[0].count > 0) {
        console.log('Users already exist — skipping seed (data looks already seeded).');
        return;
    }
    console.log('Seeding users...');
    const passwordHash = await bcryptjs_1.default.hash(DEMO_PASSWORD, 10);
    for (const u of USERS) {
        await pool_1.pool.query('INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4)', [u.name, u.email, passwordHash, u.role]);
    }
    console.log('Seeding rooms...');
    const rooms = buildRooms();
    for (const r of rooms) {
        await pool_1.pool.query('INSERT INTO rooms (id, housing_unit, identifier, label, type, capacity) VALUES ($1, $2, $3, $4, $5, $6)', [r.id, r.housingUnit, r.identifier, r.label ?? null, r.type, r.capacity]);
    }
    console.log('Seeding tenants and hostel payments...');
    const tenants = [
        {
            firstName: 'Chikondi', lastName: 'Phiri', phone: '+265991000001',
            institution: 'University of Malawi', programme: 'BSc Information Systems',
            roomId: 'AREA90-01', monthlyAmount: 100000, moveInDate: '2026-02-01', agreementStatus: 'SIGNED',
        },
        {
            firstName: 'Takondwa', lastName: 'Banda', phone: '+265991000002',
            institution: 'University of Malawi', programme: 'BSc Computer Science',
            roomId: 'AREA90-02', monthlyAmount: 100000, moveInDate: '2026-02-01', agreementStatus: 'SIGNED',
        },
        {
            firstName: 'Memory', lastName: 'Kamanga', phone: '+265991000003',
            institution: 'University of Malawi', programme: 'BA Economics',
            roomId: 'TERRAZO-01', monthlyAmount: 90000, moveInDate: '2026-03-01', agreementStatus: 'PENDING',
        },
        {
            firstName: 'Blessings', lastName: 'Mvula', phone: '+265991000004',
            institution: 'University of Malawi', programme: 'BSc Accounting',
            roomId: 'AREA50-DOUBLE', monthlyAmount: 70000, moveInDate: '2026-01-15', agreementStatus: 'SIGNED',
        },
        {
            firstName: 'Precious', lastName: 'Mwale', phone: '+265991000005',
            institution: 'University of Malawi', programme: 'BSc Nursing',
            roomId: 'AREA50-DOUBLE', monthlyAmount: 70000, moveInDate: '2026-01-20', agreementStatus: 'SIGNED',
        },
        {
            firstName: 'Yamikani', lastName: 'Chirwa', phone: '+265991000006',
            institution: 'University of Malawi', programme: 'BSc Biology',
            roomId: 'CHIBUS-01', monthlyAmount: 95000, moveInDate: '2026-02-10', agreementStatus: 'EXPIRED',
        },
    ];
    const tenantIds = {};
    for (const t of tenants) {
        const { rows } = await pool_1.pool.query(`INSERT INTO tenants (first_name, last_name, phone, institution, programme, room_id, monthly_amount, move_in_date, agreement_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`, [t.firstName, t.lastName, t.phone, t.institution, t.programme, t.roomId, t.monthlyAmount, t.moveInDate, t.agreementStatus]);
        tenantIds[`${t.firstName} ${t.lastName}`] = rows[0].id;
    }
    const payments = [
        { name: 'Chikondi Phiri', paid: 100000 },
        { name: 'Takondwa Banda', paid: 70000 },
        { name: 'Memory Kamanga', paid: 0 },
        { name: 'Blessings Mvula', paid: 70000 },
        { name: 'Precious Mwale', paid: 40000 },
        { name: 'Yamikani Chirwa', paid: 95000 },
    ];
    for (const p of payments) {
        const tenant = tenants.find((t) => `${t.firstName} ${t.lastName}` === p.name);
        await pool_1.pool.query(`INSERT INTO hostel_payments (tenant_id, period_label, expected_amount, amount_paid, payment_method, payment_date)
       VALUES ($1, $2, $3, $4, $5, $6)`, [tenantIds[p.name], 'September 2026', tenant.monthlyAmount, p.paid, p.paid > 0 ? 'CASH' : null, p.paid > 0 ? '2026-09-05' : null]);
    }
    console.log('Seeding food items and daily food records...');
    const foodItems = [
        { name: 'Maize flour', unit: 'kg', cost: 1500 },
        { name: 'Rice', unit: 'kg', cost: 2300 },
        { name: 'Beef', unit: 'kg', cost: 11000 },
        { name: 'Chicken', unit: 'kg', cost: 9500 },
        { name: 'Matemba', unit: 'kg', cost: 6000 },
        { name: 'Utaka', unit: 'kg', cost: 7000 },
        { name: 'Vegetables', unit: 'kg', cost: 800 },
        { name: 'Onions', unit: 'kg', cost: 1200 },
        { name: 'Pepper', unit: 'kg', cost: 3000 },
        { name: 'Spices', unit: 'kg', cost: 4000 },
        { name: 'Salt', unit: 'kg', cost: 900 },
        { name: 'Bananas', unit: 'piece', cost: 300 },
    ];
    const foodItemIds = {};
    for (const f of foodItems) {
        const { rows } = await pool_1.pool.query('INSERT INTO food_items (name, unit, cost) VALUES ($1, $2, $3) RETURNING id', [f.name, f.unit, f.cost]);
        foodItemIds[f.name] = rows[0].id;
    }
    const foodRecords = [
        { name: 'Maize flour', quantity: 20, cost: 30000 },
        { name: 'Rice', quantity: 15, cost: 35000 },
        { name: 'Beef', quantity: 8, cost: 90000 },
    ];
    for (const r of foodRecords) {
        await pool_1.pool.query('INSERT INTO daily_food_records (date, food_item_id, quantity, cost) VALUES (CURRENT_DATE, $1, $2, $3)', [foodItemIds[r.name], r.quantity, r.cost]);
    }
    console.log('Seeding restaurant menu...');
    const menuItems = [
        { name: 'Nsima + Beef', category: 'Meals', price: 2500 },
        { name: 'Nsima + Chicken', category: 'Meals', price: 2800 },
        { name: 'Nsima + Utaka', category: 'Meals', price: 2200 },
        { name: 'Nsima + Matemba', category: 'Meals', price: 2000 },
        { name: 'Rice + Beef', category: 'Meals', price: 3000 },
        { name: 'Rice + Chicken', category: 'Meals', price: 3200 },
        { name: 'Banana', category: 'Sides', price: 500 },
    ];
    const menuItemIds = {};
    for (const m of menuItems) {
        const { rows } = await pool_1.pool.query('INSERT INTO menu_items (name, category, selling_price, available) VALUES ($1, $2, $3, true) RETURNING id', [m.name, m.category, m.price]);
        menuItemIds[m.name] = rows[0].id;
    }
    console.log('Seeding grocery products...');
    const products = [
        { name: 'Sugar', category: 'Pantry', sellingPrice: 2500, buyingPrice: 2000, stock: 18, lowStock: 20, unit: 'kg' },
        { name: 'Bread', category: 'Bakery', sellingPrice: 1500, buyingPrice: 1100, stock: 24, lowStock: 10, unit: 'piece' },
        { name: 'Milk', category: 'Dairy', sellingPrice: 2000, buyingPrice: 1600, stock: 30, lowStock: 12, unit: 'litre' },
        { name: 'Cooking oil', category: 'Pantry', sellingPrice: 6500, buyingPrice: 5500, stock: 9, lowStock: 10, unit: 'litre' },
        { name: 'Soap', category: 'Household', sellingPrice: 1200, buyingPrice: 900, stock: 40, lowStock: 15, unit: 'piece' },
        { name: 'Rice', category: 'Pantry', sellingPrice: 2800, buyingPrice: 2300, stock: 50, lowStock: 20, unit: 'kg' },
    ];
    for (const p of products) {
        await pool_1.pool.query(`INSERT INTO grocery_products (name, category, selling_price, buying_price, current_stock, low_stock_level, unit)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`, [p.name, p.category, p.sellingPrice, p.buyingPrice, p.stock, p.lowStock, p.unit]);
    }
    console.log('Seeding expenses...');
    const expenses = [
        { description: 'Electricity', amount: 80000, business: 'GENERAL', date: '2026-09-08', method: 'BANK' },
        { description: 'Transport', amount: 20000, business: 'GENERAL', date: '2026-09-09', method: 'CASH' },
        { description: 'Restaurant gas', amount: 50000, business: 'RESTAURANT', date: '2026-09-07', method: 'CASH' },
        { description: 'Cleaning supplies', amount: 15000, business: 'HOSTEL', date: '2026-09-06', method: 'CASH' },
    ];
    for (const e of expenses) {
        await pool_1.pool.query('INSERT INTO expenses (description, amount, business, date, payment_method) VALUES ($1, $2, $3, $4, $5)', [e.description, e.amount, e.business, e.date, e.method]);
    }
    console.log('Seeding one sample sale...');
    const { rows: saleRows } = await pool_1.pool.query(`INSERT INTO sales (business, date, time, total, payment_method, status, cashier)
     VALUES ('RESTAURANT', CURRENT_DATE, '12:30', 6100, 'CASH', 'COMPLETED', 'Grace M.') RETURNING id`);
    const saleId = saleRows[0].id;
    await pool_1.pool.query(`INSERT INTO sale_items (sale_id, item_id, name, quantity, unit_price) VALUES
       ($1, $2, 'Nsima + Beef', 2, 2500),
       ($1, $3, 'Banana', 3, 500)`, [saleId, menuItemIds['Nsima + Beef'], menuItemIds['Banana']]);
    console.log('Done. Demo accounts (all use the same password):');
    console.log(`  password: ${DEMO_PASSWORD}`);
    for (const u of USERS)
        console.log(`  ${u.role.padEnd(22)} ${u.email}`);
}
seed()
    .catch((err) => {
    console.error('Seeding failed:', err);
    process.exitCode = 1;
})
    .finally(() => pool_1.pool.end());
//# sourceMappingURL=seed.js.map