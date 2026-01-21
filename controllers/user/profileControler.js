import User from '../../models/userSchema.js';
import Order from '../../models/orderSchema.js';
import Address from '../../models/addressSchema.js';
import bcrypt from 'bcrypt';
import nodemailer from 'nodemailer';
import { HTTP_STATUS, ERROR_MESSAGES, SUCCESS_MESSAGES } from '../../constants/index.js';
const loadProfile = async (req, res) => {
    try {
        let { _id } = req.session.user || req.user
        const userData = await User.findById(_id);

        if (!userData) {
            return res.status(HTTP_STATUS.NOT_FOUND).render('pageNotFound');
        }

        const totalOrders = await Order.countDocuments({ userId: _id });
        const userOrders = await Order.find({ userId: _id }).populate('orderItems.product').sort({ createdOn: -1 }).limit(5);
        const userAddresses = await Address.findOne({ userId: _id });

        res.render('userProfile', {
            user: userData,
            totalOrders,
            orders: userOrders,
            addresses: userAddresses ? userAddresses.address : []
        })
    } catch (error) {
        console.log(error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).render('pageNotFound');
    }
}

const loadEditProfile = async (req, res) => {
    try {

        let { _id } = req.session.user || req.user
        const userData = await User.findById(_id);
        const dateOfBirth = userData.dateOfBirth ? new Date(userData.dateOfBirth) : null;
        
        res.render('editProfile',{ user: userData,dateOfBirth });
    } catch (error) {
        console.log(error);
    }
}

const editprofile = async (req, res) => {
    try {
        const { _id } = req.session.user || req.user;
        const userId = _id;
        const orEmail = await User.findOne({_id}); 
        let { firstName, email, phone, dateOfBirth, gender } = req.body;

        
        firstName = firstName?.trim();
        email = email?.trim();
        phone = phone?.trim();
        gender = gender?.trim();

        
        const errors = [];

        
        if (!firstName) errors.push("Name is required");
        if (!email) errors.push("Email is required");
        if (!phone) errors.push("Phone number is required");
        if (!gender) errors.push("Gender is required");

        
        if (firstName) {
            if (firstName.length < 3 || firstName.length > 50) {
                errors.push("Name must be between 3 and 50 characters");
            }
            if (!/^[a-zA-Z\s]+$/.test(firstName)) {
                errors.push("Name must contain only letters and spaces");
            }
        }

        
        if (email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                errors.push("Please enter a valid email address");
            } else {
                
                const isHasemail = await User.findOne({ email });
                if (isHasemail && orEmail.email != email) {
                    errors.push("Email already exists");
                }
            }
        }

        
        if (phone) {
            if (!/^[6-9]\d{9}$/.test(phone)) {
                errors.push("Phone must be a valid 10-digit Indian mobile number starting with 6-9");
            }
        }

        
        if (gender && !['male', 'female', 'other', 'prefer-not-to-say'].includes(gender)) {
            errors.push("Invalid gender selection");
        }

        
        if (dateOfBirth) {
            const dobDate = new Date(dateOfBirth);
            const today = new Date();
            const age = today.getFullYear() - dobDate.getFullYear();
            
            if (age < 13) {
                errors.push("You must be at least 13 years old");
            } else if (age > 120) {
                errors.push("Please enter a valid date of birth");
            }
        }

        
        if (errors.length > 0) {
            console.log("Validation errors:", errors);
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
                status: false, 
                message: errors.join('. ')
            });
        }

        
        await User.findByIdAndUpdate(userId, {
            name: firstName,
            email: email,
            phone: phone,
            dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
            gender: gender
        });

        
        if (req.session.user) {
            req.session.user.name = firstName;
            req.session.user.email = email;
            req.session.user.phone = phone;
        }

        setTimeout(() => {
            res.redirect('/profile');
        }, 2000);

    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ 
            status: false, 
            message: ERROR_MESSAGES.USER.UPDATE_FAILED
        });
    }
}

const uploadImage = async(req,res)=>{
    try {

        const { _id } = req.session.user || req.user;
        if(!req.file){
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success:false,
                message: ERROR_MESSAGES.FILE.UPLOAD_FAILED
            });
        }
        const profileImage = `/uploads/re-images/${req.file.filename}`;

        await User.findByIdAndUpdate(_id,{
            profileImage:profileImage
        });
        res.status(HTTP_STATUS.OK).json({
            success:true, 
            message: SUCCESS_MESSAGES.USER.PROFILE_UPDATED
        });
    } catch (error) {
        console.log(error);
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false, 
            message: ERROR_MESSAGES.SERVER.INTERNAL_ERROR
        });
    }
}


