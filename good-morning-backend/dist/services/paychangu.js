"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.payChangu = exports.PayChanguService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const config_1 = require("../config");
class PayChanguService {
    async request(path, init, retries = 0) {
        for (let attempt = 0;; attempt++) {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 10000);
            try {
                const response = await fetch(`${config_1.config.paychanguBaseUrl.replace(/\/$/, '')}${path}`, { ...init, signal: controller.signal, headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${config_1.config.paychanguSecretKey}`, ...(init.headers || {}) } });
                const body = await response.json().catch(() => ({}));
                if (!response.ok) {
                    if (response.status >= 500 && attempt < retries) {
                        await new Promise(resolve => setTimeout(resolve, 200 * (attempt + 1)));
                        continue;
                    }
                    throw new Error(`PayChangu request failed with HTTP ${response.status}`);
                }
                return body;
            }
            catch (error) {
                if (attempt < retries) {
                    await new Promise(resolve => setTimeout(resolve, 200 * (attempt + 1)));
                    continue;
                }
                throw error;
            }
            finally {
                clearTimeout(timer);
            }
        }
    }
    async createCheckout(input) {
        // Drop-in Element extension point: implement a separate client method only if that mode is selected later.
        const returnUrl = `${config_1.config.paychanguReturnUrl}${config_1.config.paychanguReturnUrl.includes('?') ? '&' : '?'}ref=${encodeURIComponent(input.reference)}`;
        const body = await this.request('/payment', { method: 'POST', body: JSON.stringify({
                amount: input.amount, currency: config_1.config.currency, tx_ref: input.reference,
                first_name: input.firstName, last_name: input.lastName, email: input.email || undefined,
                callback_url: config_1.config.paychanguCallbackUrl, return_url: returnUrl,
                customization: { title: 'Hostel rent payment', description: 'Online rental payment' },
            }) });
        const checkoutUrl = body?.data?.checkout_url;
        if (body?.status !== 'success' || typeof checkoutUrl !== 'string')
            throw new Error('PayChangu did not return a checkout URL.');
        return checkoutUrl;
    }
    async verify(reference) {
        const body = await this.request(`/verify-payment/${encodeURIComponent(reference)}`, { method: 'GET' }, 2);
        const data = body?.data;
        if (!data)
            throw new Error('PayChangu verification returned no transaction.');
        return { txRef: String(data.tx_ref || ''), reference: data.reference == null ? null : String(data.reference), amount: String(data.amount), currency: String(data.currency), status: String(data.status).toLowerCase() };
    }
    validWebhookSignature(raw, signature) {
        if (!signature || !config_1.config.paychanguWebhookSecret)
            return false;
        const expected = crypto_1.default.createHmac('sha256', config_1.config.paychanguWebhookSecret).update(raw).digest('hex');
        const a = Buffer.from(expected, 'utf8'), b = Buffer.from(signature.trim(), 'utf8');
        return a.length === b.length && crypto_1.default.timingSafeEqual(a, b);
    }
}
exports.PayChanguService = PayChanguService;
exports.payChangu = new PayChanguService();
//# sourceMappingURL=paychangu.js.map