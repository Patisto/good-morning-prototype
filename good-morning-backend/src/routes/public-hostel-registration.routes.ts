import { Router } from 'express';
import { normalizeMalawiPhone } from '../services/phone';
import { pool } from '../db/pool';
import { check, date, route, text, today } from '../utils/http';
const router = Router();
const terms = [
  'The tenant agrees to pay the accommodation amount set by hostel management and keep the assigned room and shared areas clean.',
  'The room may not be transferred, sublet, or occupied beyond its approved capacity without written approval.',
  'The tenant agrees to follow reasonable hostel rules that protect residents, property, and safety.',
  'This agreement remains subject to the applicable Good Morning accommodation policies.'
];
router.get('/', route(async (_req, res) => {
  const rooms = await pool.query(`SELECT r.id,r.label,r.identifier,u.name AS housing_unit,
    COALESCE((SELECT amount FROM room_rates WHERE room_id=r.id AND effective_month <= $1 ORDER BY effective_month DESC LIMIT 1),0) AS monthly_price
    FROM rooms r JOIN housing_units u ON u.id=r.housing_unit_id WHERE r.archived_at IS NULL ORDER BY u.name,r.identifier`, [today().slice(0,7)]);
  res.json({terms,rooms:rooms.rows});
}));
router.post('/', route(async (req,res)=>{
  const b=req.body, phone=text(b.phone,'Phone'); normalizeMalawiPhone(phone);
  check(b.agreed===true,'You must agree to the accommodation terms.');
  const agreementSignature=b.agreementSignature;
  check(typeof agreementSignature==='string'&&agreementSignature.length<=80000&&/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(agreementSignature),'Please provide a valid signature for the accommodation terms.');
  const applicant:Record<string,unknown>={};
  for(const key of ['firstName','middleName','lastName','gender','dateOfBirth','phone','altPhone','email','homeDistrict','homeAddress','emergencyContactName','emergencyContactPhone','emergencyContactRelationship','institution','programme','faculty','department','yearOfStudy','regNumber','academicYear']){
    const value=b[key];
    check(value===undefined||value===null||typeof value==='string'||(key==='yearOfStudy'&&Number.isInteger(value)),`Invalid ${key}.`);
    if(value!==undefined) applicant[key]=value;
  }
  applicant.firstName=text(b.firstName,'First name'); applicant.lastName=text(b.lastName,'Last name');
  if(applicant.dateOfBirth) date(applicant.dateOfBirth);
  if(applicant.yearOfStudy!==undefined&&applicant.yearOfStudy!==null) check(Number(applicant.yearOfStudy)>0,'Invalid year of study.');
  const preferred=typeof b.preferredRoomId==='string'?b.preferredRoomId:'';
  if(preferred) { const room=await pool.query('SELECT id FROM rooms WHERE id=$1 AND archived_at IS NULL',[preferred]); check(room.rowCount,'Choose a valid preferred room.'); }
  const result=await pool.query('INSERT INTO tenant_applications(applicant,preferred_room_id,agreement_accepted_at,agreement_signature) VALUES($1::jsonb,NULLIF($2,\'\'),now(),$3) RETURNING id',[JSON.stringify(applicant),preferred,agreementSignature]);
  res.json({ok:true,id:result.rows[0].id});
}));
export default router;
