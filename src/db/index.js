import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

const connectDB = async () =>{
    try {
        const connectionInstance = await mongoose.connect(
            `${process.env.MONGODB_URI}/${DB_NAME}`)
        
        console.log(connectionInstance);
        console.log(`\n MongosDB connected !! DB Host : ${
            connectionInstance.connection.host
        }`)
    } catch (error) {
        console.log('MongoDB Error Occurred')
        process.exit(1)
    }
}

export default connectDB