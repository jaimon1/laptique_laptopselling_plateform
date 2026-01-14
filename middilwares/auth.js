import User from '../models/userSchema.js';
import { HTTP_STATUS, ERROR_MESSAGES } from '../constants/index.js';

const userAuth = async (req, res, next) => {
    try {
        let userId = null;
        if (req.session.user) {
            userId = req.session.user._id || req.session.user;
        }
        else if (req.user) {
            userId = req.user._id;
        }

        if (userId) {
            const user = await User.findById(userId);
            if (user && !user.isBlocked) {
                return next();
            } else {
                // User is blocked - destroy ONLY user session
                req.session.destroy((err) => {
                    if (err) {
                        console.log("Error destroying session:", err);
                    }
                });
                res.clearCookie('user.sid', { path: '/' });
                if (user && user.googleId) {
                    return res.redirect('/login?error=google_blocked');
                } else {
                    return res.redirect('/login?error=blocked');
                }
            }
        } else {
            return res.redirect('/login');
        }
    } catch (error) {
        console.error("Error in userAuth middleware:", error);
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(ERROR_MESSAGES.SERVER.INTERNAL_ERROR);
    }
}

const adminAuth = async (req, res, next) => {
    try {
        if (req.session.admin) {
            return next();
        } else {
            return res.redirect('/admin/login');
        }
    } catch (error) {
        console.error("Error in adminAuth middleware:", error);
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(ERROR_MESSAGES.SERVER.INTERNAL_ERROR);
    }
}

const checkUserBlocked = async (req, res, next) => {
    try {
        let userId = null;

        if (req.session.user) {
            userId = req.session.user._id || req.session.user;
        }
        else if (req.user) {
            userId = req.user._id;
        }

        if (userId) {
            const user = await User.findById(userId);
            if (user && user.isBlocked) {
                // User is blocked - destroy ONLY user session
                req.session.destroy((err) => {
                    if (err) {
                        console.log("Error destroying session:", err);
                    }
                });
                // Clear the USER cookie with correct path
                res.clearCookie('user.sid', { path: '/' });
                if (user.googleId) {
                    return res.redirect('/login?error=google_blocked');
                } else {
                    return res.redirect('/login?error=blocked');
                }
            }
        }

        next();
    } catch (error) {
        console.error("Error in checkUserBlocked middleware:", error);
        next();
    }
}

const errorHandler = (err, req, res, next) => {
    console.error("Error:", err.stack || err);

    // Check if response has already been sent
    if (res.headersSent) {
        return next(err);
    }

    // Customize based on environment
    const statusCode = res.statusCode && res.statusCode !== HTTP_STATUS.OK ? res.statusCode : HTTP_STATUS.INTERNAL_SERVER_ERROR;

    res.status(statusCode).json({
        success: false,
        message: err.message || ERROR_MESSAGES.SERVER.INTERNAL_ERROR,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
};

export {
    userAuth,
    adminAuth,
    checkUserBlocked,
    errorHandler
};