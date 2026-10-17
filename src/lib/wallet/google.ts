import { importPKCS8, SignJWT } from "jose";
import type { Activation, Show } from "../activations";
import type { PassRecord } from "../fans";
import { config, googleWalletConfig } from "../config";
import { formatShowDate, nextShow, redemptionInstructions } from "./content";

export const googleWalletEnabled = () => googleWalletConfig() !== null;

// Google object ids allow [A-Za-z0-9._-] only.
const safeId = (s: string) => s.replace(/[^A-Za-z0-9._-]/g, "_");

/**
 * Builds a signed "Save to Google Wallet" URL. The class and object are embedded
 * in the JWT, so no prior API call to Google is needed to issue a pass.
 */
export async function buildGoogleSaveUrl(a: Activation, shows: Show[], pass: PassRecord): Promise<string> {
  const cfg = googleWalletConfig();
  if (!cfg) throw new Error("Google Wallet is not configured");

  const classId = `${cfg.issuerId}.${safeId(`activation_${a.id}`)}`;
  const objectId = `${cfg.issuerId}.${safeId(`optin_${pass.opt_in_id}`)}`;
  const upcoming = nextShow(shows);
  const publicImages = config.baseUrl.startsWith("https://");
  const lang = "en-GB";
  const text = (value: string) => ({ defaultValue: { language: lang, value } });

  const genericObject = {
    id: objectId,
    classId,
    state: "ACTIVE",
    cardTitle: text(a.artist_name),
    header: text(a.offer_headline),
    subheader: text(a.tour_name),
    hexBackgroundColor: a.primary_color,
    barcode: { type: "QR_CODE", value: pass.code, alternateText: pass.code },
    ...(publicImages && {
      logo: { sourceUri: { uri: `${config.baseUrl}/api/activations/${a.id}/art/icon` } },
      heroImage: { sourceUri: { uri: `${config.baseUrl}/api/activations/${a.id}/art/hero` } },
    }),
    textModulesData: [
      { id: "code", header: "Code", body: pass.code },
      ...(upcoming ? [{ id: "next", header: "Next show", body: `${upcoming.venue}, ${upcoming.city} · ${formatShowDate(upcoming.show_date)}` }] : []),
      { id: "how", header: "How to redeem", body: redemptionInstructions(a) },
      ...(a.offer_terms ? [{ id: "terms", header: "Terms", body: a.offer_terms }] : []),
    ],
    linksModuleData: { uris: [{ uri: `${config.baseUrl}/p/${pass.pass_token}`, description: "View your pass", id: "pass" }] },
    ...(a.pass_expires_at && { validTimeInterval: { end: { date: new Date(a.pass_expires_at).toISOString() } } }),
  };

  const key = await importPKCS8(cfg.privateKey, "RS256");
  const jwt = await new SignJWT({
    iss: cfg.email,
    aud: "google",
    typ: "savetowallet",
    origins: [config.baseUrl],
    payload: { genericClasses: [{ id: classId }], genericObjects: [genericObject] },
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuedAt()
    .sign(key);

  return `https://pay.google.com/gp/v/save/${jwt}`;
}
