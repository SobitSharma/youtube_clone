import { asyncHandler } from "../utils/asyncHandler.js"
import {ApiError} from  "../utils/ApiError.js"
import { User } from "../models/user.models.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import jwt from "jsonwebtoken"
import mongoose from "mongoose"

const registerUser = asyncHandler(
    //get User details from frontend
    //validation - not empty
    // check if the user is already registered: username , email
    //check form images, check form avatar,
    //upload tyem to cloudeinary
    //create userobject - create entry in db
    //remove password and refresh toekn filed from response
    //check for user creation
    // return res
    async (req, res) => {
        const {fullname,email,username, password} = req.body
        
        if(
            [fullname,email,username,password].some((field)=> 
            field?.trim() === ""
        )
        )
        {   
            throw new ApiError(400, "All Fields are required")
        }

        const existedUser = await User.findOne({
            $or : [{ username }, { email }]
        })

        if (existedUser){
            throw new ApiError(409, "User with email or username already Exist")
        }

        const avatarLocalPath = req.files?.avatar[0]?.path;
        // const coverImageLocalPath = req.files?.coverImage[0]?.path;

        let coverImageLocalPath;
        if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
            coverImageLocalPath = req.files.coverImage[0].path
        }

        if(!avatarLocalPath){
            throw new ApiError(400, "Avatar file is required")
        }

        const avatar = await uploadOnCloudinary(avatarLocalPath)
        const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    

        if(!avatar){
            throw new ApiError(400, "Avatar file is required")
        }
        const user = await User.create({
            fullname,
            avatar:avatar.url,
            coverImage:coverImage?.url || "",
            email,
            password,
            username: username.toLowerCase()
        })

       
        const createdUser = await User.findById(user._id).select(
            "-password -refreshToken"
        )

        if(!createdUser){
            throw new ApiError(500, "Something went wrong while registering the USer")
        }

        return res.status(201).json(
            new ApiResponse(200, createdUser, "User registered Successfully")
        )

    }
)

const generateAccessAndRefreshTokens = async(userId)=> {
    try {
        const user = await User.findById(userId)
        console.log(user);
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()
        console.log('After')
        user.refreshToken = refreshToken 
        await user.save({ validateBeforeSave : false})

        return {accessToken, refreshToken}

    } catch (error) {
        throw new ApiError(500, "Something went Wrong while Generating Refresh and access Tokens")
    }
}

const userLogin = asyncHandler(
    // Get the credentials from the user req body 
    // User Name or EMail 
    // find the user in the DataBase
    // Match the password
    // Provide the access and refress Token to the User
    // Send secure Cookies

    async (req, res)=> {
        const {email, username, password} = req.body
        if (!(username || email)){
            
            throw new ApiError(400, "Username or email is required")
        }

        const user = await User.findOne({
            $or:[{email}, {username}]
        })

        if(!user){
            throw new ApiError(404, "User doesnot Exist")
        }

        const isPasswordValid =  await user.isPasswordCorrect(password)

        if(!isPasswordValid){
            throw new ApiError(404, "Password is InCorrect")
        }

        const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(user._id)

        const loggedInUser = await User.findById(user._id).
        select("-password -refreshToken")

        const options = {
            httpOnly:true,
            secure:true,
        }

        return res.status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    user: loggedInUser, accessToken, refreshToken
                },
                "User Logged In SuccessFully"
            )
        )

    }
)


const logoutUser = asyncHandler((async(req, res)=> {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set:{
                refreshToken:undefined
            }
        }, {
            new:true
        }
    )

    const options = {
        httpOnly:true,
        secure:true
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User Logged Out"))

}))

const refreshAccessToken = asyncHandler(async(req, res)=> {
   try {
     const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken
     if(!incomingRefreshToken){
         throw new ApiError(401, "Unauthorized request")
     }
 
     const decodedToken = jwt.verify(incomingRefreshToken, 
         process.env.REFRESH_TOKEN_SECRET
     )
 
     const user = await User.findById(decodedToken?._id)
     if(!user){
         throw new ApiError(401, "Invalid Refresh Token")
     }
     if(incomingRefreshToken !== user?.refreshToken){
         throw new ApiError(401, "Refresh Toke is expired or used")
     }
 
     const options = {
         httpOnly:true,
         secure:true
     }
 
     const {accessToken, newrefreshToken} = await generateAccessAndRefreshTokens(user._id)
     return res.status(200).cookie("accessToken", accessToken, options).
     cookie("refreshToken", newrefreshToken, options)
     .json(
         new ApiResponse(
             200, 
             {accessToken, refreshToken:refreshAccessToken},
             "Access Token Refreshed"
         )
     )
   } catch (error) {
        throw new ApiError(401, error?.message || "Invalid Refresh Token")
   }
})

