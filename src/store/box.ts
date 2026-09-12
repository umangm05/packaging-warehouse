"use client";

import { create } from "zustand";
import { BOX_PRESETS, DEFAULT_PRESET_ID } from "@/lib/presets";

export type SideStyle = "kraft" | "white" | "dark";

interface BoxState {
  L: number; // width mm
  W: number; // depth mm
  H: number; // height mm
  presetId: string;
  side: SideStyle;
  showGuides: boolean;
  artworkUrl: string | null; // object URL of the uploaded image
  artworkName: string | null;
  setDims: (d: Partial<Pick<BoxState, "L" | "W" | "H">>) => void;
  applyPreset: (presetId: string) => void;
  setSide: (s: SideStyle) => void;
  setShowGuides: (g: boolean) => void;
  setArtwork: (url: string | null, name: string | null) => void;
}

const INITIAL_PRESET = BOX_PRESETS.find((p) => p.id === DEFAULT_PRESET_ID)!;

export const useBoxStore = create<BoxState>((set) => ({
  L: INITIAL_PRESET.defaultL,
  W: INITIAL_PRESET.defaultW,
  H: INITIAL_PRESET.defaultH,
  presetId: DEFAULT_PRESET_ID,
  side: "kraft",
  showGuides: false,
  artworkUrl: null,
  artworkName: null,
  setDims: (d) => set((s) => ({ ...s, ...d })),
  applyPreset: (presetId) => {
    const preset = BOX_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      set({
        presetId,
        L: preset.defaultL,
        W: preset.defaultW,
        H: preset.defaultH,
      });
    }
  },
  setSide: (side) => set({ side }),
  setShowGuides: (showGuides) => set({ showGuides }),
  setArtwork: (artworkUrl, artworkName) => set({ artworkUrl, artworkName }),
}));
