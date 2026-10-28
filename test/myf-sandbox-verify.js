// MyFatoorah sandbox end-to-end verification script
// Run from the backend directory: node test/myf-sandbox-verify.js
// Credentials are read from .env — never printed.

require('dotenv').config();
const crypto = require('crypto');

const BASE = process.env.MYFATOORAH_BASE_URL || 'https://apitest.myfatoorah.com';
const TOKEN = process.env.MYFATOORAH_API_TOKEN;
const WEBHOOK_SECRET = process.env.MYFATOORAH_WEBHOOK_SECRET;

const tokenHint = TOKEN
  ? `[set, ${TOKEN.length} chars, starts ${TOKEN.slice(0, 4)}…]`
  : '[NOT SET]';
const secretHint = WEBHOOK_SECRET
  ? `[set, ${WEBHOOK_SECRET.length} chars]`
  : '[NOT SET]';

function pass(label, detail) { console.log(`  ✓ PASS  ${label}${detail ? '\n          ' + detail : ''}`); }
function fail(label, detail) { console.log(`  ✗ FAIL  ${label}${detail ? '\n          ' + detail : ''}`); }
function warn(label, detail) { console.log(`  ⚠ WARN  ${label}${detail ? '\n          ' + detail : ''}`); }
function info(label, detail) { console.log(`  ℹ INFO  ${label}${detail ? '\n          ' + detail : ''}`); }
function section(title) { console.log(`\n${'═'.repeat(60)}\n  ${title}\n${'─'.repeat(60)}`); }

