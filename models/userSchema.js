import mongoose from 'mongoose';

const { Schema } = mongoose;

const userSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    phone: {
        type: String,
        required: false,
        unique: false,
        sparse: true,
        default: null

    },
    googleId: {
        type: String,
        unique: true,
        sparse: true
    },
    password: {
        type: String,
        required: false
    },
    isBlocked: {
        type: Boolean,
        default: false
    },
    isAdmin: {
        type: Boolean,
        default: false
    },
    cart: [{
        type: Schema.Types.ObjectId,
        ref: "Cart"
    }],
    wallet: {
        type: Number,
        default: 0
    },
    wishlist: [{
        type: Schema.Types.ObjectId,
        ref: "Wishlist"
    }],
    orderHistory: {
        type: Schema.Types.ObjectId,
        ref: "Order"
    },
    createdOn: {
        type: Date,
        default: Date.now
    },
    // New referral system fields
    referralCode: {
        type: String,
        unique: true,
        sparse: true
    },
    referredBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        default: null
    },
    referrals: [{
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User"
        },
        registeredOn: {
            type: Date,
            default: Date.now
        },
        rewardGiven: {
            type: Boolean,
            default: false
        }
    }],
    searchHistory: [{
        category: {
            type: Schema.Types.ObjectId,
            ref: "Category"
        },
        brand: {
            type: String
        },
        searchOn: {
            type: Date,
            default: Date.now
        }
    }],
    resetPasswordToken: {
        type: String
    },
    resetPasswordExpires: {
        type: Date
    },
    profileImage: {
        type: String,
        default: null
    },
    dateOfBirth: {
        type: Date,
        required: false
    },
    gender: {
        type: String,
        required: false
    }
});

const User = mongoose.model('User', userSchema);

export default User;