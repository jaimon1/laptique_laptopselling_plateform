import mongoose from 'mongoose';

const { Schema } = mongoose;

const orderSchema = new Schema({
    orderId: {
        type: String,
        unique: true,
        required: true,
        default: function() {
            return 'ORD' + Date.now() + Math.random().toString(36).substr(2, 5).toUpperCase();
        }
    },
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    orderItems: [{
        product: {
            type: Schema.Types.ObjectId,
            ref: "Product",
            required: true
        },
        quantity: {
            type: Number,
            required: true
        },
        price: {
            type: Number,
            default: 0
        },
        variant: {
            storage: String,
            color: String
        },
        status: {
            type: String,
            enum: ["Active", "Cancelled", "Returned"],
            default: "Active"
        },
        cancelReason: {
            type: String,
            default: null
        },
        returnReason: {
            type: String,
            default: null
        },
        returnStatus: {
            type: String,
            enum: ["None", "Requested", "Approved", "Rejected", "Completed"],
            default: "None"
        },
   
        itemTotal: {
            type: Number,
            default: 0,
            comment: "price * quantity"
        },
        discountShare: {
            type: Number,
            default: 0,
            comment: "Proportional discount for this item"
        },
        taxShare: {
            type: Number,
            default: 0,
            comment: "Proportional tax (GST) for this item"
        },
        shippingShare: {
            type: Number,
            default: 0,
            comment: "Proportional shipping for this item"
        },
        effectivePrice: {
            type: Number,
            default: 0,
            comment: "(itemTotal + taxShare + shippingShare) - discountShare = what user paid for this item"
        },
        refundAmount: {
            type: Number,
            default: 0,
            comment: "Amount refunded for this item (0 if not refunded)"
        },
        isRefunded: {
            type: Boolean,
            default: false,
            comment: "Whether this item has been refunded"
        }
    }],
    totalPrice: {
        type: Number,
        required: true
    },
    discount: {
        type: Number,
        default: 0
    },
    tax: {
        type: Number,
        default: 0
    },
    shippingFee: {
        type: Number,
        default: 0
    },
    finalAmount: {
        type: String,
        required: true
    },
    totalRefunded: {
        type: Number,
        default: 0,
        comment: "Total amount refunded across all cancelled/returned items"
    },
    address: {
        name: {
            type: String,
            required: true
        },
        phone: {
            type: String,
            required: true
        },
        altPhone: {
            type: String
        },
        addressType: {
            type: String,
            required: true
        },
        city: {
            type: String,
            required: true
        },
        landmark: {
            type: String,
            required: true
        },
        state: {
            type: String,
            required: true
        }
    },
    paymentMethod: {
        type: String,
        required: true,
        enum: ["COD", "Online", "Wallet"]
    },
    paymentStatus: {
        type: String,
        required: true,
        enum: ["Pending", "Completed", "Failed", "Refunded"],
        default: "Pending"
    },
    invoiceDate: {
        type: Date,
    },
    status: {
        type: String,
        required: true,
        enum: ["Pending", "Processing", "Shipped", "Out for Delivery", "Delivered", "Cancelled", "Failed", "Return Request", "Returned"]
    },
    createdOn: {
        type: Date,
        default: Date.now,
        required: true
    },
    deliveredOn: {
        type: Date,
        default: null
    },
    cancelReason: {
        type: String,
        default: null
    },
    cancelledOn: {
        type: Date,
        default: null
    },
    returnReason: {
        type: String,
        default: null
    },
    returnRequestedOn: {
        type: Date,
        default: null
    },
    returnStatus: {
        type: String,
        enum: ["None", "Requested", "Approved", "Rejected", "Completed"],
        default: "None"
    },
    returnRejectionReason: {
        type: String,
        default: null
    },
    couponApplied: {
        type: Boolean,
        default: false
    },
    couponDetails: {
        code: String,
        discount: Number
    },
    statusHistory: [{
        status: String,
        updatedOn: {
            type: Date,
            default: Date.now
        },
        updatedBy: {
            type: Schema.Types.ObjectId,
            ref: "User"
        },
        note: String
    }]
});

const Order = mongoose.model("Order", orderSchema);
export default Order;