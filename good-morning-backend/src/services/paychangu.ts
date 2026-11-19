import crypto from 'crypto';
import { config } from '../config';

export type ProviderPayment = { txRef: string; reference: string | null; amount: string; currency: string; status: string };
export type DirectCharge = { chargeId: string; providerReference: string | null; amount: string; currency: string; status: string };

export const payChanguOperators = {
  AIRTEL_MONEY: '20be6c20-adeb-4b5b-a7ba-0769820df4fb',
  TNM_MPAMBA: '27494cb5-ba9e-437f-a114-4e7a7686bcca',
} as const;

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

  async createCheckout(input: { reference: string; amount: string; firstName: string; lastName: string; email?: string | null; title?: string; description?: string }) {
    // Drop-in Element extension point: implement a separate client method only if that mode is selected later.
    const returnUrl = `${config.paychanguReturnUrl}${config.paychanguReturnUrl.includes('?') ? '&' : '?'}ref=${encodeURIComponent(input.reference)}`;
    const body = await this.request('/payment', { method: 'POST', body: JSON.stringify({
      amount: input.amount, currency: config.currency, tx_ref: input.reference,
      first_name: input.firstName, last_name: input.lastName, email: input.email || undefined,
      callback_url: config.paychanguCallbackUrl, return_url: returnUrl,
      customization: { title: input.title || 'Hostel rent payment', description: input.description || 'Online rental payment' },
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

  async initializeDirectCharge(input: { mobile: string; operatorRef: string; amount: string; chargeId: string; firstName?: string; lastName?: string }): Promise<DirectCharge> {
    const body = await this.request('/mobile-money/payments/initialize', {
      method: 'POST',
      body: JSON.stringify({
        mobile: input.mobile,
        mobile_money_operator_ref_id: input.operatorRef,
        amount: input.amount,
        charge_id: input.chargeId,
        first_name: input.firstName,
        last_name: input.lastName,
      }),
    });
    const data = body?.data;
    if (!['success', 'successful'].includes(String(body?.status).toLowerCase()) || !data?.charge_id) {
      const reason = typeof body?.message === 'string' ? body.message.slice(0, 240) : String(body?.status || 'unspecified provider response');
      throw new Error(`PayChangu did not accept the mobile money charge: ${reason}`);
    }
    return {
      chargeId: String(data.charge_id),
      providerReference: data.ref_id == null ? null : String(data.ref_id),
      amount: String(data.amount),
      currency: String(data.currency),
      status: String(data.status).toLowerCase(),
    };
  }

  async verifyDirectCharge(chargeId: string): Promise<DirectCharge> {
    const body = await this.request(`/mobile-money/payments/${encodeURIComponent(chargeId)}/verify`, { method: 'GET' }, 2);
    const data = body?.data;
    if (!data) throw new Error('PayChangu direct-charge verification returned no transaction.');
    return {
      chargeId: String(data.charge_id || chargeId),
      providerReference: data.ref_id == null ? null : String(data.ref_id),
      amount: String(data.amount),
      currency: String(data.currency),
      status: String(data.status).toLowerCase(),
    };
  }

  validWebhookSignature(raw: Buffer, signature: string | undefined) {
    if (!signature || !config.paychanguWebhookSecret) return false;
    const expected = crypto.createHmac('sha256', config.paychanguWebhookSecret).update(raw).digest('hex');
    const a = Buffer.from(expected, 'utf8'), b = Buffer.from(signature.trim(), 'utf8');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }
}

export const payChangu = new PayChanguService();
