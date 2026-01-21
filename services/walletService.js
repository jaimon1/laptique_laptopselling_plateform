import crypto from 'crypto';
import razorpay from '../config/razorpay.js';
import Wallet from '../models/walletSchema.js';
import Transaction from '../models/transactionSchema.js';


async function ensureWallet(userId) {
  let wallet = await Wallet.findOne({ userId });
  if (!wallet) {
    wallet = new Wallet({ userId, balance: 0, transactions: [] });
    await wallet.save();
  }
  return wallet;
}


async function getWallet(userId) {
  return ensureWallet(userId);
}


async function recordTransaction({ userId, wallet, amount, type, source, referenceModel = 'None', referenceId = null, notes = '', status = 'SUCCESS', currency = 'INR', metadata = {} }) {
  
  const isCredit = type === 'CREDIT' || type === 'REFUND' || type === 'TOPUP';
  const legacyType = isCredit ? 'Credit' : 'Debit';

  wallet.transactions.push({
    type: legacyType,
    amount,
    description: notes || `${legacyType} via ${source}`,
    orderId: referenceId || null,
    status: status === 'SUCCESS' ? 'Completed' : (status === 'PENDING' ? 'Pending' : 'Failed')
  });

  
  const tx = new Transaction({
    user: userId,
    wallet: wallet._id,
    amount,
    currency,
    type,
    source,
    referenceModel,
    referenceId,
    notes,
    balanceAfter: wallet.balance,
    status,
    metadata,
  });
  await tx.save();
  return tx;
}


async function credit(userId, amount, { source = 'ADJUSTMENT', referenceModel = 'None', referenceId = null, notes = '', metadata = {} } = {}) {
  if (!userId) throw new Error('userId is required');
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) throw new Error('Invalid amount');

  const wallet = await ensureWallet(userId);


  wallet.balance += value;

 
  const tx = await recordTransaction({
    userId,
    wallet,
    amount: value,
    type: source === 'ORDER_CANCEL_REFUND' || source === 'ORDER_RETURN_REFUND' ? 'REFUND' : 'CREDIT',
    source,
    referenceModel,
    referenceId,
    notes,
    status: 'SUCCESS',
    metadata,
  });

  await wallet.save();
  return { wallet, tx };
}


async function debit(userId, amount, { source = 'ORDER_PAYMENT', referenceModel = 'None', referenceId = null, notes = '', metadata = {} } = {}) {
  if (!userId) throw new Error('userId is required');
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) throw new Error('Invalid amount');

  const wallet = await ensureWallet(userId);
  if (wallet.balance < value) throw new Error('Insufficient wallet balance');

 
  wallet.balance -= value;


  const tx = await recordTransaction({
    userId,
    wallet,
    amount: value,
    type: 'DEBIT',
    source,
    referenceModel,
    referenceId,
    notes,
    status: 'SUCCESS',
    metadata,
  });

  await wallet.save();
  return { wallet, tx };
}


async function getTransactions(userId, { type, source, from, to, page = 1, limit = 10 } = {}) {
  const query = { user: userId };
  if (type) query.type = type; 
  if (source) query.source = source;

  if (from || to) {
    query.createdAt = {};
    if (from) query.createdAt.$gte = new Date(from);
    if (to) query.createdAt.$lte = new Date(to);
  }

  const skip = (Math.max(1, parseInt(page)) - 1) * Math.max(1, parseInt(limit));
  const [items, total] = await Promise.all([
    Transaction.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Transaction.countDocuments(query),
  ]);

  return { items, total, page: parseInt(page), pages: Math.ceil(total / limit) };
}


async function createTopupOrder(userId, amount) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value < 1) throw new Error('Top-up amount must be at least ₹1');

  const rpOrder = await razorpay.orders.create({
    amount: Math.round(value * 100),
    currency: 'INR',
    receipt: `WLT-${String(userId).slice(-6)}-${Date.now()}`,
    notes: { user_id: String(userId), purpose: 'WALLET_TOPUP' },
  });

  return rpOrder; 
}


async function verifyTopupPayment({ userId, razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
  if (!userId) throw new Error('Unauthorized');

  if (!razorpay_order_id) throw new Error('Missing Razorpay order ID');
  if (!razorpay_payment_id) throw new Error('Missing Razorpay payment ID');
  if (!razorpay_signature) throw new Error('Missing Razorpay signature');

  if (!process.env.RAZORPAY_KEY_SECRET) {
    throw new Error('Payment gateway configuration error');
  }

  const text = `${razorpay_order_id}|${razorpay_payment_id}`;
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(text)
    .digest('hex');

  console.log('Signature verification:', {
    expected: expected.substring(0, 10) + '...',
    received: razorpay_signature.substring(0, 10) + '...',
    match: expected === razorpay_signature
  });

  if (expected !== razorpay_signature) {
    throw new Error('Invalid payment signature - payment verification failed');
  }

  return { ok: true };
}


async function finalizeTopup(userId, amount, { razorpayOrderId, razorpayPaymentId }) {
  const { wallet, tx } = await credit(userId, Number(amount), {
    source: 'WALLET_TOPUP_RAZORPAY',
    referenceModel: 'RazorpayOrder',
    referenceId: razorpayOrderId,
    notes: 'Wallet top-up via Razorpay',
    metadata: { razorpayPaymentId },
  });
  return { wallet, tx };
}

export {
  ensureWallet,
  getWallet,
  credit,
  debit,
  getTransactions,
  createTopupOrder,
  verifyTopupPayment,
  finalizeTopup,
};
