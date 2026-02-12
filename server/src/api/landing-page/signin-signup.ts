import express from "express"; 
import { connectDB } from "../../utils/mongodb/mongo-client.js";
import { sendVerificationEmail } from "../../services/email-service.js";

const signup = async(event: any) =>{
    try{

        const { name,  email, password } = JSON.parse(event.body);

        if(!name || !email || !password){
            return {
                success: false,
                statusCode: 400,
                body: JSON.stringify({
                    message: "Name, Email and Password are required."
                })
            }
        }

        const mongoclient = await connectDB();

        const user = await mongoclient
        .db()
        .collection("users")                
        .insertOne({
            name,
            email,
            password
        });

        sendVerificationEmail(email);
        
        return {
            success: true,
            statusCode: 201,
            body: JSON.stringify({
                message: "User registered successfully. Please check your email for verification."
            })
        }

    }catch(error: any){
        console.log("Error in Signup:", error);
        return {
            success: false,
            statusCode: error.statusCode || 500,
            body: JSON.stringify({
                message: "Signup failed. Please try again."
            })

        }
    }
}


const signin = async(event: any) =>{
    try{
        const { email, password } = JSON.parse(event.body);

        if(!email || !password){
            return {
                success: false,
                statusCode: 400,
                body: JSON.stringify({
                    message: "Email and Password are required."
                })
            }
        }

        const mongoclient = await connectDB();

        const user = await mongoclient
        .db()
        .collection("users")                
        .findOne({ email, password });

        if(!user){
            return {
                success: false,
                statusCode: 401,
                body: JSON.stringify({
                    message: "Invalid email or password."
                })
            }
        }

        return {
            success: true,
            statusCode: 200,
            body: JSON.stringify({
                message: "User signed in successfully."
            })
        }

    }catch(error: any){
        console.log("Error in Signin:", error);
        return {
            success: false,
            statusCode: error.statusCode || 500,
            body: JSON.stringify({
                message: "Signin failed. Please try again."
            })              
        }
    }
}

module.exports = {
    signup,
    signin
}