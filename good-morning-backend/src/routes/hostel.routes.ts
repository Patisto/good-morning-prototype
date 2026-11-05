import { Router } from 'express';
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'crypto';
import { ensureRentCharges, rentAccount } from '../services/rent';
import { sendEmail } from '../services/email';
import { pool } from '../db/pool';
import { requireAuth, requireSection, requireManager } from '../middleware/auth';
import { claimRequest, check, date, method, month, number, route, text, today, transaction } from '../utils/http';
const router = Router();
const frontendUrl = () => (process.env.FRONTEND_URL ?? '').split(',')[0].trim().replace(/\/$/, '');
const apiPublicUrl = () => (process.env.API_PUBLIC_URL ?? '').trim().replace(/\/$/, '');
async function verifyBookingPayment(txRef: string) {
    const booking = await pool.query('SELECT id,email,amount,status,booking_code,code_email_sent_at,code_email_claimed_at FROM hostel_bookings WHERE tx_ref=$1', [txRef]);
    if (!booking.rowCount) return { status: 'UNKNOWN' };
    if (booking.rows[0].status === 'FAILED') return { status: 'FAILED' };
    const secret = process.env.PAYCHANGU_SECRET_KEY;
    check(!!secret, 'PayChangu is not configured.');
    const response = await fetch(`https://api.paychangu.com/verify-payment/${encodeURIComponent(txRef)}`, { headers: { Accept: 'application/json', Authorization: `Bearer ${secret}` } });
    const verified = await response.json() as { status?: string; data?: { tx_ref?: string; status?: string; amount?: number | string; currency?: string } };
    check(response.ok, 'Could not verify the PayChangu payment.');
    const data = verified.data;
    if (data?.status === 'failed') return { status: booking.rows[0].status };
    if (!data || data.status !== 'success' || data.tx_ref !== txRef) return { status: booking.rows[0].status };
    if (data.currency !== 'MWK' || Number(data.amount) !== Number(booking.rows[0].amount)) return { status: booking.rows[0].status };
    let current = booking.rows[0];
    if (current.status === 'PENDING') {
        const rawCode = randomBytes(8).toString('hex').toUpperCase();
        const code = `GM-${rawCode.slice(0, 8)}-${rawCode.slice(8)}`;
        const updated = await transaction(async db => {
            const locked = await db.query('SELECT id,status,booking_code,email,code_email_sent_at FROM hostel_bookings WHERE tx_ref=$1 FOR UPDATE', [txRef]);
            if (locked.rows[0].status === 'PENDING') await db.query("UPDATE hostel_bookings SET status='PAID',booking_code=$2,paid_at=now() WHERE id=$1", [locked.rows[0].id, code]);
            return (await db.query('SELECT id,status,booking_code,email,code_email_sent_at FROM hostel_bookings WHERE id=$1', [locked.rows[0].id])).rows[0];
        });
        current = updated;
    }
    if (current.status === 'PAID' && current.booking_code && !current.code_email_sent_at) {
        const claim = await pool.query(`UPDATE hostel_bookings SET code_email_claimed_at=now() WHERE id=$1 AND status='PAID' AND code_email_sent_at IS NULL
            AND (code_email_claimed_at IS NULL OR code_email_claimed_at < now()-interval '5 minutes') RETURNING id`, [current.id]);
        if (claim.rowCount) {
            try {
                await sendEmail(current.email, 'Your Good Morning hostel booking code', `Your hostel booking payment has been confirmed.\n\nBooking code: ${current.booking_code}\n\nUse this code when you complete the student registration form: ${frontendUrl()}/student-registration\n\nKeep this code private. It can only be used once.`);
                await pool.query('UPDATE hostel_bookings SET code_email_sent_at=now(),code_email_claimed_at=NULL WHERE id=$1', [current.id]);
            }
            catch (error) {
                await pool.query('UPDATE hostel_bookings SET code_email_claimed_at=NULL WHERE id=$1', [current.id]);
                throw error;
            }
        }
    }
    return { status: current.status };
}

