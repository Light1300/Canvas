import nodemailer from "nodemailer";

const BREVO_SMTP_USER = process.env.BREVO_SMTP_USER as string;
const BREVO_SMTP_PASS = process.env.BREVO_SMTP_PASS as string;

if (!BREVO_SMTP_USER || !BREVO_SMTP_PASS) {
  throw new Error("Brevo SMTP credentials are not defined");
}

const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 587,
  secure: false,
  auth: {
    user: BREVO_SMTP_USER,
    pass: BREVO_SMTP_PASS,
  },
});

export async function sendVerificationEmail(
  toEmail: string,
  otp: string
): Promise<void> {
  const info = await transporter.sendMail({
    from: `"YourApp" <no-reply@yourdomain.com>`,
    to: toEmail,
    subject: "Your Verification Code",
    html: `
      <div style="font-family: sans-serif;">
        <h2>Your Verification Code</h2>
        <p>Your OTP is:</p>
        <h1>${otp}</h1>
        <p>This code expires in 5 minutes.</p>
      </div>
    `,
  });

  if (!info.messageId) {
    throw new Error("Failed to send verification email");
  }
}
