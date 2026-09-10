"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
exports.requireSection = requireSection;
const jwt_1 = require("../utils/jwt");
const types_1 = require("../types");
function requireAuth(req, res, next) {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or malformed Authorization header.' });
    }
    const token = header.slice('Bearer '.length);
    try {
        const payload = (0, jwt_1.verifyToken)(token);
        req.user = { id: payload.sub, role: payload.role, name: payload.name, email: payload.email };
        next();
    }
    catch {
        return res.status(401).json({ error: 'Invalid or expired token.' });
    }
}
function requireSection(section) {
    return (req, res, next) => {
        if (!req.user || !(0, types_1.canSee)(req.user.role, section)) {
            return res.status(403).json({ error: 'You do not have access to this section.' });
        }
        next();
    };
}
//# sourceMappingURL=auth.js.map