// Run with: npm test  (node:test, no database or real Tap credentials needed)
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

// verifyTapWebhook is a pure HMAC function — inject a test key so we never
// touch the real TAP_SECRET_KEY environment variable.
const TEST_SECRET = 'test_hmac_secret_phase2';
process.env.TAP_SECRET_KEY = TEST_SECRET;

const { verifyTapWebhook } = require('../controller/webhookController');

// ── Helpers ──────────────────────────────────────────────────────────────────

function makePayload(overrides = {}) {
  return {
    id: 'chg_TEST0001',
    amount: 10.0,
    currency: 'KWD',
    reference: { gateway: 'gw_ref_001', payment: 'pay_ref_001', order: null },
    status: 'CAPTURED',
    transaction: { created: '2026-01-01T12:00:00Z' },
    ...overrides,
  };
}

function computeHash(payload, secret) {
  const amount = Number(payload.amount).toFixed(3);
  const str =
    `x_id${payload.id}` +
    `x_amount${amount}` +
    `x_currency${payload.currency}` +
    `x_gateway_reference${payload.reference?.gateway || ''}` +
    `x_payment_reference${payload.reference?.payment || ''}` +
    `x_status${payload.status}` +
    `x_created${payload.transaction?.created}`;
  return crypto.createHmac('sha256', secret).update(str).digest('hex');
}

// ── Signature verification tests ──────────────────────────────────────────────

test('verifyTapWebhook returns true for a valid CAPTURED signature', () => {
  const payload = makePayload();
  const hash = computeHash(payload, TEST_SECRET);
  assert.equal(verifyTapWebhook(payload, { hashstring: hash }), true);
});

test('verifyTapWebhook returns true for a valid FAILED signature', () => {
  const payload = makePayload({ status: 'FAILED' });
  const hash = computeHash(payload, TEST_SECRET);
  assert.equal(verifyTapWebhook(payload, { hashstring: hash }), true);
});

test('verifyTapWebhook returns false for a wrong signature', () => {
  const payload = makePayload();
  assert.equal(verifyTapWebhook(payload, { hashstring: 'deadbeef' }), false);
});

test('verifyTapWebhook returns false when hashstring header is missing', () => {
  const payload = makePayload();
  assert.equal(verifyTapWebhook(payload, {}), false);
});

test('verifyTapWebhook returns false when hashstring is null', () => {
  const payload = makePayload();
  assert.equal(verifyTapWebhook(payload, { hashstring: null }), false);
});

test('verifyTapWebhook rejects a signature computed for a different amount', () => {
  const realPayload = makePayload({ amount: 10 });
  const tamperedPayload = makePayload({ amount: 1 });
  const hash = computeHash(realPayload, TEST_SECRET);
  assert.equal(verifyTapWebhook(tamperedPayload, { hashstring: hash }), false);
});

test('verifyTapWebhook rejects a signature computed for a different status', () => {
  const capturedHash = computeHash(makePayload({ status: 'CAPTURED' }), TEST_SECRET);
  assert.equal(
    verifyTapWebhook(makePayload({ status: 'FAILED' }), { hashstring: capturedHash }),
    false
  );
});

test('verifyTapWebhook rejects a signature computed for a different charge ID', () => {
  const realHash = computeHash(makePayload({ id: 'chg_REAL' }), TEST_SECRET);
  assert.equal(
    verifyTapWebhook(makePayload({ id: 'chg_FAKE' }), { hashstring: realHash }),
    false
  );
});

test('verifyTapWebhook rejects a signature computed for a different currency', () => {
  const realHash = computeHash(makePayload({ currency: 'KWD' }), TEST_SECRET);
  assert.equal(
    verifyTapWebhook(makePayload({ currency: 'SAR' }), { hashstring: realHash }),
    false
  );
});

test('verifyTapWebhook handles missing reference fields without throwing', () => {
  const payload = makePayload({ reference: {} });
  const hash = computeHash(payload, TEST_SECRET);
  // reference.gateway and reference.payment default to '' so hash still matches
  assert.equal(verifyTapWebhook(payload, { hashstring: hash }), true);
});

test('verifyTapWebhook rejects a signature signed with a different secret', () => {
  const payload = makePayload();
  const wrongHash = computeHash(payload, 'wrong_secret');
  assert.equal(verifyTapWebhook(payload, { hashstring: wrongHash }), false);
});

// ── Webhook status-transition guard logic ─────────────────────────────────────
// Both CAPTURED and FAILED handlers use { $nin: ['paid', 'refunded'] } in their
// MongoDB query. These tests verify the guard logic without hitting a database.

function matchesTransitionGuard(currentStatus) {
  const BLOCKED = ['paid', 'refunded'];
  return !BLOCKED.includes(currentStatus);
}

test('CAPTURED guard: upgrades pending order', () => {
  assert.equal(matchesTransitionGuard('pending'), true);
});

test('CAPTURED guard: upgrades authorized order to paid', () => {
  assert.equal(matchesTransitionGuard('authorized'), true);
});

test('CAPTURED guard: does not touch an already-paid order', () => {
  assert.equal(matchesTransitionGuard('paid'), false);
});

test('CAPTURED guard: does not touch a refunded order', () => {
  assert.equal(matchesTransitionGuard('refunded'), false);
});

test('FAILED guard: marks pending order failed', () => {
  assert.equal(matchesTransitionGuard('pending'), true);
});

test('FAILED guard: marks authorized order failed', () => {
  assert.equal(matchesTransitionGuard('authorized'), true);
});

test('FAILED guard: does not downgrade a paid order', () => {
  assert.equal(matchesTransitionGuard('paid'), false);
});

test('FAILED guard: does not downgrade a refunded order', () => {
  assert.equal(matchesTransitionGuard('refunded'), false);
});

