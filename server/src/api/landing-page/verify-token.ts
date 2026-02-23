import jwt from "jsonwebtoken";

const VERIFICATION_SECRET = process.env.VERIFICATION_SECRET as string;

export const generateVerificationToken = (email: string): string => {
  return jwt.sign({ email }, VERIFICATION_SECRET, {
    expiresIn: "15m"
  });
};

export const verifyVerificationToken = (token: string): { email: string } => {
  return jwt.verify(token, VERIFICATION_SECRET) as { email: string };
};