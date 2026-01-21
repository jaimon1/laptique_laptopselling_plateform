import User from '../../models/userSchema.js';
import Coupon from '../../models/couponSchema.js';
import { HTTP_STATUS, ERROR_MESSAGES, SUCCESS_MESSAGES } from '../../constants/index.js';


function generateReferralCode(name) {
    const prefix = name.substring(0, 3).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${prefix}${random}`;
}

async function generateReferralCoupon(userId, referredUserName) {
    try {
        const couponCode = `REF${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 30); 

        const newCoupon = new Coupon({
            name: couponCode,
            description: `Referral reward for inviting ${referredUserName}`,
            createdOn: new Date(),
            expireOn: expiryDate,
            discountType: 'fixed',
            discountValue: 100, 
            minimumPrice: 500, 
            isActive: true,
            usageLimit: 1,
            usersUsed: []
        });

        await newCoupon.save();
        return couponCode;
    } catch (error) {
        console.error('Error generating referral coupon:', error);
        return null;
    }
}


const getReferralData = async (req, res) => {
    try {
        const userId = req.session.user?._id || req.user?._id;

        if (!userId) {
            return res.status(HTTP_STATUS.UNAUTHORIZED).json({ 
                success: false, 
                message: ERROR_MESSAGES.AUTH.LOGIN_REQUIRED
            });
        }

        const user = await User.findById(userId).populate('referrals.userId', 'name email createdOn');

        if (!user) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({ 
                success: false, 
                message: ERROR_MESSAGES.USER.NOT_FOUND
            });
        }

        
        if (!user.referralCode) {
            user.referralCode = generateReferralCode(user.name);
            await user.save();
        }

        const referralLink = `${req.protocol}://${req.get('host')}/register?ref=${user.referralCode}`;

        res.json({
            success: true,
            referralCode: user.referralCode,
            referralLink,
            totalReferrals: user.referrals?.length || 0,
            referrals: user.referrals || []
        });

    } catch (error) {
        console.error('Error getting referral data:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ 
            success: false, 
            message: ERROR_MESSAGES.SERVER.INTERNAL_ERROR
        });
    }
};


const loadReferralHistory = async (req, res) => {
    try {
        const userId = req.session.user?._id || req.user?._id;

        if (!userId) {
            return res.redirect('/login');
        }

        const user = await User.findById(userId).populate('referrals.userId', 'name email createdOn');

        if (!user) {
            return res.redirect('/');
        }

        
        if (!user.referralCode) {
            user.referralCode = generateReferralCode(user.name);
            await user.save();
        }

        const referralLink = `${req.protocol}://${req.get('host')}/register?ref=${user.referralCode}`;

        
        const referralCoupons = await Coupon.find({
            description: { $regex: /Referral reward/i },
            usersUsed: { $elemMatch: { userId: userId } }
        }).sort({ createdOn: -1 });

        res.render('referralHistory', {
            user: req.session.user || req.user,
            referralCode: user.referralCode,
            referralLink,
            referrals: user.referrals || [],
            totalReferrals: user.referrals?.length || 0,
            referralCoupons: referralCoupons || [],
            title: 'Referral History'
        });

    } catch (error) {
        console.error('Error loading referral history:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).render('pageNotFound');
    }
};


const processReferralReward = async (req, res) => {
    try {
        const { referredUserId } = req.body;

        const referredUser = await User.findById(referredUserId);
        if (!referredUser || !referredUser.referredBy) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
                success: false, 
                message: ERROR_MESSAGES.USER.NOT_FOUND
            });
        }

        const referrer = await User.findById(referredUser.referredBy);
        if (!referrer) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({ 
                success: false, 
                message: ERROR_MESSAGES.USER.NOT_FOUND
            });
        }

        
        const referralEntry = referrer.referrals.find(
            ref => ref.userId.toString() === referredUserId.toString()
        );

        if (referralEntry && referralEntry.rewardGiven) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
                success: false, 
                message: 'Reward already given' 
            });
        }

        
        const couponCode = await generateReferralCoupon(referrer._id, referredUser.name);

        if (!couponCode) {
            return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ 
                success: false, 
                message: ERROR_MESSAGES.COUPON.INVALID
            });
        }

        
        await User.findOneAndUpdate(
            { _id: referrer._id, 'referrals.userId': referredUserId },
            { $set: { 'referrals.$.rewardGiven': true } }
        );

        res.status(HTTP_STATUS.OK).json({
            success: true,
            message: SUCCESS_MESSAGES.GENERAL.OPERATION_SUCCESS,
            couponCode
        });

    } catch (error) {
        console.error('Error processing referral reward:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ 
            success: false, 
            message: ERROR_MESSAGES.SERVER.INTERNAL_ERROR
        });
    }
};

export {
    getReferralData,
    loadReferralHistory,
    generateReferralCode,
    processReferralReward
};