// ── Order total calculation ───────────────────────────────────────────────────
// Mirrors the server-side formula in orderController: subtotal - couponDiscount + shippingCharges

function calculateOrderTotal(subtotal, couponDiscount = 0, shippingCharges = 0) {
  return subtotal - couponDiscount + Number(shippingCharges);
}

test('order total: no discount, no shipping', () => {
  assert.equal(calculateOrderTotal(100), 100);
});

test('order total: coupon discount applied', () => {
  assert.equal(calculateOrderTotal(100, 10), 90);
});

test('order total: shipping added', () => {
  assert.equal(calculateOrderTotal(100, 0, 5), 105);
});

test('order total: discount and shipping together', () => {
  assert.equal(calculateOrderTotal(100, 10, 5), 95);
});

test('order total: zero coupon discount does not alter total', () => {
  assert.equal(calculateOrderTotal(50.5, 0, 0), 50.5);
});

// ── paymentReference idempotency logic ───────────────────────────────────────
// The controller queries { $or: [{ paymentReference }, { tapChargeId: paymentReference }] }
// so both new orders (paymentReference) and legacy orders (tapChargeId) block duplicates.

function simulateIdempotencyMatch(orders, incomingRef) {
  return orders.find(o => o.paymentReference === incomingRef || o.tapChargeId === incomingRef) || null;
}

test('idempotency: finds order by paymentReference (new orders)', () => {
  const orders = [{ paymentReference: 'chg_ABC', tapChargeId: undefined }];
  assert.notEqual(simulateIdempotencyMatch(orders, 'chg_ABC'), null);
});

test('idempotency: finds legacy order by tapChargeId', () => {
  const orders = [{ paymentReference: undefined, tapChargeId: 'chg_LEGACY' }];
  assert.notEqual(simulateIdempotencyMatch(orders, 'chg_LEGACY'), null);
});

test('idempotency: returns null for an unknown reference', () => {
  const orders = [{ paymentReference: 'chg_ABC' }];
  assert.equal(simulateIdempotencyMatch(orders, 'chg_OTHER'), null);
});

// ── Admin payment-status whitelist ───────────────────────────────────────────
// Mirrors controller/admin/orderController.js updatePaymentStatus validation.

const VALID_ADMIN_PAYMENT_STATUSES = ['pending', 'authorized', 'paid', 'failed', 'refunded'];

function isValidAdminPaymentStatus(status) {
  return VALID_ADMIN_PAYMENT_STATUSES.includes(status);
}

test('admin whitelist: authorized is a valid payment status', () => {
  assert.equal(isValidAdminPaymentStatus('authorized'), true);
});

test('admin whitelist: all five model enum values are accepted', () => {
  for (const s of VALID_ADMIN_PAYMENT_STATUSES) {
    assert.equal(isValidAdminPaymentStatus(s), true);
  }
});

test('admin whitelist: raw Tap status strings are rejected', () => {
  assert.equal(isValidAdminPaymentStatus('CAPTURED'), false);
  assert.equal(isValidAdminPaymentStatus('AUTHORIZED'), false);
});

// ── Callback sessionStorage paymentStatus mapping ─────────────────────────────
// Mirrors the ternary chain in payment/callback/page.tsx.
// AUTHORIZED must never be stored as 'paid' — only a CAPTURED charge may be.

function mapTapStatusToPaymentStatus(tapStatus) {
  if (tapStatus === 'CAPTURED') return 'paid';
  if (tapStatus === 'AUTHORIZED') return 'authorized';
  return 'failed';
}

test('callback status: CAPTURED maps to paid', () => {
  assert.equal(mapTapStatusToPaymentStatus('CAPTURED'), 'paid');
});

test('callback status: AUTHORIZED maps to authorized, not paid', () => {
  assert.equal(mapTapStatusToPaymentStatus('AUTHORIZED'), 'authorized');
});

test('callback status: FAILED maps to failed', () => {
  assert.equal(mapTapStatusToPaymentStatus('FAILED'), 'failed');
});

test('callback status: DECLINED maps to failed', () => {
  assert.equal(mapTapStatusToPaymentStatus('DECLINED'), 'failed');
});

test('callback status: null (poll timeout) maps to failed', () => {
  assert.equal(mapTapStatusToPaymentStatus(null), 'failed');
});

// ── Checkout charge amount (Tap amount = order total) ─────────────────────────
// Mirrors checkout/page.tsx: total = subtotal - couponDiscount + shippingCharges
// The value charged to Tap and the value stored in the order must use this same formula.

function calculateChargeAmount(subtotal, couponDiscount = 0, shippingCharges = 0) {
  return subtotal - couponDiscount + shippingCharges;
}

test('charge amount: shipping is included when non-zero', () => {
  assert.equal(calculateChargeAmount(100, 0, 10), 110);
});

test('charge amount: coupon discount reduces total', () => {
  assert.equal(calculateChargeAmount(100, 10, 0), 90);
});

test('charge amount: zero shipping preserves current behavior', () => {
  assert.equal(calculateChargeAmount(100, 0, 0), 100);
  assert.equal(calculateChargeAmount(100), 100);
});

test('charge amount: discount and shipping together', () => {
  assert.equal(calculateChargeAmount(100, 10, 5), 95);
});

// ── MyFatoorah: currency rounding ────────────────────────────────────────────
// Mirrors roundForCurrency() in services/myfatoorahService.js

const DP_MYF = { KWD: 3, BHD: 3, OMR: 3 };
function roundForCurrency(amount, currency) {
  const dp = DP_MYF[currency] ?? 2;
  return parseFloat(amount.toFixed(dp));
}

test('MYF rounding: KWD uses 3 decimal places', () => {
  assert.equal(roundForCurrency(10.5, 'KWD'), 10.500);
  assert.equal(roundForCurrency(10.1234, 'KWD'), 10.123);
});

