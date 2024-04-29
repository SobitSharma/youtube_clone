// require('dotenv').config({path:'./env'})
// It will work but it is making the code inconsistent

import dotenv from 'dotenv'
import connectDB from './db/index.js'
import app from './app.js'

dotenv.config({
    path:'./env'
})   

const Port = process.env.PORT || 5000
connectDB().
then(()=>{
    app.listen(Port, () => {
        console.log(`Server is running at port : ${Port}`)
    })
}) 
.catch((error)=>{
    console.log(error)
    console.log('MongoDB Connection Failed')
})






















































// import express from 'express'

// const app = express()

// ( async ()=>{
//     try {
//         await mongoose.connect(`${process.env.MONGODB_URI}/${
//             DB_NAME
//         }`)
//         app.on('error', ()=>{
//             console.log('Application not able to talk to database')
//             throw error
//         })
//         app.listen(process.env.PORT, ()=>{
//             console.log(`APP is listening on port ${process.env.PORT}`) 
//         })
//     } catch (error) {
        
//     }
// })()
