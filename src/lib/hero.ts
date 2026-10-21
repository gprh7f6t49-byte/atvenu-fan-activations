// How the fan landing page shows its image. Shared by the landing page and the settings preview.

export type HeroLayout = "poster" | "background" | "banner";
export type HeroOverlay = "light" | "medium" | "strong";

export const HERO_LAYOUTS: Record<HeroLayout, { label: string; hint: string; minWidth: number; crops: boolean }> = {
  poster: {
    label: "Poster",
    hint: "Whole image shown uncropped, on a blurred copy of itself. Works for any image — best for posters and artwork with text.",
    minWidth: 800,
    crops: false,
  },
  background: {
    label: "Full background",
    hint: "Fills the page behind everything. Best for wide crowd or stage photos without text.",
    minWidth: 1600,
    crops: true,
  },
  banner: {
    label: "Banner",
    hint: "A wide strip across the top, with the offer and form below. Best for wide artwork.",
    minWidth: 1400,
    crops: true,
  },
};

export const HERO_OVERLAYS: Record<HeroOverlay, string> = { light: "Light", medium: "Medium", strong: "Strong" };

// Hex alpha suffixes for the brand-colour tint laid over the image.
const TINT: Record<HeroOverlay, { side: [string, string, string]; even: string; banner: string }> = {
  light: { side: ["d9", "8c", "26"], even: "99", banner: "00" },
  medium: { side: ["f2", "b3", "66"], even: "bf", banner: "26" },
  strong: { side: ["fa", "e0", "a6"], even: "e0", banner: "59" },
};

/** Tint over a full-background image: strongest behind the text on the left. */
export const backgroundTint = (color: string, o: HeroOverlay) =>
  `linear-gradient(90deg, ${color}${TINT[o].side[0]} 0%, ${color}${TINT[o].side[1]} 55%, ${color}${TINT[o].side[2]} 100%)`;

/** Even tint over the blurred copy behind a poster. */
export const posterTint = (color: string, o: HeroOverlay) => `${color}${TINT[o].even}`;

/** Banner: optional tint, fading into the page colour at the bottom so the text below sits cleanly. */
export const bannerTint = (color: string, o: HeroOverlay) =>
  `linear-gradient(180deg, ${color}${TINT[o].banner} 0%, ${color}${TINT[o].banner} 55%, ${color} 100%)`;

export const focusPosition = (x: number, y: number) => `${x}% ${y}%`;

/** Suggests a tint from the image's average brightness (0–255): bright, busy images need more. */
export const suggestOverlay = (brightness: number): HeroOverlay => (brightness > 150 ? "strong" : brightness > 90 ? "medium" : "light");

export const isHeroLayout = (v: unknown): v is HeroLayout => typeof v === "string" && v in HERO_LAYOUTS;
export const isHeroOverlay = (v: unknown): v is HeroOverlay => typeof v === "string" && v in HERO_OVERLAYS;

/** Settings for new activations: Poster suits any image. */
export const HERO_DEFAULTS = { hero_layout: "poster", hero_focus_x: 50, hero_focus_y: 50, hero_overlay: "medium" } as const satisfies {
  hero_layout: HeroLayout; hero_focus_x: number; hero_focus_y: number; hero_overlay: HeroOverlay;
};

/** Reads the hero settings posted by the image editor, falling back to the defaults. */
export function heroFromForm(form: FormData) {
  const layout = form.get("hero_layout");
  const overlay = form.get("hero_overlay");
  const pct = (v: FormDataEntryValue | null) => {
    const n = Number(v);
    return v !== null && v !== "" && Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n))) : 50;
  };
  return {
    hero_layout: isHeroLayout(layout) ? layout : HERO_DEFAULTS.hero_layout,
    hero_focus_x: pct(form.get("hero_focus_x")),
    hero_focus_y: pct(form.get("hero_focus_y")),
    hero_overlay: isHeroOverlay(overlay) ? overlay : HERO_DEFAULTS.hero_overlay,
  };
}
