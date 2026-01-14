import Product from '../../models/productSchema.js';
import Brand from '../../models/brandSchema.js';
import Category from '../../models/categorySchema.js';
import Wishlist from '../../models/wishlistSchema.js';
import { HTTP_STATUS, ERROR_MESSAGES } from '../../constants/index.js';

const branding = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 6;
        const skip = (page - 1) * limit;


        const search = req.query.search || '';
        const sortBy = req.query.sort || 'newest';
        const category = req.query.category || '';
        const brand = req.query.brand || '';
        const minPrice = parseFloat(req.query.minPrice) || 0;
        const maxPrice = parseFloat(req.query.maxPrice) || Number.MAX_VALUE;


        const categories = await Category.find({ isListed: true });
        const brands = await Brand.find({ isBlocked: false });

        let query = {
            isBlocked: false
        };


        if (search) {
            query.$or = [
                { productName: { $regex: search, $options: 'i' } },
                { shortDescription: { $regex: search, $options: 'i' } }
            ];
        }


        if (category) {
            query.category = category;
        }


        if (brand) {
            query.brand = brand;
        }


        let products = await Product.find(query)
            .populate('category')
            .populate('brand')
            .sort({ createdAt: -1 });


        products = products.map(product => {
            const productObj = product.toObject();
            if (product.variants && product.variants.length > 0) {
                productObj.minVariantPrice = Math.min(...product.variants.map(v => v.salePrice));
                productObj.maxVariantPrice = Math.max(...product.variants.map(v => v.salePrice));
                productObj.totalQuantity = product.variants.reduce((sum, v) => sum + v.quantity, 0);
            } else {
                productObj.minVariantPrice = 0;
                productObj.maxVariantPrice = 0;
                productObj.totalQuantity = 0;
            }
            productObj.avgRating = productObj.avgRating || 0;
            return productObj;
        });


        if (minPrice > 0 || maxPrice < Number.MAX_VALUE) {
            products = products.filter(product =>
                product.minVariantPrice >= minPrice && product.minVariantPrice <= maxPrice
            );
        }


        switch (sortBy) {
            case 'price_asc':
                products.sort((a, b) => a.minVariantPrice - b.minVariantPrice);
                break;
            case 'price_desc':
                products.sort((a, b) => b.minVariantPrice - a.minVariantPrice);
                break;
            case 'name_asc':
                products.sort((a, b) => a.productName.localeCompare(b.productName));
                break;
            case 'name_desc':
                products.sort((a, b) => b.productName.localeCompare(a.productName));
                break;
            case 'rating':
                products.sort((a, b) => (b.avgRating || 0) - (a.avgRating || 0));
                break;
            case 'newest':
                products.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                break;
            default:
                products.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }


        const paginatedProducts = products.slice(skip, skip + limit);
        const totalPages = Math.ceil(products.length / limit);

        // Get user's wishlist items for current logged-in user
        const userId = req.session.user?._id || req.user?._id;
        let wishlistProductIds = [];
        if (userId) {
            const wishlist = await Wishlist.findOne({ userId }).select('product');
            if (wishlist && wishlist.product) {
                wishlistProductIds = wishlist.product.map(item => item.productId.toString());
            }

        }

        const isAjax = req.xhr ||

            (req.headers.accept && req.headers.accept.indexOf('json') > -1) ||
            req.headers['x-requested-with'] === 'XMLHttpRequest';


        if (isAjax) {
            return res.json({
                success: true,
                products: paginatedProducts,
                wishlistProductIds,
                currentPage: page,
                totalPages,
                totalProducts: products.length,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1
            });
        }


        res.render('shop', {
            user: req.session.user || req.user || null,
            products: paginatedProducts,
            wishlistProductIds,
            categories,
            brands,
            currentPage: page,
            totalPages,
            totalProducts: products.length,
            search,
            sortBy,
            category,
            brand,
            minPrice: minPrice === 0 ? '' : minPrice,
            maxPrice: maxPrice === Number.MAX_VALUE ? '' : maxPrice,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1
        });

    } catch (error) {
        console.error('Error in product listing:', error);


        const isAjax = req.xhr ||
            (req.headers.accept && req.headers.accept.indexOf('json') > -1) ||
            req.headers['x-requested-with'] === 'XMLHttpRequest';

        if (isAjax) {
            return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: ERROR_MESSAGES.SERVER.INTERNAL_ERROR,
                error: error.message
            });
        }

        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).render('pageNotFound');
    }
}

