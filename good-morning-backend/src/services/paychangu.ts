import crypto from 'crypto';
import { config } from '../config';

export type ProviderPayment = { txRef: string; reference: string | null; amount: string; currency: string; status: string };

export class PayChanguService {
  private async request(path: string, init: RequestInit, retries = 0) {
    for (let attempt = 0; ; attempt++) {
      const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 10000);
      try {
        const response = await fetch(`${config.paychanguBaseUrl.replace(/\/$/, '')}${path}`, { ...init, signal: controller.signal, headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${config.paychanguSecretKey}`, ...(init.headers || {}) } });
        const body = await response.json().catch(() => ({})) as any;
        if (!response.ok) { if (response.status >= 500 && attempt < retries) { await new Promise(resolve => setTimeout(resolve, 200 * (attempt + 1))); continue; } throw new Error(`PayChangu request failed with HTTP ${response.status}`); }
        return body;
      } catch (error) { if (attempt < retries) { await new Promise(resolve => setTimeout(resolve, 200 * (attempt + 1))); continue; } throw error; }
      finally { clearTimeout(timer); }
    }
  }

  async createCheckout(input: { reference: string; amount: string; firstName: string; lastName: string; email?: string | null }) {
    // Drop-in Element extension point: implement a separate client method only if that mode is selected later.
    const returnUrl = `${config.paychanguReturnUrl}${config.paychanguReturnUrl.includes('?') ? '&' : '?'}ref=${encodeURIComponent(input.reference)}`;
    const body = await this.request('/payment', { method: 'POST', body: JSON.stringify({
      amount: input.amount, currency: config.currency, tx_ref: input.reference,
      first_name: input.firstName, last_name: input.lastName, email: input.email || undefined,
      callback_url: config.paychanguCallbackUrl, return_url: returnUrl,
      customization: { title: 'Hostel rent payment', description: 'Online rental payment' },
    }) });
    const checkoutUrl = body?.data?.checkout_url;
    if (body?.status !== 'success' || typeof checkoutUrl !== 'string') throw new Error('PayChangu did not return a checkout URL.');
    return checkoutUrl;
  }

  async verify(reference: string): Promise<ProviderPayment> {
    const body = await this.request(`/verify-payment/${encodeURIComponent(reference)}`, { method: 'GET' }, 2);
    const data = body?.data;
    if (!data) throw new Error('PayChangu verification returned no transaction.');
    return { txRef: String(data.tx_ref || ''), reference: data.reference == null ? null : String(data.reference), amount: String(data.amount), currency: String(data.currency), status: String(data.status).toLowerCase() };
  }

  validWebhookSignature(raw: Buffer, signature: string | undefined) {
    if (!signature || !config.paychanguWebhookSecret) return false;
    const expected = crypto.createHmac('sha256', config.paychanguWebhookSecret).update(raw).digest('hex');
    const a = Buffer.from(expected, 'utf8'), b = Buffer.from(signature.trim(), 'utf8');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }
}

export const payChangu = new PayChanguService();
