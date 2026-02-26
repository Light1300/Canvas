import bcrypt from "bcrypt";
import { connectDB } from "../../utils/mongodb/mongo-client.js";
import { generateAndSendOtp, validateOtp } from "./otp-generation-validation.js";
import { generateVerificationToken, verifyVerificationToken } from "./verify-token.js";
import { generateAccessToken, generateRefreshToken } from "../../utils/auth/jwt.js";
import { storeRefreshToken } from "../../services/refresh-token-service.js";
import { ApiResponse } from "../../types/api-response.js";

export const signup = async (event: any): Promise<ApiResponse> => {
  try {
    const { name, email, password } = JSON.parse(event.body);

    if (!name || !email || !password) {
      return {
        success: false,
        statusCode: 400,
        body: JSON.stringify({ message: "All fields are required." }),
      };
    }

    const mongoClient = await connectDB();
    const users = mongoClient.db().collection("users");

    const existing = await users.findOne({ email });
    if (existing) {
      return {
        success: false,
        statusCode: 409,
        body: JSON.stringify({ message: "User already exists." }),
      };
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await users.insertOne({ name, email, password: hashedPassword, isVerified: false });

    await generateAndSendOtp(email);

    const verificationToken = generateVerificationToken(email);

    return {
      success: true,
      statusCode: 201,
      body: JSON.stringify({ message: "OTP sent to email.", verificationToken }),
    };
  } catch (error: any) {
    if (error.message?.includes("Too many OTP")) {
      return {
        success: false,
        statusCode: 429,
        body: JSON.stringify({ message: error.message }),
      };
    }
    return {
      success: false,
      statusCode: 500,
      body: JSON.stringify({ message: "Signup failed." }),
    };
  }
};

export const verifyOtp = async (event: any): Promise<ApiResponse> => {
  try {
    const { otp } = JSON.parse(event.body);
    const authHeader = event.headers?.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return {
        success: false,
        statusCode: 401,
        body: JSON.stringify({ message: "Verification token missing." }),
      };
    }

    const token = authHeader.split(" ")[1];
    const { email } = verifyVerificationToken(token);
    const isValid = await validateOtp(email, otp);

    if (!isValid) {
      return {
        success: false,
        statusCode: 400,
        body: JSON.stringify({ message: "Invalid or expired OTP." }),
      };
    }

    const mongoClient = await connectDB();
    const db = mongoClient.db();
    const users = db.collection("users");

    await users.updateOne({ email }, { $set: { isVerified: true } });

    const user = await users.findOne({ email });
    if (!user) {
      return {
        success: false,
        statusCode: 404,
        body: JSON.stringify({ message: "User not found." }),
      };
    }

    const userId = user._id.toString();
    // name now included in JWT
    const accessToken = generateAccessToken(userId, email, user.name);
    const refreshToken = generateRefreshToken(userId);

    await storeRefreshToken(userId, refreshToken);

    return {
      success: true,
      statusCode: 200,
      body: JSON.stringify({
        message: "Account verified successfully.",
        accessToken,
        refreshToken,
        user: { userId, name: user.name, email },
      }),
    };
  } catch (error) {
    console.error("OTP VERIFICATION ERROR:", error);
    return {
      success: false,
      statusCode: 500,
      body: JSON.stringify({ message: "OTP verification failed." }),
    };
  }
};

export const signin = async (event: any): Promise<ApiResponse> => {
  try {
    const { email, password } = JSON.parse(event.body);

    if (!email || !password) {
      return {
        success: false,
        statusCode: 400,
        body: JSON.stringify({ message: "Email and password required." }),
      };
    }

    const mongoClient = await connectDB();
    const users = mongoClient.db().collection("users");
    const user = await users.findOne({ email });

    if (!user) {
      return {
        success: false,
        statusCode: 401,
        body: JSON.stringify({ message: "Invalid credentials." }),
      };
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return {
        success: false,
        statusCode: 401,
        body: JSON.stringify({ message: "Invalid credentials." }),
      };
    }

    if (!user.isVerified) {
      return {
        success: false,
        statusCode: 403,
        body: JSON.stringify({ message: "Please verify your email first." }),
      };
    }

    const userId = user._id.toString();
    const accessToken = generateAccessToken(userId, email, user.name);
    const refreshToken = generateRefreshToken(userId);

    await storeRefreshToken(userId, refreshToken);

    return {
      success: true,
      statusCode: 200,
      body: JSON.stringify({
        message: "Signed in successfully.",
        accessToken,
        refreshToken,
        user: { userId, name: user.name, email },
      }),
    };
  } catch {
    return {
      success: false,
      statusCode: 500,
      body: JSON.stringify({ message: "Signin failed." }),
    };
  }
};