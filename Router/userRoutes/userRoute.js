import express from 'express';
import * as userController from '../../controllers/user/userController.js';
import * as productController from '../../controllers/user/productControler.js';
import passport from 'passport';
import { checkUserBlocked, errorHandler } from '../../middilwares/auth.js';
import * as profileController from '../../controllers/user/profileControler.js';
import * as cartController from '../../controllers/user/cartController.js';
import * as wishlistController from '../../controllers/user/wishlistController.js';
import * as checkoutController from '../../controllers/user/checkoutController.js';
import * as orderController from '../../controllers/user/orderController.js';
import * as paymentController from '../../controllers/user/paymentcontroller.js';
import * as walletController from '../../controllers/user/walletController.js';
import * as referralController from '../../controllers/user/referralController.js';
import { uploadDisk,} from '../../helpers/multer.js';

const router = express.Router();

router.use(checkUserBlocked);


router.get('/', userController.loadHomepage);
router.get('/page-not-found', userController.pageNotFound);
router.get('/register', userController.loadregisterPage);
router.post('/register', userController.registration);
router.post('/verifyOtp', userController.verifyOtp);
router.post('/resendOtp', userController.resendOtp);
router.get('/login', userController.loadLogin);
router.post('/login', userController.loginRegister);
router.get('/logout', userController.logout);
router.get('/forgot-password', userController.loadForgotPassword);
router.post('/forgot-password', userController.forgotPassword);
router.post('/verify-forgot-password-otp', userController.verifyForgotPasswordOtp);
router.post('/resend-forgot-password-otp', userController.resendForgotPasswordOtp);
router.get('/reset-password-with-otp', userController.loadResetPasswordWithOtp);
router.post('/reset-password-with-otp', userController.resetPasswordWithOtp);

router.get("/shop", productController.branding)
router.get('/product/:id', productController.getProductDetails)



router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'], prompt: 'select_account' }));
router.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/login?error=google_blocked' }), (req, res) => {
    if (req.user) {
        res.redirect('/');
    } else {
        
        res.redirect('/login?error=google_blocked');
    }
})

router.get('/profile',profileController.loadProfile);
router.get('/editProfile',profileController.loadEditProfile);
router.post('/editProfile',profileController.editprofile);
router.post('/uploadImage', uploadDisk.single('image') ,profileController.uploadImage);

// Email verification routes
router.post('/send-email-verification-otp', profileController.sendEmailVerificationOTP);
router.post('/verify-email-otp', profileController.verifyEmailOTP);

// Password management routes
router.post('/change-password', profileController.changePassword);

// Address management routes
router.get('/addresses', profileController.getAddresses);
router.post('/addresses', profileController.addAddress);
router.put('/addresses/:addressId', profileController.editAddress);
router.delete('/addresses/:addressId', profileController.deleteAddress);

// Order management routes (Enhanced)
router.get('/orders', orderController.loadOrders);
router.get('/order/:orderId', orderController.getOrderDetails);
router.post('/order/:orderId/cancel', orderController.cancelOrder);
router.post('/order/:orderId/item/:itemId/cancel', orderController.cancelOrderItem);
router.post('/order/:orderId/return', orderController.requestOrderReturn);
router.post('/order/:orderId/item/:itemId/return', orderController.requestItemReturn);
router.get('/order/:orderId/invoice', orderController.downloadInvoice);

// Legacy routes for backward compatibility
router.get('/order-details/:orderId', orderController.getOrderDetails);
router.post('/cancel-order/:orderId', orderController.cancelOrder);

// Cart management routes
router.get('/cart', cartController.loadCart);
router.post('/cart/add', cartController.addToCart);
router.post('/cart/update', cartController.updateCartQuantity);
router.post('/cart/remove', cartController.removeFromCart);
router.post('/cart/clear', cartController.clearCart);
router.get('/cart/count', cartController.getCartCount);

// Wishlist management routes
router.get('/wishlist', wishlistController.loadWishlist);
router.post('/wishlist/add', wishlistController.addToWishlist);
router.post('/wishlist/remove', wishlistController.removeFromWishlist);
router.post('/wishlist/move-to-cart', wishlistController.moveToCart);
router.post('/wishlist/clear', wishlistController.clearWishlist);
router.get('/wishlist/count', wishlistController.getWishlistCount);

// Checkout management routes
router.get('/checkout', checkoutController.loadCheckout);
router.post('/checkout/place-order', checkoutController.placeOrder);
router.post('/checkout/add-address', checkoutController.addCheckoutAddress);
router.put('/checkout/edit-address/:addressId', checkoutController.editCheckoutAddress);
router.post('/checkout/apply-coupon', checkoutController.applyCoupon);
router.post('/checkout/remove-coupon', checkoutController.removeCoupon);

// Online payment (Razorpay)
router.get('/order-success/:orderId', checkoutController.loadOrderSuccess);
router.post('/payment/razorpay/create-order', paymentController.createRazorpayOrder);
router.post('/payment/razorpay/verify', paymentController.verifyRazorpayPayment);
router.get('/payment-failed/:orderId', paymentController.loadOrderFailure);
router.post('/payment/razorpay/retry/:orderId', paymentController.retryRazorpayOrder);

// Wallet routes
router.get('/wallet', walletController.getWalletPage);
router.get('/wallet/history', walletController.getWalletHistory);
router.post('/wallet/topup/init', walletController.postTopupInit);
router.post('/wallet/topup/verify', walletController.postTopupVerify);

// Referral routes
router.get('/referral/data', referralController.getReferralData);
router.get('/referral-history', referralController.loadReferralHistory);
router.post('/referral/process-reward', referralController.processReferralReward);

router.use(errorHandler);
export default router;