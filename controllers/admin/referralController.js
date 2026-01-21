import User from '../../models/userSchema.js';
import ReferralSettings from '../../models/referralSettingsSchema.js';
import Coupon from '../../models/couponSchema.js';
import Order from '../../models/orderSchema.js';
import * as walletService from '../../services/walletService.js';
import { HTTP_STATUS, ERROR_MESSAGES, SUCCESS_MESSAGES } from '../../constants/index.js';


const loadReferralsPage = async (req, res) => {
    try {
       
        const referrers = await User.find({
            'referrals.0': { $exists: true }
        }).select('name email referralCode referrals createdOn').lean();


        const referralStats = await Promise.all(referrers.map(async (referrer) => {
            const totalReferred = referrer.referrals.length;
            const rewardsGiven = referrer.referrals.filter(r => r.rewardGiven).length;
            const pendingRewards = totalReferred - rewardsGiven;
            const totalRewardsEarned = rewardsGiven * 100; 

            return {
                _id: referrer._id,
                name: referrer.name,
                email: referrer.email,
                referralCode: referrer.referralCode,
                totalReferred,
                rewardsGiven,
                pendingRewards,
                totalRewardsEarned,
                joinedOn: referrer.createdOn
            };
        }));


        referralStats.sort((a, b) => b.totalReferred - a.totalReferred);


        const settings = await ReferralSettings.getSettings();

        res.render('adminReferrals', {
            referralStats,
            settings,
            title: 'Referral Management'
        });

    } catch (error) {
        console.error('Error loading referrals page:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).render('pageNotFound');
    }
};


const loadReferralDetails = async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await User.findById(userId)
            .populate({
                path: 'referrals.userId',
                select: 'name email createdOn'
            })
            .lean();

        if (!user) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({ success: false, message: ERROR_MESSAGES.USER.NOT_FOUND });
        }


        const referralDetails = await Promise.all(user.referrals.map(async (referral) => {
            const orders = await Order.find({ userId: referral.userId._id })
                .select('orderId finalAmount createdOn status')
                .sort({ createdOn: -1 })
                .limit(5)
                .lean();

            const orderCount = await Order.countDocuments({ userId: referral.userId._id });
            const lastOrder = orders[0];

            return {
                userId: referral.userId._id,
                name: referral.userId.name,
                email: referral.userId.email,
                registeredOn: referral.registeredOn,
                rewardGiven: referral.rewardGiven,
                orderCount,
                lastOrderAmount: lastOrder ? lastOrder.finalAmount : 0,
                lastOrderDate: lastOrder ? lastOrder.createdOn : null,
                orders
            };
        }));

        res.json({
            success: true,
            referrer: {
                name: user.name,
                email: user.email,
                referralCode: user.referralCode
            },
            referrals: referralDetails
        });

    } catch (error) {
        console.error('Error loading referral details:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: ERROR_MESSAGES.SERVER.INTERNAL_ERROR });
    }
};


