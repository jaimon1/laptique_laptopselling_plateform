import mongoose from 'mongoose';
const { Schema } = mongoose;

const wishlistSchema = new Schema({

     userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required:true
     },
     product: [{
        productId: {
            type: Schema.Types.ObjectId,
            ref: "Product",
            required:true
        },
        addOn: {
            type: Date,
            Default: Date.now
        }
     }]

});

const Wishlist = mongoose.model("Wishlist",wishlistSchema);
export default Wishlist;