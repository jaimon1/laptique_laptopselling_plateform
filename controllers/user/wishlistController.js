import Wishlist from '../../models/wishlistSchema.js';
import Product from '../../models/productSchema.js';
import Cart from '../../models/cartSchema.js';
import { HTTP_STATUS, ERROR_MESSAGES, SUCCESS_MESSAGES } from '../../constants/index.js';


const loadWishlist = async (req, res) => {
    try {
        const userId = req.session.user?._id || req.user?._id;

        const wishlist = await Wishlist.findOne({ userId }).populate({
            path: 'product.productId',
            populate: [
                { path: 'category' },
                { path: 'brand' }
            ]
        });

        let wishlistItems = [];

        if (wishlist && wishlist.product.length > 0) {
            
            wishlistItems = wishlist.product.filter(item => {
                const product = item.productId;
                return product && 
                       !product.isBlocked && 
                       product.category && 
                       product.category.isListed &&
                       product.status !== 'Discontinued';
            });

            
            wishlistItems = wishlistItems.map(item => {
                const product = item.productId;
                const minPrice = Math.min(...product.variants.map(v => v.salePrice));
                const maxPrice = Math.max(...product.variants.map(v => v.salePrice));
                const hasDiscount = product.variants.some(v => v.regularPrice > v.salePrice);
                const totalStock = product.variants.reduce((sum, v) => sum + v.quantity, 0);

                return {
                    ...item.toObject(),
                    minPrice,
                    maxPrice,
                    hasDiscount,
                    totalStock,
                    inStock: totalStock > 0
                };
            });

            
            const needsUpdate = wishlist.product.length !== wishlistItems.length;
            if (needsUpdate) {
                wishlist.product = wishlistItems;
                await wishlist.save();
            }
        }

        res.render('wishlist', {
            user: req.session.user || req.user,
            wishlistItems,
            totalItems: wishlistItems.length,
            title: 'My Wishlist'
        });

    } catch (error) {
        console.error('Error loading wishlist:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).render('pageNotFound');
    }
};


const addToWishlist = async (req, res) => {
    try {
        const userId = req.session.user?._id || req.user?._id;
        
        if (!userId) {
            return res.status(HTTP_STATUS.UNAUTHORIZED).json({ 
                success: false, 
                message: ERROR_MESSAGES.AUTH.LOGIN_REQUIRED,
                redirect: '/login'
            });
        }

        const { productId } = req.body;

        if (!productId) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
                success: false, 
                message: ERROR_MESSAGES.VALIDATION.REQUIRED_FIELDS
            });
        }

        
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

        if (product.status === 'Discontinued') {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
                success: false, 
                message: ERROR_MESSAGES.PRODUCT.OUT_OF_STOCK
            });
        }

        
        let wishlist = await Wishlist.findOne({ userId });
        if (!wishlist) {
            wishlist = new Wishlist({ userId, product: [] });
        }

        
        const existingItemIndex = wishlist.product.findIndex(
            item => item.productId.toString() === productId
        );

        if (existingItemIndex > -1) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
                success: false, 
                message: ERROR_MESSAGES.WISHLIST.ALREADY_EXISTS
            });
        }

        
        wishlist.product.push({
            productId,
            addOn: new Date()
        });

        await wishlist.save();

        
        const wishlistCount = wishlist.product.length;

        res.status(HTTP_STATUS.OK).json({ 
            success: true, 
            message: SUCCESS_MESSAGES.WISHLIST.ITEM_ADDED,
            wishlistCount
        });

    } catch (error) {
        console.error('Error adding to wishlist:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ 
            success: false, 
            message: ERROR_MESSAGES.SERVER.INTERNAL_ERROR
        });
    }
};


const removeFromWishlist = async (req, res) => {
    try {
        const userId = req.session.user?._id || req.user?._id;
        
        if (!userId) {
            return res.status(HTTP_STATUS.UNAUTHORIZED).json({ 
                success: false, 
                message: ERROR_MESSAGES.AUTH.LOGIN_REQUIRED
            });
        }

        const { productId } = req.body;

        const wishlist = await Wishlist.findOne({ userId });
        if (!wishlist) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({ 
                success: false, 
                message: ERROR_MESSAGES.WISHLIST.NOT_FOUND
            });
        }

        
        wishlist.product = wishlist.product.filter(
            item => item.productId.toString() !== productId
        );

        await wishlist.save();

        
        const wishlistCount = wishlist.product.length;

        res.status(HTTP_STATUS.OK).json({ 
            success: true, 
            message: SUCCESS_MESSAGES.WISHLIST.ITEM_REMOVED,
            wishlistCount
        });

    } catch (error) {
        console.error('Error removing from wishlist:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ 
            success: false, 
            message: ERROR_MESSAGES.SERVER.INTERNAL_ERROR
        });
    }
};


