import * as walletService from '../../services/walletService.js';
import { HTTP_STATUS, ERROR_MESSAGES, SUCCESS_MESSAGES } from '../../constants/index.js';

// Render wallet page with balance and recent transactions
async function getWalletPage(req, res) {
  try {
    const user = req.session.user || req.user;
    const userId = user?._id;
    if (!userId) return res.redirect('/login');

    const wallet = await walletService.getWallet(userId);
    const { items: transactions } = await walletService.getTransactions(userId, { page: 1, limit: 5 });

    return res.render('wallet', {
      user,
      wallet,
      transactions,
      title: 'My Wallet',
    });
  } catch (err) {
    console.error('Error loading wallet page:', err);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).render('pageNotFound');
  }
}

// Render full wallet transaction history with filters
async function getWalletHistory(req, res) {
  try {
    const user = req.session.user || req.user;
    const userId = user?._id;
    if (!userId) return res.redirect('/login');

    const { type, source, from, to } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = 10;

    const wallet = await walletService.getWallet(userId);
    const result = await walletService.getTransactions(userId, { type, source, from, to, page, limit });

    // Check if AJAX request
    const isAjax = req.xhr || 
                   (req.headers.accept && req.headers.accept.indexOf('json') > -1) || 
                   req.headers['x-requested-with'] === 'XMLHttpRequest';

    if (isAjax) {
      return res.json({
        success: true,
        transactions: result.items,
        currentPage: result.page,
        totalPages: result.pages,
        total: result.total,
        hasNextPage: result.page < result.pages,
        hasPrevPage: result.page > 1
      });
    }

    return res.render('walletHistory', {
      user,
      wallet,
      type: type || '',
      source: source || '',
      from: from || '',
      to: to || '',
      transactions: result.items,
      currentPage: result.page,
      totalPages: result.pages,
      total: result.total,
      title: 'Wallet History',
    });
  } catch (err) {
    console.error('Error loading wallet history:', err);
    
    const isAjax = req.xhr || 
                   (req.headers.accept && req.headers.accept.indexOf('json') > -1) || 
                   req.headers['x-requested-with'] === 'XMLHttpRequest';
    
    if (isAjax) {
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ 
        success: false, 
        message: ERROR_MESSAGES.SERVER.INTERNAL_ERROR
      });
    }
    
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).render('pageNotFound');
  }
}

// Initiate Razorpay top-up order
async function postTopupInit(req, res) {
  try {
    const userId = (req.session.user?._id || req.user?._id);
    if (!userId) return res.status(HTTP_STATUS.UNAUTHORIZED).json({ 
      success: false, 
      message: ERROR_MESSAGES.AUTH.LOGIN_REQUIRED
    });

    const { amount } = req.body;
    const value = Number(amount);
    if (!Number.isFinite(value) || value < 1) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
        success: false, 
        message: ERROR_MESSAGES.VALIDATION.INVALID_INPUT
      });
    }

    const rpOrder = await walletService.createTopupOrder(userId, value);

    // Persist mapping in session to protect amount tampering
    req.session.walletTopup = { orderId: rpOrder.id, amount: value };

    return res.json({
      success: true,
      keyId: process.env.RAZORPAY_KEY_ID,
      razorpayOrderId: rpOrder.id,
      amount: rpOrder.amount, // paise
      currency: rpOrder.currency,
      receipt: rpOrder.receipt,
    });
  } catch (err) {
    console.error('Error initiating wallet top-up:', err);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ 
      success: false, 
      message: ERROR_MESSAGES.PAYMENT.FAILED
    });
  }
}

// Verify Razorpay top-up and credit wallet
async function postTopupVerify(req, res) {
  try {
    const userId = (req.session.user?._id || req.user?._id);
    if (!userId) {
      console.error('Wallet top-up verify: User not authenticated');
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({ 
        success: false, 
        message: ERROR_MESSAGES.AUTH.LOGIN_REQUIRED
      });
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    console.log('Wallet top-up verification started:', {
      userId,
      razorpay_order_id,
      razorpay_payment_id,
      hasSignature: !!razorpay_signature
    });

    // Validate payment signature
    try {
      const validation = await walletService.verifyTopupPayment({ 
        userId, 
        razorpay_order_id, 
        razorpay_payment_id, 
        razorpay_signature 
      });
      
      if (!validation.ok) {
        console.error('Wallet top-up: Payment signature validation failed');
        return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
          success: false, 
          message: ERROR_MESSAGES.PAYMENT.TRANSACTION_FAILED
        });
      }
    } catch (verifyError) {
      console.error('Wallet top-up: Signature verification error:', verifyError.message);
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
        success: false, 
        message: ERROR_MESSAGES.PAYMENT.TRANSACTION_FAILED
      });
    }
    
    // Retrieve expected amount from session
    const sessionTopup = req.session.walletTopup;
    console.log('Session topup data:', sessionTopup);
    
    if (!sessionTopup || sessionTopup.orderId !== razorpay_order_id) {
      console.error('Wallet top-up: Session mismatch or expired', {
        hasSession: !!sessionTopup,
        sessionOrderId: sessionTopup?.orderId,
        razorpayOrderId: razorpay_order_id
      });
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
        success: false, 
        message: ERROR_MESSAGES.AUTH.SESSION_EXPIRED
      });
    }
    
    const amountInINR = Number(sessionTopup.amount);
    console.log('Finalizing top-up with amount:', amountInINR);
    
    const { wallet } = await walletService.finalizeTopup(userId, amountInINR, {
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
    });

    // Clear session to prevent replay
    delete req.session.walletTopup;

    console.log('Wallet top-up successful. New balance:', wallet.balance);
    return res.status(HTTP_STATUS.OK).json({ 
      success: true, 
      balance: wallet.balance, 
      message: SUCCESS_MESSAGES.PAYMENT.SUCCESS
    });
  } catch (err) {
    console.error('Error verifying wallet top-up:', err);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ 
      success: false, 
      message: ERROR_MESSAGES.PAYMENT.TRANSACTION_FAILED
    });
  }
}

export {
  getWalletPage,
  getWalletHistory,
  postTopupInit,
  postTopupVerify,
};
