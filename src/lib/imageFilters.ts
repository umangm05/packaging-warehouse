import type { ImageAdjustments } from "@/lib/designerTypes";

/**
 * Build a CSS filter string for the canvas/SVG-rendering pipeline.
 * Order: blur → brightness → contrast → saturate.
 * Flip is handled separately via transform.
 */
export function buildFilterString(adj: ImageAdjustments): string {
  const parts: string[] = [];
  if (adj.blur > 0) parts.push(`blur(${adj.blur}px)`);
  if (adj.brightness !== 0) parts.push(`brightness(${1 + adj.brightness / 100})`);
  if (adj.contrast !== 0) parts.push(`contrast(${1 + adj.contrast / 100})`);
  if (adj.saturation !== 0) parts.push(`saturate(${1 + adj.saturation / 100})`);
  return parts.length > 0 ? parts.join(" ") : "none";
}

/**
 * Build a CSS transform string for flips (applied AFTER rotation transform).
 */
export function buildFlipTransform(adj: ImageAdjustments): string {
  const sx = adj.flipH ? -1 : 1;
  const sy = adj.flipV ? -1 : 1;
  if (sx === 1 && sy === 1) return "";
  return `scale(${sx}, ${sy})`;
}

/**
 * Apply background removal to an ImageData buffer in-place.
 * Pixels within tolerance of target RGB become alpha=0.
 */
export function applyBgRemoval(
  data: Uint8ClampedArray,
  target: { r: number; g: number; b: number },
  tolerance: number
): void {
  const t2 = tolerance * tolerance;
  for (let i = 0; i < data.length; i += 4) {
    const dr = data[i] - target.r;
    const dg = data[i + 1] - target.g;
    const db = data[i + 2] - target.b;
    const dist2 = dr * dr + dg * dg + db * db;
    if (dist2 <= t2) {
      data[i + 3] = 0; // set alpha to 0
    }
  }
}

/**
 * Pick the dominant background color from an ImageData buffer
 * by sampling the border pixels and returning the median color.
 * Useful for "auto-detect background" feature.
 */
export function detectBgColor(data: Uint8ClampedArray, width: number, height: number): { r: number; g: number; b: number } {
  const border: Array<[number, number, number]> = [];
  // Top and bottom rows
  for (let x = 0; x < width; x++) {
    const iTop = (0 * width + x) * 4;
    const iBot = ((height - 1) * width + x) * 4;
    border.push([data[iTop], data[iTop + 1], data[iTop + 2]]);
    border.push([data[iBot], data[iBot + 1], data[iBot + 2]]);
  }
  // Left and right columns
  for (let y = 0; y < height; y++) {
    const iLeft = (y * width + 0) * 4;
    const iRight = (y * width + (width - 1)) * 4;
    border.push([data[iLeft], data[iLeft + 1], data[iLeft + 2]]);
    border.push([data[iRight], data[iRight + 1], data[iRight + 2]]);
  }
  // Average
  let r = 0, g = 0, b = 0;
  for (const [pr, pg, pb] of border) { r += pr; g += pg; b += pb; }
  const n = border.length;
  return { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) };
}
