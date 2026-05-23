
const crypto = require('crypto');
const Order = require('../model/orderModel');

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

    // Payment success
    if (payload.status === 'CAPTURED') {

        const orderId = payload.reference?.order;

        // Update database
        await Order.findByIdAndUpdate(orderId, {
          paymentStatus: 'paid'
        });

        console.log('Payment Captured');
    }

    // Failed payment
    if (payload.status === 'FAILED') {

		await Order.findByIdAndUpdate(orderId, {
			paymentStatus: 'paid'
		});

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

module.exports = {
  postTabWebhook
};
