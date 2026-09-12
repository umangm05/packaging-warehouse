/**
 * Font utilities for the vector designer.
 *
 * This module re-exports the curated font list from designerTypes
 * and provides unit-conversion helpers used when rendering text.
 */

export { OPEN_LICENSED_FONTS, type FontFamily } from "@/lib/designerTypes";

/** 1pt = 0.3528mm — used to convert font-size (pt) to layout mm. */
export const PT_TO_MM = 25.4 / 72;

/** Convert a font size in points to millimetres. */
export function ptToMm(pt: number): number {
  return pt * PT_TO_MM;
}
