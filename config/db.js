import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const dbConnect = async ()=>{
    try {
        
        await mongoose.connect(process.env.MONGODB_URL);
        console.log('DB Connected Successfully');
    } catch(err) {
        console.error(`Error:${err.message}`);
        process.exit(1)
    }
}

export { dbConnect };