test('MYF rounding: SAR uses 2 decimal places', () => {
  assert.equal(roundForCurrency(10.556, 'SAR'), 10.56);
  assert.equal(roundForCurrency(10.123, 'SAR'), 10.12);
});

test('MYF rounding: AED uses 2 decimal places', () => {
  assert.equal(roundForCurrency(99.999, 'AED'), 100.00);
});

test('MYF rounding: BHD uses 3 decimal places', () => {
  assert.equal(roundForCurrency(5.0006, 'BHD'), 5.001);
  assert.equal(roundForCurrency(5.0001, 'BHD'), 5.000);
});

test('MYF rounding: unknown currency defaults to 2 decimal places', () => {
  assert.equal(roundForCurrency(10.556, 'USD'), 10.56);
  assert.equal(roundForCurrency(10.123, 'USD'), 10.12);
});

// ── MyFatoorah: InvoiceStatus mapping ─────────────────────────────────────────
// Mirrors the status checks in orderController.js and webhookController.js

function myfStatusIsPaid(invoiceStatus) {
  return invoiceStatus === 'Paid' || invoiceStatus === 'DuplicatePayment';
}

function myfStatusIsFailed(invoiceStatus) {
  return invoiceStatus === 'Failed' || invoiceStatus === 'Cancelled' || invoiceStatus === 'Expired';
}

test('MYF status: Paid maps to paid', () => {
  assert.equal(myfStatusIsPaid('Paid'), true);
});

test('MYF status: DuplicatePayment also maps to paid', () => {
  assert.equal(myfStatusIsPaid('DuplicatePayment'), true);
});

test('MYF status: Unpaid is not paid', () => {
  assert.equal(myfStatusIsPaid('Unpaid'), false);
});

test('MYF status: InProgress is not paid', () => {
  assert.equal(myfStatusIsPaid('InProgress'), false);
});

test('MYF status: Failed maps to failed', () => {
  assert.equal(myfStatusIsFailed('Failed'), true);
});

test('MYF status: Cancelled maps to failed', () => {
  assert.equal(myfStatusIsFailed('Cancelled'), true);
});

test('MYF status: Expired maps to failed', () => {
  assert.equal(myfStatusIsFailed('Expired'), true);
});

test('MYF status: Paid is not failed', () => {
  assert.equal(myfStatusIsFailed('Paid'), false);
});

// ── MyFatoorah: amount tolerance guard ────────────────────────────────────────
// Mirrors the tolerance check in orderController.js

function myfAmountWithinTolerance(verifiedAmount, expectedAmount, currency) {
  const tolerance = (currency === 'KWD' || currency === 'BHD' || currency === 'OMR') ? 0.001 : 0.01;
  return Math.abs(verifiedAmount - expectedAmount) <= tolerance;
}

test('MYF amount: exact match passes (KWD)', () => {
  assert.equal(myfAmountWithinTolerance(10.500, 10.500, 'KWD'), true);
});

test('MYF amount: 1-fill tolerance passes (KWD)', () => {
  assert.equal(myfAmountWithinTolerance(10.501, 10.500, 'KWD'), true);
  assert.equal(myfAmountWithinTolerance(10.499, 10.500, 'KWD'), true);
});

test('MYF amount: 2-fill difference fails (KWD)', () => {
  assert.equal(myfAmountWithinTolerance(10.502, 10.500, 'KWD'), false);
});

test('MYF amount: exact match passes (SAR)', () => {
  assert.equal(myfAmountWithinTolerance(100.50, 100.50, 'SAR'), true);
});

test('MYF amount: 1-halala tolerance passes (SAR)', () => {
  // 0.005 difference is safely within the 0.01 tolerance
  assert.equal(myfAmountWithinTolerance(100.505, 100.500, 'SAR'), true);
});

test('MYF amount: large mismatch fails (SAR)', () => {
  assert.equal(myfAmountWithinTolerance(101.00, 100.50, 'SAR'), false);
});

test('MYF amount: currency mismatch implies wrong tolerance applied', () => {
  // A 0.002 difference should fail KWD but pass SAR
  assert.equal(myfAmountWithinTolerance(10.502, 10.500, 'KWD'), false);
  assert.equal(myfAmountWithinTolerance(10.502, 10.500, 'SAR'), true);
});

// ── MyFatoorah: webhook signature ────────────────────────────────────────────
// Tests the validateWebhookSignature function from myfatoorahService.js

const TEST_MYF_SECRET = 'test_myf_webhook_secret_abc123';
process.env.MYFATOORAH_WEBHOOK_SECRET = TEST_MYF_SECRET;
const { validateWebhookSignature: myfValidateSig } = require('../services/myfatoorahService');

function makeMyfWebhookBody(overrides = {}) {
  return {
    EventType: 1,
    Event: 'PAYMENT_STATUS_CHANGED',
    Data: {
      InvoiceId: 12345,
      InvoiceStatus: 'Paid',
      InvoiceValue: 10.500,
      CustomerReference: 'chk-test-ref-001',
      InvoiceTransactions: [{
        TransactionStatus: 'SUCCESS',
        PaymentId: 'pay-001',
      }],
      ...overrides,
    },
  };
}

function computeMyfHash(body, secret) {
  const d = body.Data || {};
  const tx = Array.isArray(d.InvoiceTransactions) ? d.InvoiceTransactions[0] : {};
  const message = [
    d.InvoiceId || '',
    d.InvoiceStatus || '',
    d.InvoiceValue || '',
    tx.TransactionStatus || '',
    tx.PaymentId || '',
    d.CustomerReference || '',
  ].join('');
  return crypto.createHmac('sha256', secret).update(String(message)).digest('hex');
}

