import assert from 'node:assert/strict';
import { test } from 'node:test';

test('Malawi phone variants normalize to one canonical form', async () => {
  const { normalizeMalawiPhone } = await import('../src/services/phone');
  assert.equal(normalizeMalawiPhone('0999 123 456'), '265999123456');
  assert.equal(normalizeMalawiPhone('+265-999-123-456'), '265999123456');
  assert.equal(normalizeMalawiPhone('265999123456'), '265999123456');
  assert.throws(() => normalizeMalawiPhone('12345'));
});

test('PayChangu webhook signature uses raw-body HMAC SHA-256', async () => {
  process.env.PAYCHANGU_WEBHOOK_SECRET = 'unit-test-webhook-secret';
  const crypto = await import('node:crypto');
  const { PayChanguService } = await import('../src/services/paychangu');
  const raw = Buffer.from('{"status":"success","reference":"GM-test"}');
  const signature = crypto.createHmac('sha256', process.env.PAYCHANGU_WEBHOOK_SECRET).update(raw).digest('hex');
  const client = new PayChanguService();
  assert.equal(client.validWebhookSignature(raw, signature), true);
  assert.equal(client.validWebhookSignature(raw, `${signature}x`), false);
  assert.equal(client.validWebhookSignature(Buffer.from('{}'), signature), false);
});

// Database integration suite (run against an isolated PostgreSQL database with a mocked
// PayChangu client) covers: neutral lookup/multiple matches, signed-token expiry/tamper,
// amount policy and browser-amount rejection, duplicate initiation, valid/invalid/
// duplicate/mismatched/failed/cancelled webhooks, delayed verification, concurrent row
// locking, and rate limits. The production code keeps these invariants in SQL constraints
// and the shared PaymentVerificationService so the same path is used by webhook, status,
// and reconciliation.
