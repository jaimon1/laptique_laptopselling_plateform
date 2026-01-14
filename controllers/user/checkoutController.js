import Cart from '../../models/cartSchema.js';
import Product from '../../models/productSchema.js';
import Address from '../../models/addressSchema.js';
import Order from '../../models/orderSchema.js';
import Coupon from '../../models/couponSchema.js';
import User from '../../models/userSchema.js';
import { HTTP_STATUS, ERROR_MESSAGES, SUCCESS_MESSAGES } from '../../constants/index.js';


async function processReferralReward(userId) {
    try {
        const user = await User.findById(userId);
        
        if (!user || !user.referredBy) {
            return;
        }

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

const loadCheckout = async (req, res) => {
    try {
        const userId = req.session.user?._id || req.user?._id;

        const cart = await Cart.findOne({ userId }).populate({
            path: 'items.productId',
            populate: [
                { path: 'category' },
                { path: 'brand' }
            ]
        });

        if (!cart || cart.items.length === 0) {
            return res.redirect('/cart');
        }

        const validItems = cart.items.filter(item => {
            const product = item.productId;
            return product &&
                !product.isBlocked &&
                product.category &&
                product.category.isListed &&
                product.status !== 'Discontinued';
        });

        if (validItems.length === 0) {
            return res.redirect('/cart');
        }


        let cartItems = [];
        let subtotal = 0;
        let totalItems = 0;

        for (const item of validItems) {
            const product = item.productId;
            const variant = product.variants.find(v => v.storage === item.variantId) || product.variants[0];

            if (variant.quantity < item.quantity) {
                req.session.checkoutError = `Insufficient stock for ${product.productName}. Only ${variant.quantity} available.`;
                return res.redirect('/cart');
            }

            const itemTotal = item.quantity * variant.salePrice;
            subtotal += itemTotal;
            totalItems += item.quantity;

            cartItems.push({
                ...item.toObject(),
                variant,
                itemTotal,
                product: product
            });
        }

  
        const userAddresses = await Address.findOne({ userId });
        const addresses = userAddresses ? userAddresses.address : [];


        const defaultAddress = addresses.find(addr => addr.isDefault) || addresses[0];

        
        const taxRate = 0.18; 
        const tax = Math.round(subtotal * taxRate);
        const shippingFee = subtotal >= 500 ? 0 : 50;
        const total = subtotal + tax + shippingFee;

        const availableCoupons = await Coupon.find({
            isActive: true,
            expireOn: { $gt: new Date() },
            minimumPrice: { $lte: subtotal }
        }).select('name description discountType discountValue minimumPrice expireOn');



        res.render('checkout', {
            user: req.session.user || req.user,
            cartItems,
            addresses,
            defaultAddress,
            subtotal,
            tax,
            shippingFee,
            total,
            totalItems,
            availableCoupons,
            checkoutError: req.session.checkoutError || null,
            title: 'Checkout'
        });

        delete req.session.checkoutError;

    } catch (error) {
        console.error('Error loading checkout:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).render('pageNotFound');
    }
};



// Place order
const placeOrder = async (req, res) => {
    try {
        const userId = req.session.user?._id || req.user?._id;
        const { addressId, paymentMethod, couponCode } = req.body;

        if (!userId) {
            return res.status(HTTP_STATUS.UNAUTHORIZED).json({
                success: false,
                message: ERROR_MESSAGES.AUTH.LOGIN_REQUIRED
            });
        }

        if (!addressId || !paymentMethod) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: ERROR_MESSAGES.VALIDATION.REQUIRED_FIELDS
            });
        }

        const normalizedPaymentMethod = paymentMethod && paymentMethod.toUpperCase();
        if (!['COD', 'WALLET'].includes(normalizedPaymentMethod)) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: ERROR_MESSAGES.PAYMENT.INVALID_METHOD
            });
        }

        // Get cart
        const cart = await Cart.findOne({ userId }).populate({
            path: 'items.productId',
            populate: [
                { path: 'category' },
                { path: 'brand' }
            ]
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

        let orderItems = [];
        let subtotal = 0;
        let stockErrors = [];

        for (const item of cart.items) {
            const product = item.productId;

            // Check if product is still available
            if (product.isBlocked || !product.category.isListed || product.status === 'Discontinued') {
                stockErrors.push(`${product.productName} is no longer available`);
                continue;
            }

            const variant = product.variants.find(v => v.storage === item.variantId);
            if (!variant) {
                stockErrors.push(`Selected variant for ${product.productName} is not available`);
                continue;
            }

            // Check stock
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

        // Block COD for orders above Rs 1000
        if (normalizedPaymentMethod === 'COD' && subtotal > 1000) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: ERROR_MESSAGES.PAYMENT.INVALID_METHOD
            });
        }

        let discount = 0;
        let couponDetails = null;

        if (couponCode) {
            const coupon = await Coupon.findOne({
                name: couponCode.toUpperCase(),
                isActive: true,
                expireOn: { $gt: new Date() }
            });

            if (coupon && subtotal >= coupon.minimumPrice) {
                
                let canUseCoupon = true;
                if (coupon.usersUsed.length > 0 && coupon.usersUsed[0].count === 0) {
                    
                    const assignedUser = coupon.usersUsed.find(u => u.userId.toString() === userId.toString());
                    if (!assignedUser) {
                        canUseCoupon = false;
                    }
                }

                if (canUseCoupon) {
                   
                    const userUsed = coupon.usersUsed.find(u => u.userId.toString() === userId.toString());
                    
                    if (!userUsed || userUsed.count === 0) {
                        
                        const totalUsedCount = coupon.usersUsed.filter(u => u.count > 0).length;
                        
                        if (totalUsedCount < coupon.usageLimit) {
                           
                            if (coupon.discountType === 'percentage') {
                                discount = Math.round((subtotal * coupon.discountValue) / 100);
                            } else {
                                discount = coupon.discountValue;
                            }
                            
                            discount = Math.min(discount, subtotal);
                            
                            couponDetails = {
                                code: couponCode.toUpperCase(),
                                discount: discount
                            };
                        }
                    }
                }
            }
        }


        const discountedSubtotal = subtotal - discount;
        const tax = Math.round(discountedSubtotal * 0.18);
        const shippingFee = discountedSubtotal >= 500 ? 0 : 50;
        const finalAmount = discountedSubtotal + tax + shippingFee;

        if (normalizedPaymentMethod === 'COD') {
            // Calculate effective prices for items (for refund tracking)
            const { calculateItemEffectivePrices } = await import('../../services/refundService.js');
            const itemsWithEffectivePrices = calculateItemEffectivePrices(orderItems, discount, tax, shippingFee);
            
            // Create order for COD
            console.log('=== Creating COD Order ===');
            console.log('User ID:', userId);
            console.log('Order Items:', orderItems);
            console.log('Final Amount:', finalAmount);
            
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
                paymentMethod: 'COD',
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
                    note: 'Order placed successfully'
                }]
            });
            
            await order.save();
            console.log('Order saved successfully:', order._id, 'Order ID:', order.orderId);
            console.log('========================');

            // Update coupon usage if coupon was applied
            if (couponCode && discount > 0) {
                const coupon = await Coupon.findOne({ name: couponCode.toUpperCase() });
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
                    console.log('Coupon usage updated for user:', userId);
                }
            }

            // Update product stock immediately for COD to reserve items
            for (const item of orderItems) {
                const product = await Product.findById(item.product);
                if (!product) {
                    console.log('Product not found:', item.product);
                    continue;
                }
                const variantIndex = product.variants.findIndex(v => v.storage === item.variant.storage);
                if (variantIndex !== -1) {
                    product.variants[variantIndex].quantity -= item.quantity;
                    await product.save();
                    console.log('Stock updated for product:', product.productName);
                }
            }

            // Clear cart
            await Cart.findOneAndUpdate({ userId }, { $set: { items: [] } });

            // Process referral reward if this is user's first order
            await processReferralReward(userId);

            return res.status(HTTP_STATUS.OK).json({ 
                success: true, 
                message: SUCCESS_MESSAGES.ORDER.CREATED, 
                orderId: order._id 
            });
        }

        if (normalizedPaymentMethod === 'WALLET') {
            // Import wallet service and refund service
            const walletService = await import('../../services/walletService.js');
            const { calculateItemEffectivePrices } = await import('../../services/refundService.js');
            
            // Get wallet and check balance
            const wallet = await walletService.getWallet(userId);
            const needAmount = finalAmount;
            
            if (wallet.balance < needAmount) {
                return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
                    success: false, 
                    message: `Insufficient wallet balance. Available: ₹${wallet.balance}, Required: ₹${needAmount}` 
                });
            }

            // Calculate effective prices for items (for accurate refund tracking with tax and coupon distribution)
            const itemsWithEffectivePrices = calculateItemEffectivePrices(orderItems, discount, tax, shippingFee);

            const order = new Order({
                userId,
                orderItems: itemsWithEffectivePrices,
                totalPrice: subtotal,
                discount,
                finalAmount: finalAmount.toString(),
                address: {
                    name: selectedAddress.name,
                    phone: selectedAddress.phone,
                    altPhone: selectedAddress.altPhone,
                    addressType: selectedAddress.addressType,
                    city: selectedAddress.city,
                    landmark: selectedAddress.landmark,
                    state: selectedAddress.state
                },
                paymentMethod: 'Wallet',
                paymentStatus: 'Completed',
                status: 'Processing',
                invoiceDate: new Date(),
                couponApplied: discount > 0,
                couponDetails,
                tax,
                shippingFee,
                totalRefunded: 0,
                statusHistory: [{
                    status: 'Processing',
                    updatedBy: userId,
                    note: 'Wallet payment received'
                }]
            });
            await order.save();

            // Deduct from wallet using wallet service (creates proper Transaction record)
            try {
                await walletService.debit(userId, needAmount, {
                    source: 'ORDER_PAYMENT',
                    referenceModel: 'Order',
                    referenceId: order._id,
                    notes: `Payment for order ${order.orderId}`
                });
                console.log(`✅ Wallet debited: ₹${needAmount} for order ${order.orderId}`);
            } catch (walletError) {
                console.error('❌ Error debiting wallet:', walletError);
                // Rollback: delete the order
                await Order.findByIdAndDelete(order._id);
                return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ 
                    success: false, 
                    message: ERROR_MESSAGES.PAYMENT.FAILED
                });
            }

            // Update coupon usage if coupon was applied
            if (couponCode && discount > 0) {
                const coupon = await Coupon.findOne({ name: couponCode.toUpperCase() });
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

            // Decrement stock
            for (const item of orderItems) {
                const product = await Product.findById(item.product);
                if (!product) continue;
                const variantIndex = product.variants.findIndex(v => v.storage === item.variant.storage);
                if (variantIndex !== -1) {
                    product.variants[variantIndex].quantity -= item.quantity;
                    await product.save();
                }
            }

            // Clear cart
            await Cart.findOneAndUpdate({ userId }, { $set: { items: [] } });

            // Process referral reward if this is user's first order
            await processReferralReward(userId);

            return res.status(HTTP_STATUS.OK).json({ 
                success: true, 
                message: SUCCESS_MESSAGES.ORDER.CREATED, 
                orderId: order._id 
            });
        }

    } catch (error) {
        console.error('Error placing order:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: ERROR_MESSAGES.ORDER.CREATE_FAILED
        });
    }
};