test('MYF webhook: valid signature is accepted', () => {
  const body = makeMyfWebhookBody();
  const hash = computeMyfHash(body, TEST_MYF_SECRET);
  assert.equal(myfValidateSig(body, hash), true);
});

test('MYF webhook: wrong secret produces rejection', () => {
  const body = makeMyfWebhookBody();
  const hash = computeMyfHash(body, 'wrong_secret');
  assert.equal(myfValidateSig(body, hash), false);
});

test('MYF webhook: tampered InvoiceId produces rejection', () => {
  const body = makeMyfWebhookBody();
  const hash = computeMyfHash(body, TEST_MYF_SECRET);
  body.Data.InvoiceId = 99999;
  assert.equal(myfValidateSig(body, hash), false);
});

test('MYF webhook: tampered InvoiceStatus produces rejection', () => {
  const body = makeMyfWebhookBody();
  const hash = computeMyfHash(body, TEST_MYF_SECRET);
  body.Data.InvoiceStatus = 'Failed';
  assert.equal(myfValidateSig(body, hash), false);
});

test('MYF webhook: missing hashString returns false', () => {
  const body = makeMyfWebhookBody();
  assert.equal(myfValidateSig(body, undefined), false);
  assert.equal(myfValidateSig(body, null), false);
  assert.equal(myfValidateSig(body, ''), false);
});

test('MYF webhook: missing MYFATOORAH_WEBHOOK_SECRET returns false', () => {
  const saved = process.env.MYFATOORAH_WEBHOOK_SECRET;
  delete process.env.MYFATOORAH_WEBHOOK_SECRET;
  const body = makeMyfWebhookBody();
  const hash = computeMyfHash(body, saved);
  assert.equal(myfValidateSig(body, hash), false);
  process.env.MYFATOORAH_WEBHOOK_SECRET = saved; // restore
});

// ── MyFatoorah: IPN $nin guard ────────────────────────────────────────────────
// MYF webhook must not update a paid or refunded order (same guard as Tap)

test('MYF IPN guard: can update pending order', () => {
  assert.equal(matchesTransitionGuard('pending'), true);
});

test('MYF IPN guard: cannot downgrade paid order', () => {
  assert.equal(matchesTransitionGuard('paid'), false);
});

test('MYF IPN guard: cannot downgrade refunded order', () => {
  assert.equal(matchesTransitionGuard('refunded'), false);
});

// ── MyFatoorah: idempotency — MYF paymentReference is a checkoutRef UUID ──────
// A second POST /user/order with the same checkoutRef returns 200 with existing order

test('idempotency: MYF checkoutRef UUID prevents duplicate order', () => {
  const orders = [{ paymentReference: 'chk-uuid-0001', paymentProvider: 'myfatoorah' }];
  const match = orders.find(o => o.paymentReference === 'chk-uuid-0001');
  assert.notEqual(match, undefined);
});

test('idempotency: MYF checkoutRef does not match Tap chargeId', () => {
  const orders = [{ paymentReference: 'chg_tap001', paymentProvider: 'tap' }];
  const match = orders.find(o => o.paymentReference === 'chk-uuid-0001');
  assert.equal(match, undefined);
});

// ── Scenarios that require a real MYF sandbox — NOT run here ─────────────────
// The following require live MYFATOORAH_API_TOKEN and sandbox credentials:
//   - initiatePayment: returns valid InvoiceId and InvoiceURL
//   - verifyPayment: InvoiceStatus='Paid' after sandbox payment
//   - verifyPayment: InvoiceStatus='Failed' for declined payment
//   - amount validation: verifiedAmount matches totalPrice within tolerance
//   - full E2E: checkout → hosted page → callback → order created as 'paid'
//   - IPN: webhook updates order paymentStatus from pending → paid
//   - DuplicatePayment: second POST /user/order returns 200 with existing order
//   - ErrorUrl redirect: cancelled payment goes to /payment/failed, no order created
//   - Cart preserved after failed/cancelled payment
//   - Historical Tap orders unaffected when PAYMENT_PROVIDER=myfatoorah

// ── MYF ValidationErrors surfaced in error message ────────────────────────────
// Regression tests for the "Invalid data" fix: ValidationErrors must be included
// in the error thrown/returned so the caller can see the exact failing field.

function buildMyfErrorMessage(message, validationErrors) {
  const fieldErrors = Array.isArray(validationErrors) && validationErrors.length > 0
    ? ` (${validationErrors.map(e => `${e.Name}: ${e.Error}`).join('; ')})`
    : '';
  return (message || 'MyFatoorah error') + fieldErrors;
}

test('MYF error: ValidationErrors appended when present', () => {
  const msg = buildMyfErrorMessage('Invalid data', [
    { Name: 'CallBackUrl', Error: 'Not a valid URL' },
    { Name: 'InvoiceValue', Error: 'Must be greater than 0' },
  ]);
  assert.ok(msg.includes('Invalid data'));
  assert.ok(msg.includes('CallBackUrl: Not a valid URL'));
  assert.ok(msg.includes('InvoiceValue: Must be greater than 0'));
});

test('MYF error: no ValidationErrors keeps plain message', () => {
  const msg = buildMyfErrorMessage('Invalid data', []);
  assert.equal(msg, 'Invalid data');
});

test('MYF error: null ValidationErrors keeps plain message', () => {
  const msg = buildMyfErrorMessage('Invalid data', null);
  assert.equal(msg, 'Invalid data');
});

// ── MYF checkout total guard ──────────────────────────────────────────────────
// total <= 0 must be caught before calling MYF (no silent 0.1 substitution).

function validateCheckoutTotal(total) {
  if (!Number.isFinite(total) || total <= 0) {
    return 'Your cart appears to be empty. Please add items before checking out.';
  }
  return null;
}

test('MYF total guard: zero total returns error', () => {
  assert.notEqual(validateCheckoutTotal(0), null);
});

