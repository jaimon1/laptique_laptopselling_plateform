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
      required: false, 
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
      
      type: String,
      enum: [
        'ORDER_PAYMENT', 
        'ORDER_CANCEL_REFUND', 
        'ORDER_RETURN_REFUND', 
        'WALLET_TOPUP_RAZORPAY', 
        'REFERRAL_REWARD', 
        'ADJUSTMENT', 
        'COUPON_DISCOUNT', 
        'OFFER_DISCOUNT', 
      ],
      default: 'ADJUSTMENT',
      index: true,
    },
    referenceModel: {
      
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
      
      type: String,
      default: null,
      index: true,
    },
    notes: {
      
      type: String,
      trim: true,
      default: '',
    },
    balanceAfter: {
      
      type: Number,
      required: true,
      min: [0, 'Balance cannot be negative'],
    },
    status: {
      
      type: String,
      enum: ['PENDING', 'SUCCESS', 'FAILED'],
      default: 'SUCCESS',
      index: true,
    },
    metadata: {
      
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

TransactionSchema.index({ createdAt: -1 });
TransactionSchema.index({ user: 1, createdAt: -1 });

export default mongoose.model('Transaction', TransactionSchema);
