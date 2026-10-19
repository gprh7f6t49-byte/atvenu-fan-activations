import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export const config = {
  baseUrl: (process.env.PUBLIC_BASE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  adminPassword: process.env.ADMIN_PASSWORD ?? "",
  sessionSecret: process.env.SESSION_SECRET ?? process.env.ADMIN_PASSWORD ?? "dev-only-secret",
  orgName: process.env.ORG_NAME ?? "atVenu",
  emailFrom: process.env.EMAIL_FROM ?? "atVenu Activations <no-reply@example.com>",
  postmarkToken: process.env.POSTMARK_SERVER_TOKEN || null,
  resendKey: process.env.RESEND_API_KEY || null,
  smtp: process.env.SMTP_HOST
    ? {
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? 587),
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      }
    : null,
};

/** Reads an env var holding either PEM text or a path to a PEM file. */
function pem(value: string | undefined): string | null {
  if (!value) return null;
  if (value.includes("-----BEGIN")) return value.replace(/\\n/g, "\n");
  const p = path.resolve(/*turbopackIgnore: true*/ process.cwd(), value);
  return existsSync(p) ? readFileSync(p, "utf8") : null;
}

export function appleWalletConfig() {
  const wwdr = pem(process.env.APPLE_WWDR_CERT);
  const signerCert = pem(process.env.APPLE_SIGNER_CERT);
  const signerKey = pem(process.env.APPLE_SIGNER_KEY);
  const passTypeIdentifier = process.env.APPLE_PASS_TYPE_ID;
  const teamIdentifier = process.env.APPLE_TEAM_ID;
  if (!wwdr || !signerCert || !signerKey || !passTypeIdentifier || !teamIdentifier) return null;
  return {
    wwdr,
    signerCert,
    signerKey,
    signerKeyPassphrase: process.env.APPLE_SIGNER_KEY_PASSPHRASE,
    passTypeIdentifier,
    teamIdentifier,
  };
}

export function googleWalletConfig() {
  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID;
  let email = process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL;
  let privateKey = pem(process.env.GOOGLE_WALLET_PRIVATE_KEY);
  // Alternatively accept the service-account JSON key file Google hands out.
  const keyFile = process.env.GOOGLE_WALLET_KEY_FILE;
  if (keyFile && existsSync(path.resolve(/*turbopackIgnore: true*/ process.cwd(), keyFile))) {
    const json = JSON.parse(readFileSync(path.resolve(/*turbopackIgnore: true*/ process.cwd(), keyFile), "utf8"));
    email ??= json.client_email;
    privateKey ??= json.private_key;
  }
  if (!issuerId || !email || !privateKey) return null;
  return { issuerId, email, privateKey };
}

/** Which email service is connected, if any. Postmark/Resend send over HTTPS (works on every Railway plan). */
export function emailProvider(): "postmark" | "resend" | "smtp" | null {
  if (config.postmarkToken) return "postmark";
  if (config.resendKey) return "resend";
  if (config.smtp) return "smtp";
  return null;
}
