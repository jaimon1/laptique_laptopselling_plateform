import mongoose from 'mongoose';
const { Schema } = mongoose;

const variant = new Schema({
    storage: {
        type: String,
        required: true
    },
    regularPrice: {
        type: Number,
        required: true,
    },
    salePrice: {
        type: Number,
        default: function () {
            return this.regularPrice;
        }
    },
    productDescription: {
        type: String,
        required: true,
    },
    quantity: {
        type: Number,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }

}, { _id: false })
const productSchema = new Schema({

    productName: {
        type: String,
        required: true
    },
    shortDescription: {
        type: String,
        required: true,
        default: ''
    },

    brand: {
        type: Schema.Types.ObjectId,
        ref: "Brand",
        required: true
    },
    category: {
        type: Schema.Types.ObjectId,
        ref: "Category",
        required: true,
    },
    productOffer: {
        type: Number,
        default: 0
    },

    variants: [variant],

    ProductImages: {
        type: [String],
        required: true
    },
    isBlocked: {
        type: Boolean,
        required: true,
        default: false
    },
    status: {
        type: String,
        enum: ["Available", "Out of Stock", "Discontinued"],
        required: true,
        default: "Available"
    }
}, { timestamps: true });

const Product = mongoose.model('Product', productSchema);

export default Product;