const manualCreditReward = async (req, res) => {
    try {
        const { referrerId, referredUserId } = req.body;

        const referrer = await User.findById(referrerId);
        const referredUser = await User.findById(referredUserId);

        if (!referrer || !referredUser) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({ success: false, message: ERROR_MESSAGES.USER.NOT_FOUND });
        }

   
        const referralEntry = referrer.referrals.find(
            r => r.userId.toString() === referredUserId.toString()
        );

        if (!referralEntry) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: ERROR_MESSAGES.REFERRAL.NOT_FOUND });
        }

        if (referralEntry.rewardGiven) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: ERROR_MESSAGES.REFERRAL.ALREADY_REWARDED });
        }

  
        const settings = await ReferralSettings.getSettings();

       
        await walletService.credit(referrerId, settings.rewardAmount, {
            source: 'REFERRAL_REWARD',
            referenceModel: 'User',
            referenceId: referredUserId.toString(),
            notes: `Manual referral reward for inviting ${referredUser.name} (Admin approved)`,
            metadata: {
                referredUserName: referredUser.name,
                referredUserEmail: referredUser.email,
                manualApproval: true,
                approvedBy: req.session.admin._id
            }
        });

       
        const couponCode = `REF${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 30);

        const newCoupon = new Coupon({
            name: couponCode,
            description: `Referral bonus coupon for inviting ${referredUser.name}`,
            createdOn: new Date(),
            expireOn: expiryDate,
            discountType: 'fixed',
            discountValue: settings.bonusCouponAmount,
            minimumPrice: settings.minimumPurchaseAmount,
            isActive: true,
            usageLimit: 1,
            usersUsed: []
        });

        await newCoupon.save();

        
        await User.findOneAndUpdate(
            { _id: referrerId, 'referrals.userId': referredUserId },
            { $set: { 'referrals.$.rewardGiven': true } }
        );

        res.json({
            success: true,
            message: SUCCESS_MESSAGES.REFERRAL.REWARD_CREDITED,
            couponCode
        });

    } catch (error) {
        console.error('Error crediting reward:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: ERROR_MESSAGES.SERVER.INTERNAL_ERROR });
    }
};


const revokeReward = async (req, res) => {
    try {
        const { referrerId, referredUserId, reason } = req.body;

        const referrer = await User.findById(referrerId);
        const referredUser = await User.findById(referredUserId);

        if (!referrer || !referredUser) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({ success: false, message: ERROR_MESSAGES.USER.NOT_FOUND });
        }

        
        const referralEntry = referrer.referrals.find(
            r => r.userId.toString() === referredUserId.toString()
        );

        if (!referralEntry || !referralEntry.rewardGiven) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: ERROR_MESSAGES.REFERRAL.NO_REWARD_TO_REVOKE });
        }

        
        const settings = await ReferralSettings.getSettings();

        
        try {
            await walletService.debit(referrerId, settings.rewardAmount, {
                source: 'ADJUSTMENT',
                referenceModel: 'User',
                referenceId: referredUserId.toString(),
                notes: `Referral reward revoked for ${referredUser.name}. Reason: ${reason}`,
                metadata: {
                    revokedBy: req.session.admin._id,
                    reason
                }
            });
        } catch (error) {
            console.log(error);
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: ERROR_MESSAGES.WALLET.INSUFFICIENT_BALANCE
            });
        }

        
        await User.findOneAndUpdate(
            { _id: referrerId, 'referrals.userId': referredUserId },
            { $set: { 'referrals.$.rewardGiven': false } }
        );

        res.json({
            success: true,
            message: SUCCESS_MESSAGES.REFERRAL.REWARD_REVOKED
        });

    } catch (error) {
        console.error('Error revoking reward:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: ERROR_MESSAGES.SERVER.INTERNAL_ERROR });
    }
};


const updateSettings = async (req, res) => {
    try {
        const {
            rewardAmount,
            bonusCouponAmount,
            minimumPurchaseAmount,
            rewardRecipient,
            autoCredit,
            isActive,
            termsAndConditions
        } = req.body;

        const settings = await ReferralSettings.getSettings();

        settings.rewardAmount = rewardAmount || settings.rewardAmount;
        settings.bonusCouponAmount = bonusCouponAmount || settings.bonusCouponAmount;
        settings.minimumPurchaseAmount = minimumPurchaseAmount || settings.minimumPurchaseAmount;
        settings.rewardRecipient = rewardRecipient || settings.rewardRecipient;
        settings.autoCredit = autoCredit !== undefined ? autoCredit : settings.autoCredit;
        settings.isActive = isActive !== undefined ? isActive : settings.isActive;
        settings.termsAndConditions = termsAndConditions || settings.termsAndConditions;
        settings.updatedBy = req.session.admin._id;

        await settings.save();

        res.json({
            success: true,
            message: SUCCESS_MESSAGES.SETTINGS.UPDATED,
            settings
        });

    } catch (error) {
        console.error('Error updating settings:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: ERROR_MESSAGES.SERVER.INTERNAL_ERROR });
    }
};


const getReferralStats = async (req, res) => {
    try {
        const totalReferrers = await User.countDocuments({ 'referrals.0': { $exists: true } });

        const allUsers = await User.find({ 'referrals.0': { $exists: true } }).select('referrals').lean();

        let totalReferrals = 0;
        let totalRewardsGiven = 0;
        let pendingRewards = 0;

        allUsers.forEach(user => {
            totalReferrals += user.referrals.length;
            const given = user.referrals.filter(r => r.rewardGiven).length;
            totalRewardsGiven += given;
            pendingRewards += (user.referrals.length - given);
        });

        const settings = await ReferralSettings.getSettings();
        const totalRewardAmount = totalRewardsGiven * settings.rewardAmount;

        res.json({
            success: true,
            stats: {
                totalReferrers,
                totalReferrals,
                totalRewardsGiven,
                pendingRewards,
                totalRewardAmount,
                settings
            }
        });

    } catch (error) {
        console.error('Error getting referral stats:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: ERROR_MESSAGES.SERVER.INTERNAL_ERROR });
    }
};

export {
    loadReferralsPage,
    loadReferralDetails,
    manualCreditReward,
    revokeReward,
    updateSettings,
    getReferralStats
};
