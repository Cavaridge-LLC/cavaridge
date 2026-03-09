import { Resend } from "resend";

const FROM_ADDRESS = "MERIDIAN <noreply@meridian.dev>";
const BRAND_COLOR = "#2563eb";

function baseTemplate(title: string, body: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 0">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
<tr><td style="background-color:${BRAND_COLOR};padding:24px 32px">
<h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:600;letter-spacing:-0.02em">MERIDIAN</h1>
</td></tr>
<tr><td style="padding:32px">
<h2 style="margin:0 0 16px;color:#18181b;font-size:18px;font-weight:600">${title}</h2>
${body}
</td></tr>
<tr><td style="padding:16px 32px;background-color:#fafafa;border-top:1px solid #e4e4e7">
<p style="margin:0;color:#a1a1aa;font-size:12px;text-align:center">MERIDIAN &mdash; M&amp;A IT Due Diligence Platform</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function buttonHtml(text: string, url: string): string {
  return `<table cellpadding="0" cellspacing="0" style="margin:24px 0"><tr><td>
<a href="${url}" style="display:inline-block;padding:12px 24px;background-color:${BRAND_COLOR};color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600">${text}</a>
</td></tr></table>`;
}

class EmailService {
  private resend: Resend | null = null;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
      this.resend = new Resend(apiKey);
    }
  }

  async sendInvitation(
    email: string,
    orgName: string,
    inviteUrl: string,
    invitedByName: string
  ): Promise<{ success: boolean; messageId?: string }> {
    const subject = `You've been invited to join ${orgName} on MERIDIAN`;
    const html = baseTemplate(
      "You're Invited",
      `<p style="margin:0 0 12px;color:#3f3f46;font-size:14px;line-height:1.6"><strong>${invitedByName}</strong> has invited you to join <strong>${orgName}</strong> on MERIDIAN.</p>
<p style="margin:0 0 4px;color:#3f3f46;font-size:14px;line-height:1.6">Click the button below to accept the invitation and create your account.</p>
${buttonHtml("Accept Invitation", inviteUrl)}
<p style="margin:0;color:#71717a;font-size:12px">This invitation will expire in 7 days. If you didn't expect this email, you can safely ignore it.</p>`
    );
    return this.send(email, subject, html);
  }

  async sendPasswordReset(
    email: string,
    resetToken: string,
    userName: string
  ): Promise<{ success: boolean; messageId?: string }> {
    const subject = "Reset your MERIDIAN password";
    const html = baseTemplate(
      "Password Reset",
      `<p style="margin:0 0 12px;color:#3f3f46;font-size:14px;line-height:1.6">Hi ${userName},</p>
<p style="margin:0 0 12px;color:#3f3f46;font-size:14px;line-height:1.6">We received a request to reset your password. Use the token below to complete your password reset:</p>
<div style="margin:16px 0;padding:16px;background-color:#f4f4f5;border-radius:6px;text-align:center">
<code style="font-size:16px;color:#18181b;letter-spacing:0.05em;word-break:break-all">${resetToken}</code>
</div>
<p style="margin:0;color:#71717a;font-size:12px">This token expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.</p>`
    );
    return this.send(email, subject, html);
  }

  async sendAccountApproval(
    email: string,
    orgName: string,
    loginUrl: string
  ): Promise<{ success: boolean; messageId?: string }> {
    const subject = "Your MERIDIAN account has been approved";
    const html = baseTemplate(
      "Account Approved",
      `<p style="margin:0 0 12px;color:#3f3f46;font-size:14px;line-height:1.6">Your account request for <strong>${orgName}</strong> has been approved.</p>
<p style="margin:0 0 4px;color:#3f3f46;font-size:14px;line-height:1.6">You can now log in to MERIDIAN and start using the platform.</p>
${buttonHtml("Log In to MERIDIAN", loginUrl)}
<p style="margin:0;color:#71717a;font-size:12px">Your temporary password is <strong>meridian123</strong>. Please change it after your first login.</p>`
    );
    return this.send(email, subject, html);
  }

  async sendAccountRejection(
    email: string,
    reason?: string
  ): Promise<{ success: boolean; messageId?: string }> {
    const subject = "Update on your MERIDIAN account request";
    const reasonBlock = reason
      ? `<p style="margin:0 0 12px;color:#3f3f46;font-size:14px;line-height:1.6"><strong>Reason:</strong> ${reason}</p>`
      : "";
    const html = baseTemplate(
      "Account Request Update",
      `<p style="margin:0 0 12px;color:#3f3f46;font-size:14px;line-height:1.6">Thank you for your interest in MERIDIAN. After reviewing your account request, we are unable to approve it at this time.</p>
${reasonBlock}
<p style="margin:0;color:#71717a;font-size:12px">If you believe this was in error or have questions, please contact our support team.</p>`
    );
    return this.send(email, subject, html);
  }

  private async send(
    to: string,
    subject: string,
    html: string
  ): Promise<{ success: boolean; messageId?: string }> {
    if (!this.resend) {
      console.log(`[EmailService] (no RESEND_API_KEY) Would send email:`);
      console.log(`  To: ${to}`);
      console.log(`  Subject: ${subject}`);
      console.log(`  HTML length: ${html.length} chars`);
      return { success: true };
    }

    try {
      const { data, error } = await this.resend.emails.send({
        from: FROM_ADDRESS,
        to,
        subject,
        html,
      });

      if (error) {
        console.error("[EmailService] Resend error:", error);
        return { success: false };
      }

      return { success: true, messageId: data?.id };
    } catch (err) {
      console.error("[EmailService] Failed to send email:", err);
      return { success: false };
    }
  }
}

export const emailService = new EmailService();
