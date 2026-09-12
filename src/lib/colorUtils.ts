/**
 * Colour utilities for the vector designer.
 *
 * Parses hex, RGB(), and HSL() strings and converts between them.
 * All colours are stored internally as hex strings (#rrggbb) so the SVG
 * output is deterministic. Gradients are represented separately.
 */

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface HSL {
  h: number; // 0–360
  s: number; // 0–1
  l: number; // 0–1
}

/** Parse a hex string (#rgb, #rrggbb, #rrggbbaa) into RGB. */
export function hexToRgb(hex: string): RGB | null {
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  if (h.length !== 6) return null;
  const n = parseInt(h, 16);
  if (isNaN(n)) return null;
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

export function rgbToHex({ r, g, b }: RGB): string {
  const c = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v)))
      .toString(16)
      .padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Parse "rgb(r, g, b)" — any whitespace, 0-255 range. */
export function rgbStringToRgb(s: string): RGB | null {
  const m = s.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!m) return null;
  const r = Number(m[1]);
  const g = Number(m[2]);
  const b = Number(m[3]);
  if ([r, g, b].some((v) => v < 0 || v > 255)) return null;
  return { r, g, b };
}

/** Parse "hsl(h, s%, l%)" — degrees, 0-100% ranges. */
export function hslStringToHsl(s: string): HSL | null {
  const m = s.match(/hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%/i);
  if (!m) return null;
  const h = ((Number(m[1]) % 360) + 360) % 360;
  const s2 = Math.max(0, Math.min(100, Number(m[2]))) / 100;
  const l = Math.max(0, Math.min(100, Number(m[3]))) / 100;
  return { h, s: s2, l };
}

export function hslToRgb({ h, s, l }: HSL): RGB {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r1 = 0,
    g1 = 0,
    b1 = 0;
  if (hp >= 0 && hp < 1) [r1, g1, b1] = [c, x, 0];
  else if (hp < 2) [r1, g1, b1] = [x, c, 0];
  else if (hp < 3) [r1, g1, b1] = [0, c, x];
  else if (hp < 4) [r1, g1, b1] = [0, x, c];
  else if (hp < 5) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];
  const m = l - c / 2;
  return { r: r1 + m, g: g1 + m, b: b1 + m };
}

export function rgbToHsl({ r, g, b }: RGB): HSL {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  let h = 0;
  if (delta !== 0) {
    if (max === rn) h = ((gn - bn) / delta) % 6;
    else if (max === gn) h = (bn - rn) / delta + 2;
    else h = (rn - gn) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  return { h, s, l };
}

/** Accept hex/rgb()/hsl() — return a normalized hex colour, or null if invalid. */
export function parseColor(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed.startsWith("#")) {
    const rgb = hexToRgb(trimmed);
    return rgb ? rgbToHex(rgb) : null;
  }
  if (trimmed.toLowerCase().startsWith("rgb")) {
    const rgb = rgbStringToRgb(trimmed);
    return rgb ? rgbToHex(rgb) : null;
  }
  if (trimmed.toLowerCase().startsWith("hsl")) {
    const hsl = hslStringToHsl(trimmed);
    if (!hsl) return null;
    return rgbToHex(hslToRgb(hsl));
  }
  return null;
}

/**
 * Format a hex colour back into the requested mode for display in inputs.
 */
export function formatColorForMode(hex: string, mode: "hex" | "rgb" | "hsl"): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  if (mode === "hex") return hex;
  if (mode === "rgb") return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
  const hsl = rgbToHsl(rgb);
  return `hsl(${Math.round(hsl.h)}, ${Math.round(hsl.s * 100)}%, ${Math.round(
    hsl.l * 100
  )}%)`;
}

/**
 * Convert a colour + opacity into an rgba() CSS string for SVG fill/stroke.
 * Works for both hex colours and the special "transparent" sentinel.
 */
export function colorToCss(hex: string, opacity: number): string {
  if (hex === "transparent") return "none";
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  if (opacity >= 1) return hex;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity.toFixed(3)})`;
}
