"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { HERO_LAYOUTS, HERO_OVERLAYS, suggestOverlay, type HeroLayout, type HeroOverlay } from "@/lib/hero";
import { LandingLayout, type LandingLook } from "./landing-layout";

type Text = Pick<LandingLook, "artist_name" | "tour_name" | "offer_headline" | "tagline" | "description" | "primary_color" | "accent_color" | "text_color">;
// Form fields the preview follows as they're edited.
const LIVE_FIELDS = ["primary_color", "accent_color", "text_color", "offer_headline", "tagline", "description"] as const;

/**
 * Landing page image: upload, layout (poster / full background / banner), focal point and tint,
 * with live desktop and phone previews of the real landing page layout. Posts hero_image (file),
 * hero_image_remove, hero_layout, hero_focus_x, hero_focus_y and hero_overlay with the form.
 */
export function HeroImageEditor({ current, initial, text, shows }: {
  current?: string | null;
  initial: { layout: HeroLayout; x: number; y: number; overlay: HeroOverlay };
  text: Text;
  shows: { id: string; show_date: string; venue: string; city: string }[];
}) {
  const [file, setFile] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);
  const [layout, setLayout] = useState(initial.layout);
  const [focus, setFocus] = useState({ x: initial.x, y: initial.y });
  const [overlay, setOverlay] = useState(initial.overlay);
  const [info, setInfo] = useState<{ width: number; suggested: HeroOverlay } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState<Text>(text);
  const root = useRef<HTMLDivElement>(null);

  const image = file ?? (removed ? null : current ?? null);

  useEffect(() => () => { if (file) URL.revokeObjectURL(file); }, [file]);

  // Follow colour / wording changes elsewhere in the form, so the preview stays true.
  useEffect(() => {
    const form = root.current?.closest("form");
    if (!form) return;
    const read = () => {
      const next = { ...text };
      for (const f of LIVE_FIELDS) {
        const el = form.elements.namedItem(f);
        if (el && "value" in el && typeof el.value === "string") (next as Record<string, unknown>)[f] = el.value || (f === "offer_headline" ? text.offer_headline : null);
      }
      setLive(next);
    };
    read();
    form.addEventListener("input", read);
    return () => form.removeEventListener("input", read);
  }, [text]);

  // Measure the image: its width (to warn about soft images) and brightness (to suggest a tint).
  useEffect(() => {
    if (!image) return;
    const el = new Image();
    el.onload = () => {
      let brightness = 120;
      try {
        const c = document.createElement("canvas");
        c.width = c.height = 24;
        const ctx = c.getContext("2d")!;
        ctx.drawImage(el, 0, 0, 24, 24);
        const px = ctx.getImageData(0, 0, 24, 24).data;
        let sum = 0;
        for (let i = 0; i < px.length; i += 4) sum += 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
        brightness = sum / (px.length / 4);
      } catch {
        // External image without CORS: no suggestion.
      }
      setInfo({ width: el.naturalWidth, suggested: suggestOverlay(brightness) });
    };
    el.src = image;
  }, [image]);

  const meta = HERO_LAYOUTS[layout];
  const soft = info && image && info.width < meta.minWidth;
  const look: LandingLook = {
    ...live,
    hero_image_url: image,
    hero_layout: layout,
    hero_focus_x: focus.x,
    hero_focus_y: focus.y,
    hero_overlay: overlay,
  };

  return (
    <div ref={root} className="space-y-5">
      <input type="hidden" name="hero_layout" value={layout} />
      <input type="hidden" name="hero_focus_x" value={focus.x} />
      <input type="hidden" name="hero_focus_y" value={focus.y} />
      <input type="hidden" name="hero_overlay" value={overlay} />

      <div>
        <span className="label">Landing page image (optional)</span>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <input
            type="file"
            name="hero_image"
            accept="image/jpeg,image/png,image/webp"
            className="block max-w-full text-sm"
            onChange={(e) => {
              const f = e.currentTarget.files?.[0];
              setError(null);
              setInfo(null);
              if (f && f.size > 10 * 1024 * 1024) {
                setError("Images must be 10 MB or smaller");
                e.currentTarget.value = "";
                setFile(null);
                return;
              }
              setFile(f ? URL.createObjectURL(f) : null);
              if (f) {
                setRemoved(false);
                setFocus({ x: 50, y: 50 });
              }
            }}
          />
          {current && !file && (
            <label className="flex items-center gap-1.5 text-xs text-zinc-600">
              <input type="checkbox" name="hero_image_remove" value="1" checked={removed} onChange={(e) => setRemoved(e.currentTarget.checked)} />
              Remove image
            </label>
          )}
        </div>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        <p className="mt-1 text-xs text-zinc-500">JPG, PNG or WebP up to 10 MB. Use artwork the artist&apos;s team has cleared.</p>
      </div>

      {image && (
        <>
          <fieldset>
            <legend className="label">Layout</legend>
            <div className="grid gap-3 sm:grid-cols-3">
              {(Object.keys(HERO_LAYOUTS) as HeroLayout[]).map((k) => (
                <label key={k} className={`cursor-pointer rounded-xl border p-3 text-sm transition ${layout === k ? "border-zinc-900 ring-1 ring-zinc-900" : "border-zinc-200 hover:border-zinc-400"}`}>
                  <span className="flex items-center gap-2 font-semibold">
                    <input type="radio" name="_hero_layout_choice" checked={layout === k} onChange={() => setLayout(k)} />
                    {HERO_LAYOUTS[k].label}
                  </span>
                  <LayoutIcon kind={k} />
                  <span className="mt-2 block text-xs text-zinc-500">{HERO_LAYOUTS[k].hint}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {soft && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">
              This image is {info.width}px wide, so it may look soft as a {meta.label.toLowerCase()} (ideally {meta.minWidth}px or wider).
              {layout !== "poster" && " Poster works well with smaller images."}
            </p>
          )}

          <div className="grid gap-5 sm:grid-cols-[1fr_auto]">
            <div>
              <span className="label">Focal point</span>
              {meta.crops ? (
                <>
                  <FocusPicker src={image} focus={focus} onChange={setFocus} />
                  <p className="mt-1 text-xs text-zinc-500">Click the part that must stay in view, e.g. the artist&apos;s face. Phones crop more than laptops.</p>
                </>
              ) : (
                <p className="text-xs text-zinc-500">Not needed: Poster shows the whole image without cropping.</p>
              )}
            </div>
            <fieldset>
              <legend className="label">Tint</legend>
              <div className="inline-flex overflow-hidden rounded-lg border border-zinc-300">
                {(Object.keys(HERO_OVERLAYS) as HeroOverlay[]).map((k) => (
                  <button key={k} type="button" onClick={() => setOverlay(k)} aria-pressed={overlay === k}
                    className={`px-3 py-1.5 text-sm ${overlay === k ? "bg-zinc-900 font-semibold text-white" : "text-zinc-600 hover:bg-zinc-50"}`}>
                    {HERO_OVERLAYS[k]}
                  </button>
                ))}
              </div>
              <p className="mt-1 max-w-56 text-xs text-zinc-500">
                Darkens the image so the text stays readable.
                {info && info.suggested !== overlay && (
                  <> Suggested for this image: <button type="button" className="underline" onClick={() => setOverlay(info.suggested)}>{HERO_OVERLAYS[info.suggested]}</button>.</>
                )}
              </p>
            </fieldset>
          </div>
        </>
      )}

      <div>
        <span className="label">Preview</span>
        <div className="flex items-start gap-4">
          <Frame width={1280} height={800} label="Desktop" className="min-w-0 flex-1">
            <LandingLayout a={look} shows={shows} form={<FormPlaceholder />} fullHeight={false} />
          </Frame>
          <Frame width={390} height={844} label="Phone" className="w-[22%] min-w-24 max-w-40 shrink-0">
            <LandingLayout a={look} shows={shows} form={<FormPlaceholder />} fullHeight={false} />
          </Frame>
        </div>
      </div>
    </div>
  );
}

/** Renders its child at a real device width, scaled down to fit. */
function Frame({ width, height, label, className, children }: { width: number; height: number; label: string; className?: string; children: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.25);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / width);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);
  return (
    <figure className={className}>
      <div ref={box} className="relative overflow-hidden rounded-lg ring-1 ring-zinc-300" style={{ height: height * scale }} aria-hidden inert>
        <div className="atv-reset pointer-events-none origin-top-left" style={{ width, height, transform: `scale(${scale})` }}>
          <div className="flex h-full w-full flex-col overflow-hidden">{children}</div>
        </div>
      </div>
      <figcaption className="mt-1 text-center text-xs text-zinc-500">{label}</figcaption>
    </figure>
  );
}

