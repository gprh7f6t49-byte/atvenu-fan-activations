import "../fontconfig-env";
import sharp from "sharp";
import type { Activation } from "../activations";
import { uploadedImage } from "../uploads";

// Wallet artwork is generated from each activation's brand colours so a new tour
// gets passes without a designer. When the client uploads a pass image (or, for fan
// activations, a landing page image) that photo is used instead.

const FONT = "Inter, 'DejaVu Sans', Arial, sans-serif";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const png = (svg: string) => sharp(Buffer.from(svg)).png().toBuffer();

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.padEnd(6, "0").slice(0, 6);
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export const rgbString = (hex: string) => `rgb(${hexToRgb(hex).join(", ")})`;

/** The uploaded photo to use on passes, if any. */
export function passPhoto(a: Activation): Buffer | null {
  return uploadedImage(a.pass_image_url) ?? (a.kind === "fan" ? uploadedImage(a.hero_image_url) : null);
}

/** Crops the photo to fill w×h; `shade` darkens it so text on top stays readable. */
async function photoBanner(photo: Buffer, a: Activation, w: number, h: number, shade: number) {
  const base = sharp(photo).resize(w, h, { fit: "cover", position: "attention" });
  if (!shade) return base.png().toBuffer();
  const overlay = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${a.primary_color}" stop-opacity="${shade * 0.6}"/>
      <stop offset="1" stop-color="${a.primary_color}" stop-opacity="${shade}"/>
    </linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#s)"/>
  </svg>`);
  return base.composite([{ input: overlay }]).png().toBuffer();
}

/** Band behind the offer on Apple coupon passes (375×123 @1x). The offer text sits on top. */
export function stripImage(a: Activation, scale = 1) {
  const w = 375 * scale;
  const h = 123 * scale;
  const photo = passPhoto(a);
  if (photo) return photoBanner(photo, a, w, h, 0.55);
  const fs = 76 * scale;
  return png(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${a.primary_color}"/>
        <stop offset="1" stop-color="${a.accent_color}" stop-opacity="0.55"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="${a.primary_color}"/>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <text x="${w - 14 * scale}" y="${h - 10 * scale}" text-anchor="end" font-family="${FONT}" font-weight="900"
      font-size="${fs}" fill="${a.text_color}" fill-opacity="0.12" letter-spacing="${-2 * scale}">${esc(a.artist_name.toUpperCase())}</text>
  </svg>`);
}

export function iconImage(a: Activation, size = 29) {
  const letter = esc(a.artist_name.trim().charAt(0).toUpperCase() || "A");
  return png(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <rect width="100%" height="100%" rx="${size * 0.22}" fill="${a.primary_color}"/>
    <text x="50%" y="50%" dy="0.36em" text-anchor="middle" font-family="${FONT}" font-weight="800"
      font-size="${size * 0.62}" fill="${a.accent_color}">${letter}</text>
  </svg>`);
}

/** Top-left wordmark on Apple passes (max 160×50 @1x). */
export function logoImage(a: Activation, scale = 1) {
  const w = 160 * scale;
  const h = 50 * scale;
  return png(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <text x="0" y="${h * 0.66}" font-family="${FONT}" font-weight="900" font-size="${26 * scale}"
      fill="${a.text_color}" letter-spacing="${-0.5 * scale}">${esc(a.artist_name.toUpperCase())}</text>
  </svg>`);
}

/** Hero banner for Google Wallet generic passes (1032×336). */
export function heroImage(a: Activation) {
  const photo = passPhoto(a);
  if (photo) return photoBanner(photo, a, 1032, 336, 0);
  return png(`<svg xmlns="http://www.w3.org/2000/svg" width="1032" height="336">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${a.primary_color}"/>
        <stop offset="1" stop-color="${a.accent_color}" stop-opacity="0.6"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="${a.primary_color}"/>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <text x="48" y="170" font-family="${FONT}" font-weight="900" font-size="96" fill="${a.text_color}"
      letter-spacing="-3">${esc(a.artist_name.toUpperCase())}</text>
    <text x="52" y="240" font-family="${FONT}" font-weight="600" font-size="38" fill="${a.accent_color}">${esc(a.offer_headline)}</text>
  </svg>`);
}
