import Cart from '../../models/cartSchema.js';
import Product from '../../models/productSchema.js';
import Wishlist from '../../models/wishlistSchema.js';
import { HTTP_STATUS, ERROR_MESSAGES, SUCCESS_MESSAGES } from '../../constants/index.js';

// Load cart page
const loadCart = async (req, res) => {
    try {
        const userId = req.session.user?._id || req.user?._id;
        
        if (!userId) {
            return res.redirect('/login');
        }

        const cart = await Cart.findOne({ userId }).populate({
            path: 'items.productId',
            populate: [
                { path: 'category' },
                { path: 'brand' }
            ]
        });

        let cartItems = [];
        let cartTotal = 0;
        let totalItems = 0;

        if (cart && cart.items.length > 0) {
            // Filter out items with blocked/unlisted products or categories
            cartItems = cart.items.filter(item => {
                const product = item.productId;
                return product && 
                       !product.isBlocked && 
                       product.category && 
                       product.category.isListed &&
                       product.status !== 'Discontinued';
            });

            // Calculate totals and check stock
            cartItems = cartItems.map(item => {
                const product = item.productId;
                const variant = product.variants.find(v => v.storage === item.variantId) || product.variants[0];
                
                // Check if quantity exceeds stock
                const maxQuantity = Math.min(variant.quantity, 5); 
                const adjustedQuantity = Math.min(item.quantity, maxQuantity);
                
                const itemTotal = adjustedQuantity * variant.salePrice;
                cartTotal += itemTotal;
                totalItems += adjustedQuantity;

                return {
                    ...item.toObject(),
                    variant,
                    adjustedQuantity,
                    itemTotal,
                    maxQuantity,
                    inStock: variant.quantity > 0,
                    stockLeft: variant.quantity
                };
            });

            const needsUpdate = cartItems.some(item => item.adjustedQuantity !== item.quantity);
            if (needsUpdate) {
                cart.items = cartItems.map(item => ({
                    ...item,
                    quantity: item.adjustedQuantity,
                    totalPrice: item.itemTotal
                }));
                await cart.save();
            }
        }

        res.render('cart', {
            user: req.session.user || req.user,
            cartItems,
            cartTotal,
            totalItems,
            title: 'Shopping Cart'
        });

    } catch (error) {
        console.error('Error loading cart:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).render('pageNotFound');
    }
};

// Add product to cart
const addToCart = async (req, res) => {
    try {
        const userId = req.session.user?._id || req.user?._id;
        
        if (!userId) {
            return res.status(HTTP_STATUS.UNAUTHORIZED).json({ 
                success: false, 
                message: ERROR_MESSAGES.AUTH.LOGIN_REQUIRED,
                redirect: '/login'
            });
        }

        const { productId, variantId, quantity = 1 } = req.body;

        if (!productId || !variantId) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
                success: false, 
                message: ERROR_MESSAGES.VALIDATION.REQUIRED_FIELDS
            });
        }

        // Validate product and category
        const product = await Product.findById(productId).populate('category');
        
        if (!product) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({ 
                success: false, 
                message: ERROR_MESSAGES.PRODUCT.NOT_FOUND
            });
        }

        if (product.isBlocked) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
                success: false, 
                message: ERROR_MESSAGES.PRODUCT.OUT_OF_STOCK
            });
        }

        if (!product.category.isListed) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
                success: false, 
                message: ERROR_MESSAGES.PRODUCT.OUT_OF_STOCK
            });
        }

        if (product.status === 'Discontinued' || product.status === 'Out of Stock') {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
                success: false, 
                message: ERROR_MESSAGES.PRODUCT.OUT_OF_STOCK
            });
        }

        // Find the specific variant
        const variant = product.variants.find(v => v.storage === variantId);
        if (!variant) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
                success: false, 
                message: ERROR_MESSAGES.PRODUCT.NOT_FOUND
            });
        }

        if (variant.quantity < quantity) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
                success: false, 
                message: `Only ${variant.quantity} items available in stock` 
            });
        }

        // Find or create cart
        let cart = await Cart.findOne({ userId });
        if (!cart) {
            cart = new Cart({ userId, items: [] });
        }

        // Check if product already exists in cart
        const existingItemIndex = cart.items.findIndex(
            item => item.productId.toString() === productId && item.variantId === variantId
        );

        if (existingItemIndex > -1) {
            // Update existing item
            const existingItem = cart.items[existingItemIndex];
            const newQuantity = existingItem.quantity + parseInt(quantity);
            const maxQuantity = Math.min(variant.quantity, 5);

            if (newQuantity > maxQuantity) {
                return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
                    success: false, 
                    message: `Maximum ${maxQuantity} items allowed per product` 
                });
            }

            existingItem.quantity = newQuantity;
            existingItem.totalPrice = newQuantity * variant.salePrice;
        } else {
            // Add new item
            const maxQuantity = Math.min(variant.quantity, 5);
            if (quantity > maxQuantity) {
                return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
                    success: false, 
                    message: `Maximum ${maxQuantity} items allowed per product` 
                });
            }

            cart.items.push({
                productId,
                variantId,
                quantity: parseInt(quantity),
                price: variant.salePrice,
                totalPrice: parseInt(quantity) * variant.salePrice
            });
        }

        await cart.save();

        // Remove from wishlist if exists
        await Wishlist.updateOne(
            { userId },
            { $pull: { product: { productId } } }
        );

        // Get updated cart count
        const cartCount = cart.items.reduce((total, item) => total + item.quantity, 0);

        res.status(HTTP_STATUS.OK).json({ 
            success: true, 
            message: SUCCESS_MESSAGES.CART.ITEM_ADDED,
            cartCount
        });

    } catch (error) {
        console.error('Error adding to cart:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ 
            success: false, 
            message: ERROR_MESSAGES.CART.ADD_FAILED
        });
    }
};

