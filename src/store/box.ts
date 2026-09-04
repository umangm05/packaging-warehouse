"use client";

import { create } from "zustand";

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
}

export const useBoxStore = create<BoxState>((set) => ({
  L: 240,
  W: 160,
  H: 90,
  side: "kraft",
  showGuides: false,
  artworkUrl: null,
  artworkName: null,
  setDims: (d) => set((s) => ({ ...s, ...d })),
  setSide: (side) => set({ side }),
  setShowGuides: (showGuides) => set({ showGuides }),
  setArtwork: (artworkUrl, artworkName) => set({ artworkUrl, artworkName }),
}));