router.get('/registration/options', route(async (_req, res) => {
    const [rooms, settings] = await Promise.all([
        pool.query(`SELECT r.id,r.label,r.identifier,u.name AS housing_unit,r.capacity,
          COALESCE((SELECT amount FROM room_rates WHERE room_id=r.id AND effective_month <= to_char(now() AT TIME ZONE 'Africa/Blantyre','YYYY-MM') ORDER BY effective_month DESC LIMIT 1),0) AS monthly_price,
          (SELECT COUNT(*)::int FROM tenants t WHERE t.room_id=r.id AND t.deleted_at IS NULL AND t.checkout_date IS NULL) AS occupants
          FROM rooms r JOIN housing_units u ON u.id=r.housing_unit_id WHERE r.archived_at IS NULL ORDER BY u.name,r.identifier`),
        pool.query('SELECT name FROM housing_units ORDER BY name'),
    ]);
    res.json({ rooms: rooms.rows, units: settings.rows });
}));
router.get('/bookings/links/:token', route(async (req, res) => {
    const result = await pool.query(`SELECT o.token,o.title,o.amount,o.room_id,r.label,r.identifier,u.name AS housing_unit
        FROM hostel_booking_offers o LEFT JOIN rooms r ON r.id=o.room_id LEFT JOIN housing_units u ON u.id=r.housing_unit_id
        WHERE o.token=$1 AND o.active=true AND (o.expires_at IS NULL OR o.expires_at>now())`, [req.params.token]);
    check(result.rowCount, 'This booking link is no longer available.', 404);
    res.json(result.rows[0]);
}));
router.post('/bookings/links/:token/checkout', route(async (req, res) => {
    const email = text(req.body.email, 'Email address').toLowerCase();
    check(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), 'Enter a valid email address.');
    check(!!process.env.PAYCHANGU_SECRET_KEY && !!apiPublicUrl() && !!frontendUrl(), 'Booking payments are not configured yet.');
    const offer = await pool.query(`SELECT id,title,amount FROM hostel_booking_offers WHERE token=$1 AND active=true AND (expires_at IS NULL OR expires_at>now())`, [req.params.token]);
    check(offer.rowCount, 'This booking link is no longer available.', 404);
    const txRef = `GM-${randomUUID()}`;
    const inserted = await pool.query(`INSERT INTO hostel_bookings(offer_id,email,amount,tx_ref,checkout_url) VALUES($1,$2,$3,$4,'') RETURNING id`, [offer.rows[0].id, email, offer.rows[0].amount, txRef]);
    const response = await fetch('https://api.paychangu.com/payment', { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.PAYCHANGU_SECRET_KEY}` }, body: JSON.stringify({ amount: String(offer.rows[0].amount), currency: 'MWK', email, tx_ref: txRef, callback_url: `${apiPublicUrl()}/api/hostel/bookings/paychangu/webhook`, return_url: `${frontendUrl()}/hostel-booking-result?tx_ref=${encodeURIComponent(txRef)}&booking_token=${encodeURIComponent(req.params.token)}`, customization: { title: String(offer.rows[0].title), description: 'Good Morning hostel booking payment' }, meta: { booking_id: inserted.rows[0].id } }) });
    const payload = await response.json() as { status?: string; data?: { checkout_url?: string } };
    check(response.ok && payload.status === 'success' && !!payload.data?.checkout_url, 'PayChangu could not start the checkout.');
    await pool.query('UPDATE hostel_bookings SET checkout_url=$2 WHERE id=$1', [inserted.rows[0].id, payload.data.checkout_url]);
    res.json({ checkoutUrl: payload.data.checkout_url, txRef });
}));
router.get('/bookings/payment-status/:txRef', route(async (req, res) => {
    res.json(await verifyBookingPayment(text(req.params.txRef, 'Transaction reference')));
}));
router.post('/bookings/paychangu/webhook', route(async (req, res) => {
    const rawBody = (req as typeof req & { rawBody?: Buffer }).rawBody;
    const secret = process.env.PAYCHANGU_WEBHOOK_SECRET;
    const signatureHeader = req.get('Signature') ?? '';
    check(!!rawBody && !!secret && !!signatureHeader, 'Invalid PayChangu webhook.', 401);
    const signature = signatureHeader.replace(/^sha256=/i, '');
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    const actualBytes = Buffer.from(signature, 'hex'), expectedBytes = Buffer.from(expected, 'hex');
    check(actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes), 'Invalid PayChangu webhook signature.', 401);
    let txRef = req.body?.tx_ref ?? req.body?.data?.tx_ref ?? req.body?.reference ?? req.body?.data?.reference;
    const bookingId = req.body?.meta?.booking_id ?? req.body?.data?.meta?.booking_id;
    if (typeof txRef !== 'string' && typeof bookingId === 'string') {
        txRef = (await pool.query('SELECT tx_ref FROM hostel_bookings WHERE id=$1', [bookingId])).rows[0]?.tx_ref;
    }
    if (typeof txRef === 'string') await verifyBookingPayment(txRef);
    res.json({ received: true });
}));
router.post('/registration', route(async (req, res) => {
    const b = req.body;
    const first = text(b.firstName, 'First name'), last = text(b.lastName, 'Last name'), phone = text(b.phone, 'Phone');
    const email = text(b.email, 'Email address').toLowerCase();
    check(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), 'Enter a valid email address.');
    const bookingCode = text(b.bookingCode, 'Booking code').toUpperCase();
    let roomId = typeof b.preferredRoomId === 'string' && b.preferredRoomId ? b.preferredRoomId : null;
    if (roomId) {
        const room = await pool.query(`SELECT r.capacity,(SELECT COUNT(*)::int FROM tenants t WHERE t.room_id=r.id AND t.deleted_at IS NULL AND t.checkout_date IS NULL) AS occupants FROM rooms r WHERE r.id=$1 AND r.archived_at IS NULL`, [roomId]);
        check(room.rowCount, 'Selected room is unavailable.');
    }
    const result = await transaction(async db => {
        const booking = await db.query(`SELECT b.id,b.email,o.room_id FROM hostel_bookings b JOIN hostel_booking_offers o ON o.id=b.offer_id
            WHERE b.booking_code=$1 AND b.status='PAID' FOR UPDATE OF b`, [bookingCode]);
        check(booking.rowCount, 'Booking code is invalid, already used, or payment is not confirmed.');
        check(String(booking.rows[0].email).toLowerCase() === email, 'Use the email address that received the booking code.');
        const bookedRoom = booking.rows[0].room_id as string | null;
        if (bookedRoom) {
            check(!roomId || roomId === bookedRoom, 'Use the room attached to this booking.');
            roomId = bookedRoom;
        }
        if (roomId) {
            const room = await db.query('SELECT capacity FROM rooms WHERE id=$1 AND archived_at IS NULL FOR UPDATE', [roomId]);
            check(room.rowCount, 'The selected room is no longer available.', 404);
            const occupancy = await db.query('SELECT COUNT(*)::int AS n FROM tenants WHERE room_id=$1 AND deleted_at IS NULL AND checkout_date IS NULL', [roomId]);
            check(occupancy.rows[0].n < room.rows[0].capacity, 'The selected room is now full. Contact the hostel manager before submitting.');
        }
        const created = await db.query(`INSERT INTO student_applications(first_name,middle_name,last_name,phone,email,institution,programme,faculty,department,year_of_study,reg_number,academic_year,preferred_room_id,agreement_status,gender,date_of_birth,alt_phone,home_district,home_address,emergency_contact_name,emergency_contact_phone,emergency_contact_relationship,move_in_date,booking_id)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'PENDING',$14,$15,$16,$17,$18,$19,$20,$21,$22,$23) RETURNING id`, [first, b.middleName || null, last, phone, email, b.institution || null, b.programme || null, b.faculty || null, b.department || null, b.yearOfStudy || null, b.regNumber || null, b.academicYear || null, roomId, b.gender || null, b.dateOfBirth ? date(b.dateOfBirth) : null, b.altPhone || null, b.homeDistrict || null, b.homeAddress || null, b.emergencyContactName || null, b.emergencyContactPhone || null, b.emergencyContactRelationship || null, b.moveInDate ? date(b.moveInDate) : null, booking.rows[0].id]);
        await db.query("UPDATE hostel_bookings SET status='USED' WHERE id=$1", [booking.rows[0].id]);
        return created.rows[0];
    });
    res.json({ id: result.id });
}));
router.use(requireAuth, requireSection('hostel'));
const manage = requireManager('hostel');
router.get('/bookings/offers', manage, route(async (_req, res) => {
    const offers = await pool.query(`SELECT o.id,o.token,o.title,o.amount,o.room_id,o.active,o.expires_at,r.label,r.identifier,u.name AS housing_unit
        FROM hostel_booking_offers o LEFT JOIN rooms r ON r.id=o.room_id LEFT JOIN housing_units u ON u.id=r.housing_unit_id ORDER BY o.created_at DESC`);
    const bookings = await pool.query(`SELECT b.id,b.email,b.amount,b.status,b.tx_ref,b.paid_at,b.created_at,o.title,o.token
        FROM hostel_bookings b JOIN hostel_booking_offers o ON o.id=b.offer_id ORDER BY b.created_at DESC LIMIT 100`);
    res.json({ offers: offers.rows, bookings: bookings.rows });
}));
router.post('/bookings/offers', manage, route(async (req, res) => {
    const amount = number(req.body.amount, 'Booking payment amount', 0.01);
    const title = typeof req.body.title === 'string' && req.body.title.trim() ? text(req.body.title, 'Booking name') : 'Hostel booking payment';
    const roomId = typeof req.body.roomId === 'string' && req.body.roomId ? req.body.roomId : null;
    if (roomId) {
        const room = await pool.query('SELECT id FROM rooms WHERE id=$1 AND archived_at IS NULL', [roomId]);
        check(room.rowCount, 'Select an available room.', 404);
    }
    const expiresAt = typeof req.body.expiresAt === 'string' && req.body.expiresAt ? new Date(req.body.expiresAt) : null;
    check(!expiresAt || !Number.isNaN(expiresAt.getTime()), 'Enter a valid link expiry date.');
    check(!expiresAt || expiresAt.getTime() > Date.now(), 'Expiry date must be in the future.');
    const token = randomBytes(24).toString('hex');
    const result = await pool.query(`INSERT INTO hostel_booking_offers(token,title,amount,room_id,expires_at,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING id`, [token, title, amount, roomId, expiresAt, req.user!.id]);
    res.json({ id: result.rows[0].id, token, bookingUrl: `${frontendUrl()}/hostel-booking/${token}` });
}));
router.delete('/bookings/offers/:id', manage, route(async (req, res) => {
    const updated = await pool.query('UPDATE hostel_booking_offers SET active=false WHERE id=$1 RETURNING id', [req.params.id]);
    check(updated.rowCount, 'Booking link not found.', 404);
    res.json({ ok: true });
}));
router.get('/applications', manage, route(async (_req, res) => {
    const result = await pool.query(`SELECT a.*,r.label AS room_label,r.identifier AS room_identifier,u.name AS housing_unit FROM student_applications a LEFT JOIN rooms r ON r.id=a.preferred_room_id LEFT JOIN housing_units u ON u.id=r.housing_unit_id ORDER BY (a.status='PENDING') DESC,a.submitted_at DESC`);
    res.json({ applications: result.rows });
}));
router.post('/applications/:id/approve', manage, route(async (req, res) => {
    const b = req.body, tenantId = randomUUID();
    const first = text(b.firstName, 'First name'), last = text(b.lastName, 'Last name'), phone = text(b.phone, 'Phone');
    const roomId = text(b.roomId, 'Room'), moveIn = date(b.moveInDate);
    const deposit = number(b.deposit ?? 0, 'Deposit');
    await transaction(async db => {
        const application = await db.query("SELECT id,agreement_status,student_signature FROM student_applications WHERE id=$1 AND status='PENDING' FOR UPDATE", [req.params.id]);
        check(application.rowCount, 'Application is no longer pending.', 409);
        const room = await db.query('SELECT * FROM rooms WHERE id=$1 AND archived_at IS NULL FOR UPDATE', [roomId]);
        check(room.rowCount, 'Select an existing room.');
        const occupancy = await db.query('SELECT COUNT(*)::int AS n FROM tenants WHERE room_id=$1 AND deleted_at IS NULL AND checkout_date IS NULL', [roomId]);
        check(occupancy.rows[0].n < room.rows[0].capacity, 'That room is full.');
        const rate = await db.query('SELECT amount FROM room_rates WHERE room_id=$1 AND effective_month <= $2 ORDER BY effective_month DESC LIMIT 1', [roomId, moveIn.slice(0, 7)]);
        const profileFields = ['middleName','gender','dateOfBirth','altPhone','email','homeDistrict','homeAddress','emergencyContactName','emergencyContactPhone','emergencyContactRelationship','institution','programme','faculty','department','yearOfStudy','regNumber','academicYear'] as const;
        const snake = (key: string) => key.replace(/[A-Z]/g, c => '_' + c.toLowerCase());
        const columns = ['id','first_name','last_name','phone','room_id','move_in_date','monthly_amount','deposit','agreement_status','agreement_signature'];
        const values: unknown[] = [tenantId, first, last, phone, roomId, moveIn, rate.rows[0]?.amount ?? 0, deposit, application.rows[0].agreement_status, application.rows[0].student_signature];
        for (const field of profileFields) {
            const value = b[field] === '' || b[field] === undefined ? null : b[field];
            if (field === 'dateOfBirth' && value !== null) date(value);
            if (field === 'yearOfStudy' && value !== null) check(Number.isInteger(value) && value > 0, 'Invalid year of study.');
            if (field !== 'yearOfStudy' && value !== null) check(typeof value === 'string' && value.length <= 500, `Invalid ${field}.`);
            columns.push(snake(field)); values.push(value);
        }
        await db.query(`INSERT INTO tenants(${columns.join(',')}) VALUES (${values.map((_,i)=>'$'+(i+1)).join(',')})`, values);
        await db.query('INSERT INTO rent_charges(tenant_id,month,expected_amount) VALUES($1,$2,$3) ON CONFLICT(tenant_id,month) DO NOTHING', [tenantId, moveIn.slice(0, 7), rate.rows[0]?.amount ?? 0]);
        await db.query("UPDATE student_applications SET status='APPROVED',tenant_id=$2 WHERE id=$1", [req.params.id, tenantId]);
    });
    res.json({ id: tenantId });
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
        await ensureRentCharges(db, tenantId, period);
        const account = await rentAccount(db, tenantId, period, true);
        const charge = await db.query('SELECT id FROM rent_charges WHERE tenant_id=$1 AND month=$2 FOR UPDATE', [tenantId, period]);
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
    await transaction(async db => {
        const tenants = await db.query(`SELECT id FROM tenants WHERE deleted_at IS NULL AND to_char(move_in_date,'YYYY-MM') <= $1
            AND (checkout_date IS NULL OR to_char(checkout_date,'YYYY-MM') >= $1) ORDER BY id`, [period]);
        for (const tenant of tenants.rows) await ensureRentCharges(db, tenant.id, period);
    });
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
