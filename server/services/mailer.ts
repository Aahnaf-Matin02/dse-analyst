import nodemailer from "nodemailer";

interface MailOptions {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export const MailerService = {
  async sendMail({ to, subject, text, html }: MailOptions): Promise<boolean> {
    const isSmtpConfigured = !!(
      process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS
    );

    const fromAddress = process.env.SMTP_FROM || "noreply@dse-ai-analyst.com";

    // 1. Beautiful log fallback for local testing and serverless logs
    console.log(`
========================================================================
📬 [MAILER] OUTGOING EMAIL DETECTED
To: ${to}
Subject: ${subject}
Text: ${text}
------------------------------------------------------------------------
HTML Preview:
${html}
========================================================================
`);

    // 2. If SMTP is configured, attempt actual delivery
    if (isSmtpConfigured) {
      try {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || "587", 10),
          secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });

        await transporter.sendMail({
          from: `"DSE AI Analyst" <${fromAddress}>`,
          to,
          subject,
          text,
          html,
        });

        console.log(`[MAILER] Email successfully sent via SMTP to ${to}`);
        return true;
      } catch (err) {
        console.error(`[MAILER] Failed to deliver email via SMTP to ${to}:`, err);
        return false;
      }
    }

    return true; // Return true as simulation succeeded
  }
};