test('MYF total guard: negative total returns error', () => {
  assert.notEqual(validateCheckoutTotal(-1), null);
});

test('MYF total guard: NaN total returns error', () => {
  assert.notEqual(validateCheckoutTotal(NaN), null);
});

test('MYF total guard: valid KWD total passes', () => {
  assert.equal(validateCheckoutTotal(3.500), null);
  assert.equal(validateCheckoutTotal(0.100), null);
});

// ── MYF optional fields included in request body ─────────────────────────────

function buildMyfExecutePaymentBody({ amount, currency, callbackUrl, errorUrl,
  customerName, customerRef, customerEmail, customerMobile, mobileCountryCode }) {
  const body = {
    PaymentMethodId: 0,
    CustomerName: customerName || 'Customer',
    InvoiceValue: amount,
    DisplayCurrencyIso: currency,
    CallBackUrl: callbackUrl,
    ErrorUrl: errorUrl || callbackUrl,
    Language: 'en',
    CustomerReference: String(customerRef),
    SourceInfo: 'Luvana Paris',
    NotificationOption: 'LNK',
  };
  if (customerEmail) body.CustomerEmail = customerEmail;
  if (customerMobile) {
    body.CustomerMobile = customerMobile;
    body.MobileCountryCode = mobileCountryCode || '965';
  }
  return body;
}

test('MYF request: NotificationOption is always LNK', () => {
  const body = buildMyfExecutePaymentBody({ amount: 3.5, currency: 'KWD',
    callbackUrl: 'http://localhost:3000/payment/callback',
    errorUrl: 'http://localhost:3000/payment/failed',
    customerName: 'Ali', customerRef: 'uuid-001' });
  assert.equal(body.NotificationOption, 'LNK');
});

test('MYF request: email and phone included when provided', () => {
  const body = buildMyfExecutePaymentBody({ amount: 3.5, currency: 'KWD',
    callbackUrl: 'http://localhost:3000/payment/callback',
    errorUrl: 'http://localhost:3000/payment/failed',
    customerName: 'Ali', customerRef: 'uuid-001',
    customerEmail: 'ali@example.com', customerMobile: '99887766', mobileCountryCode: '965' });
  assert.equal(body.CustomerEmail, 'ali@example.com');
  assert.equal(body.CustomerMobile, '99887766');
  assert.equal(body.MobileCountryCode, '965');
});

test('MYF request: email and phone omitted when not provided', () => {
  const body = buildMyfExecutePaymentBody({ amount: 3.5, currency: 'KWD',
    callbackUrl: 'http://localhost:3000/payment/callback',
    errorUrl: 'http://localhost:3000/payment/failed',
    customerName: 'Ali', customerRef: 'uuid-001' });
  assert.equal('CustomerEmail' in body, false);
  assert.equal('CustomerMobile' in body, false);
});

// ── MYF two-step flow: InitiatePayment → ExecutePayment ──────────────────────
// Root cause of "PaymentMethodId: This payment method is not supported":
// PaymentMethodId: 0 requires the UCP feature which is not enabled on every account.
// The correct flow is: call InitiatePayment to get real IDs, then ExecutePayment.

// Simulate what getPaymentMethods returns from InitiatePayment
function mockPaymentMethods(methods) {
  return { PaymentMethods: methods };
}

function pickFirstMethodId(methodsResponse) {
  const methods = methodsResponse?.PaymentMethods ?? [];
  if (methods.length === 0) return null;
  return methods[0].PaymentMethodId;
}

test('MYF two-step: picks first available PaymentMethodId from InitiatePayment', () => {
  const resp = mockPaymentMethods([
    { PaymentMethodId: 2, PaymentMethodEn: 'KNET' },
    { PaymentMethodId: 1, PaymentMethodEn: 'Credit Card' },
  ]);
  assert.equal(pickFirstMethodId(resp), 2);
});

test('MYF two-step: returns null when no methods available', () => {
  const resp = mockPaymentMethods([]);
  assert.equal(pickFirstMethodId(resp), null);
});

test('MYF two-step: returns null when PaymentMethods is missing', () => {
  assert.equal(pickFirstMethodId({}), null);
  assert.equal(pickFirstMethodId(null), null);
});

test('MYF two-step: ExecutePayment body uses ID from InitiatePayment, not 0', () => {
  const methodId = pickFirstMethodId(mockPaymentMethods([{ PaymentMethodId: 2, PaymentMethodEn: 'KNET' }]));
  // The body must never use 0 — it must use the real ID
  assert.notEqual(methodId, 0);
  assert.equal(methodId, 2);
});

test('MYF two-step: error returned when no methods available for currency', () => {
  const methods = [];
  const error = methods.length === 0
    ? 'No payment methods available for KWD. Please contact support.'
    : null;
  assert.notEqual(error, null);
  assert.ok(error.includes('KWD'));
});

test('MYF two-step: single KNET method for KWD sandbox uses that ID', () => {
  // Kuwait sandbox typically only has KNET available
  const resp = mockPaymentMethods([{ PaymentMethodId: 2, PaymentMethodEn: 'KNET' }]);
  const methodId = pickFirstMethodId(resp);
  assert.equal(methodId, 2);
  // This ID should be passed to ExecutePayment, not hardcoded 0
  const body = { PaymentMethodId: methodId, InvoiceValue: 3.5, CurrencyIso: 'KWD' };
  assert.equal(body.PaymentMethodId, 2);
});

test('MYF two-step: PaymentMethodId 0 is never sent when InitiatePayment is used', () => {
  // Any real account response will have IDs >= 1
  const resp = mockPaymentMethods([
    { PaymentMethodId: 1, PaymentMethodEn: 'Credit Card' },
  ]);
  const methodId = pickFirstMethodId(resp);
  assert.ok(methodId > 0, 'method ID must be > 0 (real ID, not the invalid 0)');
});

