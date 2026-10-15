import type { NextFunction, Request, Response } from 'express';
import { pool } from '../db/pool';
import { verifyToken } from '../utils/jwt';
import { canSee, canManage, type Section } from '../types';
declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Express {
        interface Request {
            user?: {
                id: string;
                role: import('../types').Role;
                name: string;
                email: string;
            };
        }
    }
}
export function requireAuth(req: Request, res: Response, next: NextFunction) {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or malformed Authorization header.' });
    }
    const token = header.slice('Bearer '.length);
    try {
        const payload = verifyToken(token);
        void pool.query('SELECT id,role,name,email FROM users WHERE id=$1 AND active=true', [payload.sub]).then(result => {
            if (!result.rows[0])
                return res.status(401).json({ error: 'This account is inactive or no longer exists.' });
            req.user = result.rows[0];
            next();
        }).catch(next);
    }
    catch {
        return res.status(401).json({ error: 'Invalid or expired token.' });
    }
}
export function requireSection(section: Section) {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.user || !canSee(req.user.role, section)) {
            return res.status(403).json({ error: 'You do not have access to this section.' });
        }
        next();
    };
}
export function requireManager(section: Section) {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.user || !canManage(req.user.role, section))
            return res.status(403).json({ error: 'Manager access required.' });
        next();
    };
}