// Load order success page
const loadOrderSuccess = async (req, res) => {
    try {
        const { orderId } = req.params;
        const userId = req.session.user?._id || req.user?._id;

        if (!userId) {
            return res.redirect('/login');
        }

        // Get order details
        const order = await Order.findOne({
            _id: orderId,
            userId
        }).populate('orderItems.product');

        if (!order) {
            return res.redirect('/');
        }

        res.render('orderSuccess', {
            user: req.session.user || req.user,
            order,
            title: 'Order Placed Successfully'
        });

    } catch (error) {
        console.error('Error loading order success:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).render('pageNotFound');
    }
};

// Add new address during checkout
const addCheckoutAddress = async (req, res) => {
    try {
        const userId = req.session.user?._id || req.user?._id;

        if (!userId) {
            return res.status(HTTP_STATUS.UNAUTHORIZED).json({
                success: false,
                message: ERROR_MESSAGES.AUTH.LOGIN_REQUIRED
            });
        }

        const { name, phone, altPhone, addressType, city, landmark, state, isDefault } = req.body;

        // Validate required fields
        if (!name || !phone || !addressType || !city || !landmark || !state) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: ERROR_MESSAGES.VALIDATION.REQUIRED_FIELDS
            });
        }

        // Find or create address document
        let userAddresses = await Address.findOne({ userId });
        if (!userAddresses) {
            userAddresses = new Address({ userId, address: [] });
        }

        // If this is set as default or it's the first address, remove default from other addresses
        const shouldBeDefault = isDefault || userAddresses.address.length === 0;

        if (shouldBeDefault) {
            userAddresses.address.forEach(addr => {
                addr.isDefault = false;
            });
        }

        // Add new address
        const newAddress = {
            name,
            phone,
            altPhone: altPhone || phone,
            addressType,
            city,
            landmark,
            state,
            isDefault: shouldBeDefault
        };

        userAddresses.address.push(newAddress);
        await userAddresses.save();

        // Get the newly added address
        const addedAddress = userAddresses.address[userAddresses.address.length - 1];

        res.status(HTTP_STATUS.CREATED).json({
            success: true,
            message: SUCCESS_MESSAGES.ADDRESS.ADDED,
            address: addedAddress
        });

    } catch (error) {
        console.error('Error adding checkout address:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: ERROR_MESSAGES.ADDRESS.CREATE_FAILED
        });
    }
};

