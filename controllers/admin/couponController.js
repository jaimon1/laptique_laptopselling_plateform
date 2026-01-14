import Coupon from '../../models/couponSchema.js';
import { HTTP_STATUS, ERROR_MESSAGES, SUCCESS_MESSAGES } from '../../constants/index.js';


const loadCoupon = async (req, res) => {
    try {

        let { page = 1, search = "" } = req.query;
        page = parseInt(page);

        const limit = 5; 
        const query = {};

        
        if (search.trim() !== "") {
            query.$or = [
                { code: { $regex: search, $options: "i" } },
                { discountType: { $regex: search, $options: "i" } }
            ];
        }

        
        const totalCoupons = await Coupon.countDocuments(query);

        
        const couponData = await Coupon.find(query)
            .sort({ createdOn: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();

        
        res.render("coupon", {
            couponData,
            currentPage: page,
            totalPages: Math.ceil(totalCoupons / limit),
            search
        });
    } catch (error) {
        console.error("Error loading coupons:", error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(ERROR_MESSAGES.SERVER.INTERNAL_ERROR);
    }
}

const addCoupon = async (req, res) => {
    try {
        res.render('AddCoupon');
    } catch (error) {
        console.log(error);
        res.redirect('/admin/pageError');
    }
}

const createCoupon = async (req, res) => {
    try {
        const {
            name,
            description,
            expireOn,
            discountType,
            discountValue,
            minimumPrice,
            usageLimit,
        } = req.body;

        
        if (!name || !expireOn || !discountType || discountValue === undefined || minimumPrice === undefined || !usageLimit) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: ERROR_MESSAGES.VALIDATION.REQUIRED_FIELDS });
        }

        
        const trimmedName = name.trim().toUpperCase();
        
        if (!trimmedName) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: ERROR_MESSAGES.VALIDATION.INVALID_INPUT });
        }

        if (trimmedName.length > 20) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: ERROR_MESSAGES.VALIDATION.INVALID_INPUT });
        }

        if (!/^[A-Z0-9]+$/.test(trimmedName)) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: ERROR_MESSAGES.VALIDATION.INVALID_INPUT });
        }

        
        const existingCoupon = await Coupon.findOne({ name: trimmedName });
        if (existingCoupon) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: ERROR_MESSAGES.COUPON.ALREADY_EXISTS });
        }

        
        if (!["percentage", "fixed"].includes(discountType)) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: ERROR_MESSAGES.VALIDATION.INVALID_INPUT });
        }

        
        const numDiscountValue = parseFloat(discountValue);
        if (isNaN(numDiscountValue) || numDiscountValue <= 0) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: ERROR_MESSAGES.VALIDATION.INVALID_INPUT });
        }

        if (discountType === 'percentage' && numDiscountValue > 100) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: ERROR_MESSAGES.VALIDATION.INVALID_INPUT });
        }

        if (numDiscountValue > 999999) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: ERROR_MESSAGES.VALIDATION.INVALID_INPUT });
        }

        
        const numMinimumPrice = parseFloat(minimumPrice);
        if (isNaN(numMinimumPrice) || numMinimumPrice < 0) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: ERROR_MESSAGES.VALIDATION.INVALID_INPUT });
        }

        if (numMinimumPrice > 999999) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: ERROR_MESSAGES.VALIDATION.INVALID_INPUT });
        }

        
        const numUsageLimit = parseInt(usageLimit);
        if (isNaN(numUsageLimit) || numUsageLimit < 1) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: ERROR_MESSAGES.VALIDATION.INVALID_INPUT });
        }

        if (numUsageLimit > 999999) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: ERROR_MESSAGES.VALIDATION.INVALID_INPUT });
        }


        const currentDate = new Date();
        currentDate.setHours(0, 0, 0, 0);
        const expiryDate = new Date(expireOn);
        expiryDate.setHours(0, 0, 0, 0);

        if (expiryDate <= currentDate) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: ERROR_MESSAGES.COUPON.EXPIRED });
        }

        
        const trimmedDescription = description ? description.trim() : '';
        if (trimmedDescription.length > 500) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: ERROR_MESSAGES.VALIDATION.INVALID_INPUT });
        }


        const newCoupon = new Coupon({
            name: trimmedName,
            description: trimmedDescription,
            expireOn: expiryDate,
            discountType,
            discountValue: numDiscountValue,
            minimumPrice: numMinimumPrice,
            usageLimit: numUsageLimit
        });

        await newCoupon.save();

        return res.status(HTTP_STATUS.CREATED).json({
            success: true,
            message: SUCCESS_MESSAGES.COUPON.CREATED,
            coupon: newCoupon,
        });

    } catch (error) {
        console.error("Error creating coupon:", error);
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: ERROR_MESSAGES.SERVER.INTERNAL_ERROR });
    }
};




const loadEditCoupon = async (req, res) => {
    try {
        const { id } = req.params;
        const coupon = await Coupon.findById(id);

        if (!coupon) {
            return res.redirect('/admin/loadCoupon');
        }

        res.render('EditCoupon', { coupon });
    } catch (error) {
        console.error('Error loading edit coupon:', error);
        res.redirect('/admin/pageError');
    }
};


