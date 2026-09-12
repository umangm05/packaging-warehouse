"use client";

import { create } from "zustand";
import { DIM_LIMITS, validateDimension } from "@/lib/dimValidation";

export type SideStyle = "kraft" | "white" | "dark";

interface BoxState {
  L: number; // width mm
  W: number; // depth mm
  H: number; // height mm
  side: SideStyle;
  showGuides: boolean;
  artworkUrl: string | null; // object URL of the uploaded image
  artworkName: string | null;
  setDims: (d: Partial<Pick<BoxState, "L" | "W" | "H">>) => void;
  setSide: (s: SideStyle) => void;
  setShowGuides: (g: boolean) => void;
  setArtwork: (url: string | null, name: string | null) => void;
  resetDims: () => void;
}

export const useBoxStore = create<BoxState>((set) => ({
  L: 240,
  W: 160,
  H: 90,
  side: "kraft",
  showGuides: false,
  artworkUrl: null,
  artworkName: null,
  setDims: (d) =>
    set((s) => {
      // Defensive backstop: validate every dimension before committing.
      // Invalid values are silently rejected — the UI layer (useDimInput)
      // is the primary gatekeeper that shows inline errors.
      const next = { ...s };
      for (const key of ["L", "W", "H"] as const) {
        if (key in d) {
          const v = d[key];
          if (v !== undefined) {
            const limits = DIM_LIMITS[key];
            const result = validateDimension(v, limits.min, limits.max);
            if (result.valid) {
              next[key] = v;
            }
            // If invalid: keep previous value (reject silently)
          }
        }
      }
      return next;
    }),
  setSide: (side) => set({ side }),
  setShowGuides: (showGuides) => set({ showGuides }),
  setArtwork: (artworkUrl, artworkName) => set({ artworkUrl, artworkName }),
  resetDims: () => set({ L: 240, W: 160, H: 90 }),
}));
