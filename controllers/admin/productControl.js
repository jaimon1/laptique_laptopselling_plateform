import Product from '../../models/productSchema.js';
import Category from '../../models/categorySchema.js';
import Brand from '../../models/brandSchema.js';
import { HTTP_STATUS, ERROR_MESSAGES, SUCCESS_MESSAGES } from '../../constants/index.js';


const loadProductList = async (req, res) => {
    try {

        const page = Number(req.query.page) || 1;
        const limit = 5;
        const skip = (page - 1) * limit;
        const search = req.query.search || '';
        const query = {
            productName: { $regex: ".*" + search + ".*", $options: "i" }
        }

        const productData = await Product.find(query)
            .populate("category", 'name')
            .populate("brand", "name")
            .sort({ createdAt: -1 }).skip(skip).limit(limit);

        const productTotal = await Product.countDocuments(query);

        const totalPages = Math.ceil(productTotal / limit);

        res.render('product', {
            currentPage: page,
            totalPages: totalPages,
            productData: productData,
            search,

        });
    } catch (error) {
        res.redirect('/admin/pageError');
        console.log(error);
    }
}

const loadAddProduct = async (req, res) => {
    try {
        const categoryData = await Category.find({isListed:true});
        const brandData = await Brand.find({isBlocked:false});

        res.render("adminProduct", {
            categoryData: categoryData,
            brandData: brandData,
            id: false
        })

    } catch (error) {
        console.log(error);
    }
}
const addProduct = async (req, res) => {
    try {

        const { productName, brand, category, description } = req.body;
        const variants = JSON.parse(req.body.variants)

        const paths = req.files.map(file => file.filename);

        const categoryData = await Category.findOne({ name: category });
        if (!categoryData) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: ERROR_MESSAGES.CATEGORY.NOT_FOUND });
        }

        const brandData = await Brand.findOne({ name: brand });
        if (!brandData) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: ERROR_MESSAGES.BRAND.NOT_FOUND });
        }

        const ishas = await Product.findOne({ productName: productName });
        if (ishas) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: ERROR_MESSAGES.PRODUCT.ALREADY_EXISTS });
        }

        const newProduct = new Product({
            productName: productName, brand: brandData._id, category: categoryData._id,
            shortDescription: description, ProductImages: paths, variants
        });
        await newProduct.save();

        res.json({
            success: true,
            message: SUCCESS_MESSAGES.PRODUCT.ADDED,
            body: req.body,
        });
    } catch (error) {
        console.log(error)
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: ERROR_MESSAGES.SERVER.INTERNAL_ERROR });
    }
}

const blockProduct = async (req, res) => {
    try {
        const id = req.query.id;
        const page = req.query.page;
        await Product.updateOne({ _id: id }, { $set: { isBlocked: true } });
        res.redirect(`/admin/loadProduct?page=${page}`);
    } catch (error) {
        console.log(error);
        res.redirect('/admin/pageError');
    }
}

const unblockProduct = async (req, res) => {
    try {
        const id = req.query.id;
        const page = req.query.page;
        await Product.updateOne({ _id: id }, { $set: { isBlocked: false } });
        res.redirect(`/admin/loadProduct?page=${page}`);
    } catch (error) {
        console.log(error);
        res.redirect('/admin/pageError');
    }
}

const deleteProduct = async (req, res) => {
    try {
        const id = req.query.id;
        const page = req.query.page;
        await Product.deleteOne({ _id: id });
        res.redirect(`/admin/loadProduct?page=${page}`);
    } catch (error) {
        console.log(error);
        res.redirect('/admin/pageError');
    }
}

const loadeditProduct = async (req, res) => {
    try {

        const id = req.params.id;
        const productData = await Product.findById(id).populate("brand", "name").populate("category", "name");
        const brandData = await Brand.find({}, 'name')
        const categoryData = await Category.find({}, 'name')

        if (!productData) {
            res.redirect("/admin/pageError");
            console.log("Cannot Find Products");
        }

        res.render('adminProduct', {
            productData: productData,
            brandData: brandData,
            categoryData: categoryData,
            id: id
        })



    } catch (error) {
        console.log(error);
        res.redirect('/admin/pageError');
    }
}

