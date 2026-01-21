import User from '../../models/userSchema.js';
import Product from '../../models/productSchema.js';
import nodemailer from 'nodemailer';
import Brand from '../../models/brandSchema.js';
import Category from '../../models/categorySchema.js';
import Coupon from '../../models/couponSchema.js';
import ReferralSettings from '../../models/referralSettingsSchema.js';
import dotenv from 'dotenv';
dotenv.config();
import bcrypt from 'bcrypt';
import { HTTP_STATUS, ERROR_MESSAGES, SUCCESS_MESSAGES } from '../../constants/index.js';

const pageNotFound = async (req, res) => {
    try {
        res.render('pageNotFound');
    } catch (error) {
        console.log(error);
        res.redirect('/page-not-found');
    }
}

const loadHomepage = async (req, res) => {
    try {
        const brandData = await Brand.find({
            isBlocked: false,
        })
        const categoryData = await Category.find({
            isListed: true,
        })
        const search = req.query.search || '';
        const page = parseInt(req.query.page) || 1;
        const limit = 8
        const skip = (page - 1) * limit;
        const existsProducts = await Product.find({
            isBlocked: false,
        }).skip(skip).limit(limit).sort({ createdAt: -1 });

        if (!existsProducts || existsProducts.length === 0) {
            console.log("No More Product Available");
        }

        const totalCount = await Product.countDocuments({
            isBlocked: false
        });

        let totalPages = Math.ceil(totalCount / limit);


        if (req.session.user || req.user) {
            res.render('index', {
                user: req.session.user || req.user,
                totalPages: totalPages,
                currentPage: page,
                brandData: brandData,
                categoryData: categoryData,
                productData: existsProducts,
                search: search

            });
        } else {
            res.render('index', {
                user: false,
                brandData: brandData,
                categoryData: categoryData,
                totalPages: totalPages,
                currentPage: page,
                productData: existsProducts,
                search: search
            });
        }
    } catch (error) {
        console.log('Home page not found',error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send('Server not Found');
    }
};
const loadregisterPage = async (req, res) => {
    try {
        if (!req.session.user) {
            const referralCode = req.query.ref || '';
            res.render('Signup', { msg: null, referralCode });
        } else {
            res.redirect('/');
        }
    } catch (error) {
        console.log('Error occured on register page',error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send("Server not found");
    }
}

function genarateOtp() {
    return Math.floor(100000 + Math.random() * 900000);
}

async function sendMailVerification(email, otp, name) {
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
                user: process.env.EMAIL_ADDRESS,
                pass: process.env.EMAIL_PASSWORD
            }
        });
        const info = await transporter.sendMail({
            from: process.env.EMAIL_ADDRESS,
            to: email,
            subject: "Email Verification",
            text: `Your OTP is ${otp}`,
            html: `Hi <b>${name} I'm a Proffessional Web Developer <b>JAIMON A A</b> </b> <b>Your One Time Password is ${otp}</b>`
        });

        return info.accepted.length > 0;

    } catch (error) {
        console.log("Something went wrong while sending email to the user",error);
        return false;
    }
}

const registration = async (req, res) => {

    try {
        const { username, phone, email, password, confirmPassword, referralCode } = req.body;

        if (password !== confirmPassword) {
            return res.render('Signup', { msg: "Password do not match", referralCode: referralCode || '' })
        }

        const emailAlreadyExists = await User.findOne({ email });

        if (emailAlreadyExists) {
            return res.render('Signup', { msg: "Email Already Exists", referralCode: referralCode || '' });
        }

        
        let referrer = null;
        if (referralCode && referralCode.trim()) {
            referrer = await User.findOne({ referralCode: referralCode.trim().toUpperCase() });
            if (!referrer) {
                return res.render('Signup', { msg: "Invalid referral code", referralCode: referralCode || '' });
            }
        }

        let otp = genarateOtp();

        let emailSend = sendMailVerification(email, otp, username);
        if (!emailSend) {
            res.json("email Error");
        }
        req.session.userOtp = otp;
        req.session.userData = { username, phone, email, password, referrerId: referrer?._id };

        res.render('otpVerify');
        console.log(`otp Sent Successfully ${otp}`);
    } catch (error) {
        console.log(`An Error occured ${error}`);
        res.redirect('/page-not-found');
    }

}

