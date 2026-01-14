import User from '../../models/userSchema.js';
import { HTTP_STATUS, ERROR_MESSAGES, SUCCESS_MESSAGES } from '../../constants/index.js';


const notFound = (req, res) => {
    res.render('pageNotFound')
}

const userPage = async (req, res) => {

    try {
        let search = "";
        if (req.query.search) {
            search = req.query.search;
        }
        let limit = 4;
        let page = 1;
        if (req.query.page) {
            page = Number(req.query.page);
        }
        const userData = await User.find({
            isAdmin:false,
            $or: [
                { name: { $regex: ".*" + search + ".*", $options: "i" } },
                { email: { $regex: ".*" + search + ".*", $options: "i" } }
            ]
        }).limit(limit * 1).skip((page - 1) * limit).exec();

        const count = await User.find({
            isAdmin:false,
            $or: [
                { name: { $regex: ".*" + search + ".*" } },
                { email: { $regex: ".*" + search + ".*" } }
            ]
        }).countDocuments();

        res.render('userListing', {
            data: userData,
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            search
        });

    } catch (error) {
        res.render('pageNotFound');
        console.log(error);
    }

}

const blockUsers = async (req, res) => {
    try {
        const id = req.query.id;
        const page = req.query.page || 1;
        await User.updateOne({ _id: id }, { $set: { isBlocked: true } });
        res.redirect(`/admin/users?page=${page}`);

    } catch (error) {
        console.log(error);
        res.redirect('/pageError')
    }
}

const unBlockUsers = async (req, res) => {
    try {
        const id = req.query.id;
        const page = req.query.page || 1;
        await User.updateOne({ _id: id }, { $set: { isBlocked: false } });
        res.redirect(`/admin/users?page=${page}`);
    } catch (error) {
        console.log(error);
        res.redirect('/pageError');
    }
}


export {
    userPage,
    notFound,
    blockUsers,
    unBlockUsers

}