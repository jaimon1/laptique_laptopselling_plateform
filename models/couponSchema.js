import mongoose from 'mongoose';
const { Schema } = mongoose;

const couponSchema = new Schema({
    name: { // coupon code (WELCOME10)
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
        required: true
    },
    minimumPrice: { 
        type: Number,
        required: true
    },
    isActive: { 
        type: Boolean,
        default: true
    },
    usageLimit: {
        type: Number,
        default: 1
    },
    usersUsed: [
        {
            userId: { type: Schema.Types.ObjectId, ref: "User" },
            count: { type: Number, default: 0 }
        }
    ]
});

const Coupon = mongoose.model("Coupon", couponSchema);

export default Coupon;
