import mongoose from 'mongoose';
import Product from './productSchema';

const { Schema } = mongoose;

const brandSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    BrandImage: {
        type: [String],
        required: true
    },
    isBlocked: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});


const Brand = mongoose.model('Brand', brandSchema);

export default Brand;

const deleteProduct = async (req, res) => {
    try {
        const brandId = req.params.id;

        await Product.deleteMany({
            brand: brandId,
            variants: {
                $elemMatch: {
                    quantity: { $gt: 15 }
                }
            }
        })

    } catch (error) {

    }
}