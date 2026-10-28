import { Router } from 'express';
import { randomUUID } from 'crypto';
import { rentAccount } from '../services/rent';
import { pool } from '../db/pool';
import { requireAuth, requireSection, requireManager } from '../middleware/auth';
import { claimRequest, check, date, method, month, number, route, text, today, transaction } from '../utils/http';
const router = Router();
router.get('/registration/options', route(async (_req, res) => {
    const [rooms, settings] = await Promise.all([
        pool.query(`SELECT r.id,r.label,r.identifier,u.name AS housing_unit,r.capacity,
          (SELECT COUNT(*)::int FROM tenants t WHERE t.room_id=r.id AND t.deleted_at IS NULL AND t.checkout_date IS NULL) AS occupants
          FROM rooms r JOIN housing_units u ON u.id=r.housing_unit_id WHERE r.archived_at IS NULL ORDER BY u.name,r.identifier`),
        pool.query('SELECT name FROM housing_units ORDER BY name'),
    ]);
    res.json({ rooms: rooms.rows, units: settings.rows });
}));
router.post('/registration', route(async (req, res) => {
    const b = req.body;
    const first = text(b.firstName, 'First name'), last = text(b.lastName, 'Last name'), phone = text(b.phone, 'Phone');
    check(typeof b.studentSignature === 'string' && /^data:image\/(png|jpeg);base64,/.test(b.studentSignature) && b.studentSignature.length < 700000, 'Please provide a valid online signature.');
    const roomId = typeof b.preferredRoomId === 'string' && b.preferredRoomId ? b.preferredRoomId : null;
    if (roomId) {
        const room = await pool.query(`SELECT r.capacity,(SELECT COUNT(*)::int FROM tenants t WHERE t.room_id=r.id AND t.deleted_at IS NULL AND t.checkout_date IS NULL) AS occupants FROM rooms r WHERE r.id=$1 AND r.archived_at IS NULL`, [roomId]);
        check(room.rowCount, 'Selected room is unavailable.');
    }
    const result = await pool.query(`INSERT INTO student_applications(first_name,middle_name,last_name,phone,email,institution,programme,faculty,department,year_of_study,reg_number,academic_year,preferred_room_id,student_signature)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`, [first, b.middleName || null, last, phone, b.email || null, b.institution || null, b.programme || null, b.faculty || null, b.department || null, b.yearOfStudy || null, b.regNumber || null, b.academicYear || null, roomId, b.studentSignature]);
    res.json({ id: result.rows[0].id });
}));
router.use(requireAuth, requireSection('hostel'));
const manage = requireManager('hostel');
router.get('/applications', manage, route(async (_req, res) => {
    const result = await pool.query(`SELECT a.*,r.label AS room_label,r.identifier AS room_identifier,u.name AS housing_unit FROM student_applications a LEFT JOIN rooms r ON r.id=a.preferred_room_id LEFT JOIN housing_units u ON u.id=r.housing_unit_id ORDER BY a.submitted_at DESC`);
    res.json({ applications: result.rows });
}));
router.get('/', route(async (req, res) => {
    const period = month(req.query.month);
    const [rooms, tenants, charges, settings, units] = await Promise.all([
        pool.query(`SELECT r.*, u.name AS housing_unit, (SELECT COUNT(*)::int FROM tenants t WHERE t.room_id=r.id AND t.deleted_at IS NULL AND t.checkout_date IS NULL) AS occupants,
      COALESCE((SELECT amount FROM room_rates WHERE room_id=r.id AND effective_month <= $1 ORDER BY effective_month DESC LIMIT 1),0) AS monthly_price
      FROM rooms r JOIN housing_units u ON u.id=r.housing_unit_id WHERE r.archived_at IS NULL ORDER BY u.name,r.identifier`, [period]),
        pool.query('SELECT * FROM tenants WHERE deleted_at IS NULL ORDER BY last_name,first_name'),
        pool.query(`SELECT c.*, COALESCE(SUM(p.amount),0) AS amount_paid FROM rent_charges c
      LEFT JOIN rent_receipts p ON p.charge_id=c.id WHERE c.month=$1 GROUP BY c.id`, [period]),
        pool.query('SELECT default_monthly_price FROM hostel_settings WHERE id=true'),
        pool.query('SELECT id,name FROM housing_units ORDER BY name'),
    ]);
    res.json({ units: units.rows, rooms: rooms.rows, tenants: tenants.rows, charges: charges.rows, defaultPrice: Number(settings.rows[0].default_monthly_price) });
}));
router.post('/units', manage, route(async (req, res) => {
    const name = text(req.body.name, 'Unit name');
    const id = req.body.id ? text(req.body.id, 'Unit ID') : randomUUID();
    await transaction(async (db) => {
        if (req.body.id) {
            const unit = await db.query('UPDATE housing_units SET name=$2 WHERE id::text=$1 RETURNING id', [id, name]);
            check(unit.rowCount, 'Housing unit not found.', 404);
            await db.query('UPDATE rooms SET housing_unit=$2,updated_at=now() WHERE housing_unit_id::text=$1', [id, name]);
        }
        else
            await db.query('INSERT INTO housing_units(id,name) VALUES ($1,$2)', [id, name]);
    });
    res.json({ id });
}));
router.get('/rent-quote', route(async (req, res) => {
    const account = await rentAccount(pool, text(req.query.tenantId, 'Tenant'), month(req.query.month));
    res.json(account);
}));
router.post('/payments', manage, route(async (req, res) => {
    const tenantId = text(req.body.tenantId, 'Tenant'), period = month(req.body.month);
    const amount = number(req.body.amount, 'Payment', 0.01), paymentDate = date(req.body.paymentDate);
    const paymentMethod = method(req.body.paymentMethod);
    check(paymentDate <= today(), 'Payment date cannot be in the future.');
    await transaction(async (db) => {
        if (!await claimRequest(db, req.body.requestId, req.user!.id, `rent:${tenantId}:${period}`))
            return;
        const account = await rentAccount(db, tenantId, period, true);
        const charge = await db.query(`INSERT INTO rent_charges(tenant_id,month,expected_amount) VALUES ($1,$2,$3)
            ON CONFLICT(tenant_id,month) DO UPDATE SET tenant_id=EXCLUDED.tenant_id RETURNING id`, [tenantId, period, account.expectedAmount]);
        await db.query('INSERT INTO rent_receipts(charge_id,amount,payment_method,payment_date,recorded_by) VALUES ($1,$2,$3,$4,$5)', [charge.rows[0].id, amount, paymentMethod, paymentDate, req.user!.id]);
    });
    res.json({ ok: true });
}));
router.post('/settings', manage, route(async (req, res) => {
    const price = number(req.body.defaultPrice, 'Default monthly rent');
    await pool.query('UPDATE hostel_settings SET default_monthly_price=$1 WHERE id=true', [price]);
    res.json({ ok: true });
}));
router.post('/rooms', manage, route(async (req, res) => {
    const b = req.body;
    const id = b.id ? text(b.id, 'Room ID') : randomUUID();
    const capacity = number(b.capacity, 'Capacity', 1);
    check(Number.isInteger(capacity), 'Capacity must be a whole number.');
    const price = number(b.monthlyPrice, 'Monthly rent');
    const effective = month(b.effectiveMonth);
    check(effective >= today().slice(0, 7), 'Price changes must apply to this month or a future month.');
    const unitId = text(b.housingUnitId, 'Housing unit'), identifier = text(b.identifier, 'Room name');
    await transaction(async (db) => {
        const unit = await db.query('SELECT id,name FROM housing_units WHERE id::text=$1 FOR SHARE', [unitId]);
        check(unit.rowCount, 'Select an existing housing unit.');
        const housingUnit = unit.rows[0].name;
        if (b.id) {
            const existing = await db.query('SELECT id FROM rooms WHERE id=$1 AND archived_at IS NULL FOR UPDATE', [id]);
            check(existing.rowCount, 'Room not found.', 404);
            const count = await db.query('SELECT COUNT(*)::int AS n FROM tenants WHERE room_id=$1 AND deleted_at IS NULL AND checkout_date IS NULL', [id]);
            check(capacity >= count.rows[0].n, 'Capacity cannot be lower than current occupancy.');
            await db.query('UPDATE rooms SET housing_unit=$2,identifier=$3,label=$3,capacity=$4,housing_unit_id=$5,updated_at=now() WHERE id=$1', [id, housingUnit, identifier, capacity, unitId]);
        }
        else {
            await db.query("INSERT INTO rooms(id,housing_unit,identifier,label,type,capacity,housing_unit_id) VALUES ($1,$2,$3,$3,'SINGLE',$4,$5)", [id, housingUnit, identifier, capacity, unitId]);
        }
        await db.query('INSERT INTO room_rates(room_id,effective_month,amount) VALUES ($1,$2,$3) ON CONFLICT(room_id,effective_month) DO UPDATE SET amount=EXCLUDED.amount', [id, effective, price]);
    });
    res.json({ id });
}));
router.post('/rooms/batch-price', manage, route(async (req, res) => {
    const ids = req.body.roomIds;
    check(Array.isArray(ids) && ids.length > 0 && ids.length <= 500 && ids.every(id => typeof id === 'string'), 'Select between 1 and 500 rooms.');
    const price = number(req.body.monthlyPrice, 'Monthly rent'), effective = month(req.body.effectiveMonth);
    check(effective >= today().slice(0, 7), 'Price changes must apply to this month or a future month.');
    await transaction(async (db) => {
        const rooms = await db.query('SELECT id FROM rooms WHERE id=ANY($1::text[]) AND archived_at IS NULL ORDER BY id FOR UPDATE', [ids]);
        check(rooms.rowCount === new Set(ids).size, 'One or more rooms are unavailable.');
        await db.query(`INSERT INTO room_rates(room_id,effective_month,amount) SELECT unnest($1::text[]),$2,$3
      ON CONFLICT(room_id,effective_month) DO UPDATE SET amount=EXCLUDED.amount`, [Array.from(new Set(ids)), effective, price]);
    });
    res.json({ ok: true });
}));
router.delete('/rooms/:id', manage, route(async (req, res) => {
    await transaction(async (db) => {
        const room = await db.query('SELECT id FROM rooms WHERE id=$1 AND archived_at IS NULL FOR UPDATE', [req.params.id]);
        check(room.rowCount, 'Room not found.', 404);
        const occupied = await db.query('SELECT id FROM tenants WHERE room_id=$1 AND deleted_at IS NULL AND checkout_date IS NULL', [req.params.id]);
        check(!occupied.rowCount, 'Move or check out all tenants before deleting this room.');
        await db.query('UPDATE rooms SET archived_at=now() WHERE id=$1', [req.params.id]);
    });
    res.json({ ok: true });
}));
// Explicit whitelist preserves the complete tenant profile without accepting arbitrary SQL fields.
const profileFields = ['middleName', 'gender', 'dateOfBirth', 'altPhone', 'email', 'homeDistrict', 'homeAddress', 'emergencyContactName', 'emergencyContactPhone', 'emergencyContactRelationship', 'institution', 'programme', 'faculty', 'department', 'yearOfStudy', 'regNumber', 'academicYear'] as const;
const snake = (key: string) => key.replace(/[A-Z]/g, c => '_' + c.toLowerCase());
router.post('/tenants', manage, route(async (req, res) => {
    const b = req.body, id = b.id || randomUUID();
    const first = text(b.firstName, 'First name'), last = text(b.lastName, 'Last name'), phone = text(b.phone, 'Phone');
    const roomId = text(b.roomId, 'Room'), moveIn = date(b.moveInDate);
    check(moveIn <= today(), 'Move-in cannot be in the future.');
    check(['PENDING', 'SIGNED', 'EXPIRED'].includes(b.agreementStatus), 'Invalid agreement status.');
    const deposit = number(b.deposit ?? 0, 'Deposit');
    await transaction(async (db) => {
        // Lock the tenant before rooms so simultaneous moves of the same tenant serialize.
        let previousRoom: string | undefined;
        if (b.id) {
            const current = await db.query('SELECT * FROM tenants WHERE id=$1 AND deleted_at IS NULL AND checkout_date IS NULL FOR UPDATE', [id]);
            check(current.rowCount, 'Active tenant not found.', 404);
            check(current.rows[0].move_in_date === moveIn, 'Move-in date cannot be changed after registration.');
            previousRoom = current.rows[0].room_id;
        }
        const room = await db.query('SELECT * FROM rooms WHERE id=$1 AND archived_at IS NULL FOR UPDATE', [roomId]);
        check(room.rowCount, 'Room not found.', 404);
        const occupancy = await db.query('SELECT COUNT(*)::int AS n FROM tenants WHERE room_id=$1 AND id<>$2 AND deleted_at IS NULL AND checkout_date IS NULL', [roomId, id]);
        check(occupancy.rows[0].n < room.rows[0].capacity, 'That room is full.');
        const rate = await db.query('SELECT amount FROM room_rates WHERE room_id=$1 AND effective_month <= $2 ORDER BY effective_month DESC LIMIT 1', [roomId, today().slice(0, 7)]);
        const values: unknown[] = [id, first, last, phone, roomId, moveIn, rate.rows[0]?.amount ?? 0, deposit, b.agreementStatus];
        const columns = ['id', 'first_name', 'last_name', 'phone', 'room_id', 'move_in_date', 'monthly_amount', 'deposit', 'agreement_status'];
        for (const field of profileFields) {
            columns.push(snake(field));
            const value = b[field] === '' || b[field] === undefined ? null : b[field];
            if (field === 'dateOfBirth' && value !== null)
                date(value);
            if (field === 'yearOfStudy' && value !== null)
                check(Number.isInteger(value) && value > 0, 'Invalid year of study.');
            if (field !== 'yearOfStudy' && value !== null)
                check(typeof value === 'string' && value.length <= 500, `Invalid ${field}.`);
            values.push(value);
        }
        await db.query(`INSERT INTO tenants(${columns.join(',')}) VALUES (${values.map((_, i) => '$' + (i + 1)).join(',')})
      ON CONFLICT(id) DO UPDATE SET ${columns.slice(1).map(c => `${c}=EXCLUDED.${c}`).join(',')},updated_at=now()`, values);
        if (previousRoom !== roomId)
            await db.query('INSERT INTO tenant_room_history(tenant_id,effective_month,room_id) VALUES ($1,$2,$3) ON CONFLICT(tenant_id,effective_month) DO UPDATE SET room_id=EXCLUDED.room_id', [id, b.id ? today().slice(0, 7) : moveIn.slice(0, 7), roomId]);
    });
    res.json({ id });
}));
router.post('/tenants/:id/checkout', manage, route(async (req, res) => {
    const end = date(req.body.date);
    check(end === today(), 'Checkouts must be recorded for today.');
    const result = await pool.query('UPDATE tenants SET checkout_date=$2,updated_at=now() WHERE id=$1 AND checkout_date IS NULL AND move_in_date <= $2 RETURNING id', [req.params.id, end]);
    check(result.rowCount, 'Active tenant not found or checkout is before move-in.', 400);
    res.json({ ok: true });
}));
router.post('/charges', manage, route(async (req, res) => {
    const period = month(req.body.month);
    check(period <= today().slice(0, 7), 'Generate rent for the current or a previous month.');
    await pool.query(`INSERT INTO rent_charges(tenant_id,month,expected_amount)
    SELECT t.id,$1,COALESCE((SELECT amount FROM room_rates WHERE room_id=(SELECT h.room_id FROM tenant_room_history h WHERE h.tenant_id=t.id AND h.effective_month <= $1 ORDER BY h.effective_month DESC LIMIT 1) AND effective_month <= $1 ORDER BY effective_month DESC LIMIT 1),t.monthly_amount)
    FROM tenants t WHERE t.deleted_at IS NULL AND to_char(t.move_in_date,'YYYY-MM') <= $1
    AND (t.checkout_date IS NULL OR to_char(t.checkout_date,'YYYY-MM') >= $1)
    ON CONFLICT(tenant_id,month) DO NOTHING`, [period]);
    res.json({ ok: true });
}));
router.get('/charges/:id/receipts', route(async (req, res) => {
    const result = await pool.query('SELECT * FROM rent_receipts WHERE charge_id=$1 ORDER BY payment_date,created_at', [req.params.id]);
    res.json({ receipts: result.rows });
}));
router.post('/charges/:id/payments', manage, route(async (req, res) => {
    const amount = number(req.body.amount, 'Payment', 0.01), paymentDate = date(req.body.paymentDate), paymentMethod = method(req.body.paymentMethod);
    check(paymentDate <= today(), 'Payment date cannot be in the future.');
    await transaction(async (db) => {
        if (!await claimRequest(db, req.body.requestId, req.user!.id, `rent:${req.params.id}`))
            return;
        const charge = await db.query('SELECT id FROM rent_charges WHERE id=$1 FOR UPDATE', [req.params.id]);
        check(charge.rowCount, 'Monthly charge not found.', 404);
        // Keep every receipt, including overpayments; the balance may become a credit.
        await db.query('INSERT INTO rent_receipts(charge_id,amount,payment_method,payment_date,recorded_by) VALUES ($1,$2,$3,$4,$5)', [req.params.id, amount, paymentMethod, paymentDate, req.user!.id]);
    });
    res.json({ ok: true });
}));
router.post('/charges/:id/notes', manage, route(async (req, res) => {
    check(typeof req.body.notes === 'string' && req.body.notes.length <= 2000, 'Notes must be at most 2000 characters.');
    const result = await pool.query('UPDATE rent_charges SET notes=$2 WHERE id=$1 RETURNING id', [req.params.id, req.body.notes]);
    check(result.rowCount, 'Monthly charge not found.', 404);
    res.json({ ok: true });
}));
export default router;
