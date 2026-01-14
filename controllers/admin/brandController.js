import Brand from '../../models/brandSchema.js';
import sharp from 'sharp';
import path from 'path';
import {fileURLToPath} from 'url';
import { HTTP_STATUS, ERROR_MESSAGES, SUCCESS_MESSAGES } from '../../constants/index.js';

const loadBrand = async (req, res) => {
    try {
        const page = Number(req.query.page) || 1;
        const limit = 4;
        const skip = (page - 1) * limit;
        const search = req.query.search || '';
        const brandData = await Brand.find({
            name: { $regex: ".*" + search + ".*", $options: 'i' }
        }).sort({ createdAt: 1 }).skip(skip).limit(limit);
        const totalBrand = await Brand.countDocuments({
            name: { $regex: ".*" + search + ".*", $options: 'i' }
        })
        const totalPage = Math.ceil(totalBrand / limit);
        const reversedBrand = brandData.reverse()
        res.render('brand', {
            currentPages: page,
            brandData: reversedBrand,
            totalBrandCount: totalBrand,
            totalPage: totalPage,
            search
        })
    } catch (error) {
        console.log(error)
        res.redirect('/admin/pageError');
    }
}

const createBrand = async (req, res) => {
    try {
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename)
        const brandName = req.body.name.trim();
        
        // Validate brand name
        if (!brandName || brandName.length < 2 || brandName.length > 40) {
            return res.redirect("/admin/createBrand?error=invalid");
        }

        // Check if brand already exists (case-insensitive)
        const ishas = await Brand.findOne({ name: { $regex: new RegExp(`^${brandName}$`, 'i') } });
        if (ishas) {
            return res.redirect("/admin/createBrand?brandadded=exists");
        }

        // Process image
        const fileName = Date.now() + "-" + req.file.originalname.split(" ").join("-");
        const outputPath = path.join(__dirname, "../../public/uploads/re-images", fileName);

        await sharp(req.file.buffer)
            .resize(500, 500, {
                fit: "contain",
                background: { r: 255, g: 255, b: 255, alpha: 1 }
            })
            .toFormat('webp', { quality: 90 })
            .toFile(outputPath);
        
        // Create new brand
        const newData = new Brand({ 
            name: brandName, 
            BrandImage: fileName,
            isBlocked: false 
        });
        await newData.save();
        
        return res.redirect("/admin/createBrand?brandadded=success");

    } catch (error) {
        console.log(error)
        res.redirect("/admin/pageError");
    }
}

const loadCreateBrand = (req, res) => {
    try {
        res.render("createBrand")
    } catch (error) {
        res.redirect("/admin/pageError");
        console.log(error);
    }
}

const blockBrand = async (req, res) => {
    try {
        const id = req.query.id;
        const page = req.query.page || 1
        await Brand.updateOne({ _id: id }, { $set: { isBlocked: true } });
        res.redirect(`/admin/brands?page=${page}&status=success&action=blocked`)
    } catch (error) {
        res.redirect("/admin/pageError");
        console.log(error);
    }
}

const unBlockBrand = async (req, res) => {
    try {
        const id = req.query.id;
        const page = req.query.page || 1
        await Brand.updateOne({ _id: id }, { $set: { isBlocked: false } });
        res.redirect(`/admin/brands?page=${page}&status=success&action=unblocked`)
    } catch (error) {
        res.redirect("/admin/pageError")
        console.log(error);
    }
}

const deleteBrand = async (req, res) => {
    try {
        const id = req.query.id;
        const page = req.query.page;
        await Brand.deleteOne({ _id: id });
        res.redirect(`/admin/brands?page=${page}&status=success&action=deleted`)

    } catch (error) {
        res.redirect('/admin/pageError');
        console.log(error);
    }
}

export {
    loadBrand,
    createBrand,
    loadCreateBrand,
    blockBrand,
    unBlockBrand,
    deleteBrand
}