const updateCoupon = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            expireOn,
            discountType,
            discountValue,
            minimumPrice,
            usageLimit,
            description,
            isActive
        } = req.body;

        
        if (!expireOn || !discountType || discountValue === undefined || minimumPrice === undefined || !usageLimit) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: ERROR_MESSAGES.VALIDATION.REQUIRED_FIELDS
            });
        }

        
        if (!["percentage", "fixed"].includes(discountType)) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: ERROR_MESSAGES.VALIDATION.INVALID_INPUT
            });
        }

        
        const numDiscountValue = parseFloat(discountValue);
        if (isNaN(numDiscountValue) || numDiscountValue <= 0) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: ERROR_MESSAGES.VALIDATION.INVALID_INPUT
            });
        }

        if (discountType === 'percentage' && numDiscountValue > 100) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: ERROR_MESSAGES.VALIDATION.INVALID_INPUT
            });
        }

        if (numDiscountValue > 999999) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: ERROR_MESSAGES.VALIDATION.INVALID_INPUT
            });
        }

        
        const numMinimumPrice = parseFloat(minimumPrice);
        if (isNaN(numMinimumPrice) || numMinimumPrice < 0) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: ERROR_MESSAGES.VALIDATION.INVALID_INPUT
            });
        }

        if (numMinimumPrice > 999999) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: ERROR_MESSAGES.VALIDATION.INVALID_INPUT
            });
        }

        
        const numUsageLimit = parseInt(usageLimit);
        if (isNaN(numUsageLimit) || numUsageLimit < 1) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: ERROR_MESSAGES.VALIDATION.INVALID_INPUT
            });
        }

        if (numUsageLimit > 999999) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: ERROR_MESSAGES.VALIDATION.INVALID_INPUT
            });
        }

        
        const expiryDate = new Date(expireOn);
        const currentDate = new Date();
        currentDate.setHours(0, 0, 0, 0);
        expiryDate.setHours(0, 0, 0, 0);

        if (expiryDate <= currentDate) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: ERROR_MESSAGES.COUPON.EXPIRED
            });
        }


        const trimmedDescription = description ? description.trim() : '';
        if (trimmedDescription.length > 500) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: ERROR_MESSAGES.VALIDATION.INVALID_INPUT
            });
        }

        
        const updatedCoupon = await Coupon.findByIdAndUpdate(
            id,
            {
                expireOn: expiryDate,
                discountType,
                discountValue: numDiscountValue,
                minimumPrice: numMinimumPrice,
                usageLimit: numUsageLimit,
                description: trimmedDescription,
                isActive: isActive === true || isActive === 'true'
            },
            { new: true }
        );

        if (!updatedCoupon) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
                success: false,
                message: ERROR_MESSAGES.COUPON.NOT_FOUND
            });
        }

        return res.status(HTTP_STATUS.OK).json({
            success: true,
            message: SUCCESS_MESSAGES.COUPON.UPDATED,
            coupon: updatedCoupon
        });

    } catch (error) {
        console.error("Error updating coupon:", error);
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: ERROR_MESSAGES.SERVER.INTERNAL_ERROR
        });
    }
};


const toggleCouponStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { isActive } = req.body;

        const coupon = await Coupon.findById(id);

        if (!coupon) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
                success: false,
                message: ERROR_MESSAGES.COUPON.NOT_FOUND
            });
        }

        
        if (new Date(coupon.expireOn) < new Date()) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: ERROR_MESSAGES.COUPON.EXPIRED
            });
        }


        coupon.isActive = isActive;
        await coupon.save();

        return res.status(HTTP_STATUS.OK).json({
            success: true,
            message: SUCCESS_MESSAGES.COUPON.STATUS_UPDATED
        });

    } catch (error) {
        console.error("Error toggling coupon status:", error);
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: ERROR_MESSAGES.SERVER.INTERNAL_ERROR
        });
    }
};


const deleteCoupon = async (req, res) => {
    try {
        const { id } = req.params;

        const coupon = await Coupon.findById(id);

        if (!coupon) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
                success: false,
                message: ERROR_MESSAGES.COUPON.NOT_FOUND
            });
        }

        
        if (coupon.usersUsed && coupon.usersUsed.length > 0) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: ERROR_MESSAGES.COUPON.CANNOT_DELETE
            });
        }

        await Coupon.findByIdAndDelete(id);

        return res.status(HTTP_STATUS.OK).json({
            success: true,
            message: SUCCESS_MESSAGES.COUPON.DELETED
        });

    } catch (error) {
        console.error("Error deleting coupon:", error);
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: ERROR_MESSAGES.SERVER.INTERNAL_ERROR
        });
    }
};

export {
    loadCoupon,
    createCoupon,
    addCoupon,
    loadEditCoupon,
    updateCoupon,
    toggleCouponStatus,
    deleteCoupon
}