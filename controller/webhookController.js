
const crypto = require('crypto');
const Order = require('../model/orderModel');
const { verifyPayment: verifyMyfPayment, validateWebhookSignature } = require('../services/myfatoorahService');

const postTabWebhook = async (req, res) => {
  try {
    const payload = req.body;

    console.log(JSON.stringify(payload, null, 2));

    const isValid = verifyTapWebhook(payload, req.headers);

    if (!isValid) {
        return res.status(400).json({
            success: false,
            message: 'Invalid webhook signature'
        });
    }

    // Payment captured — upgrade pending/authorized to paid; never touch refunded
    if (payload.status === 'CAPTURED') {
        const orderId = payload.reference?.order;
        if (orderId) {
            await Order.findOneAndUpdate(
                { _id: orderId, paymentStatus: { $nin: ['paid', 'refunded'] } },
                { paymentStatus: 'paid' }
            );
        }
        console.log('Payment Captured');
    }

    // Failed payment — only mark failed if not already paid or refunded
    if (payload.status === 'FAILED') {
        const orderId = payload.reference?.order;
        if (orderId) {
            await Order.findOneAndUpdate(
                { _id: orderId, paymentStatus: { $nin: ['paid', 'refunded'] } },
                { paymentStatus: 'failed' }
            );
        }
        console.log('Payment Failed');
    }

    res.status(200).json({
        success: true
    });
  } catch (error) {
		console.error('Tap Webhook error:', error);
		res.status(500).json({ message: 'Internal server error' });
  }
};

const verifyTapWebhook = (payload, headers) => {

    const postedHash = headers.hashstring;

    const id = payload.id;
    const amount = Number(payload.amount).toFixed(3);
    const currency = payload.currency;
    const gateway_reference = payload.reference?.gateway || '';
    const payment_reference = payload.reference?.payment || '';
    const status = payload.status;
    const created = payload.transaction?.created;

    const toBeHashedString =
        `x_id${id}` +
        `x_amount${amount}` +
        `x_currency${currency}` +
        `x_gateway_reference${gateway_reference}` +
        `x_payment_reference${payment_reference}` +
        `x_status${status}` +
        `x_created${created}`;
		
    const generatedHash = crypto
        .createHmac('sha256', process.env.TAP_SECRET_KEY)
        .update(toBeHashedString)
        .digest('hex');

    return generatedHash === postedHash;
}

// MyFatoorah IPN handler (Webhook V2)
// Always returns 200 to prevent infinite retries; logs errors for reconciliation.
// The signature requires MYFATOORAH_WEBHOOK_SECRET to be set in the environment.
// The webhook does NOT include the amount — GetPaymentStatus is re-queried to confirm it.
const postMyfatoorahWebhook = async (req, res) => {
  try {
    const payload = req.body;
    const hashString = req.headers['hashstring'] || req.headers['HashString'];

    if (!validateWebhookSignature(payload, hashString)) {
      console.warn('[MYF Webhook] Signature validation failed');
      return res.status(400).json({ success: false, message: 'Invalid webhook signature' });
    }

    const invoiceStatus = payload?.Data?.InvoiceStatus;
    // CustomerReference is the checkoutRef UUID set at payment initiation
    const customerRef = payload?.Data?.CustomerReference;
    const paymentId = payload?.Data?.InvoiceTransactions?.[0]?.PaymentId;

    if (!customerRef) {
      console.warn('[MYF Webhook] Missing CustomerReference');
      return res.status(200).json({ success: true });
    }

    const isPaid = invoiceStatus === 'Paid' || invoiceStatus === 'PAID' || invoiceStatus === 'DuplicatePayment';
    const isFailed = invoiceStatus === 'Failed' || invoiceStatus === 'FAILED' ||
                     invoiceStatus === 'Cancelled' || invoiceStatus === 'Expired';

    if (isPaid) {
      // Re-query to confirm the amount — signature does not cover it
      if (paymentId) {
        try {
          const myfResult = await verifyMyfPayment(paymentId, 'PaymentId');
          const alsoConfirmed = myfResult.invoiceStatus === 'Paid' || myfResult.invoiceStatus === 'DuplicatePayment';
          if (alsoConfirmed) {
            await Order.findOneAndUpdate(
              { paymentReference: customerRef, paymentProvider: 'myfatoorah', paymentStatus: { $nin: ['paid', 'refunded'] } },
              { paymentStatus: 'paid' }
            );
          }
        } catch (e) {
          console.error('[MYF Webhook] Re-query failed:', e.message);
          // Return 200 — will be caught by reconciliation rather than causing retries
        }
      }
    } else if (isFailed) {
      await Order.findOneAndUpdate(
        { paymentReference: customerRef, paymentProvider: 'myfatoorah', paymentStatus: { $nin: ['paid', 'refunded'] } },
        { paymentStatus: 'failed' }
      );
    } else {
      console.log(`[MYF Webhook] Unhandled InvoiceStatus: ${invoiceStatus}`);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('[MYF Webhook] Unexpected error:', error);
    res.status(200).json({ success: true }); // always 200 to stop retries
  }
};

module.exports = {
  postTabWebhook,
  verifyTapWebhook,
  postMyfatoorahWebhook,
};
