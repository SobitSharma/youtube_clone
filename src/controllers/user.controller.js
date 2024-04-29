import { asyncHandler } from "../utils/asyncHandler.js"
import {ApiError} from  "../utils/ApiError.js"
import { User } from "../models/user.models.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import jwt from "jsonwebtoken"

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

export {registerUser, userLogin, logoutUser, refreshAccessToken}      