const getProductDetails = async (req, res) => {
    try {
        const productId = req.params.id;

        const product = await Product.findById(productId)
            .populate('category')
            .populate('brand');

        if (!product || product.isBlocked) {
            return res.status(HTTP_STATUS.NOT_FOUND).render('pageNotFound');
        }
        const productMinPrice = Math.min(...product.variants.map(v => v.salePrice));
        const productMaxPrice = Math.max(...product.variants.map(v => v.salePrice));
        const priceRange = {
            min: productMinPrice * 0.7,
            max: productMaxPrice * 1.3
        };


        let relatedProducts = [];
        const sameCategoryProducts = await Product.find({
            category: product.category._id,
            _id: { $ne: productId },
            isBlocked: false,
            status: { $ne: 'Discontinued' }
        })
            .populate('category')
            .populate('brand')
            .limit(6);

        relatedProducts = [...sameCategoryProducts];
        if (relatedProducts.length < 8) {
            const sameBrandProducts = await Product.find({
                brand: product.brand._id,
                _id: {
                    $ne: productId,
                    $nin: relatedProducts.map(p => p._id)
                },
                isBlocked: false,
                status: { $ne: 'Discontinued' },
            })
                .populate('category')
                .populate('brand')
                .limit(8 - relatedProducts.length);

            relatedProducts = [...relatedProducts, ...sameBrandProducts];
        }
        if (relatedProducts.length < 8) {
            const similarPriceProducts = await Product.find({
                _id: { $ne: productId, $nin: relatedProducts.map(p => p._id) },
                isBlocked: false,
                status: { $ne: 'Discontinued' }
            })
                .populate('category')
                .populate('brand');

            const filteredByPrice = similarPriceProducts.filter(prod => {
                const minPrice = Math.min(...prod.variants.map(v => v.salePrice));
                const maxPrice = Math.max(...prod.variants.map(v => v.salePrice));
                return (minPrice >= priceRange.min && minPrice <= priceRange.max) ||
                    (maxPrice >= priceRange.min && maxPrice <= priceRange.max);
            }).slice(0, 8 - relatedProducts.length);

            relatedProducts = [...relatedProducts, ...filteredByPrice];
        }
        if (relatedProducts.length < 8) {
            const otherProducts = await Product.find({
                _id: { $ne: productId, $nin: relatedProducts.map(p => p._id) },
                isBlocked: false,
                status: { $ne: 'Discontinued' }
            })
                .populate('category')
                .populate('brand')
                .limit(8 - relatedProducts.length);

            relatedProducts = [...relatedProducts, ...otherProducts];
        }

        relatedProducts = relatedProducts.map(relatedProduct => {
            const productObj = relatedProduct.toObject();
            if (relatedProduct.variants && relatedProduct.variants.length > 0) {
                productObj.minPrice = Math.min(...relatedProduct.variants.map(v => v.salePrice));
                productObj.maxPrice = Math.max(...relatedProduct.variants.map(v => v.salePrice));
                productObj.hasDiscount = relatedProduct.variants.some(v => v.regularPrice > v.salePrice);
                if (productObj.hasDiscount) {
                    const variant = relatedProduct.variants.find(v => v.regularPrice > v.salePrice);
                    productObj.discountPercentage = Math.round(((variant.regularPrice - variant.salePrice) / variant.regularPrice) * 100);
                }
            }
            return productObj;
        });

        res.render('productDetails', {
            user: req.session.user || req.user || null,
            product,
            relatedProducts: relatedProducts.slice(0, 8)
        });

    } catch (error) {
        console.error('Error getting product details:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).render('pageNotFound');
    }
}



export {
    branding,
    getProductDetails
}