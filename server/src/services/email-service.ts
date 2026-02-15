import nodemailer from "nodemailer";

const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

if (!EMAIL_USER || !EMAIL_PASS) {
  throw new Error("Email credentials are not defined");
}

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS
  }
});

export async function sendVerificationEmail(
  toEmail: string,
  otp: string
) {
  await transporter.sendMail({
    from: ` <${EMAIL_USER}>`,
    to: toEmail,
    subject: "Your Verification Code",
    text: `Your verification code is: ${otp}`,
    html: `<b>Your verification code is: ${otp}</b>`
  });

  console.log("EMAIL SENT to ::::", toEmail );
}