// Edit address during checkout
const editCheckoutAddress = async (req, res) => {
    try {
        const userId = req.session.user?._id || req.user?._id;
        const { addressId } = req.params;

        if (!userId) {
            return res.status(HTTP_STATUS.UNAUTHORIZED).json({
                success: false,
                message: ERROR_MESSAGES.AUTH.LOGIN_REQUIRED
            });
        }

        const { name, phone, altPhone, addressType, city, landmark, state, isDefault } = req.body;

        // Validate required fields
        if (!name || !phone || !addressType || !city || !landmark || !state) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: ERROR_MESSAGES.VALIDATION.REQUIRED_FIELDS
            });
        }

        // Find user addresses
        const userAddresses = await Address.findOne({ userId });
        if (!userAddresses) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
                success: false,
                message: ERROR_MESSAGES.ADDRESS.NOT_FOUND
            });
        }

        const addressIndex = userAddresses.address.findIndex(addr => addr._id.toString() === addressId);
        if (addressIndex === -1) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
                success: false,
                message: ERROR_MESSAGES.ADDRESS.NOT_FOUND
            });
        }

        // If this is set as default, remove default from other addresses
        if (isDefault) {
            userAddresses.address.forEach((addr, index) => {
                if (index !== addressIndex) {
                    addr.isDefault = false;
                }
            });
        }

        // Update address
        userAddresses.address[addressIndex] = {
            ...userAddresses.address[addressIndex]._doc,
            name,
            phone,
            altPhone: altPhone || phone,
            addressType,
            city,
            landmark,
            state,
            isDefault: isDefault || false
        };

        await userAddresses.save();

        res.status(HTTP_STATUS.OK).json({
            success: true,
            message: SUCCESS_MESSAGES.ADDRESS.UPDATED,
            address: userAddresses.address[addressIndex]
        });

    } catch (error) {
        console.error('Error editing checkout address:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: ERROR_MESSAGES.ADDRESS.UPDATE_FAILED
        });
    }
};