async function secretPassword(password) {
    const hashedPassword = await bcrypt.hash(password, 10);
    return hashedPassword;
}
function generateReferralCode(name) {
    const prefix = name.substring(0, 3).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${prefix}${random}`;
}

const verifyOtp = async function (req, res) {
    try {
        const { otp } = req.body;
        console.log(req.session.userOtp);
        console.log(otp);
        if (req.session.userOtp == otp) {
            const user = req.session.userData;
            const hashedPassword = await secretPassword(user.password);

            
            let referralCode = generateReferralCode(user.username);
            let isUnique = false;
            while (!isUnique) {
                const existing = await User.findOne({ referralCode });
                if (!existing) {
                    isUnique = true;
                } else {
                    referralCode = generateReferralCode(user.username);
                }
            }

            const newUser = new User({
                name: user.username,
                password: hashedPassword,
                email: user.email,
                phone: user.phone,
                referralCode: referralCode,
                referredBy: user.referrerId || null
            });
            await newUser.save();

            
            if (user.referrerId) {
                await User.findByIdAndUpdate(user.referrerId, {
                    $push: {
                        referrals: {
                            userId: newUser._id,
                            registeredOn: new Date(),
                            rewardGiven: false
                        }
                    }
                });

                
                try {
                    const settings = await ReferralSettings.getSettings();
                    const couponCode = `WELCOME${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
                    const expiryDate = new Date();
                    expiryDate.setDate(expiryDate.getDate() + 30); 

                    const welcomeCoupon = new Coupon({
                        name: couponCode,
                        description: `Welcome bonus for joining via referral`,
                        createdOn: new Date(),
                        expireOn: expiryDate,
                        discountType: 'fixed',
                        discountValue: settings.bonusCouponAmount, 
                        minimumPrice: settings.minimumPurchaseAmount,
                        isActive: true,
                        usageLimit: 1,
                        usersUsed: [{
                            userId: newUser._id,
                            count: 0 
                        }]
                    });

                    await welcomeCoupon.save();
                    
                } catch (couponError) {
                    console.error(' Error creating welcome coupon:', couponError);
                    
                }
            }

         
            req.session.regenerate((err) => {
                if (err) {
                    console.error('Session regeneration error:', err);
                    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ 
                        success: false, 
                        msg: ERROR_MESSAGES.AUTH.SESSION_EXPIRED
                    });
                }

          
                req.session.user = newUser;

      
                req.session.save((err) => {
                    if (err) {
                        console.error('Session save error:', err);
                        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ 
                            success: false, 
                            msg: ERROR_MESSAGES.AUTH.SESSION_EXPIRED
                        });
                    }
                    res.status(HTTP_STATUS.OK).json({ 
                        success: true, 
                        message: SUCCESS_MESSAGES.AUTH.REGISTER_SUCCESS, 
                        redirectUrl: "/" 
                    });
                });
            });
        } else {
            res.status(HTTP_STATUS.BAD_REQUEST).json({ 
                success: false, 
                msg: ERROR_MESSAGES.AUTH.TOKEN_INVALID
            });
        }
    } catch (error) {
        console.log(`Error Veryfying OTP ${error}`);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ 
            success: false, 
            mag: ERROR_MESSAGES.SERVER.INTERNAL_ERROR
        });
    }
}

const resendOtp = async function (req, res) {
    try {
        const { email, username } = req.session.userData;

        if (!email) {
            res.json({ success: false, msg: "Email not Found in the session" });
        }

        const otp = genarateOtp();

        const resendEmail = sendMailVerification(email, otp, username);

        if (resendEmail) {
            req.session.userOtp = otp;
            res.status(HTTP_STATUS.OK).json({ 
                success: true, 
                msg: SUCCESS_MESSAGES.AUTH.EMAIL_VERIFIED
            });
            console.log("Otp Resend", otp);

        } else {
            res.status(HTTP_STATUS.BAD_REQUEST).json({ 
                success: false, 
                msg: ERROR_MESSAGES.SERVER.INTERNAL_ERROR
            });
            console.log("Otp Resinding unsuccessfull");
        }
    } catch (error) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({ 
            success: false, 
            msg: ERROR_MESSAGES.SERVER.INTERNAL_ERROR
        });
        console.log("An error Occured", error);
    }
}

const loadLogin = async (req, res) => {
    try {
        if (!req.session.user && !req.user) {
            let msg = "";
            if (req.query.error === 'blocked') {
                msg = "Your account has been blocked by the administrator.";
            } else if (req.query.error === 'google_blocked') {
                msg = "User blocked by admin";
            }
            res.render('login', { msg: msg, success: null })
        } else {
            res.redirect('/');
        }
    } catch (error) {
        console.log(error);
        res.redirect('/page-not-found')
    }
}

