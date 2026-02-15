const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "smtp.ethereal.email",
  port: 587,
  secure: false,
  auth: {
    user: "maddison53@ethereal.email",
    pass: "jn7jnAPss4f63QBp6D",
  },
});

export async function sendVerificationEmail(
  toEmail: string,
  otp: string
) {
  await transporter.sendMail({
    from: '"Maddison Foo Koch" <maddison53@ethereal.email>',
    to: toEmail,
    subject: "Your Verification Code",
    text: `Your verification code is: ${otp}`,
    html: `<b>Your verification code is: ${otp}</b>`,
  });
}