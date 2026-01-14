import crypto from 'crypto';
import razorpay from '../../config/razorpay.js';
import Cart from '../../models/cartSchema.js';
import Product from '../../models/productSchema.js';
import Address from '../../models/addressSchema.js';
import Order from '../../models/orderSchema.js';
import Coupon from '../../models/couponSchema.js';
import User from '../../models/userSchema.js';
import { HTTP_STATUS, ERROR_MESSAGES, SUCCESS_MESSAGES } from '../../constants/index.js';

// Helper function to process referral rewards
async function processReferralReward(userId) {
    
    try {
        const user = await User.findById(userId);
        
        if (!user || !user.referredBy) {
            return;
        }

        // Check if this is user's first order
        const orderCount = await Order.countDocuments({ userId });
        
        if (orderCount !== 1) {
            return;
        }

        const referrer = await User.findById(user.referredBy);
       
        if (!referrer) {
            return;
        }

        // Check if reward already given
        const referralEntry = referrer.referrals.find(
            ref => ref.userId.toString() === userId.toString()
        );

        if (referralEntry && referralEntry.rewardGiven) {
            return;
        }
 
        // Import wallet service
        const walletService = await import('../../services/walletService.js');
        
        // Credit ₹100 to referrer's wallet
        const rewardAmount = 100;
        await walletService.credit(referrer._id, rewardAmount, {
            source: 'REFERRAL_REWARD',
            referenceModel: 'User',
            referenceId: userId.toString(),
            notes: `Referral reward for inviting ${user.name}`,
            metadata: {
                referredUserName: user.name,
                referredUserEmail: user.email
            }
        });
        

        // Update referral entry to mark reward as given
        await User.findOneAndUpdate(
            { _id: referrer._id, 'referrals.userId': userId },
            { $set: { 'referrals.$.rewardGiven': true } },
            { new: true }
        );

    } catch (error) {
        console.error('Error stack:', error.stack);
    }
}

