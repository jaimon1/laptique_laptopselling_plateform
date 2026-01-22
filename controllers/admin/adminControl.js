import User from '../../models/userSchema.js';
import bcrypt from 'bcrypt';
import { ERROR_MESSAGES } from '../../constants/index.js';




const loadLogin = (req, res) => {
    if (req.session.admin) {
        res.redirect('/admin');
    } else {
        res.render('adminLogin', { msg: null });
    }
}

const registerLogin = async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.render('adminLogin', { msg: ERROR_MESSAGES.VALIDATION.REQUIRED_FIELDS });
        }

        const user = await User.findOne({ email, isAdmin: true });
        
        if (!user) {
            return res.render('adminLogin', { msg: ERROR_MESSAGES.AUTH.INVALID_CREDENTIALS });
        }

        const comparePassword = await bcrypt.compare(password, user.password);
        
        if (comparePassword) {
            
            req.session.regenerate((err) => {
                if (err) {
                    console.error('Admin session regeneration error:', err);
                    return res.render('adminLogin', { msg: ERROR_MESSAGES.AUTH.LOGIN_FAILED });
                }
                
                
                req.session.admin = user._id;
                
                
                req.session.save((err) => {
                    if (err) {
                        console.error('Admin session save error:', err);
                        return res.render('adminLogin', { msg: ERROR_MESSAGES.AUTH.LOGIN_FAILED });
                    }
                    return res.redirect('/admin');
                });
            });
        } else {
            return res.render('adminLogin', { msg: ERROR_MESSAGES.AUTH.INVALID_CREDENTIALS });
        }
    } catch (error) {
        console.error('Admin Login Error:', error);
        res.render('adminLogin', { msg: ERROR_MESSAGES.SERVER.INTERNAL_ERROR });
    }
}

const dashboard = async (req, res) => {
    try {
        if (req.session.admin) {
            return res.render('dashboard');
        }
        return res.redirect('/admin/login');
    } catch (error) {
        console.error('Dashboard error:', error);
        res.redirect('/pageError');
    }
}

const pageError = (req, res) => {
    res.render('pageNotFound')
}

const logoutPage = (req, res) => {
    try {
        console.log('Admin logout initiated');
        console.log('Admin session before destroy:', req.session.admin);
        
        
        req.session.destroy((err) => {
            if (err) {
                console.log("An Error Occurred While Admin Logout:", err);
                return res.redirect("/admin/pageError");
            }
            
            console.log('Admin session destroyed successfully');
            
            
            res.clearCookie('admin.sid', { 
                path: '/admin' 
            });
            
            console.log('Admin cookie cleared');
            res.redirect('/admin/login');
        });
    } catch (error) {
        console.log("Admin logout error:", error);
        res.redirect('/admin/pageError');
    }
}

const loadOffersPage = (req, res) => {
    try {
        if (req.session.admin) {
            return res.render('offers');
        }
        return res.redirect('/admin/login');
    } catch (error) {
        res.redirect('/admin/pageError');
        console.log(error)
    }
}

export {
    loadLogin,
    registerLogin,
    dashboard,
    pageError,
    logoutPage,
    loadOffersPage
}