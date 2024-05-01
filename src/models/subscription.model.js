import mongoose, { Schema } from "mongoose";

const subscriptionSchema = new Schema({
    subscriber: {
        //One who is Subscribing the channel
        type:Schema.Types.ObjectId,
        ref:"User" 
    },
    channel: {
        //One to whom The subscriber is subscribing
        type:Schema.Types.ObjectId,
        ref:"User"
    }
}, {timestamps:true})

export const Subscription = mongoose.model("Subscription",
subscriptionSchema)