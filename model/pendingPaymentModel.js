const mongoose = require('mongoose');

const pendingPaymentSchema = new mongoose.Schema({
  paymentReference: { type: String, required: true, unique: true },
  myfPaymentId: { type: String },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  addressId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserAddress' },
  amount: { type: Number },
  currency: { type: String, default: 'KWD' },
  invoiceId: { type: String },
  myfInvoiceStatus: { type: String },
  // Raw items from req.body — variant IDs + quantities at payment time
  cartSnapshot: { type: Array, default: [] },
  failureReason: { type: String },
  status: {
    type: String,
    enum: ['pending_review', 'order_created'],
    default: 'pending_review',
  },
  resolvedOrderId: { type: String },
}, { timestamps: true });

pendingPaymentSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model('PendingPayment', pendingPaymentSchema);