const sendEmailVerificationOTP = async (req, res) => {
    try {
        const { email } = req.body;
        const { _id } = req.session.user || req.user;

        
        const existingUser = await User.findOne({ email, _id: { $ne: _id } });
        if (existingUser) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
                success: false, 
                message: ERROR_MESSAGES.USER.ALREADY_EXISTS
            });
        }

        
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        
        
        req.session.emailVerificationOTP = {
            otp: otp,
            email: email,
            expires: Date.now() + 10 * 60 * 1000 
        };

        
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

        await transporter.sendMail({
            from: process.env.EMAIL_ADDRESS,
            to: email,
            subject: "Email Verification OTP - LapTique",
            text: `Your OTP for email verification is: ${otp}. This OTP will expire in 10 minutes.`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #4f7cff;">Email Verification</h2>
                    <p>Your OTP for email verification is:</p>
                    <div style="background: #f8f9fa; padding: 20px; text-align: center; font-size: 24px; font-weight: bold; color: #4f7cff; border-radius: 8px; margin: 20px 0;">
                        ${otp}
                    </div>
                    <p>This OTP will expire in 10 minutes.</p>
                    <p>If you didn't request this verification, please ignore this email.</p>
                </div>
            `
        });

        res.status(HTTP_STATUS.OK).json({ 
            success: true, 
            message: SUCCESS_MESSAGES.AUTH.EMAIL_VERIFIED
        });
    } catch (error) {
        console.log(error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ 
            success: false, 
            message: ERROR_MESSAGES.SERVER.INTERNAL_ERROR
        });
    }
};

const verifyEmailOTP = async (req, res) => {
    try {
        const { otp, email } = req.body;
        const { _id } = req.session.user || req.user;

        const storedOTP = req.session.emailVerificationOTP;

        if (!storedOTP || storedOTP.email !== email) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
                success: false, 
                message: ERROR_MESSAGES.AUTH.TOKEN_INVALID
            });
        }

        if (Date.now() > storedOTP.expires) {
            delete req.session.emailVerificationOTP;
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
                success: false, 
                message: ERROR_MESSAGES.AUTH.TOKEN_INVALID
            });
        }

        if (storedOTP.otp !== otp) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
                success: false, 
                message: ERROR_MESSAGES.AUTH.TOKEN_INVALID
            });
        }

        
        await User.findByIdAndUpdate(_id, { email: email });

        
        delete req.session.emailVerificationOTP;

        res.status(HTTP_STATUS.OK).json({ 
            success: true, 
            message: SUCCESS_MESSAGES.AUTH.EMAIL_VERIFIED
        });
    } catch (error) {
        console.log(error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ 
            success: false, 
            message: ERROR_MESSAGES.SERVER.INTERNAL_ERROR
        });
    }
};


const changePassword = async (req, res) => {
    try {
        let { currentPassword, newPassword } = req.body;
        const { _id } = req.session.user || req.user;

        
        currentPassword = currentPassword?.trim();
        newPassword = newPassword?.trim();

        
        const errors = [];

        
        if (!currentPassword) errors.push("Current password is required");
        if (!newPassword) errors.push("New password is required");

        
        if (currentPassword && currentPassword.length < 6) {
            errors.push("Current password must be at least 6 characters");
        }

        
        if (newPassword) {
            if (newPassword.length < 8) {
                errors.push("New password must be at least 8 characters long");
            }
            if (newPassword.length > 50) {
                errors.push("New password must not exceed 50 characters");
            }
            if (!/[a-z]/.test(newPassword)) {
                errors.push("New password must contain at least one lowercase letter");
            }
            if (!/[A-Z]/.test(newPassword)) {
                errors.push("New password must contain at least one uppercase letter");
            }
            if (!/[0-9]/.test(newPassword)) {
                errors.push("New password must contain at least one number");
            }
            if (!/[^a-zA-Z0-9]/.test(newPassword)) {
                errors.push("New password must contain at least one special character");
            }
        }

        
        if (currentPassword && newPassword && currentPassword === newPassword) {
            errors.push("New password must be different from current password");
        }

        
        if (errors.length > 0) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
                success: false, 
                message: errors.join('. ')
            });
        }

        const user = await User.findById(_id);
        if (!user) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({ 
                success: false, 
                message: ERROR_MESSAGES.USER.NOT_FOUND
            });
        }

        
        if (!user.password) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
                success: false, 
                message: ERROR_MESSAGES.USER.INVALID_EMAIL
            });
        }

        
        const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
        if (!isCurrentPasswordValid) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
                success: false, 
                message: ERROR_MESSAGES.AUTH.INVALID_CREDENTIALS
            });
        }

        
        const saltRounds = 10;
        const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

        
        await User.findByIdAndUpdate(_id, { password: hashedNewPassword });

        res.status(HTTP_STATUS.OK).json({ 
            success: true, 
            message: SUCCESS_MESSAGES.AUTH.PASSWORD_CHANGED
        });
    } catch (error) {
        console.error('Error changing password:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ 
            success: false, 
            message: ERROR_MESSAGES.USER.UPDATE_FAILED
        });
    }
};


const getAddresses = async (req, res) => {
    try {
        const { _id } = req.session.user || req.user;
        const userAddresses = await Address.findOne({ userId: _id });
        
        res.status(HTTP_STATUS.OK).json({ 
            success: true, 
            addresses: userAddresses ? userAddresses.address : [] 
        });
    } catch (error) {
        console.log(error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ 
            success: false, 
            message: ERROR_MESSAGES.ADDRESS.NOT_FOUND
        });
    }
};

const addAddress = async (req, res) => {
    try {
        const { _id } = req.session.user || req.user;
        let { addressType, name, city, landmark, state, phone, altPhone } = req.body;

        
        addressType = addressType?.trim();
        name = name?.trim();
        city = city?.trim();
        landmark = landmark?.trim();
        state = state?.trim();
        phone = phone?.trim();
        altPhone = altPhone?.trim();


        const errors = [];

        
        if (!addressType) errors.push("Address type is required");
        if (!name) errors.push("Name is required");
        if (!city) errors.push("City is required");
        if (!landmark) errors.push("Landmark/Address is required");
        if (!state) errors.push("State is required");
        if (!phone) errors.push("Phone number is required");

        
        if (addressType && !['Home', 'Work', 'Other'].includes(addressType)) {
            errors.push("Invalid address type");
        }

        
        if (name) {
            if (name.length < 3 || name.length > 50) {
                errors.push("Name must be between 3 and 50 characters");
            }
            if (!/^[a-zA-Z\s]+$/.test(name)) {
                errors.push("Name must contain only letters and spaces");
            }
        }

        
        if (landmark) {
            if (landmark.length < 3 || landmark.length > 100) {
                errors.push("Landmark must be between 3 and 100 characters");
            }
        }


        if (city) {
            if (city.length < 2 || city.length > 50) {
                errors.push("City must be between 2 and 50 characters");
            }
            if (!/^[a-zA-Z\s]+$/.test(city)) {
                errors.push("City must contain only letters and spaces");
            }
        }

        
        if (state) {
            if (state.length < 2 || state.length > 50) {
                errors.push("State must be between 2 and 50 characters");
            }
            if (!/^[a-zA-Z\s]+$/.test(state)) {
                errors.push("State must contain only letters and spaces");
            }
        }

        
        if (phone) {
            if (!/^[6-9]\d{9}$/.test(phone)) {
                errors.push("Phone must be a valid 10-digit Indian mobile number starting with 6-9");
            }
        }

        
        if (altPhone) {
            if (!/^[6-9]\d{9}$/.test(altPhone)) {
                errors.push("Alternative phone must be a valid 10-digit Indian mobile number starting with 6-9");
            }
            if (phone && altPhone === phone) {
                errors.push("Alternative phone must be different from primary phone");
            }
        }

        
        if (errors.length > 0) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
                success: false, 
                message: errors.join('. ')
            });
        }

        let userAddress = await Address.findOne({ userId: _id });

        const newAddress = {
            addressType,
            name,
            city,
            landmark,
            state,
            phone,
            altPhone: altPhone || phone
        };

        if (userAddress) {
            userAddress.address.push(newAddress);
            await userAddress.save();
        } else {
            userAddress = new Address({
                userId: _id,
                address: [newAddress]
            });
            await userAddress.save();
        }

        res.status(HTTP_STATUS.OK).json({ success: true, message: SUCCESS_MESSAGES.ADDRESS.ADDED });
    } catch (error) {
        console.error('Error adding address:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: ERROR_MESSAGES.SERVER.INTERNAL_ERROR });
    }
};

const editAddress = async (req, res) => {
    try {
        const { _id } = req.session.user || req.user;
        const { addressId } = req.params;
        let { addressType, name, city, landmark, state, phone, altPhone } = req.body;

        
        addressType = addressType?.trim();
        name = name?.trim();
        city = city?.trim();
        landmark = landmark?.trim();
        state = state?.trim();
        phone = phone?.trim();
        altPhone = altPhone?.trim();


        const errors = [];

        
        if (!addressType) errors.push("Address type is required");
        if (!name) errors.push("Name is required");
        if (!city) errors.push("City is required");
        if (!landmark) errors.push("Landmark/Address is required");
        if (!state) errors.push("State is required");
        if (!phone) errors.push("Phone number is required");

        
        if (addressType && !['Home', 'Work', 'Other'].includes(addressType)) {
            errors.push("Invalid address type");
        }

        
        if (name) {
            if (name.length < 3 || name.length > 50) {
                errors.push("Name must be between 3 and 50 characters");
            }
            if (!/^[a-zA-Z\s]+$/.test(name)) {
                errors.push("Name must contain only letters and spaces");
            }
        }

        
        if (landmark) {
            if (landmark.length < 3 || landmark.length > 100) {
                errors.push("Landmark must be between 3 and 100 characters");
            }
        }

        
        if (city) {
            if (city.length < 2 || city.length > 50) {
                errors.push("City must be between 2 and 50 characters");
            }
            if (!/^[a-zA-Z\s]+$/.test(city)) {
                errors.push("City must contain only letters and spaces");
            }
        }

        
        if (state) {
            if (state.length < 2 || state.length > 50) {
                errors.push("State must be between 2 and 50 characters");
            }
            if (!/^[a-zA-Z\s]+$/.test(state)) {
                errors.push("State must contain only letters and spaces");
            }
        }

        
        if (phone) {
            if (!/^[6-9]\d{9}$/.test(phone)) {
                errors.push("Phone must be a valid 10-digit Indian mobile number starting with 6-9");
            }
        }

        
        if (altPhone) {
            if (!/^[6-9]\d{9}$/.test(altPhone)) {
                errors.push("Alternative phone must be a valid 10-digit Indian mobile number starting with 6-9");
            }
            if (phone && altPhone === phone) {
                errors.push("Alternative phone must be different from primary phone");
            }
        }

        
        if (errors.length > 0) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
                success: false, 
                message: errors.join('. ')
            });
        }

        const userAddress = await Address.findOne({ userId: _id });
        if (!userAddress) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({ 
                success: false, 
                message: ERROR_MESSAGES.ADDRESS.NOT_FOUND
            });
        }

        const addressIndex = userAddress.address.findIndex(addr => addr._id.toString() === addressId);
        if (addressIndex === -1) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({ 
                success: false, 
                message: ERROR_MESSAGES.ADDRESS.NOT_FOUND
            });
        }

        userAddress.address[addressIndex] = {
            ...userAddress.address[addressIndex]._doc,
            addressType,
            name,
            city,
            landmark,
            state,
            phone,
            altPhone: altPhone || phone
        };

        await userAddress.save();

        res.status(HTTP_STATUS.OK).json({ 
            success: true, 
            message: SUCCESS_MESSAGES.ADDRESS.UPDATED
        });
    } catch (error) {
        console.error('Error updating address:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ 
            success: false, 
            message: ERROR_MESSAGES.ADDRESS.UPDATE_FAILED
        });
    }
};

const deleteAddress = async (req, res) => {
    try {
        const { _id } = req.session.user || req.user;
        const { addressId } = req.params;

        const userAddress = await Address.findOne({ userId: _id });
        if (!userAddress) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({ success: false, message: ERROR_MESSAGES.ADDRESS.NOT_FOUND });
        }

        userAddress.address = userAddress.address.filter(addr => addr._id.toString() !== addressId);
        await userAddress.save();

        res.status(HTTP_STATUS.OK).json({ success: true, message: SUCCESS_MESSAGES.ADDRESS.DELETED });
    } catch (error) {
        console.log(error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: ERROR_MESSAGES.SERVER.INTERNAL_ERROR });
    }
};


const getOrderDetails = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { _id } = req.session.user || req.user;

        const order = await Order.findOne({ _id: orderId, userId: _id })
            .populate('orderItems.product');

        if (!order) {
            return res.status(HTTP_STATUS.NOT_FOUND).render('pageNotFound');
        }

        res.render('orderDetails', {
            user: req.session.user || req.user,
            order,
            title: 'Order Details'
        });
    } catch (error) {
        console.log(error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).render('pageNotFound');
    }
};


const cancelOrder = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { reason } = req.body;
        const { _id } = req.session.user || req.user;

        const order = await Order.findOne({ _id: orderId, userId: _id });
        if (!order) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({ success: false, message: ERROR_MESSAGES.ORDER.NOT_FOUND });
        }

        if (order.status === 'Delivered' || order.status === 'cancelled') {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: ERROR_MESSAGES.ORDER.CANNOT_CANCEL });
        }

        await Order.findByIdAndUpdate(orderId, { 
            status: 'cancelled',
            cancelReason: reason,
            cancelledAt: new Date()
        });

        res.status(HTTP_STATUS.OK).json({ success: true, message: SUCCESS_MESSAGES.ORDER.CANCELLED });
    } catch (error) {
        console.log(error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: ERROR_MESSAGES.SERVER.INTERNAL_ERROR });
    }
};

export {
    loadProfile,
    loadEditProfile,
    editprofile,
    uploadImage,
    sendEmailVerificationOTP,
    verifyEmailOTP,
    changePassword,
    getAddresses,
    addAddress,
    editAddress,
    deleteAddress,
    getOrderDetails,
    cancelOrder
}