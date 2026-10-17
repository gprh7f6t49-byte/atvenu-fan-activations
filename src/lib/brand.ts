import type { CSSProperties } from "react";
import type { Activation } from "./activations";

/** CSS variables that theme fan-facing pages with the activation's colours. */
export function brandStyle(a: Activation): CSSProperties {
  return { "--brand": a.primary_color, "--accent": a.accent_color, "--ink": a.text_color } as CSSProperties;
}
