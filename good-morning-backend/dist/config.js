"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const required = (name) => {
    const value = process.env[name]?.trim();
    if (process.env.NODE_ENV === 'production' && !value)
        throw new Error(`Missing required production environment variable: ${name}`);
    return value ?? '';
};
exports.config = {
    paychanguEnv: process.env.PAYCHANGU_ENV === 'live' ? 'live' : 'test',
    paychanguBaseUrl: process.env.PAYCHANGU_BASE_URL?.trim() || 'https://api.paychangu.com',
    paychanguSecretKey: required('PAYCHANGU_SECRET_KEY'),
    paychanguPublicKey: process.env.PAYCHANGU_PUBLIC_KEY?.trim() || '',
    paychanguWebhookSecret: required('PAYCHANGU_WEBHOOK_SECRET'),
    paychanguCallbackUrl: required('PAYCHANGU_CALLBACK_URL'),
    paychanguReturnUrl: required('PAYCHANGU_RETURN_URL'),
    paychanguCancelUrl: process.env.PAYCHANGU_CANCEL_URL?.trim() || '',
    currency: process.env.PAYMENT_CURRENCY?.trim() || 'MWK',
    allowPartial: process.env.ALLOW_PARTIAL_PAYMENTS === 'true',
    minPayment: Number(process.env.MIN_PAYMENT_AMOUNT || 0),
    allowOverpayment: process.env.ALLOW_OVERPAYMENT === 'true',
    lookupTokenSecret: required('LOOKUP_TOKEN_SECRET'),
    lookupTokenTtl: Number(process.env.LOOKUP_TOKEN_TTL_SECONDS || 600),
    pendingExpiryMinutes: Number(process.env.PAYMENT_PENDING_EXPIRY_MINUTES || 60),
    reconcileIntervalMinutes: Number(process.env.RECONCILE_INTERVAL_MINUTES || 10),
    frontendUrl: process.env.FRONTEND_URL?.trim() || '',
    corsOrigins: (process.env.CORS_ALLOWED_ORIGINS || process.env.FRONTEND_URL || '').split(',').map(x => x.trim()).filter(Boolean),
    rateLimitLookup: Number(process.env.RATE_LIMIT_LOOKUP_PER_MINUTE || 5),
    rateLimitInitiate: Number(process.env.RATE_LIMIT_INITIATE_PER_MINUTE || 5),
    rateLimitStatus: Number(process.env.RATE_LIMIT_STATUS_PER_MINUTE || 30),
};
//# sourceMappingURL=config.js.map