// Apply coupon
const applyCoupon = async (req, res) => {
    try {
        const userId = req.session.user?._id || req.user?._id;
        const { couponCode } = req.body;

        if (!userId) {
            return res.status(HTTP_STATUS.UNAUTHORIZED).json({
                success: false,
                message: ERROR_MESSAGES.AUTH.LOGIN_REQUIRED
            });
        }

        if (!couponCode) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: ERROR_MESSAGES.COUPON.INVALID
            });
        }

        // Get cart
        const cart = await Cart.findOne({ userId }).populate('items.productId');
        if (!cart || cart.items.length === 0) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: ERROR_MESSAGES.CART.EMPTY
            });
        }

        // Calculate subtotal
        let subtotal = 0;
        for (const item of cart.items) {
            const product = item.productId;
            const variant = product.variants.find(v => v.storage === item.variantId);
            if (variant) {
                subtotal += item.quantity * variant.salePrice;
            }
        }

        // Find coupon
        const coupon = await Coupon.findOne({
            name: couponCode.toUpperCase(),
            isActive: true,
            expireOn: { $gt: new Date() }
        });

        if (!coupon) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: ERROR_MESSAGES.COUPON.INVALID
            });
        }

        // Check minimum purchase
        if (subtotal < coupon.minimumPrice) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: `Minimum purchase of ₹${coupon.minimumPrice} required for this coupon`
            });
        }

        // Check if this is a user-specific coupon (like welcome bonus)
        if (coupon.usersUsed.length > 0 && coupon.usersUsed[0].count === 0) {
            // This is a user-specific coupon (assigned but not used yet)
            const assignedUser = coupon.usersUsed.find(u => u.userId.toString() === userId.toString());
            if (!assignedUser) {
                return res.status(HTTP_STATUS.BAD_REQUEST).json({
                    success: false,
                    message: ERROR_MESSAGES.COUPON.NOT_APPLICABLE
                });
            }
        }

        // Check if user already used this coupon (ONE TIME PER USER)
        const userUsed = coupon.usersUsed.find(u => u.userId.toString() === userId.toString());
        if (userUsed && userUsed.count > 0) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: ERROR_MESSAGES.COUPON.ALREADY_USED
            });
        }

        // Check if coupon usage limit reached (total users who have actually used it)
        const totalUsedCount = coupon.usersUsed.filter(u => u.count > 0).length;
        if (totalUsedCount >= coupon.usageLimit) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: ERROR_MESSAGES.COUPON.MAX_USAGE_REACHED
            });
        }

        // Calculate discount
        let discount = 0;
        if (coupon.discountType === 'percentage') {
            discount = Math.round((subtotal * coupon.discountValue) / 100);
        } else {
            discount = coupon.discountValue;
        }
        discount = Math.min(discount, subtotal);

        // Calculate new totals
        const discountedSubtotal = subtotal - discount;
        const tax = Math.round(discountedSubtotal * 0.18);
        const shippingFee = discountedSubtotal >= 500 ? 0 : 50;
        const total = discountedSubtotal + tax + shippingFee;

        // Store coupon in session
        req.session.appliedCoupon = {
            code: coupon.name,
            discount: discount
        };

        res.status(HTTP_STATUS.OK).json({
            success: true,
            message: SUCCESS_MESSAGES.COUPON.APPLIED,
            coupon: {
                code: coupon.name,
                discount: discount
            },
            pricing: {
                subtotal,
                discount,
                tax,
                shippingFee,
                total
            }
        });

    } catch (error) {
        console.error('Error applying coupon:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: ERROR_MESSAGES.COUPON.INVALID
        });
    }
};

