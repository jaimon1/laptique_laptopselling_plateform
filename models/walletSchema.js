import mongoose from 'mongoose';
const { Schema } = mongoose;

const walletSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        unique: true
    },
    balance: {
        type: Number,
        default: 0,
        min: 0
    },
    transactions: [{
        transactionId: {
            type: String,
            required: true,
            unique: true,
            default: function () {
                return 'TXN' + Date.now() + Math.random().toString(36).substr(2, 5).toUpperCase();
            }
        },
        type: {
            type: String,
            enum: ["Credit", "Debit"],
            required: true
        },
        amount: {
            type: Number,
            required: true,
            min: 0
        },
        description: {
            type: String,
            required: true
        },
        orderId: {
            type: String,
            default: null
        },
        createdOn: {
            type: Date,
            default: Date.now
        },
        status: {
            type: String,
            enum: ["Pending", "Completed", "Failed"],
            default: "Completed"
        }
    }],
    createdOn: {
        type: Date,
        default: Date.now
    },
    updatedOn: {
        type: Date,
        default: Date.now
    }
});


walletSchema.pre('save', function (next) {
    this.updatedOn = new Date();
    next();
});

const Wallet = mongoose.model('Wallet', walletSchema);
export default Wallet;