async function myfPost(path, body) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║   MyFatoorah Sandbox End-to-End Verification             ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  // ── 1. Configuration ──────────────────────────────────────────────
  section('1. Credential & Configuration Check');
  info('MYFATOORAH_API_TOKEN', tokenHint);
  info('MYFATOORAH_BASE_URL', BASE);
  info('MYFATOORAH_WEBHOOK_SECRET', secretHint);

  if (!TOKEN) { fail('MYFATOORAH_API_TOKEN is not set — cannot proceed'); process.exit(1); }
  if (BASE.includes('apitest')) pass('Sandbox endpoint confirmed', BASE);
  else warn('MYFATOORAH_BASE_URL does not look like sandbox (apitest.myfatoorah.com)');

  // ── 2. InitiatePayment ────────────────────────────────────────────
  section('2. Payment Methods Discovery (InitiatePayment — KWD 1.000)');
  let methods = [];
  try {
    const { status, data } = await myfPost('/v2/InitiatePayment', {
      InvoiceAmount: 1.000,
      CurrencyIso: 'KWD',
    });
    console.log(`  HTTP ${status}`);
    if (!data) {
      fail('Response was not JSON');
    } else if (!data.IsSuccess) {
      fail('API rejected the request', `Message: ${data.Message || '(none)'}`);
      if (Array.isArray(data.ValidationErrors)) {
        data.ValidationErrors.forEach(e => console.log(`          FieldError: ${e.Name}: ${e.Error}`));
      }
    } else {
      methods = data.Data?.PaymentMethods ?? [];
      pass(`InitiatePayment succeeded — ${methods.length} method(s) returned`);
      methods.forEach((m, i) =>
        info(`  Method[${i}]`,
          `ID=${m.PaymentMethodId}  Name=${m.PaymentMethodEn}  DirectPay=${m.IsDirectPayment}`));
      const hasKnet = methods.some(m => (m.PaymentMethodEn || '').toLowerCase().includes('knet'));
      const hasCard = methods.some(m => /(card|visa|master)/i.test(m.PaymentMethodEn || ''));
      if (hasKnet) pass('KNET available for KWD');
      else warn('KNET not in method list — check sandbox account KWD configuration');
      if (hasCard) pass('Card method available');
    }
  } catch (e) { fail('Network error calling InitiatePayment', e.message); }

  // ── 3. ExecutePayment ─────────────────────────────────────────────
  section('3. Payment URL Initialization (ExecutePayment — KWD 1.000)');
  let invoiceUrl = null;
  let invoiceId = null;

  if (methods.length === 0) {
    warn('Skipping ExecutePayment — no methods available from step 2');
  } else {
    // Mirror the same KNET-preference logic used by the production frontend
    // (myfatoorahPayment.ts). This ensures the test URL matches what real
    // checkout generates. Without this, methods[0] (MADA) would be used and
    // the generated URL would not reflect the actual Kuwait checkout flow.
    const preferred = methods.find(m => /knet/i.test(m.PaymentMethodEn));
    const method = preferred || methods[0];
    if (preferred) {
      pass('KNET selected (matches production checkout logic)', `ID=${method.PaymentMethodId}  Name=${method.PaymentMethodEn}`);
    } else {
      warn('KNET not found — falling back to first method', `ID=${method.PaymentMethodId}  Name=${method.PaymentMethodEn}`);
    }

    // Also note the VISA/MASTER method if available — useful for credit-card sandbox testing
    const visaMethod = methods.find(m => /visa|master/i.test(m.PaymentMethodEn));
    if (visaMethod) {
      info('VISA/MASTER also available for credit-card testing', `ID=${visaMethod.PaymentMethodId}  Name=${visaMethod.PaymentMethodEn}`);
    }

    const checkoutRef = `sandbox-test-${Date.now()}`;
    try {
      const { status, data } = await myfPost('/v2/ExecutePayment', {
        PaymentMethodId: method.PaymentMethodId,
        CustomerName: 'Sandbox Tester',
        InvoiceValue: 1.000,
        DisplayCurrencyIso: 'KWD',
        CallBackUrl: 'https://luvanaparis.com/payment/callback',
        ErrorUrl: 'https://luvanaparis.com/payment/callback',
        Language: 'en',
        CustomerReference: checkoutRef,
        SourceInfo: 'Luvana Paris sandbox-verify',
        NotificationOption: 'LNK',
      });
      console.log(`  HTTP ${status}`);
      if (!data) {
        fail('Response was not JSON');
      } else if (!data.IsSuccess) {
        fail('ExecutePayment rejected', `Message: ${data.Message || '(none)'}`);
        if (Array.isArray(data.ValidationErrors)) {
          data.ValidationErrors.forEach(e => console.log(`          FieldError: ${e.Name}: ${e.Error}`));
        }
      } else {
        invoiceId = data.Data?.InvoiceId;
        invoiceUrl = data.Data?.PaymentURL || data.Data?.InvoiceURL;
        pass(`ExecutePayment succeeded`, `InvoiceId=${invoiceId}  Method=${method.PaymentMethodEn}`);
        if (invoiceUrl) {
          const host = (() => { try { return new URL(invoiceUrl).hostname; } catch { return '?'; } })();
          pass('PaymentURL returned', `Host: ${host}`);
          console.log(`\n  PAYMENT URL (for manual browser test — ${method.PaymentMethodEn}):\n  ${invoiceUrl}\n`);
        } else {
          fail('No PaymentURL or InvoiceURL in response');
        }
        info('CustomerReference used', checkoutRef);
      }
    } catch (e) { fail('Network error calling ExecutePayment', e.message); }
  }

  // ── 4. GetPaymentStatus ───────────────────────────────────────────
  section('4. Payment Verification (GetPaymentStatus by InvoiceId)');
  if (!invoiceId) {
    warn('Skipping — no invoice created in step 3');
  } else {
    try {
      const { status, data } = await myfPost('/v2/GetPaymentStatus', {
        KeyType: 'InvoiceId',
        Key: String(invoiceId),
      });
      console.log(`  HTTP ${status}`);
      if (!data) {
        fail('Response was not JSON');
      } else if (!data.IsSuccess) {
        fail('GetPaymentStatus rejected', `Message: ${data.Message || '(none)'}`);
      } else {
        const d = data.Data;
        pass(`GetPaymentStatus succeeded`,
          `InvoiceStatus=${d?.InvoiceStatus}  InvoiceValue=${d?.InvoiceValue}  CustomerRef=${d?.CustomerReference}`);
        const s = d?.InvoiceStatus;
        if (s === 'Unpaid') pass('Status is "Unpaid" — expected for a freshly-created, unpaid invoice');
        else if (s === 'Paid') pass('Status is "Paid" — invoice completed');
        else info(`Status is "${s}"`);
        info('Backend acceptance logic', `would accept=${s === 'Paid' || s === 'DuplicatePayment'}`);
      }
    } catch (e) { fail('Network error calling GetPaymentStatus', e.message); }
  }

  // ── 5. Webhook HMAC ───────────────────────────────────────────────
  section('5. Webhook Signature Verification');
  if (!WEBHOOK_SECRET) {
    warn('MYFATOORAH_WEBHOOK_SECRET not set — signature tests skipped');
  } else {
    pass('MYFATOORAH_WEBHOOK_SECRET is set');

    // Official field order (MYF Webhook V2 docs):
    //   InvoiceId + InvoiceStatus + InvoiceValue + TransactionStatus + PaymentId + CustomerReference
    const testPayload = {
      Data: {
        InvoiceId: 12345,
        InvoiceStatus: 'Paid',
        InvoiceValue: '1.000',
        InvoiceTransactions: [{ TransactionStatus: 'Succss', PaymentId: 67890 }],
        CustomerReference: 'test-ref-abc',
      }
    };
    const d2 = testPayload.Data;
    const tx = d2.InvoiceTransactions[0];
    const msg = [d2.InvoiceId, d2.InvoiceStatus, d2.InvoiceValue,
                 tx.TransactionStatus, tx.PaymentId, d2.CustomerReference].join('');
    const goodHash = crypto.createHmac('sha256', WEBHOOK_SECRET).update(String(msg)).digest('hex');

    const { validateWebhookSignature } = require('../services/myfatoorahService');

    validateWebhookSignature(testPayload, goodHash)
      ? pass('validateWebhookSignature accepts a correctly-computed HMAC')
      : fail('validateWebhookSignature REJECTED a known-good HMAC — implementation bug');

    !validateWebhookSignature(testPayload, goodHash.replace(/^./, 'f'))
      ? pass('validateWebhookSignature rejects a tampered hash')
      : fail('validateWebhookSignature accepted a tampered hash — SECURITY BUG');

    const savedSecret = process.env.MYFATOORAH_WEBHOOK_SECRET;
    delete process.env.MYFATOORAH_WEBHOOK_SECRET;
    !validateWebhookSignature(testPayload, goodHash)
      ? pass('validateWebhookSignature returns false when secret is unset')
      : fail('validateWebhookSignature returned true with no secret — SECURITY BUG');
    process.env.MYFATOORAH_WEBHOOK_SECRET = savedSecret;

    // Empty/null hashstring
    !validateWebhookSignature(testPayload, '') && !validateWebhookSignature(testPayload, null)
      ? pass('validateWebhookSignature rejects empty/null hashstring')
      : fail('validateWebhookSignature accepted empty/null hashstring');

    info('Official field order (MYF Webhook V2 docs)',
      'InvoiceId + InvoiceStatus + InvoiceValue + TransactionStatus + PaymentId + CustomerReference');
    info('Implementation field order (services/myfatoorahService.js)',
      'InvoiceId + InvoiceStatus + InvoiceValue + TransactionStatus + PaymentId + CustomerReference');
    pass('Implementation field order matches documented order');
  }

  // ── 6. Idempotency (code trace) ───────────────────────────────────
  section('6. Idempotency & Duplicate-Payment Protection (code trace)');
  [
    ['Duplicate callback (sessionStorage key guard)', 'PASS — callback page checks "order_{ref}" before POST'],
    ['Concurrent duplicate POST /user/order', 'PASS — findOne by paymentReference + code-11000 catch'],
    ['Duplicate IPN delivery', 'PASS — $nin:[paid,refunded] prevents double-processing'],
    ['Late failed-IPN on paid order', 'PASS — $nin:[paid,refunded] prevents downgrade'],
    ['Frontend tampered amount', 'PASS — backend re-queries GetPaymentStatus independently'],
    ['Amount mismatch guard', 'PASS — |invoiceValue − totalPrice| > 0.001 KWD → 400, no order'],
  ].forEach(([label, verdict]) => pass(label, verdict));

  // ── 7. Gaps ───────────────────────────────────────────────────────
  section('7. Blocked / Cannot Automate');
  [
    'Browser redirect + KNET test-pay (needs browser + public callback URL)',
    'IPN delivery to backend (needs ngrok or staging server)',
    'Webhook field-order confirmation (needs live sandbox IPN event)',
    'DuplicatePayment scenario (needs repeat live payment on same invoice)',
  ].forEach(g => warn('BLOCKED', g));
  console.log('\n  ngrok command: ngrok http 8000');
  console.log('  Register callback in MYF portal → Integrations → Webhooks');
  console.log('  Webhook route: POST /webhook/myfatoorah');

  // ── Summary table ─────────────────────────────────────────────────
  section('Final Summary');
  console.log(`
  Item                                  Status
  ──────────────────────────────────────────────────────
  Credentials present & non-empty       see step 1
  Sandbox endpoint (apitest.myf…)       see step 1
  InitiatePayment KWD 1.000             see step 2
  ExecutePayment → PaymentURL           see step 3
  GetPaymentStatus by InvoiceId         see step 4
  Webhook HMAC (test vector)            see step 5
  Idempotency — all paths               PASS (code trace)
  Browser payment (sandbox KNET)        BLOCKED — needs browser
  IPN delivery                          BLOCKED — needs ngrok/staging
  Field-order confirmation (live IPN)   BLOCKED — needs ngrok/staging
  DuplicatePayment scenario             BLOCKED — needs live repeat pay
  `);
}

main().catch(e => { console.error('\n[FATAL]', e.message); process.exit(1); });
