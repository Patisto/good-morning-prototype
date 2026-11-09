"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const crypto_1 = require("crypto");
const rent_1 = require("../services/rent");
const phone_1 = require("../services/phone");
const pool_1 = require("../db/pool");
const auth_1 = require("../middleware/auth");
const http_1 = require("../utils/http");
const router = (0, express_1.Router)();
router.use(auth_1.requireAuth, (0, auth_1.requireSection)('hostel'));
const manage = (0, auth_1.requireManager)('hostel');
router.get('/', (0, http_1.route)(async (req, res) => {
    const period = (0, http_1.month)(req.query.month);
    const [rooms, tenants, charges, settings, units] = await Promise.all([
        pool_1.pool.query(`SELECT r.*, u.name AS housing_unit, (SELECT COUNT(*)::int FROM tenants t WHERE t.room_id=r.id AND t.deleted_at IS NULL AND t.checkout_date IS NULL) AS occupants,
      COALESCE((SELECT amount FROM room_rates WHERE room_id=r.id AND effective_month <= $1 ORDER BY effective_month DESC LIMIT 1),0) AS monthly_price
      FROM rooms r JOIN housing_units u ON u.id=r.housing_unit_id WHERE r.archived_at IS NULL ORDER BY u.name,r.identifier`, [period]),
        pool_1.pool.query('SELECT * FROM tenants WHERE deleted_at IS NULL ORDER BY last_name,first_name'),
        pool_1.pool.query(`SELECT c.*, COALESCE(SUM(p.amount),0) AS amount_paid FROM rent_charges c
      LEFT JOIN rent_receipts p ON p.charge_id=c.id WHERE c.month=$1 GROUP BY c.id`, [period]),
        pool_1.pool.query('SELECT default_monthly_price FROM hostel_settings WHERE id=true'),
        pool_1.pool.query('SELECT id,name FROM housing_units ORDER BY name'),
    ]);
    res.json({ units: units.rows, rooms: rooms.rows, tenants: tenants.rows, charges: charges.rows, defaultPrice: Number(settings.rows[0].default_monthly_price) });
}));
router.post('/units', manage, (0, http_1.route)(async (req, res) => {
    const name = (0, http_1.text)(req.body.name, 'Unit name');
    const id = req.body.id ? (0, http_1.text)(req.body.id, 'Unit ID') : (0, crypto_1.randomUUID)();
    await (0, http_1.transaction)(async (db) => {
        if (req.body.id) {
            const unit = await db.query('UPDATE housing_units SET name=$2 WHERE id::text=$1 RETURNING id', [id, name]);
            (0, http_1.check)(unit.rowCount, 'Housing unit not found.', 404);
            await db.query('UPDATE rooms SET housing_unit=$2,updated_at=now() WHERE housing_unit_id::text=$1', [id, name]);
        }
        else
            await db.query('INSERT INTO housing_units(id,name) VALUES ($1,$2)', [id, name]);
    });
    res.json({ id });
}));
router.get('/rent-quote', (0, http_1.route)(async (req, res) => {
    const account = await (0, rent_1.rentAccount)(pool_1.pool, (0, http_1.text)(req.query.tenantId, 'Tenant'), (0, http_1.month)(req.query.month));
    res.json(account);
}));
router.post('/payments', manage, (0, http_1.route)(async (req, res) => {
    const tenantId = (0, http_1.text)(req.body.tenantId, 'Tenant'), period = (0, http_1.month)(req.body.month);
    const amount = (0, http_1.number)(req.body.amount, 'Payment', 0.01), paymentDate = (0, http_1.date)(req.body.paymentDate);
    const paymentMethod = (0, http_1.method)(req.body.paymentMethod);
    (0, http_1.check)(paymentDate <= (0, http_1.today)(), 'Payment date cannot be in the future.');
    await (0, http_1.transaction)(async (db) => {
        if (!await (0, http_1.claimRequest)(db, req.body.requestId, req.user.id, `rent:${tenantId}:${period}`))
            return;
        await (0, rent_1.ensureRentCharges)(db, tenantId, period);
        const account = await (0, rent_1.rentAccount)(db, tenantId, period, true);
        const charge = await db.query('SELECT id FROM rent_charges WHERE tenant_id=$1 AND month=$2 FOR UPDATE', [tenantId, period]);
        await db.query('INSERT INTO rent_receipts(charge_id,amount,payment_method,payment_date,recorded_by) VALUES ($1,$2,$3,$4,$5)', [charge.rows[0].id, amount, paymentMethod, paymentDate, req.user.id]);
    });
    res.json({ ok: true });
}));
router.post('/settings', manage, (0, http_1.route)(async (req, res) => {
    const price = (0, http_1.number)(req.body.defaultPrice, 'Default monthly rent');
    await pool_1.pool.query('UPDATE hostel_settings SET default_monthly_price=$1 WHERE id=true', [price]);
    res.json({ ok: true });
}));
router.post('/rooms', manage, (0, http_1.route)(async (req, res) => {
    const b = req.body;
    const id = b.id ? (0, http_1.text)(b.id, 'Room ID') : (0, crypto_1.randomUUID)();
    const capacity = (0, http_1.number)(b.capacity, 'Capacity', 1);
    (0, http_1.check)(Number.isInteger(capacity), 'Capacity must be a whole number.');
    const price = (0, http_1.number)(b.monthlyPrice, 'Monthly rent');
    const effective = (0, http_1.month)(b.effectiveMonth);
    (0, http_1.check)(effective >= (0, http_1.today)().slice(0, 7), 'Price changes must apply to this month or a future month.');
    const unitId = (0, http_1.text)(b.housingUnitId, 'Housing unit'), identifier = (0, http_1.text)(b.identifier, 'Room name');
    await (0, http_1.transaction)(async (db) => {
        const unit = await db.query('SELECT id,name FROM housing_units WHERE id::text=$1 FOR SHARE', [unitId]);
        (0, http_1.check)(unit.rowCount, 'Select an existing housing unit.');
        const housingUnit = unit.rows[0].name;
        if (b.id) {
            const existing = await db.query('SELECT id FROM rooms WHERE id=$1 AND archived_at IS NULL FOR UPDATE', [id]);
            (0, http_1.check)(existing.rowCount, 'Room not found.', 404);
            const count = await db.query('SELECT COUNT(*)::int AS n FROM tenants WHERE room_id=$1 AND deleted_at IS NULL AND checkout_date IS NULL', [id]);
            (0, http_1.check)(capacity >= count.rows[0].n, 'Capacity cannot be lower than current occupancy.');
            await db.query('UPDATE rooms SET housing_unit=$2,identifier=$3,label=$3,capacity=$4,housing_unit_id=$5,updated_at=now() WHERE id=$1', [id, housingUnit, identifier, capacity, unitId]);
        }
        else {
            await db.query("INSERT INTO rooms(id,housing_unit,identifier,label,type,capacity,housing_unit_id) VALUES ($1,$2,$3,$3,'SINGLE',$4,$5)", [id, housingUnit, identifier, capacity, unitId]);
        }
        await db.query('INSERT INTO room_rates(room_id,effective_month,amount) VALUES ($1,$2,$3) ON CONFLICT(room_id,effective_month) DO UPDATE SET amount=EXCLUDED.amount', [id, effective, price]);
    });
    res.json({ id });
}));
router.post('/rooms/batch-price', manage, (0, http_1.route)(async (req, res) => {
    const ids = req.body.roomIds;
    (0, http_1.check)(Array.isArray(ids) && ids.length > 0 && ids.length <= 500 && ids.every(id => typeof id === 'string'), 'Select between 1 and 500 rooms.');
    const price = (0, http_1.number)(req.body.monthlyPrice, 'Monthly rent'), effective = (0, http_1.month)(req.body.effectiveMonth);
    (0, http_1.check)(effective >= (0, http_1.today)().slice(0, 7), 'Price changes must apply to this month or a future month.');
    await (0, http_1.transaction)(async (db) => {
        const rooms = await db.query('SELECT id FROM rooms WHERE id=ANY($1::text[]) AND archived_at IS NULL ORDER BY id FOR UPDATE', [ids]);
        (0, http_1.check)(rooms.rowCount === new Set(ids).size, 'One or more rooms are unavailable.');
        await db.query(`INSERT INTO room_rates(room_id,effective_month,amount) SELECT unnest($1::text[]),$2,$3
      ON CONFLICT(room_id,effective_month) DO UPDATE SET amount=EXCLUDED.amount`, [Array.from(new Set(ids)), effective, price]);
    });
    res.json({ ok: true });
}));
router.delete('/rooms/:id', manage, (0, http_1.route)(async (req, res) => {
    await (0, http_1.transaction)(async (db) => {
        const room = await db.query('SELECT id FROM rooms WHERE id=$1 AND archived_at IS NULL FOR UPDATE', [req.params.id]);
        (0, http_1.check)(room.rowCount, 'Room not found.', 404);
        const occupied = await db.query('SELECT id FROM tenants WHERE room_id=$1 AND deleted_at IS NULL AND checkout_date IS NULL', [req.params.id]);
        (0, http_1.check)(!occupied.rowCount, 'Move or check out all tenants before deleting this room.');
        await db.query('UPDATE rooms SET archived_at=now() WHERE id=$1', [req.params.id]);
    });
    res.json({ ok: true });
}));
// Explicit whitelist preserves the complete tenant profile without accepting arbitrary SQL fields.
const profileFields = ['middleName', 'gender', 'dateOfBirth', 'altPhone', 'email', 'homeDistrict', 'homeAddress', 'emergencyContactName', 'emergencyContactPhone', 'emergencyContactRelationship', 'institution', 'programme', 'faculty', 'department', 'yearOfStudy', 'regNumber', 'academicYear'];
const snake = (key) => key.replace(/[A-Z]/g, c => '_' + c.toLowerCase());
router.post('/tenants', manage, (0, http_1.route)(async (req, res) => {
    const b = req.body, id = b.id || (0, crypto_1.randomUUID)();
    const first = (0, http_1.text)(b.firstName, 'First name'), last = (0, http_1.text)(b.lastName, 'Last name'), phone = (0, http_1.text)(b.phone, 'Phone');
    const phoneNormalized = (0, phone_1.normalizeMalawiPhone)(phone);
    const roomId = (0, http_1.text)(b.roomId, 'Room'), moveIn = (0, http_1.date)(b.moveInDate);
    (0, http_1.check)(moveIn <= (0, http_1.today)(), 'Move-in cannot be in the future.');
    (0, http_1.check)(['PENDING', 'SIGNED', 'EXPIRED'].includes(b.agreementStatus), 'Invalid agreement status.');
    const deposit = (0, http_1.number)(b.deposit ?? 0, 'Deposit');
    await (0, http_1.transaction)(async (db) => {
        // Lock the tenant before rooms so simultaneous moves of the same tenant serialize.
        let previousRoom;
        if (b.id) {
            const current = await db.query('SELECT * FROM tenants WHERE id=$1 AND deleted_at IS NULL AND checkout_date IS NULL FOR UPDATE', [id]);
            (0, http_1.check)(current.rowCount, 'Active tenant not found.', 404);
            (0, http_1.check)(current.rows[0].move_in_date === moveIn, 'Move-in date cannot be changed after registration.');
            previousRoom = current.rows[0].room_id;
        }
        const duplicate = await db.query('SELECT id FROM tenants WHERE phone_normalized=$1 AND id<>$2 AND deleted_at IS NULL', [phoneNormalized, id]);
        (0, http_1.check)(!duplicate.rowCount, 'That phone number is already registered to another active tenant.', 409);
        const room = await db.query('SELECT * FROM rooms WHERE id=$1 AND archived_at IS NULL FOR UPDATE', [roomId]);
        (0, http_1.check)(room.rowCount, 'Room not found.', 404);
        const occupancy = await db.query('SELECT COUNT(*)::int AS n FROM tenants WHERE room_id=$1 AND id<>$2 AND deleted_at IS NULL AND checkout_date IS NULL', [roomId, id]);
        (0, http_1.check)(occupancy.rows[0].n < room.rows[0].capacity, 'That room is full.');
        const rate = await db.query('SELECT amount FROM room_rates WHERE room_id=$1 AND effective_month <= $2 ORDER BY effective_month DESC LIMIT 1', [roomId, (0, http_1.today)().slice(0, 7)]);
        const values = [id, first, last, phone, roomId, moveIn, rate.rows[0]?.amount ?? 0, deposit, b.agreementStatus];
        const columns = ['id', 'first_name', 'last_name', 'phone', 'room_id', 'move_in_date', 'monthly_amount', 'deposit', 'agreement_status'];
        for (const field of profileFields) {
            columns.push(snake(field));
            const value = b[field] === '' || b[field] === undefined ? null : b[field];
            if (field === 'dateOfBirth' && value !== null)
                (0, http_1.date)(value);
            if (field === 'yearOfStudy' && value !== null)
                (0, http_1.check)(Number.isInteger(value) && value > 0, 'Invalid year of study.');
            if (field !== 'yearOfStudy' && value !== null)
                (0, http_1.check)(typeof value === 'string' && value.length <= 500, `Invalid ${field}.`);
            values.push(value);
        }
        await db.query(`INSERT INTO tenants(${columns.join(',')}) VALUES (${values.map((_, i) => '$' + (i + 1)).join(',')})
      ON CONFLICT(id) DO UPDATE SET ${columns.slice(1).map(c => `${c}=EXCLUDED.${c}`).join(',')},updated_at=now()`, values);
        if (previousRoom !== roomId)
            await db.query('INSERT INTO tenant_room_history(tenant_id,effective_month,room_id) VALUES ($1,$2,$3) ON CONFLICT(tenant_id,effective_month) DO UPDATE SET room_id=EXCLUDED.room_id', [id, b.id ? (0, http_1.today)().slice(0, 7) : moveIn.slice(0, 7), roomId]);
    });
    res.json({ id });
}));
router.post('/tenants/:id/checkout', manage, (0, http_1.route)(async (req, res) => {
    const end = (0, http_1.date)(req.body.date);
    (0, http_1.check)(end === (0, http_1.today)(), 'Checkouts must be recorded for today.');
    const result = await pool_1.pool.query('UPDATE tenants SET checkout_date=$2,updated_at=now() WHERE id=$1 AND checkout_date IS NULL AND move_in_date <= $2 RETURNING id', [req.params.id, end]);
    (0, http_1.check)(result.rowCount, 'Active tenant not found or checkout is before move-in.', 400);
    res.json({ ok: true });
}));
router.post('/charges', manage, (0, http_1.route)(async (req, res) => {
    const period = (0, http_1.month)(req.body.month);
    (0, http_1.check)(period <= (0, http_1.today)().slice(0, 7), 'Generate rent for the current or a previous month.');
    await (0, http_1.transaction)(async (db) => {
        const tenants = await db.query(`SELECT id FROM tenants WHERE deleted_at IS NULL AND to_char(move_in_date,'YYYY-MM') <= $1
            AND (checkout_date IS NULL OR to_char(checkout_date,'YYYY-MM') >= $1) ORDER BY id`, [period]);
        for (const tenant of tenants.rows)
            await (0, rent_1.ensureRentCharges)(db, tenant.id, period);
    });
    res.json({ ok: true });
}));
router.get('/charges/:id/receipts', (0, http_1.route)(async (req, res) => {
    const result = await pool_1.pool.query('SELECT * FROM rent_receipts WHERE charge_id=$1 ORDER BY payment_date,created_at', [req.params.id]);
    res.json({ receipts: result.rows });
}));
router.post('/charges/:id/payments', manage, (0, http_1.route)(async (req, res) => {
    const amount = (0, http_1.number)(req.body.amount, 'Payment', 0.01), paymentDate = (0, http_1.date)(req.body.paymentDate), paymentMethod = (0, http_1.method)(req.body.paymentMethod);
    (0, http_1.check)(paymentDate <= (0, http_1.today)(), 'Payment date cannot be in the future.');
    await (0, http_1.transaction)(async (db) => {
        if (!await (0, http_1.claimRequest)(db, req.body.requestId, req.user.id, `rent:${req.params.id}`))
            return;
        const charge = await db.query('SELECT id FROM rent_charges WHERE id=$1 FOR UPDATE', [req.params.id]);
        (0, http_1.check)(charge.rowCount, 'Monthly charge not found.', 404);
        // Keep every receipt, including overpayments; the balance may become a credit.
        await db.query('INSERT INTO rent_receipts(charge_id,amount,payment_method,payment_date,recorded_by) VALUES ($1,$2,$3,$4,$5)', [req.params.id, amount, paymentMethod, paymentDate, req.user.id]);
    });
    res.json({ ok: true });
}));
router.post('/charges/:id/notes', manage, (0, http_1.route)(async (req, res) => {
    (0, http_1.check)(typeof req.body.notes === 'string' && req.body.notes.length <= 2000, 'Notes must be at most 2000 characters.');
    const result = await pool_1.pool.query('UPDATE rent_charges SET notes=$2 WHERE id=$1 RETURNING id', [req.params.id, req.body.notes]);
    (0, http_1.check)(result.rowCount, 'Monthly charge not found.', 404);
    res.json({ ok: true });
}));
exports.default = router;
//# sourceMappingURL=hostel.routes.js.map