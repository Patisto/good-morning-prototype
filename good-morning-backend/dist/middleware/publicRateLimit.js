"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.publicRateLimit = void 0;
const buckets = new Map();
const publicRateLimit = (name, limit, key = req => req.ip || 'unknown') => (_req, res, next) => {
    const req = _req, now = Date.now(), id = `${name}:${key(req)}`, current = buckets.get(id);
    if (!current || now - current.start >= 60000)
        buckets.set(id, { start: now, count: 1 });
    else {
        current.count++;
        if (current.count > limit) {
            const retryAfter = Math.max(1, Math.ceil((60000 - (now - current.start)) / 1000));
            res.set('Retry-After', String(retryAfter));
            return res.status(429).json({ error: `Too many requests. Please try again in about ${retryAfter} seconds.` });
        }
    }
    next();
};
exports.publicRateLimit = publicRateLimit;
//# sourceMappingURL=publicRateLimit.js.map