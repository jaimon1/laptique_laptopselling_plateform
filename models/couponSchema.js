import mongoose from 'mongoose';
const { Schema } = mongoose;

const couponSchema = new Schema({
    name: { 
        type:String,
        unique:true,
        required:true,
        uppercase: true,
        trim: true
    },
    description: {
        type: String,
        default: ""
    },
    createdOn: {
        type: Date,
        default: Date.now
    },
    expireOn: {
        type: Date,
        required: true,
    },
    discountType: { 
        type: String,
        enum: ["percentage", "fixed"],
        required: true
    },
    discountValue: { 
        type: Number,
        required: true,
        min: [0.01, 'Discount value must be greater than 0']
    },
    maxDiscountAmount: {
        type: Number,
        default: null, 
        min: [0, 'Maximum discount amount cannot be negative']
    },
    minimumPrice: { 
        type: Number,
        required: true,
        min: [0, 'Minimum price cannot be negative']
    },
    isActive: { 
        type: Boolean,
        default: true
    },
    usageLimit: {
        type: Number,
        default: 1,
        min: [1, 'Usage limit must be at least 1']
    },
    usersUsed: [
        {
            userId: { type: Schema.Types.ObjectId, ref: "User" },
            count: { type: Number, default: 0 }
        }
    ]
});


couponSchema.pre('save', function(next) {
    if (this.discountType === 'percentage') {
        if (this.discountValue < 1 || this.discountValue > 50) {
            return next(new Error('Percentage discount must be between 1% and 50%'));
        }
    }
    

    if (this.discountType === 'fixed') {
        if (this.discountValue > 5000) {
            return next(new Error('Fixed discount cannot exceed ₹5,000'));
        }
    }
    
    next();
});

const Coupon = mongoose.model("Coupon", couponSchema);

export default Coupon;
