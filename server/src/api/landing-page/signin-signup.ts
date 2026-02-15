import bcrypt from "bcrypt";
import { connectDB } from "../../utils/mongodb/mongo-client.js";
import { generateAndSendOtp, validateOtp } from "./otp-generation-validation.js";
import { generateVerificationToken, verifyVerificationToken } from "./verify-token.js";
import { generateAccessToken, generateRefreshToken, hashToken } from "../../utils/auth/jwt.js";


export const signup = async (event: any) => {
  try {
    const { name, email, password } = JSON.parse(event.body);
    console.log("Event at signin-signup ", JSON.parse(event.body));

    if (!name || !email || !password) {
      return {
        success: false,
        statusCode: 400,
        body: JSON.stringify({ message: "All fields are required." })
      };
    }

    const mongoClient = await connectDB();
    const users = mongoClient.db().collection("users");

    const existing = await users.findOne({ email });
    if (existing) {
      return {
        success: false,
        statusCode: 409,
        body: JSON.stringify({ message: "User already exists." })
      };
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);

    await users.insertOne({
      name,
      email,
      password: hashedPassword,
      isVerified: false
    });

    const task = await generateAndSendOtp(email);
    console.log("Task is performed ::: ",task)

    const verificationToken = generateVerificationToken(email);
    console.log("VERIFICATION TOKEN IS HERE :::", verificationToken);

    return {
      success: true,
      statusCode: 201,
      body: JSON.stringify({
        message: "OTP sent to email.",
        verificationToken
      })
    };

  } catch (error: any) {
    console.log("ERROR OCCURED ", error);

      if (error.message?.includes("Too many OTP")) {
        return {
          success: false,
          statusCode: 429,
          body: JSON.stringify({ message: error.message })
        };
      }
  
      return {
        success: false,
        statusCode: 500,
        body: JSON.stringify({ message: "Signup failed." })
      };
    }
}

export const verifyOtp = async (event: any) => {
  try {
    console.log("VERIFY-OTP REQUEST RECEIVED");

    const parsedBody = JSON.parse(event.body);
    const { otp } = parsedBody;

    console.log("OTP RECEIVED:", otp);

    const authHeader = event.headers?.authorization;

    console.log("AUTH HEADER:", authHeader);

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log("Verification token missing or malformed");
      return {
        success: false,
        statusCode: 401,
        body: JSON.stringify({ message: "Verification token missing." })
      };
    }

    const token = authHeader.split(" ")[1];

    console.log("VERIFICATION TOKEN RECEIVED");

    const { email } = verifyVerificationToken(token);

    console.log("TOKEN VERIFIED FOR EMAIL:", email);

    const isValid = await validateOtp(email, otp);

    console.log("OTP VALIDATION RESULT:", isValid);

    if (!isValid) {
      return {
        success: false,
        statusCode: 400,
        body: JSON.stringify({ message: "Invalid or expired OTP." })
      };
    }

    const mongoClient = await connectDB();
    const users = mongoClient.db().collection("users");

    await users.updateOne(
      { email },
      { $set: { isVerified: true } }
    );

    console.log("USER VERIFIED SUCCESSFULLY");
    
    const user = await users
    .findOne({email})

    if(!user){
      return {
        success: false,
        statucCode: 404,
        message: "User not found",
      }
    }

    const accessToken = generateAccessToken(user._id.toString(), email);
    const refreshToken = generateRefreshToken(user._id.toString());

    const hashedRefresh = hashToken(refreshToken);

     await db.collection("refreshTokens").insertOne({
      userId: user._id,
      token: hashedRefresh,
      createdAt: new Date()
    });


    return {
      success: true,
      statusCode: 200,
      body: JSON.stringify({
         message: "Account verified successfully.",
         accessToken,
         refreshToken })
    };

  } catch (error) {
    console.error("OTP VERIFICATION ERROR:", error);

    return {
      success: false,
      statusCode: 500,
      body: JSON.stringify({ message: "OTP verification failed." })
    };
  }
};

export const signin = async (event: any) => {
  try {
    const { email, password } = JSON.parse(event.body);

    if (!email || !password) {
      return {
        success: false,
        statusCode: 400,
        body: JSON.stringify({ message: "Email and password required." })
      };
    }

    const mongoClient = await connectDB();
    const users = mongoClient.db().collection("users");

    
    const user = await users.findOne({ email });

    if (!user) {
      return {
        success: false,
        statusCode: 401,
        body: JSON.stringify({ message: "Invalid credentials." })
      };
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return {
        success: false,
        statusCode: 401,
        body: JSON.stringify({ message: "Invalid credentials." })
      };
    }

    if (!user.isVerified) {
      return {
        success: false,
        statusCode: 403,
        body: JSON.stringify({ message: "Please verify your email first." })
      };
    }

    return {
      success: true,
      statusCode: 200,
      body: JSON.stringify({ message: "Signed in successfully." })
    };

  } catch {
    return {
      success: false,
      statusCode: 500,
      body: JSON.stringify({ message: "Signin failed." })
    };
  }
};