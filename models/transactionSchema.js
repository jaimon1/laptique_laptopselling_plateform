import mongoose from 'mongoose';

const TransactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    wallet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Wallet',
      required: false, // Optional to allow creation before wallet linkage in legacy scenarios
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [0, 'Amount must be positive'],
    },
    currency: {
      type: String,
      default: 'INR',
      uppercase: true,
      trim: true,
    },
    type: {
      type: String,
      required: true,
      enum: ['CREDIT', 'DEBIT', 'REFUND', 'TOPUP'],
      index: true,
    },
    source: {
      // Where this transaction originated from
      type: String,
      enum: [
        'ORDER_PAYMENT', // wallet used to pay order
        'ORDER_CANCEL_REFUND', // auto refund on order cancellation
        'ORDER_RETURN_REFUND', // admin approved return refund
        'WALLET_TOPUP_RAZORPAY', // Razorpay top-up
        'REFERRAL_REWARD', // referral reward credit
        'ADJUSTMENT', // manual admin adjustments if needed
        'COUPON_DISCOUNT', // optional for analytics breakdown
        'OFFER_DISCOUNT', // optional for analytics breakdown
      ],
      default: 'ADJUSTMENT',
      index: true,
    },
    referenceModel: {
      // For traceability: Order, Payment, RazorpayOrder, Coupon, Offer, etc.
      type: String,
      enum: [
        'Order',
        'Payment',
        'RazorpayOrder',
        'Coupon',
        'Offer',
        'ReturnRequest',
        'AdminAction',
        'User',
        'None',
      ],
      default: 'None',
    },
    referenceId: {
      // The ID of the referenced document (string to support non-ObjectId refs, e.g., Razorpay order id)
      type: String,
      default: null,
      index: true,
    },
    notes: {
      // Human readable description to show in history UI
      type: String,
      trim: true,
      default: '',
    },
    balanceAfter: {
      // Snapshot of wallet balance after applying this transaction
      type: Number,
      required: true,
      min: [0, 'Balance cannot be negative'],
    },
    status: {
      // For async flows (e.g., top-up pending -> success)
      type: String,
      enum: ['PENDING', 'SUCCESS', 'FAILED'],
      default: 'SUCCESS',
      index: true,
    },
    metadata: {
      // Store additional info like Razorpay payment signature, coupon code, etc.
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

TransactionSchema.index({ createdAt: -1 });
TransactionSchema.index({ user: 1, createdAt: -1 });

export default mongoose.model('Transaction', TransactionSchema);