const loginRegister = async (req, res) => {
    try {
        const { email, password } = req.body;
        const findUser = await User.findOne({ isAdmin: 0, email: email });

        if (!findUser) {
            return res.render('login', { msg: "User Not Exists", success: null })
        }
        if (findUser.isBlocked) {
            return res.render('login', { msg: "User Blocked by Jaimon", success: null })
        }
        const comparePassword = await bcrypt.compare(password, findUser.password)
        if (!comparePassword) {
            return res.render('login', { msg: "Password Not Match", success: null });
        }

        req.session.regenerate((err) => {
            if (err) {
                console.error('Session regeneration error:', err);
                return res.render('login', { msg: "Login failed. Please try again.", success: null });
            }

            
            req.session.user = findUser;

       
            req.session.save((err) => {
                if (err) {
                    console.error('Session save error:', err);
                    return res.render('login', { msg: "Login failed. Please try again.", success: null });
                }
                res.redirect('/');
            });
        });
    } catch (error) {
        console.error('Login Error', error);
        res.redirect('/page-not-found');
    }
}
const logout = (req, res, next) => {
    try {
        console.log('User logout initiated');
        console.log('User session before destroy:', req.session.user);


        req.logout(function (err) {
            if (err) {
                console.log('Passport logout error:', err);
            }

        
            req.session.destroy((err) => {
                if (err) {
                    console.log('User session destroy error:', err);
                    return next(err);
                }

                console.log('User session destroyed successfully');

       
                res.clearCookie('user.sid', {
                    path: '/'
                });

                console.log('User cookie cleared');
                res.redirect('/login');
            });
        });
    } catch (error) {
        console.log('User logout error:', error);
        res.redirect('/login');
    }
}

const loadShopPage = async (req, res) => {
    try {

        res.render("shop")

    } catch (error) {
        console.log(error);
    }
}
async function sendForgotPasswordOtp(email, otp, name) {
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
                user: process.env.EMAIL_ADDRESS,
                pass: process.env.EMAIL_PASSWORD
            }
        });

        const info = await transporter.sendMail({
            from: process.env.EMAIL_ADDRESS,
            to: email,
            subject: "Password Reset OTP",
            text: `Your password reset OTP is ${otp}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333;">Password Reset OTP</h2>
                    <p>Hi <strong>${name}</strong>,</p>
                    <p>You requested to reset your password. Use the OTP below to proceed:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; display: inline-block;">
                            <h1 style="color: #d10024; margin: 0; font-size: 32px; letter-spacing: 5px;">${otp}</h1>
                        </div>
                    </div>
                    <p><strong>This OTP will expire in 10 minutes.</strong></p>
                    <p>If you didn't request this password reset, please ignore this email.</p>
                    <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
                    <p style="color: #666; font-size: 12px;">This email was sent by LapTique - Your Premium Laptop Store</p>
                </div>
            `
        });

        return info.accepted.length > 0;

    } catch (error) {
        console.log("Error sending forgot password OTP:", error);
        return false;
    }
}

const loadForgotPassword = async (req, res) => {
    try {
        if (req.session.user || req.user) {
            return res.redirect('/');
        }
        res.render('forgotPassword', { msg: null, success: null });
    } catch (error) {
        console.log('Error loading forgot password page:', error);
        res.redirect('/page-not-found');
    }
}

const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email: email, isAdmin: 0 });

        if (!user) {
            return res.render('forgotPassword', {
                msg: "No account found with this email address",
                success: null
            });
        }

        if (user.isBlocked) {
            return res.render('forgotPassword', {
                msg: "Your account has been blocked. Please contact support.",
                success: null
            });
        }


        const otp = genarateOtp();


        req.session.forgotPasswordOtp = otp;
        req.session.forgotPasswordEmail = email;
        req.session.forgotPasswordOtpExpiry = Date.now() + 600000; 


        const emailSent = await sendForgotPasswordOtp(email, otp, user.name);

        if (emailSent) {
            console.log(`Forgot Password OTP sent: ${otp}`); 
            res.render('forgotPasswordOtp');
        } else {
            res.render('forgotPassword', {
                msg: "Failed to send OTP. Please try again later.",
                success: null
            });
        }

    } catch (error) {
        console.log('Error in forgot password:', error);
        res.render('forgotPassword', {
            msg: "An error occurred. Please try again later.",
            success: null
        });
    }
}