function FormPlaceholder() {
  return (
    <div>
      <p className="text-2xl font-extrabold">Claim Fan Discount</p>
      <p className="mb-6 mt-1 text-sm opacity-70">Your personal pass, delivered straight to your phone.</p>
      {[0, 1, 2].map((i) => (
        <div key={i} className="mb-4">
          <div className="mb-1 h-2.5 w-20 rounded bg-white/30" />
          <div className="h-11 rounded-lg border border-white/20 bg-white/10" />
        </div>
      ))}
      <div className="mt-6 h-14 rounded-full bg-accent" />
    </div>
  );
}

function FocusPicker({ src, focus, onChange }: { src: string; focus: { x: number; y: number }; onChange: (f: { x: number; y: number }) => void }) {
  const set = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    onChange({
      x: Math.round(Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100))),
      y: Math.round(Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100))),
    });
  };
  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label="Focal point"
      aria-valuenow={focus.x}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={`${focus.x}% from left, ${focus.y}% from top`}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); set(e); }}
      onPointerMove={(e) => { if (e.buttons) set(e); }}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 10 : 2;
        const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
        if (!d) return;
        e.preventDefault();
        onChange({ x: Math.min(100, Math.max(0, focus.x + d[0])), y: Math.min(100, Math.max(0, focus.y + d[1])) });
      }}
      className="relative inline-block cursor-crosshair touch-none select-none overflow-hidden rounded-lg ring-1 ring-zinc-300"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" draggable={false} className="block max-h-56 w-auto max-w-full" />
      <span className="pointer-events-none absolute h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_2px_rgba(0,0,0,0.6)]"
        style={{ left: `${focus.x}%`, top: `${focus.y}%` }} />
    </div>
  );
}

/** Small diagram of each layout. */
function LayoutIcon({ kind }: { kind: HeroLayout }) {
  return (
    <svg viewBox="0 0 64 40" className="mt-2 h-10 w-16 text-zinc-500" aria-hidden>
      <rect x="0.5" y="0.5" width="63" height="39" rx="3" fill="none" stroke="currentColor" />
      {kind === "background" && <rect x="1" y="1" width="62" height="38" rx="3" fill="currentColor" opacity="0.35" />}
      {kind === "banner" && <rect x="1" y="1" width="62" height="13" rx="2" fill="currentColor" opacity="0.5" />}
      {kind === "poster" && (
        <>
          <rect x="1" y="1" width="62" height="38" rx="3" fill="currentColor" opacity="0.12" />
          <rect x="6" y="5" width="16" height="21" rx="1.5" fill="currentColor" opacity="0.6" />
        </>
      )}
      <rect x="6" y={kind === "poster" ? 29 : kind === "banner" ? 19 : 12} width="20" height="3" rx="1" fill="currentColor" />
      <rect x="38" y={kind === "banner" ? 18 : 9} width="20" height={kind === "banner" ? 18 : 24} rx="2" fill="none" stroke="currentColor" />
    </svg>
  );
}
