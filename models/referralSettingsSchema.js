import mongoose from 'mongoose';

const referralSettingsSchema = new mongoose.Schema({
    rewardAmount: {
        type: Number,
        default: 100,
        required: true,
        min: 0
    },
    bonusCouponAmount: {
        type: Number,
        default: 50,
        required: true,
        min: 0
    },
    minimumPurchaseAmount: {
        type: Number,
        default: 500,
        required: true,
        min: 0
    },
    rewardRecipient: {
        type: String,
        enum: ['referrer_only', 'both', 'referred_only'],
        default: 'referrer_only'
    },
    autoCredit: {
        type: Boolean,
        default: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    termsAndConditions: {
        type: String,
        default: 'Referral rewards are subject to terms and conditions.'
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});


referralSettingsSchema.statics.getSettings = async function () {
    let settings = await this.findOne();
    if (!settings) {
        settings = await this.create({});
    }
    return settings;
};

const ReferralSettings = mongoose.model('ReferralSettings', referralSettingsSchema);

export default ReferralSettings;