// Remove coupon
const removeCoupon = async (req, res) => {
    try {
        const userId = req.session.user?._id || req.user?._id;

        if (!userId) {
            return res.status(HTTP_STATUS.UNAUTHORIZED).json({
                success: false,
                message: ERROR_MESSAGES.AUTH.LOGIN_REQUIRED
            });
        }

        // Get cart
        const cart = await Cart.findOne({ userId }).populate('items.productId');
        if (!cart || cart.items.length === 0) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: ERROR_MESSAGES.CART.EMPTY
            });
        }

        // Calculate subtotal
        let subtotal = 0;
        for (const item of cart.items) {
            const product = item.productId;
            const variant = product.variants.find(v => v.storage === item.variantId);
            if (variant) {
                subtotal += item.quantity * variant.salePrice;
            }
        }

        // Calculate totals without discount
        const tax = Math.round(subtotal * 0.18);
        const shippingFee = subtotal >= 500 ? 0 : 50;
        const total = subtotal + tax + shippingFee;

        // Remove coupon from session
        delete req.session.appliedCoupon;

        res.status(HTTP_STATUS.OK).json({
            success: true,
            message: SUCCESS_MESSAGES.COUPON.REMOVED,
            pricing: {
                subtotal,
                discount: 0,
                tax,
                shippingFee,
                total
            }
        });

    } catch (error) {
        console.error('Error removing coupon:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: ERROR_MESSAGES.COUPON.INVALID
        });
    }
};

export {
    loadCheckout,
    placeOrder,
    loadOrderSuccess,
    addCheckoutAddress,
    editCheckoutAddress,
    applyCoupon,
    removeCoupon
};