// Create Razorpay order and create a pending Order document
const createRazorpayOrder = async (req, res) => {
    try {
        const userId = req.session.user?._id || req.user?._id;
        const { addressId, couponCode } = req.body;

        if (!userId) {
            return res.status(HTTP_STATUS.UNAUTHORIZED).json({ 
                success: false, 
                message: ERROR_MESSAGES.AUTH.LOGIN_REQUIRED
            });
        }

        if (!addressId) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
                success: false, 
                message: ERROR_MESSAGES.ADDRESS.REQUIRED
            });
        }

        // Fetch cart with product and variant details
        const cart = await Cart.findOne({ userId }).populate({
            path: 'items.productId',
            populate: [{ path: 'category' }, { path: 'brand' }]
        });
        if (!cart || cart.items.length === 0) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
                success: false, 
                message: ERROR_MESSAGES.CART.EMPTY
            });
        }

        // Validate address
        const userAddresses = await Address.findOne({ userId });
        if (!userAddresses) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
                success: false, 
                message: ERROR_MESSAGES.ADDRESS.NOT_FOUND
            });
        }
        const selectedAddress = userAddresses.address.id(addressId);
        if (!selectedAddress) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
                success: false, 
                message: ERROR_MESSAGES.ADDRESS.NOT_FOUND
            });
        }

        // Build order items and calculate totals
        let orderItems = [];
        let subtotal = 0;
        let stockErrors = [];

        for (const item of cart.items) {
            const product = item.productId;

            // Check if product is available
            if (!product || product.isBlocked || !product.category?.isListed || product.status === 'Discontinued') {
                stockErrors.push(`${product?.productName || 'Product'} is no longer available`);
                continue;
            }

            const variant = product.variants.find(v => v.storage === item.variantId);
            if (!variant) {
                stockErrors.push(`Selected variant for ${product.productName} is not available`);
                continue;
            }

            if (variant.quantity < item.quantity) {
                stockErrors.push(`Insufficient stock for ${product.productName}. Only ${variant.quantity} available.`);
                continue;
            }

            const itemTotal = item.quantity * variant.salePrice;
            subtotal += itemTotal;

            orderItems.push({
                product: product._id,
                quantity: item.quantity,
                price: variant.salePrice,
                variant: {
                    storage: variant.storage,
                    color: variant.color || 'Default'
                }
            });
        }

        if (stockErrors.length > 0) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
                success: false, 
                message: stockErrors.join(', ') 
            });
        }
        if (orderItems.length === 0) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
                success: false, 
                message: ERROR_MESSAGES.CART.EMPTY
            });
        }

        // Apply coupon if eligible
        let discount = 0;
        let couponDetails = null;
        if (couponCode) {
            const coupon = await Coupon.findOne({
                name: couponCode.toUpperCase(),
                isActive: true,
                expireOn: { $gt: new Date() }
            });
            if (coupon && subtotal >= coupon.minimumPrice) {
                // Check if user already used this coupon (ONE TIME PER USER)
                const userUsed = coupon.usersUsed.find(u => u.userId.toString() === userId.toString());

                if (!userUsed || userUsed.count === 0) {
                    // Check if coupon usage limit reached (total users)
                    const totalUsedCount = coupon.usersUsed.filter(u => u.count > 0).length;

                    if (totalUsedCount < coupon.usageLimit) {
                        // Calculate discount
                        if (coupon.discountType === 'percentage') {
                            discount = Math.round((subtotal * coupon.discountValue) / 100);
                        } else {
                            discount = coupon.discountValue;
                        }

                        discount = Math.min(discount, subtotal);
                        couponDetails = { code: couponCode.toUpperCase(), discount };
                    }
                }
            }
        }

        const discountedSubtotal = subtotal - discount;
        const tax = Math.round(discountedSubtotal * 0.18);
        const shippingFee = discountedSubtotal >= 500 ? 0 : 50;
        const finalAmount = discountedSubtotal + tax + shippingFee; // in INR

        // Calculate effective prices for items (for refund tracking)
        const { calculateItemEffectivePrices } = await import('../../services/refundService.js');
        const itemsWithEffectivePrices = calculateItemEffectivePrices(orderItems, discount, tax, shippingFee);

        // Create a pending order (do NOT deduct stock yet)
        const order = new Order({
            userId,
            orderItems: itemsWithEffectivePrices,
            totalPrice: subtotal,
            discount,
            finalAmount: finalAmount.toString(),
            totalRefunded: 0,
            address: {
                name: selectedAddress.name,
                phone: selectedAddress.phone,
                altPhone: selectedAddress.altPhone,
                addressType: selectedAddress.addressType,
                city: selectedAddress.city,
                landmark: selectedAddress.landmark,
                state: selectedAddress.state
            },
            paymentMethod: 'Online',
            paymentStatus: 'Pending',
            status: 'Pending',
            invoiceDate: new Date(),
            couponApplied: discount > 0,
            couponDetails,
            tax,
            shippingFee,
            statusHistory: [{
                status: 'Pending',
                updatedBy: userId,
                note: 'Order created for online payment'
            }]
        });
        await order.save();

        // Create Razorpay order (amount in paise)
        const rpOrder = await razorpay.orders.create({
            amount: finalAmount * 100,
            currency: 'INR',
            receipt: order.orderId,
            notes: {
                order_id: order._id.toString(),
                user_id: userId.toString()
            }
        });

        return res.json({
            success: true,
            keyId: process.env.RAZORPAY_KEY_ID,
            razorpayOrderId: rpOrder.id,
            amount: rpOrder.amount,
            currency: rpOrder.currency,
            receipt: rpOrder.receipt,
            orderId: order._id,
            orderNumber: order.orderId
        });
    } catch (error) {
        console.error('Error creating Razorpay order:', error);
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ 
            success: false, 
            message: ERROR_MESSAGES.PAYMENT.FAILED
        });
    }
};

// Verify Razorpay payment signature and finalize order
const verifyRazorpayPayment = async (req, res) => {
    try {
        const userId = req.session.user?._id || req.user?._id;
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;

        if (!userId) {
            return res.status(HTTP_STATUS.UNAUTHORIZED).json({ 
                success: false, 
                message: ERROR_MESSAGES.AUTH.LOGIN_REQUIRED
            });
        }

        const order = await Order.findOne({ _id: orderId, userId });
        if (!order) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({ 
                success: false, 
                message: ERROR_MESSAGES.ORDER.NOT_FOUND
            });
        }

        if (order.paymentStatus === 'Completed') {
            return res.json({ success: true, redirectUrl: `/order-success/${order._id}` });
        }

        // Verify signature
        const generated_signature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest('hex');

        if (generated_signature === razorpay_signature) {
            // Payment success: update order, decrement stock, clear cart
            order.paymentStatus = 'Completed';
            order.paymentMethod = 'Online';
            order.status = 'Processing';
            order.statusHistory.push({
                status: 'Processing',
                updatedBy: userId,
                note: 'Payment completed via Razorpay'
            });
            await order.save();

            // Update coupon usage if coupon was applied
            if (order.couponApplied && order.couponDetails?.code) {
                const coupon = await Coupon.findOne({ name: order.couponDetails.code.toUpperCase() });
                if (coupon) {
                    const userUsedIndex = coupon.usersUsed.findIndex(u => u.userId.toString() === userId.toString());
                    if (userUsedIndex !== -1) {
                        // User exists, increment count
                        coupon.usersUsed[userUsedIndex].count += 1;
                    } else {
                        // Add new user
                        coupon.usersUsed.push({ userId, count: 1 });
                    }
                    await coupon.save();
                }
            }

            // Decrement product stock for each item
            for (const item of order.orderItems) {
                const product = await Product.findById(item.product);
                if (!product) continue;
                const variantIndex = product.variants.findIndex(v => v.storage === item.variant.storage);
                if (variantIndex !== -1) {
                    product.variants[variantIndex].quantity = Math.max(0, product.variants[variantIndex].quantity - item.quantity);
                    await product.save();
                }
            }

            // Clear user's cart
            await Cart.findOneAndUpdate({ userId }, { $set: { items: [] } });

            // Process referral reward if this is user's first order
            await processReferralReward(userId);

            return res.json({ success: true, redirectUrl: `/order-success/${order._id}` });
        } else {
            // Payment failed/invalid signature - mark as failed
            order.paymentStatus = 'Failed';
            order.status = 'Failed';
            order.statusHistory.push({
                status: 'Failed',
                updatedBy: userId,
                note: 'Payment verification failed'
            });
            await order.save();

            return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
                success: false, 
                redirectUrl: `/payment-failed/${order._id}` 
            });
        }
    } catch (error) {
        console.error('Error verifying Razorpay payment:', error);
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ 
            success: false, 
            message: ERROR_MESSAGES.PAYMENT.TRANSACTION_FAILED
        });
    }
};

