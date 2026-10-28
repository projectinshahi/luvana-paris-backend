const crypto = require('crypto');

// KWD/BHD/OMR use 3 decimal places; SAR/AED and others use 2
const DP = { KWD: 3, BHD: 3, OMR: 3 };

function roundForCurrency(amount, currency) {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`Invalid charge amount: ${amount}. Must be a positive finite number.`);
  }
  const dp = DP[currency] ?? 2;
  return parseFloat(amount.toFixed(dp));
}

function getBaseUrl() {
  return process.env.MYFATOORAH_BASE_URL || 'https://apitest.myfatoorah.com';
}

function getToken() {
  const token = process.env.MYFATOORAH_API_TOKEN;
  if (!token) throw new Error('MYFATOORAH_API_TOKEN is not set');
  return token;
}

async function myfetch(path, body) {
  const url = `${getBaseUrl()}${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  let data;
  try {
    data = await res.json();
  } catch {
    // MYF returned a non-JSON body (HTML error page, plain-text 404, etc.)
    console.error('[MYF]', path, 'HTTP', res.status, 'non-JSON response. URL:', url);
    throw new Error(
      `MyFatoorah ${path} returned HTTP ${res.status} (non-JSON body). ` +
      `Verify MYFATOORAH_BASE_URL is correct ("${getBaseUrl()}").`
    );
  }

  if (!data.IsSuccess) {
    const fieldErrors = Array.isArray(data.ValidationErrors) && data.ValidationErrors.length > 0
      ? ` (${data.ValidationErrors.map(e => `${e.Name}: ${e.Error}`).join('; ')})`
      : '';
    console.error('[MYF]', path, 'HTTP', res.status, 'failed:', data.Message, data.ValidationErrors);
    throw new Error((data.Message || `MyFatoorah error at ${path}`) + fieldErrors);
  }
  return data.Data;
}

// Returns the payment methods available for a given amount and currency.
// PaymentMethodId: 0 ("all methods") requires the UCP feature which is not enabled on
// every MYF account — always call this first and use the real IDs from the response.
async function getPaymentMethods(invoiceAmount, currencyIso) {
  const data = await myfetch('/v2/InitiatePayment', {
    InvoiceAmount: invoiceAmount,
    CurrencyIso: currencyIso,
  });
  return Array.isArray(data.PaymentMethods) ? data.PaymentMethods : [];
}

// Initiate a hosted payment page using the first available payment method.
// ponytail: uses first available method; add a method-selector step when the account
//           has multiple methods (e.g. KNET + Credit Card).
async function initiatePayment({ amount, currency, callbackUrl, errorUrl, customerName, customerRef,
  customerEmail, customerMobile, mobileCountryCode }) {
  const chargeAmount = roundForCurrency(amount, currency);

  const methods = await getPaymentMethods(chargeAmount, currency);
  if (methods.length === 0) {
    throw new Error(`No payment methods available for ${currency}`);
  }
  // For KWD prefer KNET; fall back to first available method.
  // ponytail: add a method-selector step when UCP is enabled and multiple methods apply.
  const preferred = currency === 'KWD'
    ? methods.find(m => /knet/i.test(m.PaymentMethodEn))
    : null;
  const methodId = (preferred || methods[0]).PaymentMethodId;

  const body = {
    PaymentMethodId: methodId,
    CustomerName: customerName || 'Customer',
    InvoiceValue: chargeAmount,
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
  const data = await myfetch('/v2/ExecutePayment', body);
  // MYF response uses PaymentURL (current API) or InvoiceURL (older API versions)
  const invoiceUrl = data.PaymentURL || data.InvoiceURL;
  if (!invoiceUrl) {
    throw new Error('MyFatoorah did not return a payment URL. Verify the API token is active.');
  }
  return { invoiceId: data.InvoiceId, invoiceUrl, paymentMethodId: methodId };
}

// Verify a payment by PaymentId (from callback ?paymentId=…) or InvoiceId
async function verifyPayment(key, keyType = 'PaymentId') {
  const data = await myfetch('/v2/GetPaymentStatus', {
    KeyType: keyType,
    Key: String(key),
  });
  const tx = Array.isArray(data.InvoiceTransactions) ? data.InvoiceTransactions[0] : null;
  return {
    invoiceId: data.InvoiceId,
    invoiceStatus: data.InvoiceStatus,       // 'Paid', 'Unpaid', 'Failed', 'DuplicatePayment', etc.
    invoiceValue: Number(data.InvoiceValue),
    currency: (tx && tx.Currency) || data.DisplayCurrencyIso || '',
    customerReference: data.CustomerReference,
    paymentId: (tx && tx.PaymentId) || String(key),
    transactionStatus: (tx && tx.TransactionStatus) || '',
  };
}

// Verify MyFatoorah Webhook V2 signature.
// IMPORTANT: The signature does NOT include amount — always re-query GetPaymentStatus for the amount.
// Requires MYFATOORAH_WEBHOOK_SECRET from the merchant portal (Integration → Webhooks).
// ponytail: field concatenation order is unconfirmed pending a real sandbox webhook event;
//           update this list if MYF sends a non-matching hash in sandbox testing.
function validateWebhookSignature(body, hashString) {
  if (!hashString || typeof hashString !== 'string') return false;
  const secret = process.env.MYFATOORAH_WEBHOOK_SECRET;
  if (!secret) {
    console.warn('[MYF Webhook] MYFATOORAH_WEBHOOK_SECRET not configured — signature unverifiable');
    return false;
  }
  const d = (body && body.Data) || {};
  const tx = Array.isArray(d.InvoiceTransactions) ? d.InvoiceTransactions[0] : {};
  const message = [
    d.InvoiceId || '',
    d.InvoiceStatus || '',
    d.InvoiceValue || '',
    tx.TransactionStatus || '',
    tx.PaymentId || '',
    d.CustomerReference || '',
  ].join('');
  const expected = crypto.createHmac('sha256', secret).update(String(message)).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(hashString, 'hex'));
  } catch {
    return false;
  }
}

module.exports = { initiatePayment, verifyPayment, validateWebhookSignature, roundForCurrency, getPaymentMethods };
