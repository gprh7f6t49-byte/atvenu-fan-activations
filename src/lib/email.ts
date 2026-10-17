import nodemailer from "nodemailer";
import QRCode from "qrcode";
import { config } from "./config";
import { db, newId } from "./db";
import type { Activation, Show } from "./activations";
import { markPassEvent, type PassRecord } from "./fans";
import { formatShowDate, redemptionInstructions } from "./wallet/content";
import { passBadge } from "./discount";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function renderPassEmail(a: Activation, shows: Show[], pass: PassRecord) {
  const passUrl = `${config.baseUrl}/p/${pass.pass_token}`;
  const name = pass.first_name ? `Hi ${esc(pass.first_name)},` : "Hi,";
  const badge = passBadge(a.kind, pass.recipient_group);
  const intro =
    a.kind === "fan"
      ? "You're in. Here's your personal code — add it to your phone's wallet so it's ready at the merch stand."
      : `Here's your ${a.kind === "crew" ? "crew" : "comp"} pass for the ${esc(a.tour_name)}. Add it to your phone's wallet and show it at any merch stand.`;
  const footer =
    a.kind === "fan"
      ? `You're receiving this because you signed up for the ${esc(a.artist_name)} fan offer.`
      : `This pass was issued to you by the ${esc(a.artist_name)} merch team. It's personal to you — please don't forward it.`;
  const dates = shows
    .map((s) => `<tr><td style="padding:4px 12px 4px 0;color:#888">${esc(formatShowDate(s.show_date))}</td><td style="padding:4px 0">${esc(s.venue)}, ${esc(s.city)}</td></tr>`)
    .join("");
  const html = `<!doctype html><html><body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#111">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0"><tr><td align="center">
  <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#fff;border-radius:12px;overflow:hidden">
    <tr><td style="background:${a.primary_color};color:${a.text_color};padding:32px 32px 28px">
      <div style="font-size:13px;letter-spacing:2px;color:${a.accent_color};text-transform:uppercase">${badge ? `${esc(badge)} · ` : ""}${esc(a.tour_name)}</div>
      <div style="font-size:34px;font-weight:900;margin-top:6px">${esc(a.artist_name)}</div>
      <div style="font-size:20px;margin-top:10px">${esc(a.offer_headline)}</div>
    </td></tr>
    <tr><td style="padding:28px 32px">
      <p style="margin:0 0 16px">${name}</p>
      <p style="margin:0 0 20px">${intro}</p>
      <div style="text-align:center;margin:24px 0">
        <img src="cid:qr" width="200" height="200" alt="QR code for ${esc(pass.code)}" style="display:inline-block"/>
        <div style="font-family:Menlo,Consolas,monospace;font-size:22px;letter-spacing:3px;margin-top:8px">${esc(pass.code)}</div>
      </div>
      <p style="text-align:center;margin:0 0 24px">
        <a href="${passUrl}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:14px 22px;border-radius:999px;font-weight:bold">Add to Apple or Google Wallet</a>
      </p>
      <p style="margin:0 0 8px;font-weight:bold">How to redeem</p>
      <p style="margin:0 0 20px;color:#444">${esc(redemptionInstructions(a))}</p>
      ${dates ? `<p style="margin:0 0 8px;font-weight:bold">Tour dates</p><table role="presentation" style="font-size:14px;margin-bottom:20px">${dates}</table>` : ""}
      ${a.offer_terms ? `<p style="font-size:12px;color:#888;margin:0">${esc(a.offer_terms)}</p>` : ""}
    </td></tr>
    <tr><td style="padding:16px 32px 28px;font-size:12px;color:#999">
      ${footer}
      ${a.privacy_url ? `<a href="${a.privacy_url}" style="color:#999">Privacy policy</a>.` : ""}
    </td></tr>
  </table></td></tr></table></body></html>`;
  const subject =
    a.kind === "crew"
      ? `Your ${a.artist_name} crew merch pass`
      : a.kind === "comp"
        ? `Your ${a.artist_name} merch comp pass`
        : `Your ${a.artist_name} merch code is ready`;
  return { subject, html };
}

/**
 * Emails the fan their pass. Without SMTP configured the email is saved to the
 * outbox table only (visible in admin), which keeps demos self-contained.
 */
export async function sendPassEmail(a: Activation, shows: Show[], pass: PassRecord): Promise<void> {
  const { subject, html } = renderPassEmail(a, shows, pass);
  const qr = await QRCode.toBuffer(pass.code, { width: 400, margin: 1 });
  let status: "sent" | "logged" | "failed" = "logged";
  let error: string | null = null;

  if (config.smtp) {
    try {
      const transport = nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.port === 465,
        auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
      });
      await transport.sendMail({
        from: config.emailFrom,
        to: pass.email,
        subject,
        html,
        attachments: [{ filename: "qr.png", content: qr, cid: "qr" }],
      });
      status = "sent";
    } catch (err) {
      status = "failed";
      error = err instanceof Error ? err.message : String(err);
    }
  }

  const storedHtml = html.replace("cid:qr", `data:image/png;base64,${qr.toString("base64")}`);
  db()
    .prepare("INSERT INTO emails (id, opt_in_id, to_email, subject, html, status, error) VALUES (?,?,?,?,?,?,?)")
    .run(newId(), pass.opt_in_id, pass.email, subject, storedHtml, status, error);
  if (status !== "failed") markPassEvent(pass.opt_in_id, "email");
}

export interface EmailRow {
  id: string;
  to_email: string;
  subject: string;
  status: string;
  error: string | null;
  created_at: string;
}

export function listEmails(activationId: string, limit = 50): EmailRow[] {
  return db()
    .prepare(
      `SELECT e.id, e.to_email, e.subject, e.status, e.error, e.created_at FROM emails e
       JOIN opt_ins o ON o.id = e.opt_in_id WHERE o.activation_id = ? ORDER BY e.created_at DESC LIMIT ?`,
    )
    .all(activationId, limit) as unknown as EmailRow[];
}

export function getEmailHtml(id: string): string | undefined {
  const row = db().prepare("SELECT html FROM emails WHERE id = ?").get(id) as { html: string } | undefined;
  return row?.html;
}