// ── MYF ExecutePayment: PaymentURL vs InvoiceURL ────────────────────────────
// Root cause of the post-payment 404:
//   MYF's ExecutePayment response uses PaymentURL (current API) not InvoiceURL.
//   payData.InvoiceURL was undefined → window.location.href = undefined →
//   browser navigated to literal path "/undefined" → Next.js 404.
// Fix: accept PaymentURL OR InvoiceURL; throw if neither is present.

function extractInvoiceUrl(payData) {
  const url = (payData && (payData.PaymentURL || payData.InvoiceURL)) || null;
  if (!url) throw new Error('MyFatoorah did not return a payment URL. Verify the API token is active.');
  return url;
}

test('MYF invoiceUrl: PaymentURL field is accepted (current API)', () => {
  const payData = { InvoiceId: 1, PaymentURL: 'https://apitest.myfatoorah.com/en/KWT/invoice/1' };
  assert.equal(extractInvoiceUrl(payData), 'https://apitest.myfatoorah.com/en/KWT/invoice/1');
});

test('MYF invoiceUrl: InvoiceURL field is accepted (older API versions)', () => {
  const payData = { InvoiceId: 1, InvoiceURL: 'https://apitest.myfatoorah.com/en/KWT/invoice/1' };
  assert.equal(extractInvoiceUrl(payData), 'https://apitest.myfatoorah.com/en/KWT/invoice/1');
});

test('MYF invoiceUrl: PaymentURL takes precedence over InvoiceURL when both present', () => {
  const payData = { InvoiceId: 1, PaymentURL: 'https://correct.url', InvoiceURL: 'https://old.url' };
  assert.equal(extractInvoiceUrl(payData), 'https://correct.url');
});

test('MYF invoiceUrl: missing URL throws descriptive error (prevents /undefined 404)', () => {
  // If neither field is present, navigating to undefined → "/undefined" → Next.js 404.
  // The service must throw before the caller can set window.location.href.
  assert.throws(() => extractInvoiceUrl({ InvoiceId: 1 }), /did not return a payment URL/);
});

test('MYF invoiceUrl: null payData throws descriptive error', () => {
  assert.throws(() => extractInvoiceUrl(null), /did not return a payment URL/);
});

test('MYF invoiceUrl: empty string URL treated as missing (falsy guard)', () => {
  assert.throws(() => extractInvoiceUrl({ InvoiceId: 1, PaymentURL: '' }), /did not return a payment URL/);
});

// ── Cart pre-payment validation logic ────────────────────────────────────────
// Mirrors validateCart in controller/user/cartController.js

function simulateCartValidation(items, variantDb) {
  const unavailable = [];
  for (const item of items) {
    const v = variantDb[String(item.variant)];
    if (!v) { unavailable.push({ variantId: item.variant, name: 'Unknown', reason: 'not_found' }); continue; }
    if (v.status !== 'active') { unavailable.push({ variantId: item.variant, name: v.name || 'Item', reason: 'variant_inactive' }); continue; }
    if (v.productStatus && v.productStatus !== 'active') { unavailable.push({ variantId: item.variant, name: v.name, reason: 'product_inactive' }); continue; }
    if (v.stock !== undefined && v.stock < item.quantity) { unavailable.push({ variantId: item.variant, name: v.name, reason: 'out_of_stock' }); }
  }
  return { valid: unavailable.length === 0, unavailable };
}

const mockVariants = {
  'var-active': { status: 'active', productStatus: 'active', stock: 10, name: 'Active Item' },
  'var-inactive': { status: 'inactive', productStatus: 'active', stock: 5, name: 'Inactive Item' },
  'var-prod-inactive': { status: 'active', productStatus: 'inactive', stock: 5, name: 'Inactive Product Item' },
  'var-no-stock': { status: 'active', productStatus: 'active', stock: 0, name: 'OOS Item' },
};

test('cart validate: all active items → valid', () => {
  const result = simulateCartValidation(
    [{ variant: 'var-active', quantity: 2 }],
    mockVariants
  );
  assert.equal(result.valid, true);
  assert.equal(result.unavailable.length, 0);
});

test('cart validate: inactive variant → not valid', () => {
  const result = simulateCartValidation(
    [{ variant: 'var-inactive', quantity: 1 }],
    mockVariants
  );
  assert.equal(result.valid, false);
  assert.equal(result.unavailable[0].reason, 'variant_inactive');
});

test('cart validate: inactive product → not valid', () => {
  const result = simulateCartValidation(
    [{ variant: 'var-prod-inactive', quantity: 1 }],
    mockVariants
  );
  assert.equal(result.valid, false);
  assert.equal(result.unavailable[0].reason, 'product_inactive');
});

test('cart validate: out-of-stock item → not valid', () => {
  const result = simulateCartValidation(
    [{ variant: 'var-no-stock', quantity: 1 }],
    mockVariants
  );
  assert.equal(result.valid, false);
  assert.equal(result.unavailable[0].reason, 'out_of_stock');
});

test('cart validate: unknown variant → not valid', () => {
  const result = simulateCartValidation(
    [{ variant: 'var-unknown', quantity: 1 }],
    mockVariants
  );
  assert.equal(result.valid, false);
  assert.equal(result.unavailable[0].reason, 'not_found');
});

test('cart validate: mixed cart with one inactive → not valid', () => {
  const result = simulateCartValidation(
    [
      { variant: 'var-active', quantity: 1 },
      { variant: 'var-inactive', quantity: 1 },
    ],
    mockVariants
  );
  assert.equal(result.valid, false);
  assert.equal(result.unavailable.length, 1);
  assert.equal(result.unavailable[0].variantId, 'var-inactive');
});

// ── PendingPayment status transitions ─────────────────────────────────────────
// Mirrors the PendingPayment model status enum and retryRecovery logic