const changeCurrentPassword = asyncHandler(async(req, res)=> {
    const {oldPassword, newPassword}= req.body
    const user = await User.findById(req.user?._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if(!isPasswordCorrect){
        throw new ApiError(400, "Invalid old Password")
    }

    user.password = newPassword
    await user.save({validateBeforeSave:false})

    return res.status(200).json(new ApiResponse(200, {}, "Password changed Sucessfully"))

})

const getCurrentUser = asyncHandler(async(req,res)=> {
    return res.status(200).json(
        200, req.user, "current user fetched sucessfully"
    )
})

const updateAccountDetails = asyncHandler(async(req, res)=> {
    const {fullname, email, username} = req.body

    if(!fullname || !email || !username){
        throw new ApiError(400, "All fields are required")
    }

    const user = User.findByIdAndUpdate(
        req.user._id,
        {
            $set:{
                fullname,
                username,
                email
            }
        },
        {
            new:true
        }
    ).select("-password")

    return res.status(200).json(new ApiResponse(200, user, "Account details successfully updated"))
})

const updateUserAvatar = asyncHandler(async(req, res)=> {
    const avatarLocalPath = req.file?.path 

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file is missing")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if(!avatar.url){
        throw new ApiError(400, "Error while uploading on avatar")

    }

    const user = await User.findOneAndUpdate(req.user._id, 
    {
        $set:{
            avatar:avatar.url
        }
    }, {new:true}).select("-password")

    return res.status(200).json(
        new ApiResponse(200,user, "Avatar updated successfully")
    )
})

const updateCoverImage = asyncHandler(async(req, res)=> {
    const coverimagepath = req.file?.path
    if(!coverimagepath){
        throw new ApiError(400, "Error while uploading the cover image")
    }

    const coverimageurl = await uploadOnCloudinary(coverimagepath)

    const user = User.findByIdAndUpdate(
        req.user._id,
        {
            $set:{
                coverImage:coverimageurl.url
            }
        },
        {new:true}
    )

    return res.status(200).json(
        new ApiResponse(200,user, "CoverImage updated successfully")
    )

})

const getUserChannelProfile = asyncHandler(async(req,res)=> {
    const {username} = req.params

    if(!username?.trim()){
        throw new ApiError(400, "Username is missing")
    }

    const channel = await User.aggregate([
        {
            $match: {
                username:username?.toLowerCase()
            }

        }, 
        {
            $lookup: {
                from:"subscriptions",
                localField:"_id",
                foreignField:"channel",
                as:"subscribers"
            }
        },
        {
            $lookup: {
                from:"subscriptions",
                localField:"_id",
                foreignField:"subscriber",
                as:"subscribedTo"
            }
        },
        {
            $addFields:{
                subscribersCount:{
                    $size:"$subscribers"
                },
                channelsSubscribedToCount: {
                    $size:"$subscribedTo"
                },
                issubscribed: {
                    if:{$in: [req.user?._id, "$subscribers.subscriber"]},
                    then:true,
                    else:false
                }
            },    
        },
        {
            $project:{
                fullname:1,
                username:1,
                subscribersCount:1,
                channelsSubscribedToCount:1,
                issubscribed:1,
                avatar:1,
                coverImage:1,
                email:1
            }
        }
    ])

    if(!channel?.length){
        throw new ApiError(404, "channel does not exists")
    }

    return res.status(200)
    .json(
        new ApiResponse(200, channel[0],"Channel Fetched successfully" )
    )
})


const getWatchHistory = asyncHandler(async(req,res)=> {
    const user = await User.aggregate([
        {
            $match:{
                _id:new mongoose.Types.ObjectId(req.user._id)
            }
        }, 
        {
            $lookup: {
                from:"videos",
                localField:"watchHistory",
                foreignField:"_id",
                as:"watchHistory",
                pipeline:[
                    {
                        $lookup:{
                            from:"users",
                            localField:"owner",
                            foreignField:"_id",
                            as:"owner",
                            pipeline:[
                                {
                                    $project:{
                                        fullname:1,
                                        username:1,
                                        avatar:1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields:{
                            owner:{
                                $first:"$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])
    return res.status(200).json(
        new ApiResponse(200, user[0].watchHistory, "Watch History Fetched")
    )
})


export {
    registerUser,
    userLogin, 
    logoutUser, 
    refreshAccessToken,
    getCurrentUser,
    changeCurrentPassword,
    updateAccountDetails,
    updateUserAvatar,
    updateCoverImage,
    getUserChannelProfile,
    getWatchHistory
}      










