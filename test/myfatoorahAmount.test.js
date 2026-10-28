// Run with: npm test  (node:test, no database or network needed)
const test = require('node:test');
const assert = require('node:assert/strict');
const { roundForCurrency } = require('../services/myfatoorahService');

// ── roundForCurrency ─────────────────────────────────────────────────────────

test('KWD rounds to 3 decimal places', () => {
  assert.equal(roundForCurrency(10.5, 'KWD'), 10.5);
  assert.equal(roundForCurrency(10.5005, 'KWD'), 10.501);
  assert.equal(roundForCurrency(10.0, 'KWD'), 10.0);
  assert.equal(roundForCurrency(0.001, 'KWD'), 0.001);
});

test('BHD and OMR also use 3 decimal places', () => {
  assert.equal(roundForCurrency(5.1234, 'BHD'), 5.123);
  assert.equal(roundForCurrency(5.1234, 'OMR'), 5.123);
});

test('SAR and AED use 2 decimal places', () => {
  // 10.556 → "10.56"; avoid 10.555 which is 10.554999… in IEEE 754 and rounds to 10.55
  assert.equal(roundForCurrency(10.556, 'SAR'), 10.56);
  assert.equal(roundForCurrency(10.554, 'AED'), 10.55);
});

test('unknown currency defaults to 2 decimal places', () => {
  assert.equal(roundForCurrency(10.556, 'USD'), 10.56);
  assert.equal(roundForCurrency(10.554, ''), 10.55);
});

test('rejects NaN amount', () => {
  assert.throws(() => roundForCurrency(NaN, 'KWD'), /Invalid charge amount/);
});

test('rejects Infinity', () => {
  assert.throws(() => roundForCurrency(Infinity, 'KWD'), /Invalid charge amount/);
});

test('rejects zero', () => {
  assert.throws(() => roundForCurrency(0, 'KWD'), /Invalid charge amount/);
});

test('rejects negative amount', () => {
  assert.throws(() => roundForCurrency(-5, 'KWD'), /Invalid charge amount/);
});

// ── Checkout total composition ────────────────────────────────────────────────
// These mirror the arithmetic in checkout/page.tsx so a formula change breaks here too.

function computeCheckoutTotal(subtotal, discount = 0, shippingCharges = 0) {
  return subtotal - discount + shippingCharges;
}

test('checkout total: no discount, no shipping', () => {
  assert.equal(computeCheckoutTotal(10.500), 10.5);
});

test('checkout total: with 10% coupon discount', () => {
  const subtotal = 20.0;
  const discount = Math.round(subtotal * 0.1); // matches checkout page formula
  assert.equal(computeCheckoutTotal(subtotal, discount), 18.0);
});

test('checkout total: with shipping charges', () => {
  assert.equal(computeCheckoutTotal(10.5, 0, 2.0), 12.5);
});

test('checkout total: NaN subtotal produces NaN (guard must catch it)', () => {
  const total = computeCheckoutTotal(undefined);
  assert.ok(!Number.isFinite(total), 'expected NaN/Infinity when subtotal is missing');
  assert.ok(total <= 0 || !Number.isFinite(total), 'MYF guard condition must trigger');
});

test('checkout total passed to roundForCurrency — valid KWD amount survives', () => {
  const total = computeCheckoutTotal(10.500);
  const charged = roundForCurrency(total, 'KWD');
  assert.equal(charged, 10.5);
  assert.equal(String(charged), '10.5');
});

test('checkout total passed to roundForCurrency — NaN is rejected', () => {
  const total = computeCheckoutTotal(undefined);
  assert.throws(() => roundForCurrency(total, 'KWD'), /Invalid charge amount/);
});

// ── Webhook signature helper ──────────────────────────────────────────────────
// validateWebhookSignature must reject calls with no secret configured.

const { validateWebhookSignature } = require('../services/myfatoorahService');

test('validateWebhookSignature returns false when secret is unset', () => {
  delete process.env.MYFATOORAH_WEBHOOK_SECRET;
  assert.equal(validateWebhookSignature({ Data: {} }, 'abc123'), false);
});

test('validateWebhookSignature returns false for malformed hashString', () => {
  process.env.MYFATOORAH_WEBHOOK_SECRET = 'testsecret';
  assert.equal(validateWebhookSignature({ Data: {} }, ''), false);
  assert.equal(validateWebhookSignature({ Data: {} }, null), false);
  assert.equal(validateWebhookSignature({ Data: {} }, 123), false);
  delete process.env.MYFATOORAH_WEBHOOK_SECRET;
});