const moveToCart = async (req, res) => {
    try {
        const userId = req.session.user?._id || req.user?._id;
        
        if (!userId) {
            return res.status(HTTP_STATUS.UNAUTHORIZED).json({ 
                success: false, 
                message: ERROR_MESSAGES.AUTH.LOGIN_REQUIRED
            });
        }

        const { productId, variantId } = req.body;

        if (!productId || !variantId) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
                success: false, 
                message: ERROR_MESSAGES.VALIDATION.REQUIRED_FIELDS
            });
        }

        
        const product = await Product.findById(productId).populate('category');
        
        if (!product || product.isBlocked || !product.category.isListed) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
                success: false, 
                message: ERROR_MESSAGES.PRODUCT.OUT_OF_STOCK
            });
        }

        
        const variant = product.variants.find(v => v.storage === variantId);
        if (!variant || variant.quantity < 1) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
                success: false, 
                message: ERROR_MESSAGES.PRODUCT.OUT_OF_STOCK
            });
        }

        
        let cart = await Cart.findOne({ userId });
        if (!cart) {
            cart = new Cart({ userId, items: [] });
        }

        
        const existingItemIndex = cart.items.findIndex(
            item => item.productId.toString() === productId && item.variantId === variantId
        );

        if (existingItemIndex > -1) {
            
            const existingItem = cart.items[existingItemIndex];
            const newQuantity = existingItem.quantity + 1;
            const maxQuantity = Math.min(variant.quantity, 5);

            if (newQuantity > maxQuantity) {
                return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
                    success: false, 
                    message: ERROR_MESSAGES.CART.MAX_QUANTITY_EXCEEDED
                });
            }

            existingItem.quantity = newQuantity;
            existingItem.totalPrice = newQuantity * variant.salePrice;
        } else {
            
            cart.items.push({
                productId,
                variantId,
                quantity: 1,
                price: variant.salePrice,
                totalPrice: variant.salePrice
            });
        }

        await cart.save();

        
        await Wishlist.updateOne(
            { userId },
            { $pull: { product: { productId } } }
        );

        
        const cartCount = cart.items.reduce((total, item) => total + item.quantity, 0);
        const updatedWishlist = await Wishlist.findOne({ userId });
        const wishlistCount = updatedWishlist ? updatedWishlist.product.length : 0;

        res.status(HTTP_STATUS.OK).json({ 
            success: true, 
            message: SUCCESS_MESSAGES.CART.ITEM_ADDED,
            cartCount,
            wishlistCount
        });

    } catch (error) {
        console.error('Error moving to cart:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ 
            success: false, 
            message: ERROR_MESSAGES.CART.ADD_FAILED
        });
    }
};


const clearWishlist = async (req, res) => {
    try {
        const userId = req.session.user?._id || req.user?._id;
        
        if (!userId) {
            return res.status(HTTP_STATUS.UNAUTHORIZED).json({ 
                success: false, 
                message: ERROR_MESSAGES.AUTH.LOGIN_REQUIRED
            });
        }

        await Wishlist.findOneAndUpdate(
            { userId },
            { $set: { product: [] } },
            { upsert: true }
        );

        res.status(HTTP_STATUS.OK).json({ 
            success: true, 
            message: SUCCESS_MESSAGES.GENERAL.OPERATION_SUCCESS
        });

    } catch (error) {
        console.error('Error clearing wishlist:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ 
            success: false, 
            message: ERROR_MESSAGES.SERVER.INTERNAL_ERROR
        });
    }
};


const getWishlistCount = async (req, res) => {
    try {
        const userId = req.session.user?._id || req.user?._id;
        
        if (!userId) {
            return res.status(HTTP_STATUS.OK).json({ wishlistCount: 0 });
        }

        const wishlist = await Wishlist.findOne({ userId });
        const wishlistCount = wishlist ? wishlist.product.length : 0;

        res.status(HTTP_STATUS.OK).json({ wishlistCount });

    } catch (error) {
        console.error('Error getting wishlist count:', error);
        res.status(HTTP_STATUS.OK).json({ wishlistCount: 0 });
    }
};

export {
    loadWishlist,
    addToWishlist,
    removeFromWishlist,
    moveToCart,
    clearWishlist,
    getWishlistCount
};