function simulatePendingPaymentGuard(pp, paymentRef) {
  if (!pp || pp.paymentReference !== paymentRef) return 'not_found';
  if (pp.status === 'order_created') return 'already_resolved';
  return 'needs_recovery';
}

test('PendingPayment: pending_review needs recovery', () => {
  const pp = { paymentReference: 'ref-001', status: 'pending_review' };
  assert.equal(simulatePendingPaymentGuard(pp, 'ref-001'), 'needs_recovery');
});

test('PendingPayment: order_created blocks re-creation', () => {
  const pp = { paymentReference: 'ref-001', status: 'order_created' };
  assert.equal(simulatePendingPaymentGuard(pp, 'ref-001'), 'already_resolved');
});

test('PendingPayment: wrong reference returns not_found', () => {
  const pp = { paymentReference: 'ref-001', status: 'pending_review' };
  assert.equal(simulatePendingPaymentGuard(pp, 'ref-other'), 'not_found');
});

test('PendingPayment: null record returns not_found', () => {
  assert.equal(simulatePendingPaymentGuard(null, 'ref-001'), 'not_found');
});

// ── Recovery idempotency ──────────────────────────────────────────────────────
// retryRecovery checks for an existing order before creating a new one

function simulateRecoveryIdempotency(existingOrders, paymentRef) {
  const existing = existingOrders.find(o => o.paymentReference === paymentRef);
  if (existing) return { status: 'order_created', order: existing };
  return null;
}

test('recovery idempotency: returns existing order if paymentRef already has an order', () => {
  const orders = [{ paymentReference: 'ref-001', orderId: 'ORD-001' }];
  const result = simulateRecoveryIdempotency(orders, 'ref-001');
  assert.notEqual(result, null);
  assert.equal(result.status, 'order_created');
  assert.equal(result.order.orderId, 'ORD-001');
});

test('recovery idempotency: returns null when no existing order', () => {
  const orders = [{ paymentReference: 'ref-001' }];
  assert.equal(simulateRecoveryIdempotency(orders, 'ref-other'), null);
});

// ── Callback 202 routing ──────────────────────────────────────────────────────
// Callback page must route to /payment/processing on 202, not /payment/success

function simulateCallbackRouting(orderResStatus, orderResData) {
  if (orderResStatus === 202 || orderResData?.status === 'pending_review') {
    return 'processing';
  }
  if ((orderResStatus === 200 || orderResStatus === 201) && orderResData?.order?.orderId) {
    return 'success';
  }
  return 'success_no_order';
}

test('callback routing: 202 pending_review → processing page', () => {
  assert.equal(simulateCallbackRouting(202, { status: 'pending_review', paymentReference: 'ref-001' }), 'processing');
});

test('callback routing: 200 with status:pending_review → processing page', () => {
  assert.equal(simulateCallbackRouting(200, { status: 'pending_review' }), 'processing');
});

test('callback routing: 201 with order → success page', () => {
  assert.equal(simulateCallbackRouting(201, { order: { orderId: 'ORD-001' } }), 'success');
});

test('callback routing: 200 duplicate → success page', () => {
  assert.equal(simulateCallbackRouting(200, { order: { orderId: 'ORD-001' } }), 'success');
});

// ── Scenarios that require a real Tap sandbox — NOT run here ─────────────────
// The following scenarios cannot be validated without live Tap sandbox credentials:
//   - createOrder: Tap API returns CAPTURED → order saved with paymentStatus 'paid'
//   - createOrder: Tap API returns AUTHORIZED → order saved with paymentStatus 'authorized'
//   - createOrder: charge status FAILED → 400, no order persisted
//   - createOrder: missing paymentReference → 400
//   - createOrder: duplicate paymentReference → 200 with existing order (idempotency)
//   - createOrder: Tap API unreachable → 502
//   - Webhook: CAPTURED event promotes 'authorized' order to 'paid'
//   - Webhook: CAPTURED event does not modify a 'paid' or 'refunded' order
//   - Webhook: FAILED event marks 'pending'/'authorized' order as 'failed'
//   - Webhook: FAILED event does not downgrade 'paid' or 'refunded' order
//   - Cart is retained when payment fails (order never created)
//   - Callback routes FAILED/DECLINED/timeout to /payment/failed
// These must be verified manually against the Tap test environment.

// ── Product status visibility ─────────────────────────────────────────────────
// Mirrors the { status: 'active' } filter applied in user product/home/cart APIs

function simulateProductListFilter(products) {
  return products.filter(p => p.status === 'active');
}

test('product listing: active products are visible', () => {
  const products = [{ id: 1, status: 'active' }, { id: 2, status: 'inactive' }];
  const visible = simulateProductListFilter(products);
  assert.equal(visible.length, 1);
  assert.equal(visible[0].id, 1);
});

test('product listing: inactive products are excluded', () => {
  const products = [{ id: 1, status: 'inactive' }, { id: 2, status: 'inactive' }];
  const visible = simulateProductListFilter(products);
  assert.equal(visible.length, 0);
});

test('product listing: empty list stays empty', () => {
  assert.equal(simulateProductListFilter([]).length, 0);
});

test('product detail: inactive product returns 404', () => {
  // Backend behavior: getProductDetails returns 404 when product.status !== 'active'
  function getProductStatus(product) {
    if (!product) return 404;
    if (product.status !== 'active') return 404;
    return 200;
  }
  assert.equal(getProductStatus({ status: 'inactive' }), 404);
  assert.equal(getProductStatus({ status: 'active' }), 200);
  assert.equal(getProductStatus(null), 404);
});

// ── addToCart status guard ────────────────────────────────────────────────────
// Mirrors the new variant/product status checks added to addToCart

