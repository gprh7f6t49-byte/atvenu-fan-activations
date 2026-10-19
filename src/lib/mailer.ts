import nodemailer from "nodemailer";
import { config, emailProvider } from "./config";

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  /** Inline images referenced in the HTML as cid:<contentId>. */
  inline?: { filename: string; contentId: string; content: Buffer; contentType: string }[];
}

export type SendResult = { status: "sent" | "logged" | "failed"; error: string | null };

/**
 * Sends through whichever service is configured: Postmark or Resend (HTTPS APIs) or SMTP.
 * With none configured the email isn't sent ("logged") and only appears in the admin outbox.
 */
export async function deliver(email: OutgoingEmail): Promise<SendResult> {
  const provider = emailProvider();
  if (!provider) return { status: "logged", error: null };
  try {
    if (provider === "postmark") await viaPostmark(email);
    else if (provider === "resend") await viaResend(email);
    else await viaSmtp(email);
    return { status: "sent", error: null };
  } catch (err) {
    return { status: "failed", error: err instanceof Error ? err.message : String(err) };
  }
}

async function postJson(url: string, headers: Record<string, string>, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 300)}`);
}

function viaPostmark(email: OutgoingEmail) {
  return postJson(process.env.POSTMARK_API_URL ?? "https://api.postmarkapp.com/email", { "X-Postmark-Server-Token": config.postmarkToken! }, {
    From: config.emailFrom,
    To: email.to,
    Subject: email.subject,
    HtmlBody: email.html,
    MessageStream: process.env.POSTMARK_MESSAGE_STREAM ?? "outbound",
    Attachments: email.inline?.map((a) => ({
      Name: a.filename,
      Content: a.content.toString("base64"),
      ContentType: a.contentType,
      ContentID: `cid:${a.contentId}`,
    })),
  });
}

function viaResend(email: OutgoingEmail) {
  return postJson(process.env.RESEND_API_URL ?? "https://api.resend.com/emails", { Authorization: `Bearer ${config.resendKey}` }, {
    from: config.emailFrom,
    to: [email.to],
    subject: email.subject,
    html: email.html,
    attachments: email.inline?.map((a) => ({
      filename: a.filename,
      content: a.content.toString("base64"),
      content_id: a.contentId,
    })),
  });
}

async function viaSmtp(email: OutgoingEmail) {
  const smtp = config.smtp!;
  await nodemailer
    .createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.port === 465,
      auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
    })
    .sendMail({
      from: config.emailFrom,
      to: email.to,
      subject: email.subject,
      html: email.html,
      attachments: email.inline?.map((a) => ({ filename: a.filename, content: a.content, cid: a.contentId })),
    });
}