// Load order failure page with retry option
const loadOrderFailure = async (req, res) => {
    try {
        const { orderId } = req.params;
        const userId = req.session.user?._id || req.user?._id;

        if (!userId) return res.redirect('/login');

        const order = await Order.findOne({ _id: orderId, userId }).populate('orderItems.product');
        if (!order) return res.redirect('/orders');

        return res.render('orderFailure', {
            user: req.session.user || req.user,
            order,
            title: 'Payment Failed'
        });
    } catch (error) {
        console.error('Error loading order failure page:', error);
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).render('pageNotFound');
    }
};

// Retry payment: create a new Razorpay order for an existing order (not completed)
const retryRazorpayOrder = async (req, res) => {
    try {
        const userId = req.session.user?._id || req.user?._id;
        const { orderId } = req.params;

        if (!userId) {
            return res.status(HTTP_STATUS.UNAUTHORIZED).json({ 
                success: false, 
                message: ERROR_MESSAGES.AUTH.LOGIN_REQUIRED
            });
        }

        const order = await Order.findOne({ _id: orderId, userId });

        if (!order) {
            console.error(' Order not found');
            return res.status(HTTP_STATUS.NOT_FOUND).json({ 
                success: false, 
                message: ERROR_MESSAGES.ORDER.NOT_FOUND
            });
        }
        if (order.paymentStatus === 'Completed') {
            console.log('Order already paid');
            return res.json({ success: true, redirectUrl: `/order-success/${order._id}` });
        }

        // Validate stock

        for (const item of order.orderItems) {
            const product = await Product.findById(item.product);
            if (!product) {

                return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
                    success: false, 
                    message: ERROR_MESSAGES.PRODUCT.NOT_FOUND
                });
            }

            const variant = product.variants.find(v => v.storage === item.variant.storage);
            if (!variant) {

                return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
                    success: false, 
                    message: ERROR_MESSAGES.PRODUCT.NOT_FOUND
                });
            }

            if (variant.quantity < item.quantity) {

                return res.status(HTTP_STATUS.BAD_REQUEST).json({
                    success: false,
                    message: ERROR_MESSAGES.PRODUCT.INSUFFICIENT_STOCK
                });
            }
        }

        // Create Razorpay order
        const amount = Math.round(parseFloat(order.finalAmount) * 100);

        if (!razorpay) {
            return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ 
                success: false, 
                message: ERROR_MESSAGES.PAYMENT.FAILED
            });
        }

        let rpOrder;
        try {
            rpOrder = await razorpay.orders.create({
                amount: amount,
                currency: 'INR',
                receipt: `${order.orderId}-R-${Date.now().toString().slice(-6)}`,
                notes: {
                    order_id: order._id.toString(),
                    user_id: userId.toString(),
                    retry: 'true'
                }
            });
           
        } catch (rzpError) {
            console.error('Razorpay Error Details:', rzpError.error || rzpError.message);
            return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: ERROR_MESSAGES.PAYMENT.FAILED
            });
        }

        console.log('=== RETRY PAYMENT SUCCESS ===');
        return res.json({
            success: true,
            keyId: process.env.RAZORPAY_KEY_ID,
            razorpayOrderId: rpOrder.id,
            amount: rpOrder.amount,
            currency: rpOrder.currency,
            receipt: rpOrder.receipt,
            orderId: order._id,
            orderNumber: order.orderId
        });

    } catch (error) {
        console.error('=== RETRY PAYMENT FAILED ===');
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: ERROR_MESSAGES.PAYMENT.FAILED
        });
    }
};

export {
    createRazorpayOrder,
    verifyRazorpayPayment,
    loadOrderFailure,
    retryRazorpayOrder
};