// Update cart item quantity
const updateCartQuantity = async (req, res) => {
    try {
        const userId = req.session.user?._id || req.user?._id;

        const { productId, variantId, quantity } = req.body;
        if (!productId || !variantId || quantity < 1) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
                success: false, 
                message: ERROR_MESSAGES.VALIDATION.INVALID_INPUT
            });
        }

        const cart = await Cart.findOne({ userId });
        if (!cart) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({ 
                success: false, 
                message: ERROR_MESSAGES.CART.EMPTY
            });
        }

        // Find the cart item
        const itemIndex = cart.items.findIndex(
            item => item.productId.toString() === productId && item.variantId === variantId
        );

        if (itemIndex === -1) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({ 
                success: false, 
                message: ERROR_MESSAGES.CART.ITEM_NOT_FOUND
            });
        }

        // Validate product and stock
        const product = await Product.findById(productId).populate('category');
        if (!product || product.isBlocked || !product.category.isListed) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
                success: false, 
                message: ERROR_MESSAGES.PRODUCT.OUT_OF_STOCK
            });
        }

        const variant = product.variants.find(v => v.storage === variantId);
        if (!variant) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
                success: false, 
                message: ERROR_MESSAGES.PRODUCT.NOT_FOUND
            });
        }

        const maxQuantity = Math.min(variant.quantity, 5);
        if (quantity > maxQuantity) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
                success: false, 
                message: `Maximum ${maxQuantity} items allowed`,
                maxQuantity
            });
        }

        // Update the item
        cart.items[itemIndex].quantity = parseInt(quantity);
        cart.items[itemIndex].totalPrice = parseInt(quantity) * variant.salePrice;

        await cart.save();

        // Calculate new totals
        const cartTotal = cart.items.reduce((total, item) => total + item.totalPrice, 0);
        const cartCount = cart.items.reduce((total, item) => total + item.quantity, 0);

        res.status(HTTP_STATUS.OK).json({ 
            success: true, 
            message: SUCCESS_MESSAGES.CART.UPDATED,
            cartTotal,
            cartCount,
            itemTotal: cart.items[itemIndex].totalPrice
        });

    } catch (error) {
        console.error('Error updating cart quantity:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ 
            success: false, 
            message: ERROR_MESSAGES.CART.UPDATE_FAILED
        });
    }
};

// Remove item from cart
const removeFromCart = async (req, res) => {
    try {
        const userId = req.session.user?._id || req.user?._id;

        const { productId, variantId } = req.body;

        const cart = await Cart.findOne({ userId });
        if (!cart) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({ 
                success: false, 
                message: ERROR_MESSAGES.CART.EMPTY
            });
        }

        // Remove the item
        cart.items = cart.items.filter(
            item => !(item.productId.toString() === productId && item.variantId === variantId)
        );

        await cart.save();

        const cartTotal = cart.items.reduce((total, item) => total + item.totalPrice, 0);
        const cartCount = cart.items.reduce((total, item) => total + item.quantity, 0);

        res.status(HTTP_STATUS.OK).json({ 
            success: true, 
            message: SUCCESS_MESSAGES.CART.ITEM_REMOVED,
            cartTotal,
            cartCount
        });

    } catch (error) {
        console.error('Error removing from cart:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ 
            success: false, 
            message: ERROR_MESSAGES.CART.REMOVE_FAILED
        });
    }
};

// Clear entire cart
const clearCart = async (req, res) => {
    try {
        const userId = req.session.user?._id || req.user?._id;
        await Cart.findOneAndUpdate(
            { userId },
            { $set: { items: [] } },
            { upsert: true }
        );

        res.status(HTTP_STATUS.OK).json({ 
            success: true, 
            message: SUCCESS_MESSAGES.CART.CLEARED
        });

    } catch (error) {
        console.error('Error clearing cart:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ 
            success: false, 
            message: ERROR_MESSAGES.CART.UPDATE_FAILED
        });
    }
};

// Get cart count for header
const getCartCount = async (req, res) => {
    try {
        const userId = req.session.user?._id || req.user?._id;
        
        if (!userId) {
            return res.status(HTTP_STATUS.OK).json({ cartCount: 0 });
        }

        const cart = await Cart.findOne({ userId });
        const cartCount = cart ? cart.items.reduce((total, item) => total + item.quantity, 0) : 0;

        res.status(HTTP_STATUS.OK).json({ cartCount });

    } catch (error) {
        console.error('Error getting cart count:', error);
        res.status(HTTP_STATUS.OK).json({ cartCount: 0 });
    }
};

export {
    loadCart,
    addToCart,
    updateCartQuantity,
    removeFromCart,
    clearCart,
    getCartCount
};