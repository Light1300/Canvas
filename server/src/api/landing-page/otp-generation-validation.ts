import redis from "../../utils/redis/redisClient.js";
import { sendVerificationEmail } from "../../services/email-service.js";

const OTP_PREFIX = "otp";
const OTP_TTL_SECONDS = 60 * 5;
const RATE_LIMIT_PREFIX = "otp:limit";
const MAX_REQUESTS = 3;
const RATE_LIMIT_TTL = 60 * 5;


const generateOtp = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const getKey = (email: string): string => {
  return `${OTP_PREFIX}:${email}`;
};

export const generateAndSendOtp = async (email: string): Promise<void> => {
  const rateKey = `${RATE_LIMIT_PREFIX}:${email}`;
  const requestCount = await redis.incr(rateKey);

  if (requestCount === 1) {
    await redis.expire(rateKey, RATE_LIMIT_TTL);
  }

  if (requestCount > MAX_REQUESTS) {
    throw new Error("Too many OTP requests. Try again later.");
  }

  const otp = generateOtp();

  await redis.set(getKey(email), otp, "EX", OTP_TTL_SECONDS);

  await sendVerificationEmail(email, otp);
};


export const validateOtp = async (
  email: string,
  otp: string
): Promise<boolean> => {
  const storedOtp = await redis.get(getKey(email));

  if (!storedOtp) return false;
  if (storedOtp !== otp) return false;

  await redis.del(getKey(email));

  return true;
};