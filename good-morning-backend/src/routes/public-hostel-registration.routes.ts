import { Router } from 'express';
import { createHash } from 'crypto';
import { normalizeMalawiPhone } from '../services/phone';
import { pool } from '../db/pool';
import { check, date, route, text, today, transaction } from '../utils/http';

const router = Router();
const hash = (token: string) => createHash('sha256').update(token).digest('hex');
const terms = [
  'The tenant agrees to pay the accommodation amount set by hostel management and keep the assigned room and shared areas clean.',
  'The room may not be transferred, sublet, or occupied beyond its approved capacity without written approval.',
  'The tenant agrees to follow reasonable hostel rules that protect residents, property, and safety.',
  'This agreement remains subject to the applicable Good Morning accommodation policies.'
];

router.get('/:token', route(async (req, res) => {
  const invite = await pool.query("SELECT status FROM tenant_registration_invites WHERE token_hash=$1", [hash(req.params.token)]);
  check(invite.rowCount && invite.rows[0].status === 'INVITED', 'This registration link is invalid, used, or revoked.', 404);
  const rooms = await pool.query(`SELECT r.id,r.label,r.identifier,u.name AS housing_unit,
    COALESCE((SELECT amount FROM room_rates WHERE room_id=r.id AND effective_month <= $1 ORDER BY effective_month DESC LIMIT 1),0) AS monthly_price
    FROM rooms r JOIN housing_units u ON u.id=r.housing_unit_id WHERE r.archived_at IS NULL ORDER BY u.name,r.identifier`, [today().slice(0,7)]);
  res.json({ terms, rooms: rooms.rows });
}));

router.post('/:token', route(async (req, res) => {
  const tokenHash = hash(req.params.token);
  const b = req.body;
  const phone = normalizeMalawiPhone(text(b.phone, 'Phone'));
  check(b.agreed === true, 'You must agree to the accommodation terms.');
  const first = text(b.firstName, 'First name'), last = text(b.lastName, 'Last name');
  const allowed = ['middleName','gender','dateOfBirth','altPhone','email','homeDistrict','homeAddress','emergencyContactName','emergencyContactPhone','emergencyContactRelationship','institution','programme','faculty','department','yearOfStudy','regNumber','academicYear'];
  const applicant: Record<string, unknown> = { firstName:first, lastName:last, phone:b.phone, agreementStatus:'SIGNED', agreementSignature:`PUBLIC_ACCEPTED:${new Date().toISOString()}` };
  for (const key of allowed) {
    const value = b[key];
    check(value === undefined || value === null || typeof value === 'string' || (key === 'yearOfStudy' && Number.isInteger(value)), `Invalid ${key}.`);
    if (value !== undefined) applicant[key] = value;
  }
  if (applicant.dateOfBirth) date(applicant.dateOfBirth);
  const result = await pool.query(`UPDATE tenant_registration_invites SET status='SUBMITTED',applicant=$3::jsonb,
    preferred_room_id=NULLIF($4,'') ,submitted_at=now(),updated_at=now()
    WHERE token_hash=$1 AND phone_normalized=$2 AND status='INVITED' RETURNING id`,
    [tokenHash, phone, JSON.stringify(applicant), typeof b.preferredRoomId === 'string' ? b.preferredRoomId : '']);
  check(result.rowCount, 'Phone number does not match the invitation, or this link has already been used.', 403);
  res.json({ ok:true });
}));

export default router;
