"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.today = exports.route = exports.HttpError = void 0;
exports.check = check;
exports.text = text;
exports.number = number;
exports.date = date;
exports.month = month;
exports.method = method;
exports.transaction = transaction;
exports.claimRequest = claimRequest;
const pool_1 = require("../db/pool");
class HttpError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}
exports.HttpError = HttpError;
function check(condition, message, status = 400) {
    if (!condition)
        throw new HttpError(status, message);
}
const route = (fn) => (req, res, next) => { Promise.resolve(fn(req, res)).catch(next); };
exports.route = route;
function text(value, label) {
    check(typeof value === 'string' && value.trim().length > 0 && value.length <= 500, `${label} is required (maximum 500 characters).`);
    return value.trim();
}
function number(value, label, minimum = 0) {
    check(typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= 999999999, `${label} must be a valid number of at least ${minimum}.`);
    check(Math.abs(value * 100 - Math.round(value * 100)) < 0.00001, `${label} supports at most two decimal places.`);
    return value;
}
function date(value) {
    check(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value), 'Use a valid date (YYYY-MM-DD).');
    check(!Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value, 'Invalid date.');
    return value;
}
function month(value) {
    check(typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value), 'Use a valid month (YYYY-MM).');
    return value;
}
function method(value) {
    check(['CASH', 'AIRTEL_MONEY', 'TNM_MPAMBA', 'BANK', 'OTHER', 'CREDIT', 'MEAL_CARD'].includes(String(value)), 'Invalid payment method.');
    return String(value);
}
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Blantyre', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
exports.today = today;
async function transaction(fn) {
    const db = await pool_1.pool.connect();
    try {
        await db.query('BEGIN');
        const result = await fn(db);
        await db.query('COMMIT');
        return result;
    }
    catch (error) {
        await db.query('ROLLBACK');
        throw error;
    }
    finally {
        db.release();
    }
}
/** A retry after a lost response must not record a financial operation twice. */
async function claimRequest(db, key, userId, operation) {
    check(typeof key === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key), 'A valid request ID is required.');
    const result = await db.query('INSERT INTO request_receipts(id,user_id,operation) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING RETURNING id', [key, userId, operation]);
    if (result.rowCount)
        return true;
    const previous = await db.query('SELECT user_id,operation FROM request_receipts WHERE id=$1', [key]);
    check(previous.rows[0]?.user_id === userId && previous.rows[0]?.operation === operation, 'Request ID belongs to another operation.', 409);
    return false;
}
//# sourceMappingURL=http.js.map