function simulateAddToCartStatusGuard(variant, product) {
  if (!variant) return { ok: false, reason: 'variant_not_found' };
  if (variant.status !== 'active') return { ok: false, reason: 'variant_inactive' };
  if (!product || product.status !== 'active') return { ok: false, reason: 'product_inactive' };
  if (variant.stock < 1) return { ok: false, reason: 'no_stock' };
  return { ok: true };
}

test('addToCart guard: active variant and product → allowed', () => {
  const result = simulateAddToCartStatusGuard(
    { status: 'active', stock: 5 },
    { status: 'active' }
  );
  assert.equal(result.ok, true);
});

test('addToCart guard: inactive variant → rejected', () => {
  const result = simulateAddToCartStatusGuard(
    { status: 'inactive', stock: 5 },
    { status: 'active' }
  );
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'variant_inactive');
});

test('addToCart guard: inactive product → rejected', () => {
  const result = simulateAddToCartStatusGuard(
    { status: 'active', stock: 5 },
    { status: 'inactive' }
  );
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'product_inactive');
});

test('addToCart guard: null product → rejected', () => {
  const result = simulateAddToCartStatusGuard({ status: 'active', stock: 5 }, null);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'product_inactive');
});

// ── getCart unavailable flag ──────────────────────────────────────────────────
// Mirrors the unavailable field added to each enriched cart item in getCart

function simulateGetCartUnavailableFlag(variant, productStatus, quantity) {
  if (variant.status !== 'active') return 'variant_inactive';
  if (productStatus !== 'active') return 'product_inactive';
  if (variant.stock !== undefined && variant.stock < quantity) return 'out_of_stock';
  return null;
}

test('getCart flag: active item with sufficient stock → null', () => {
  assert.equal(simulateGetCartUnavailableFlag({ status: 'active', stock: 10 }, 'active', 2), null);
});

test('getCart flag: inactive variant → variant_inactive', () => {
  assert.equal(simulateGetCartUnavailableFlag({ status: 'inactive', stock: 10 }, 'active', 1), 'variant_inactive');
});

test('getCart flag: inactive product → product_inactive', () => {
  assert.equal(simulateGetCartUnavailableFlag({ status: 'active', stock: 10 }, 'inactive', 1), 'product_inactive');
});

test('getCart flag: insufficient stock → out_of_stock', () => {
  assert.equal(simulateGetCartUnavailableFlag({ status: 'active', stock: 1 }, 'active', 5), 'out_of_stock');
});

// ── Checkout blocks invalid cart items before MYF initiation ─────────────────
// Mirrors checkout/page.tsx preflight: validateRes.data.valid === false blocks payment

function simulateCheckoutPreflightGuard(validateResult) {
  if (!validateResult.valid) {
    const names = (validateResult.unavailable || []).map(u => u.name).join(', ');
    return { blocked: true, message: `Some items are no longer available: ${names || 'one or more items'}` };
  }
  return { blocked: false };
}

test('checkout preflight: valid cart proceeds to payment', () => {
  const result = simulateCheckoutPreflightGuard({ valid: true, unavailable: [] });
  assert.equal(result.blocked, false);
});

test('checkout preflight: invalid cart is blocked', () => {
  const result = simulateCheckoutPreflightGuard({
    valid: false,
    unavailable: [{ variantId: 'v1', name: 'Cherry Bomb Lipstick', reason: 'product_inactive' }],
  });
  assert.equal(result.blocked, true);
  assert.ok(result.message.includes('Cherry Bomb Lipstick'));
});

test('checkout preflight: multiple unavailable items all named in error', () => {
  const result = simulateCheckoutPreflightGuard({
    valid: false,
    unavailable: [
      { variantId: 'v1', name: 'Item A', reason: 'product_inactive' },
      { variantId: 'v2', name: 'Item B', reason: 'variant_inactive' },
    ],
  });
  assert.equal(result.blocked, true);
  assert.ok(result.message.includes('Item A'));
  assert.ok(result.message.includes('Item B'));
});

// ── Cart cleanup: only purchased variants, only after save ────────────────────
// Mirrors Cart.deleteMany({ user, variant: { $in: variantIds } }) in createOrder

function simulateCartCleanup(cartVariantIds, purchasedVariantIds, orderSaved) {
  if (!orderSaved) return cartVariantIds; // cart untouched on failure
  const purchasedSet = new Set(purchasedVariantIds.map(String));
  return cartVariantIds.filter(id => !purchasedSet.has(String(id)));
}

test('cart cleanup: purchased variants removed after save', () => {
  const remaining = simulateCartCleanup(['v1', 'v2', 'v3'], ['v1', 'v2'], true);
  assert.deepEqual(remaining, ['v3']);
});

test('cart cleanup: unpurchased variants preserved', () => {
  const remaining = simulateCartCleanup(['v1', 'v2'], ['v1'], true);
  assert.deepEqual(remaining, ['v2']);
});

test('cart cleanup: no cleanup when order.save fails', () => {
  const remaining = simulateCartCleanup(['v1', 'v2'], ['v1', 'v2'], false);
  assert.deepEqual(remaining, ['v1', 'v2']); // unchanged
});

// ── No notification system reintroduced ──────────────────────────────────────
// The notification model/routes/controllers must not exist

test('notification system is absent: no Notification model exported', () => {
  // If this require succeeds, the notification system was reintroduced.
  // It must throw MODULE_NOT_FOUND.
  let caught = false;
  try { require('../model/notificationModel'); } catch (e) { caught = e.code === 'MODULE_NOT_FOUND'; }
  assert.equal(caught, true, 'notificationModel must not exist');
});

test('notification system is absent: no notification controller exported', () => {
  let caught = false;
  try { require('../controller/user/notificationController'); } catch (e) { caught = e.code === 'MODULE_NOT_FOUND'; }
  assert.equal(caught, true, 'notificationController must not exist');
});
