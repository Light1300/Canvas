import Brevo from "@getbrevo/brevo";

const BREVO_API_KEY = process.env.BREVO_API_KEY as string;

if (!BREVO_API_KEY) {
  throw new Error("BREVO_API_KEY is not defined");
}

const brevo = new Brevo.TransactionalEmailsApi();

brevo.setApiKey(
  Brevo.TransactionalEmailsApiApiKeys.apiKey,
  BREVO_API_KEY
);

export async function sendVerificationEmail(
  toEmail: string,
  otp: string
): Promise<void> {
  try {
    const response = await brevo.sendTransacEmail({
      sender: {
        name: "YourApp",
        email: "no-reply@yourdomain.com", // verify this in Brevo
      },
      to: [{ email: toEmail }],
      subject: "Your Verification Code",
      htmlContent: `
        <div style="font-family: sans-serif;">
          <h2>Your Verification Code</h2>
          <p>Your OTP is:</p>
          <h1>${otp}</h1>
          <p>This code expires in 5 minutes.</p>
        </div>
      `,
    });

    if (!response.messageId) {
      throw new Error("Email not accepted by Brevo");
    }

  } catch (error) {
    console.error("Brevo email error:", error);
    throw new Error("Failed to send verification email");
  }
}