const editProduct = async (req, res) => {
    try {
        const id = req.params.id;
        const { productName, brand, category, description } = req.body;
        
        console.log('Edit Product Request:');
        console.log('Product ID:', id);
        console.log('Product Name:', productName);
        console.log('Brand:', brand);
        console.log('Category:', category);
        console.log('Description:', description);
        console.log('Raw Variants:', req.body.variants);
        console.log('Existing Images:', req.body.existingImages);
        console.log('New Files:', req.files ? req.files.length : 0);
        
        let variants;
        try {
            variants = JSON.parse(req.body.variants);
            console.log('Parsed Variants:', variants);
        } catch (e) {
            console.error('Variant parsing error:', e);
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: ERROR_MESSAGES.VALIDATION.INVALID_INPUT });
        }

        if (!productName || !brand || !category || !description || !variants || !Array.isArray(variants) || variants.length === 0) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: ERROR_MESSAGES.VALIDATION.REQUIRED_FIELDS });
        }

        const categoryData = await Category.findOne({ name: category });
        if (!categoryData) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: ERROR_MESSAGES.CATEGORY.NOT_FOUND });
        }
        const brandData = await Brand.findOne({ name: brand });
        if (!brandData) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: ERROR_MESSAGES.BRAND.NOT_FOUND });
        }

        let images = [];
        if (req.body.existingImages) {
            try {
                images = JSON.parse(req.body.existingImages);
            } catch (e) {
                console.log(e)
                if (typeof req.body.existingImages === 'string') {
                    images = [req.body.existingImages];
                }
            }
        }
        if (req.files && req.files.length > 0) {
            const newImages = req.files.map(file => file.filename);
            images = images.concat(newImages);
        }
        if (!images || images.length === 0) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: ERROR_MESSAGES.VALIDATION.REQUIRED_FIELDS });
        }

        for (const v of variants) {
            if (!v.storage || typeof v.storage !== 'string') {
                return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: ERROR_MESSAGES.VALIDATION.INVALID_INPUT });
            }
            if (!v.regularPrice || isNaN(v.regularPrice) || v.regularPrice <= 0) {
                return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: ERROR_MESSAGES.VALIDATION.INVALID_INPUT });
            }
            if (v.quantity === undefined || isNaN(v.quantity) || v.quantity < 0) {
                return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: ERROR_MESSAGES.VALIDATION.INVALID_INPUT });
            }
            if (!v.productDescription || v.productDescription.trim().length < 10) {
                return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: ERROR_MESSAGES.VALIDATION.INVALID_INPUT });
            }
        }

        await Product.findByIdAndUpdate(id, {
            productName,
            shortDescription: description,
            brand: brandData._id,
            category: categoryData._id,
            variants,
            ProductImages: images
        });

        res.json({ success: true, message: SUCCESS_MESSAGES.PRODUCT.UPDATED });
    } catch (error) {
        console.log(error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: ERROR_MESSAGES.SERVER.INTERNAL_ERROR });
    }
}
const getProductsForOffers = async (req, res) => {
    try {
        const search = req.query.search || '';
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const query = search ? {
            productName: { $regex: search, $options: 'i' }
        } : {};

        const totalProducts = await Product.countDocuments(query);
        const totalPages = Math.ceil(totalProducts / limit);

        const products = await Product.find(query)
            .populate('category', 'name categoryOffer')
            .populate('brand', 'name')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        res.json({ 
            success: true, 
            products,
            pagination: {
                currentPage: page,
                totalPages,
                totalProducts,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1
            }
        });
    } catch (error) {
        console.error('Error fetching products for offers:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: ERROR_MESSAGES.SERVER.INTERNAL_ERROR });
    }
};

const addProductOffer = async (req, res) => {
    try {
        const { productId, percentage } = req.body;
        
        if (!productId || !percentage) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: ERROR_MESSAGES.VALIDATION.REQUIRED_FIELDS });
        }
        
        if (percentage < 1 || percentage > 90) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: ERROR_MESSAGES.VALIDATION.INVALID_INPUT });
        }
        
        const product = await Product.findById(productId).populate('category');
        if (!product) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({ success: false, message: ERROR_MESSAGES.PRODUCT.NOT_FOUND });
        }
        
        product.productOffer = percentage;
        
        const bestOffer = Math.max(percentage, product.category?.categoryOffer || 0);
        
        product.variants.forEach(variant => {
            const discount = (variant.regularPrice * bestOffer) / 100;
            variant.salePrice = Math.round(variant.regularPrice - discount);
        });
        
        await product.save();
        
        res.json({ success: true, message: SUCCESS_MESSAGES.OFFER.APPLIED });
    } catch (error) {
        console.error('Error adding product offer:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: ERROR_MESSAGES.SERVER.INTERNAL_ERROR });
    }
};

const removeProductOffer = async (req, res) => {
    try {
        const { productId } = req.body;
        
        const product = await Product.findById(productId).populate('category');
        if (!product) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({ success: false, message: ERROR_MESSAGES.PRODUCT.NOT_FOUND });
        }
        
        product.productOffer = 0;
        
        const categoryOffer = product.category?.categoryOffer || 0;
        
        product.variants.forEach(variant => {
            if (categoryOffer > 0) {
                const discount = (variant.regularPrice * categoryOffer) / 100;
                variant.salePrice = Math.round(variant.regularPrice - discount);
            } else {
                variant.salePrice = variant.regularPrice;
            }
        });
        
        await product.save();
        
        res.json({ success: true, message: SUCCESS_MESSAGES.OFFER.REMOVED });
    } catch (error) {
        console.error('Error removing product offer:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: ERROR_MESSAGES.SERVER.INTERNAL_ERROR });
    }
};

export {
    loadProductList,
    loadAddProduct,
    addProduct,
    blockProduct,
    unblockProduct,
    deleteProduct,
    loadeditProduct,
    editProduct,
    getProductsForOffers,
    addProductOffer,
    removeProductOffer
}