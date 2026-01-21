import Category from '../../models/categorySchema.js';
import Product from '../../models/productSchema.js';
import { HTTP_STATUS, ERROR_MESSAGES, SUCCESS_MESSAGES } from '../../constants/index.js';

const categoryInfo = async (req, res) => {
    try {
        let page = Number(req.query.page) || 1;
        let limit = 8;
        let skip = (page - 1) * limit;
        let search = req.query.search || '';

        let categoryData = await Category.find({
            $or: [
                { slug: { $regex: ".*" + search + ".*", $options: "i" } },
                { name: { $regex: ".*" + search + ".*", $options: "i" } }
            ]
        })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .exec();

        let totalCategories = await Category.countDocuments({
            $or: [
                { slug: { $regex: ".*" + search + ".*", $options: "i" } },
                { name: { $regex: ".*" + search + ".*", $options: "i" } }
            ]
        });
        let totalPages = Math.ceil(totalCategories / limit);
        res.render('category', {
            cat: categoryData,
            currentPage: page,
            totalPages: totalPages,
            totalCategories: totalCategories,
            search
        })

    } catch (error) {
        console.log(error);
        res.redirect('/admin/pageError');
    }
}

const loadCategory = async (req, res) => {
    try {
        const id = req.query.id;
        let category = null
        if (id) {
            category = await Category.findById(id)
        }
        res.render('addCategory', { category });
    } catch (error) {
        res.redirect('/admin/pageError');
        console.log(error);
    }
}

const addCategory = async (req, res) => {

    const { id, categoryName, description } = req.body;
    console.log(id, categoryName, description)
    try {
        if (id) {
          
            let isHas = await Category.findOne({ 
                name: categoryName,
                _id: { $ne: id } 
            });
            if (isHas) {
                return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: ERROR_MESSAGES.CATEGORY.ALREADY_EXISTS });
            }
            await Category.findByIdAndUpdate(id, { name: categoryName, description: description }, { new: true });
            return res.json({ message: SUCCESS_MESSAGES.CATEGORY.UPDATED });
        }

        let validResponce = await Category.findOne({ name: categoryName });
        if (validResponce) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: ERROR_MESSAGES.CATEGORY.ALREADY_EXISTS });
        }
        const newCategory = new Category({ name: categoryName,description: description });
        await newCategory.save();
        return res.json({ message: SUCCESS_MESSAGES.CATEGORY.ADDED });

    } catch (error) {
        console.log(error);
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: ERROR_MESSAGES.SERVER.INTERNAL_ERROR });
        
    }

}

const listCategory = async (req, res) => {
    try {
        const id = req.query.id;
        await Category.updateOne({ _id: id }, { $set: { isListed: false } });
        
        if (req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest') {
            return res.status(HTTP_STATUS.OK).json({ 
                success: true, 
                message: SUCCESS_MESSAGES.CATEGORY.UNLISTED 
            });
        }
        
        const page = req.query.page || 1;
        res.redirect(`/admin/category?page=${page}&status=success&action=unlisted`);
    } catch (error) {
        console.log(error);
        
        if (req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest') {
            return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ 
                success: false, 
                message: ERROR_MESSAGES.SERVER.INTERNAL_ERROR 
            });
        }
        
        res.redirect('/admin/pageError');
    }
}

const unlistCategory = async (req, res) => {
    try {
        const id = req.query.id;
        await Category.updateOne({ _id: id }, { $set: { isListed: true } });
        
        if (req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest') {
            return res.status(HTTP_STATUS.OK).json({ 
                success: true, 
                message: SUCCESS_MESSAGES.CATEGORY.LISTED 
            });
        }
        
        const page = req.query.page || 1;
        res.redirect(`/admin/category?page=${page}&status=success&action=listed`);
    } catch (error) {
        console.log(error);
        
        if (req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest') {
            return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ 
                success: false, 
                message: ERROR_MESSAGES.SERVER.INTERNAL_ERROR 
            });
        }
        
        res.redirect('/admin/pageError');
    }
}

