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
const expenses_routes_1 = __importDefault(require("./routes/expenses.routes"));
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use((0, cors_1.default)({ origin: process.env.FRONTEND_URL ?? 'http://localhost:5173' }));
app.use(express_1.default.json());
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', auth_routes_1.default);
app.use('/api/hostel', hostel_routes_1.default);
app.use('/api/restaurant', restaurant_routes_1.default);
app.use('/api/grocery', grocery_routes_1.default);
app.use('/api/expenses', expenses_routes_1.default);
// Keep error responses generic — don't leak internals to the client.
app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
});
const port = Number(process.env.PORT ?? 4000);
// Cloud web hosts route traffic to the port they provide at runtime.
app.listen(port, '0.0.0.0', () => {
    console.log(`Good Morning API listening on port ${port}`);
});
//# sourceMappingURL=index.js.map