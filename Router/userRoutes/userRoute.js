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

router.get('/auth/google/callback', 
    passport.authenticate('google', { 
        failureRedirect: '/login?error=google_blocked',
        failureMessage: true 
    }), 
    (req, res) => {
        console.log('=== GOOGLE CALLBACK DEBUG ===');
        console.log('1. User from Passport:', req.user ? 'EXISTS' : 'MISSING');
        console.log('2. Session ID:', req.sessionID);
        console.log('3. Session before save:', JSON.stringify(req.session, null, 2));
        console.log('4. Cookie settings:', req.session.cookie);
        
        try {
            if (req.user) {
                // Store user data in session
                req.session.user = {
                    _id: req.user._id,
                    name: req.user.name,
                    email: req.user.email,
                    isBlocked: req.user.isBlocked
                };
                
                console.log('5. User data set in session:', req.session.user);
                
                // Force session save
                req.session.save((err) => {
                    if (err) {
                        console.error('❌ Session save error:', err);
                        return res.redirect('/login?error=session_error');
                    }
                    console.log('✅ Session saved successfully');
                    console.log('6. Redirecting to homepage...');
                    res.redirect('/');
                });
            } else {
                console.error('❌ No user found after authentication');
                res.redirect('/login?error=google_blocked');
            }
        } catch (error) {
            console.error('❌ Google callback error:', error);
            res.redirect('/login?error=authentication_failed');
        }
    }
)

router.get('/profile',profileController.loadProfile);
router.get('/editProfile',profileController.loadEditProfile);
router.post('/editProfile',profileController.editprofile);
router.post('/uploadImage', uploadDisk.single('image') ,profileController.uploadImage);

router.post('/send-email-verification-otp', profileController.sendEmailVerificationOTP);
router.post('/verify-email-otp', profileController.verifyEmailOTP);

router.post('/change-password', profileController.changePassword);

router.get('/addresses', profileController.getAddresses);
router.post('/addresses', profileController.addAddress);
router.put('/addresses/:addressId', profileController.editAddress);
router.delete('/addresses/:addressId', profileController.deleteAddress);

router.get('/orders', orderController.loadOrders);
router.get('/order/:orderId', orderController.getOrderDetails);
router.post('/order/:orderId/cancel', orderController.cancelOrder);
router.post('/order/:orderId/item/:itemId/cancel', orderController.cancelOrderItem);
router.post('/order/:orderId/return', orderController.requestOrderReturn);
router.post('/order/:orderId/item/:itemId/return', orderController.requestItemReturn);
router.get('/order/:orderId/invoice', orderController.downloadInvoice);

router.get('/order-details/:orderId', orderController.getOrderDetails);
router.post('/cancel-order/:orderId', orderController.cancelOrder);

router.get('/cart', cartController.loadCart);
router.post('/cart/add', cartController.addToCart);
router.patch('/cart/update', cartController.updateCartQuantity);
router.delete('/cart/remove', cartController.removeFromCart);
router.delete('/cart/clear', cartController.clearCart);
router.get('/cart/count', cartController.getCartCount);

router.get('/wishlist', wishlistController.loadWishlist);
router.post('/wishlist/add', wishlistController.addToWishlist);
router.delete('/wishlist/remove', wishlistController.removeFromWishlist);
router.post('/wishlist/move-to-cart', wishlistController.moveToCart);
router.delete('/wishlist/clear', wishlistController.clearWishlist);
router.get('/wishlist/count', wishlistController.getWishlistCount);

router.get('/checkout', checkoutController.loadCheckout);
router.post('/checkout/place-order', checkoutController.placeOrder);
router.post('/checkout/add-address', checkoutController.addCheckoutAddress);
router.put('/checkout/edit-address/:addressId', checkoutController.editCheckoutAddress);
router.post('/checkout/apply-coupon', checkoutController.applyCoupon);
router.delete('/checkout/remove-coupon', checkoutController.removeCoupon);

router.get('/order-success/:orderId', checkoutController.loadOrderSuccess);
router.post('/payment/razorpay/create-order', paymentController.createRazorpayOrder);
router.post('/payment/razorpay/verify', paymentController.verifyRazorpayPayment);
router.get('/payment-failed/:orderId', paymentController.loadOrderFailure);
router.post('/payment/razorpay/retry/:orderId', paymentController.retryRazorpayOrder);

router.get('/wallet', walletController.getWalletPage);
router.get('/wallet/history', walletController.getWalletHistory);
router.post('/wallet/topup/init', walletController.postTopupInit);
router.post('/wallet/topup/verify', walletController.postTopupVerify);

router.get('/referral/data', referralController.getReferralData);
router.get('/referral-history', referralController.loadReferralHistory);
router.post('/referral/process-reward', referralController.processReferralReward);

router.use(errorHandler);
export default router;
