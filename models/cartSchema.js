import mongoose from 'mongoose';
const { Schema } = mongoose;

const cartSchema = new Schema({
    userId:{
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    items: [{
        productId: {
            type: Schema.Types.ObjectId,
            ref: "Product",
            required: true
        },
        variantId: {
            type: String,
            required: true
        },
        quantity: {
            type: Number,
            default: 1,
            min: 1,
            max: 10
        },
        price: {
            type: Number,
            required: true,
        },
        totalPrice: {
            type: Number,
            required: true
        },
        status: {
            type: String,
            default: "Placed"
        },
        cancelationReason: {
            type: String,
            default: "none"
        },
        addedAt: {
            type: Date,
            default: Date.now
        }
    }]
});

const Cart = mongoose.model("Cart",cartSchema);

export default Cart;