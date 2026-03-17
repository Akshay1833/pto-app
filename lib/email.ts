import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  const result = await resend.emails.send({
    from: "hr@bullzeyeequipment.com",
    to,
    subject,
    html,
  });

  console.log("RESEND RESULT:", result);

  return result;
}
