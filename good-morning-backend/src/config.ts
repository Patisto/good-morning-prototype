import dotenv from 'dotenv';
dotenv.config();

const env = (name: string) => process.env[name]?.trim() || '';

const paychanguSecretKey = env('PAYCHANGU_SECRET_KEY');
const paychanguWebhookSecret = env('PAYCHANGU_WEBHOOK_SECRET');
const paychanguCallbackUrl = env('PAYCHANGU_CALLBACK_URL');
const paychanguReturnUrl = env('PAYCHANGU_RETURN_URL');
const lookupTokenSecret = env('LOOKUP_TOKEN_SECRET');

export const config = {
  paychanguEnv: process.env.PAYCHANGU_ENV === 'live' ? 'live' : 'test',
  paychanguBaseUrl: process.env.PAYCHANGU_BASE_URL?.trim() || 'https://api.paychangu.com',
  paychanguSecretKey,
  paychanguPublicKey: process.env.PAYCHANGU_PUBLIC_KEY?.trim() || '',
  paychanguWebhookSecret,
  paychanguCallbackUrl,
  paychanguReturnUrl,
  paychanguCancelUrl: process.env.PAYCHANGU_CANCEL_URL?.trim() || '',
  currency: process.env.PAYMENT_CURRENCY?.trim() || 'MWK',
  allowPartial: process.env.ALLOW_PARTIAL_PAYMENTS === 'true',
  minPayment: Number(process.env.MIN_PAYMENT_AMOUNT || 0),
  allowOverpayment: process.env.ALLOW_OVERPAYMENT === 'true',
  lookupTokenSecret,
  lookupTokenTtl: Number(process.env.LOOKUP_TOKEN_TTL_SECONDS || 600),
  pendingExpiryMinutes: Number(process.env.PAYMENT_PENDING_EXPIRY_MINUTES || 60),
  reconcileIntervalMinutes: Number(process.env.RECONCILE_INTERVAL_MINUTES || 10),
  frontendUrl: process.env.FRONTEND_URL?.trim() || '',
  corsOrigins: (process.env.CORS_ALLOWED_ORIGINS || process.env.FRONTEND_URL || '').split(',').map(x => x.trim()).filter(Boolean),
  rateLimitLookup: Number(process.env.RATE_LIMIT_LOOKUP_PER_MINUTE || 5),
  rateLimitInitiate: Number(process.env.RATE_LIMIT_INITIATE_PER_MINUTE || 5),
  rateLimitStatus: Number(process.env.RATE_LIMIT_STATUS_PER_MINUTE || 30),
  paychanguConfigured: Boolean(paychanguSecretKey && paychanguWebhookSecret && paychanguCallbackUrl && paychanguReturnUrl && lookupTokenSecret),
};
