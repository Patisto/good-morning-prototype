"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const hostel_routes_1 = __importDefault(require("./routes/hostel.routes"));
const restaurant_routes_1 = __importDefault(require("./routes/restaurant.routes"));
const grocery_routes_1 = __importDefault(require("./routes/grocery.routes"));
const finance_routes_1 = __importDefault(require("./routes/finance.routes"));
const expenses_routes_1 = __importDefault(require("./routes/expenses.routes"));
const users_routes_1 = __importDefault(require("./routes/users.routes"));
const reports_routes_1 = __importDefault(require("./routes/reports.routes"));
const public_payments_routes_1 = __importDefault(require("./routes/public-payments.routes"));
const paychangu_webhook_routes_1 = __importDefault(require("./routes/paychangu-webhook.routes"));
const reconciliation_1 = require("./services/reconciliation");
const config_1 = require("./config");
const http_1 = require("./utils/http");
dotenv_1.default.config();
const app = (0, express_1.default)();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use('/api/webhooks/paychangu', express_1.default.raw({ type: 'application/json', limit: '256kb' }), paychangu_webhook_routes_1.default);
const frontendOrigins = new Set();
for (const configured of config_1.config.corsOrigins.length ? config_1.config.corsOrigins : ['http://localhost:5173']) {
    try {
        const url = new URL(configured.trim());
        frontendOrigins.add(url.origin);
        url.hostname = url.hostname.startsWith('www.') ? url.hostname.slice(4) : `www.${url.hostname}`;
        frontendOrigins.add(url.origin);
    }
    catch { /* Ignore invalid entries; valid configured origins remain active. */ }
}
app.use((0, cors_1.default)({ origin: (origin, callback) => {
        if (!origin)
            return callback(null, true);
        let normalized = origin;
        try {
            normalized = new URL(origin).origin;
        }
        catch { /* Reject malformed origins below. */ }
        callback(null, frontendOrigins.has(normalized));
    } }));
app.use((req, res, next) => { if (process.env.NODE_ENV === 'production' && req.header('x-forwarded-proto') !== 'https')
    return res.status(400).json({ error: 'HTTPS is required.' }); next(); });
app.use((_req, res, next) => { res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer'); next(); });
app.use(express_1.default.json());
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/public/rental-payments', public_payments_routes_1.default);
app.use('/api/auth', auth_routes_1.default);
app.use('/api/hostel', hostel_routes_1.default);
app.use('/api/restaurant', restaurant_routes_1.default);
app.use('/api/grocery', grocery_routes_1.default);
app.use('/api/expenses', expenses_routes_1.default);
app.use('/api/finance', finance_routes_1.default);
app.use('/api/reports', reports_routes_1.default);
app.use('/api/users', users_routes_1.default);
// Keep error responses generic — don't leak internals to the client.
app.use((err, _req, res, _next) => {
    if (err instanceof http_1.HttpError)
        return res.status(err.status).json({ error: err.message });
    const code = err?.code;
    if (code === '22P02')
        return res.status(400).json({ error: 'Invalid record identifier or value.' });
    if (code === '23505')
        return res.status(409).json({ error: 'That record already exists.' });
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
});
const port = Number(process.env.PORT ?? 4000);
// Cloud web hosts route traffic to the port they provide at runtime.
app.listen(port, '0.0.0.0', () => {
    console.log(`Good Morning API listening on port ${port}`);
    (0, reconciliation_1.startReconciliationScheduler)();
});
//# sourceMappingURL=index.js.map