import { PKPass } from "passkit-generator";
import type { Activation, Show } from "../activations";
import type { PassRecord } from "../fans";
import { appleWalletConfig, config } from "../config";
import { iconImage, logoImage, rgbString, stripImage } from "./images";
import { formatShowDate, nextShow, redemptionInstructions } from "./content";
import { passBadge, placeOf } from "../discount";

export const appleWalletEnabled = () => appleWalletConfig() !== null;

export async function buildApplePass(a: Activation, shows: Show[], pass: PassRecord): Promise<Buffer> {
  const cfg = appleWalletConfig();
  if (!cfg) throw new Error("Apple Wallet is not configured");

  const upcoming = nextShow(shows);
  const badge = passBadge(a.kind, pass.recipient_group);
  const holder = [pass.first_name, pass.last_name].filter(Boolean).join(" ") || pass.email;
  const holderDetail = [pass.role, pass.organisation].filter(Boolean).join(" · ");
  const passJson = {
    formatVersion: 1,
    passTypeIdentifier: cfg.passTypeIdentifier,
    teamIdentifier: cfg.teamIdentifier,
    serialNumber: pass.opt_in_id,
    organizationName: config.orgName,
    description: `${a.artist_name} — ${a.offer_headline}`,
    foregroundColor: rgbString(a.text_color),
    backgroundColor: rgbString(a.primary_color),
    labelColor: rgbString(a.accent_color),
    sharingProhibited: true,
    coupon: {
      headerFields: badge
        ? [{ key: "type", label: "PASS", value: badge }]
        : [{ key: "tour", label: "TOUR", value: a.tour_name }],
      primaryFields: [{ key: "offer", label: a.artist_name.toUpperCase(), value: a.offer_headline }],
      secondaryFields: [
        { key: "holder", label: a.kind === "fan" ? "FAN" : "NAME", value: holder },
        { key: "code", label: "CODE", value: pass.code },
      ],
      auxiliaryFields: [
        ...(holderDetail ? [{ key: "role", label: a.kind === "crew" ? "DEPARTMENT" : "GROUP", value: holderDetail }] : []),
        ...(pass.pass_scope === "city" && pass.link_city ? [{ key: "valid", label: "VALID IN", value: pass.link_city }] : []),
        ...(upcoming ? [{ key: "next", label: "NEXT SHOW", value: `${upcoming.city} · ${formatShowDate(upcoming.show_date)}` }] : []),
      ],
      backFields: [
        { key: "how", label: "How to redeem", value: redemptionInstructions(a, pass) },
        ...(a.offer_terms ? [{ key: "terms", label: "Terms", value: a.offer_terms }] : []),
        ...(shows.length
          ? [{
              key: "dates",
              label: "Tour dates",
              value: shows.map((s) => `${formatShowDate(s.show_date)} — ${s.venue}, ${s.city}`).join("\n"),
            }]
          : []),
        { key: "pass", label: "Your pass", value: `${config.baseUrl}/p/${pass.pass_token}` },
        ...(a.privacy_url ? [{ key: "privacy", label: "Privacy", value: a.privacy_url }] : []),
      ],
    },
  };

  const [icon, icon2x, icon3x, logo, logo2x, strip, strip2x, strip3x] = await Promise.all([
    iconImage(a, 29), iconImage(a, 58), iconImage(a, 87),
    logoImage(a, 1), logoImage(a, 2),
    stripImage(a, 1), stripImage(a, 2), stripImage(a, 3),
  ]);

  const pkpass = new PKPass(
    {
      "pass.json": Buffer.from(JSON.stringify(passJson)),
      "icon.png": icon, "icon@2x.png": icon2x, "icon@3x.png": icon3x,
      "logo.png": logo, "logo@2x.png": logo2x,
      "strip.png": strip, "strip@2x.png": strip2x, "strip@3x.png": strip3x,
    },
    {
      wwdr: cfg.wwdr,
      signerCert: cfg.signerCert,
      signerKey: cfg.signerKey,
      signerKeyPassphrase: cfg.signerKeyPassphrase,
    },
  );

  // The QR carries the raw atVenu promo code, so the POS scanner reads it like a typed code.
  pkpass.setBarcodes({ message: pass.code, format: "PKBarcodeFormatQR", messageEncoding: "iso-8859-1", altText: pass.code });

  const located = shows.filter((s) => s.latitude != null && s.longitude != null).slice(0, 10);
  if (located.length) {
    pkpass.setLocations(
      ...located.map((s) => ({
        latitude: s.latitude!,
        longitude: s.longitude!,
        relevantText: `${a.artist_name} tonight — show your pass at the ${placeOf(a)}`,
      })),
    );
  }
  if (upcoming) pkpass.setRelevantDate(new Date(`${upcoming.show_date}T16:00:00Z`));
  const expires = pass.valid_until ?? a.pass_expires_at;
  if (expires) pkpass.setExpirationDate(new Date(expires));

  return pkpass.getAsBuffer();
}
