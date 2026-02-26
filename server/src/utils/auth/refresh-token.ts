import { connectDB } from "../mongodb/mongo-client.js";
import { verifyRefreshToken, hashToken, generateAccessToken , generateRefreshToken  } from "./jwt.js";
import { ObjectId } from "mongodb";
import { } from "./jwt.js";
import { STATUS_CODES } from "node:http";

export const refreshTokenHandler = async (event: any) => {
  try {
    const { refreshToken } = JSON.parse(event.body);

    if (!refreshToken) {
      return {
        statusCode: 401,
        body: JSON.stringify({ message: "Refresh token required" })
      };
    }

    const { userId } = verifyRefreshToken(refreshToken);

    const db = (await connectDB()).db();
    const hashed = hashToken(refreshToken);

    const storedToken = await db.collection("refreshTokens").findOne({
      userId: new ObjectId(userId),
      token: hashed
    });

    if (!storedToken) {
      return {
        statusCode: 403,
        body: JSON.stringify({ message: "Invalid refresh token" })
      };
    }


    await db.collection("refreshTokens").deleteOne({
      _id: storedToken._id
    });

    const user = await db.collection("users").findOne({
      _id: new ObjectId(userId)
    });

    if(!user){
        return {
            success:false,
            statueCode: 404,
            body: JSON.stringify({
                message: "User not found"
            })
        }
    }
    const newAccess = generateAccessToken(userId, user.email, user.name);
    const newRefresh = generateRefreshToken(userId);

    await db.collection("refreshTokens").insertOne({
      userId: new ObjectId(userId),
      token: hashToken(newRefresh),
      createdAt: new Date()
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        accessToken: newAccess,
        refreshToken: newRefresh
      })
    };

  } catch {
    return {
      statusCode: 403,
      body: JSON.stringify({ message: "Invalid or expired refresh token" })
    };
  }
};