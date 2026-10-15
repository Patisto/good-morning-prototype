import type { Request, Response, NextFunction } from 'express';
import type { PoolClient } from 'pg';
import { pool } from '../db/pool';
export class HttpError extends Error {
    constructor(public status: number, message: string) { super(message); }
}
export function check(condition: unknown, message: string, status = 400): asserts condition {
    if (!condition)
        throw new HttpError(status, message);
}
export const route = (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) => { Promise.resolve(fn(req, res)).catch(next); };
export function text(value: unknown, label: string): string {
    check(typeof value === 'string' && value.trim().length > 0 && value.length <= 500, `${label} is required (maximum 500 characters).`);
    return value.trim();
}
export function number(value: unknown, label: string, minimum = 0): number {
    check(typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= 999999999, `${label} must be a valid number of at least ${minimum}.`);
    check(Math.abs(value * 100 - Math.round(value * 100)) < 0.00001, `${label} supports at most two decimal places.`);
    return value;
}
export function date(value: unknown): string {
    check(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value), 'Use a valid date (YYYY-MM-DD).');
    check(!Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value, 'Invalid date.');
    return value;
}
export function month(value: unknown): string {
    check(typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value), 'Use a valid month (YYYY-MM).');
    return value;
}
export function method(value: unknown): string {
    check(['CASH', 'AIRTEL_MONEY', 'TNM_MPAMBA', 'BANK', 'OTHER'].includes(String(value)), 'Invalid payment method.');
    return String(value);
}
export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Blantyre', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export async function transaction<T>(fn: (db: PoolClient) => Promise<T>): Promise<T> {
    const db = await pool.connect();
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
export async function claimRequest(db: PoolClient, key: unknown, userId: string, operation: string): Promise<boolean> {
    check(typeof key === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key), 'A valid request ID is required.');
    const result = await db.query('INSERT INTO request_receipts(id,user_id,operation) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING RETURNING id', [key, userId, operation]);
    if (result.rowCount)
        return true;
    const previous = await db.query('SELECT user_id,operation FROM request_receipts WHERE id=$1', [key]);
    check(previous.rows[0]?.user_id === userId && previous.rows[0]?.operation === operation, 'Request ID belongs to another operation.', 409);
    return false;
}
