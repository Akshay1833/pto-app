import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

type SendEmailArgs = {
  to: string | string[];
  subject: string;
  html: string;
};

export async function sendEmail({ to, subject, html }: SendEmailArgs) {
  const from = process.env.EMAIL_FROM;

  if (!process.env.RESEND_API_KEY || !from) {
    console.warn("Email skipped: missing RESEND_API_KEY or EMAIL_FROM");
    return;
  }

  try {
    const result = await resend.emails.send({
      from,
      to,
      subject,
      html,
    });

    console.log("Email sent:", result);
  } catch (error) {
    console.error("Failed to send email:", error);
  }
}