const verifyForgotPasswordOtp = async (req, res) => {
    try {
        const { otp } = req.body;

        if (!req.session.forgotPasswordOtp || !req.session.forgotPasswordEmail) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                msg: ERROR_MESSAGES.AUTH.SESSION_EXPIRED
            });
        }
        if (Date.now() > req.session.forgotPasswordOtpExpiry) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                msg: ERROR_MESSAGES.AUTH.TOKEN_INVALID
            });
        }
        if (req.session.forgotPasswordOtp == otp) {
            req.session.forgotPasswordVerified = true;
            res.status(HTTP_STATUS.OK).json({
                success: true,
                message: SUCCESS_MESSAGES.AUTH.EMAIL_VERIFIED,
                redirectUrl: "/reset-password-with-otp"
            });
        } else {
            res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                msg: ERROR_MESSAGES.AUTH.TOKEN_INVALID
            });
        }

    } catch (error) {
        console.log('Error verifying forgot password OTP:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            msg: ERROR_MESSAGES.SERVER.INTERNAL_ERROR
        });
    }
}

const resendForgotPasswordOtp = async (req, res) => {
    try {
        if (!req.session.forgotPasswordEmail) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                msg: ERROR_MESSAGES.AUTH.SESSION_EXPIRED
            });
        }

        const email = req.session.forgotPasswordEmail;
        const user = await User.findOne({ email: email, isAdmin: 0 });

        if (!user) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                msg: ERROR_MESSAGES.USER.NOT_FOUND
            });
        }
        const otp = genarateOtp();

        req.session.forgotPasswordOtp = otp;
        req.session.forgotPasswordOtpExpiry = Date.now() + 600000; 

        const emailSent = await sendForgotPasswordOtp(email, otp, user.name);

        if (emailSent) {
            console.log(`Forgot Password OTP resent: ${otp}`); 
            res.status(HTTP_STATUS.OK).json({
                success: true,
                msg: SUCCESS_MESSAGES.AUTH.EMAIL_VERIFIED
            });
        } else {
            res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                msg: ERROR_MESSAGES.SERVER.INTERNAL_ERROR
            });
        }

    } catch (error) {
        console.log('Error resending forgot password OTP:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            msg: ERROR_MESSAGES.SERVER.INTERNAL_ERROR
        });
    }
}

const loadResetPasswordWithOtp = async (req, res) => {
    try {
        
        if (!req.session.forgotPasswordVerified || !req.session.forgotPasswordEmail) {
            return res.redirect('/forgot-password');
        }

        res.render('resetPassword', {
            msg: null,
            success: null
        });

    } catch (error) {
        console.log('Error loading reset password page:', error);
        res.redirect('/page-not-found');
    }
}

const resetPasswordWithOtp = async (req, res) => {
    try {
        const { password, confirmPassword } = req.body;

        
        if (!req.session.forgotPasswordVerified || !req.session.forgotPasswordEmail) {
            return res.render('resetPassword', {
                msg: "Session expired. Please start the process again.",
                success: null
            });
        }
        if (password !== confirmPassword) {
            return res.render('resetPassword', {
                msg: "Passwords do not match",
                success: null
            });
        }
        if (password.length < 8) {
            return res.render('resetPassword', {
                msg: "Password must be at least 8 characters long",
                success: null
            });
        }

        const user = await User.findOne({
            email: req.session.forgotPasswordEmail,
            isAdmin: 0
        });

        if (!user) {
            return res.render('resetPassword', {
                msg: "User not found.",
                success: null
            });
        }

        const hashedPassword = await secretPassword(password);

        user.password = hashedPassword;
        await user.save();

        delete req.session.forgotPasswordOtp;
        delete req.session.forgotPasswordEmail;
        delete req.session.forgotPasswordOtpExpiry;
        delete req.session.forgotPasswordVerified;

        res.render('login', {
            msg: null,
            success: "Password has been reset successfully. Please login with your new password."
        });

    } catch (error) {
        console.log('Error resetting password:', error);
        res.render('resetPassword', {
            msg: "An error occurred. Please try again later.",
            success: null
        });
    }
}

export {
    loadHomepage,
    pageNotFound,
    loadregisterPage,
    registration,
    verifyOtp,
    resendOtp,
    loadLogin,
    loginRegister,
    logout,
    loadShopPage,
    loadForgotPassword,
    forgotPassword,
    verifyForgotPasswordOtp,
    resendForgotPasswordOtp,
    loadResetPasswordWithOtp,
    resetPasswordWithOtp
}