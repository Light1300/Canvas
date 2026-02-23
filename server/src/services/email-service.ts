const BREVO_API_KEY = process.env.BREVO_API_KEY as string;
const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL as string;
const BREVO_SENDER_NAME = "Canva Project";

if (!BREVO_API_KEY) {
  throw new Error("BREVO_API_KEY is not defined");
}

export async function sendVerificationEmail(
  toEmail: string,
  otp: string
): Promise<void> {
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": BREVO_API_KEY,
    },
    body: JSON.stringify({
      sender: {
        name: BREVO_SENDER_NAME,
        email: BREVO_SENDER_EMAIL,
      },
      to: [{ email: toEmail }],
      subject: "Your Verification Code",
      htmlContent: `
        <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto;">
          <h2>Your Verification Code</h2>
          <p>Your OTP is:</p>
          <h1 style="letter-spacing: 6px; color: #4f46e5;">${otp}</h1>
          <p>This code expires in 5 minutes.</p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Brevo API error:", error);
    throw new Error("Failed to send verification email");
  }

  console.log("Email sent to:", toEmail);
}