const deleteCategory = async (req, res) => {
    try {
        const id = req.query.id;
        await Category.deleteOne({ _id: id });
        
        if (req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest') {
            return res.status(HTTP_STATUS.OK).json({ 
                success: true, 
                message: SUCCESS_MESSAGES.CATEGORY.DELETED 
            });
        }
        
        const page = req.query.page || 1;
        res.redirect(`/admin/category?page=${page}&status=success&action=deleted`);
    } catch (error) {
        console.log(error);
        
        if (req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest') {
            return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ 
                success: false, 
                message: ERROR_MESSAGES.SERVER.INTERNAL_ERROR 
            });
        }
        
        res.redirect('/admin/pageError');
    }
}
const addCategoryOffer = async (req, res) => {
    try {
        const { categoryId, percentage } = req.body;
        
        if (!categoryId || percentage === undefined) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ status: false, message: ERROR_MESSAGES.VALIDATION.REQUIRED_FIELDS });
        }
        
        const offerPercentage = parseInt(percentage);
        if (offerPercentage < 1 || offerPercentage > 90) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ status: false, message: ERROR_MESSAGES.VALIDATION.INVALID_INPUT });
        }

        const category = await Category.findById(categoryId);
        if (!category) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({ status: false, message: ERROR_MESSAGES.CATEGORY.NOT_FOUND });
        }
        
   
        category.categoryOffer = offerPercentage;
        await category.save();
        

        const products = await Product.find({ category: categoryId });
        
        for (const product of products) {

            const bestOffer = Math.max(product.productOffer || 0, offerPercentage);
            
      
            product.variants.forEach(variant => {
                const discount = (variant.regularPrice * bestOffer) / 100;
                variant.salePrice = Math.round(variant.regularPrice - discount);
            });
            
            await product.save();
        }
        
        res.json({ 
            status: true, 
            message: SUCCESS_MESSAGES.OFFER.APPLIED
        });
    } catch (error) {
        console.error('Error adding category offer:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ status: false, message: ERROR_MESSAGES.SERVER.INTERNAL_ERROR });
    }
}

const removeCategoryOffer = async (req, res) => {
    try {
        const { categoryId } = req.body;
        
        const category = await Category.findById(categoryId);
        if (!category) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({ status: false, message: ERROR_MESSAGES.CATEGORY.NOT_FOUND });
        }
        
       
        category.categoryOffer = 0;
        await category.save();
        
        
        const products = await Product.find({ category: categoryId });
        
        for (const product of products) {
           
            const productOffer = product.productOffer || 0;
            
            product.variants.forEach(variant => {
                if (productOffer > 0) {
                    const discount = (variant.regularPrice * productOffer) / 100;
                    variant.salePrice = Math.round(variant.regularPrice - discount);
                } else {
                    variant.salePrice = variant.regularPrice;
                }
            });
            
            await product.save();
        }
        
        res.json({ 
            status: true, 
            message: SUCCESS_MESSAGES.OFFER.REMOVED
        });
    } catch (error) {
        console.error('Error removing category offer:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ status: false, message: ERROR_MESSAGES.SERVER.INTERNAL_ERROR });
    }
}

const getCategoriesForOffers = async (req, res) => {
    try {
        const search = req.query.search || '';
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const query = search ? {
            name: { $regex: search, $options: 'i' }
        } : {};

        const totalCategories = await Category.countDocuments(query);
        const totalPages = Math.ceil(totalCategories / limit);

        const categories = await Category.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
        
        // Get product count for each category
        const categoriesWithCount = await Promise.all(categories.map(async (category) => {
            const productCount = await Product.countDocuments({ category: category._id });
            return {
                ...category.toObject(),
                productCount
            };
        }));

        res.json({ 
            success: true, 
            categories: categoriesWithCount,
            pagination: {
                currentPage: page,
                totalPages,
                totalCategories,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1
            }
        });
    } catch (error) {
        console.error('Error fetching categories for offers:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: ERROR_MESSAGES.SERVER.INTERNAL_ERROR });
    }
};

export {
    categoryInfo,
    addCategory,
    loadCategory,
    listCategory,
    unlistCategory,
    deleteCategory,
    addCategoryOffer,
    removeCategoryOffer,
    getCategoriesForOffers
}