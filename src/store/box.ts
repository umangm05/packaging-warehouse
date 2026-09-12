"use client";

import { create } from "zustand";
import { BOX_PRESETS, DEFAULT_PRESET_ID } from "@/lib/presets";

export type SideStyle = "kraft" | "white" | "dark";

/** Crop region in source-image pixels. null = use the full image. */
export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Per-face artwork state. */
export interface FaceState {
  image: string | null;
  imageName: string | null;
  useOverride: boolean;
  crop: CropRect | null;
  scale: number;
}

export const FACE_NAMES = [
  "Right (+X)",
  "Left (-X)",
  "Top (+Y)",
  "Bottom (-Y)",
  "Front (+Z)",
  "Back (-Z)",
] as const;

export type FaceIndex = 0 | 1 | 2 | 3 | 4 | 5;

function makeFace(useOverride: boolean = false): FaceState {
  return { image: null, imageName: null, useOverride, crop: null, scale: 1.0 };
}

interface BoxState {
  L: number;
  W: number;
  H: number;
  presetId: string;
  side: SideStyle;
  showGuides: boolean;

  masterImage: string | null;
  masterImageName: string | null;
  masterCrop: CropRect | null;
  masterScale: number;

  faces: FaceState[];

  setDims: (d: Partial<Pick<BoxState, "L" | "W" | "H">>) => void;
  applyPreset: (presetId: string) => void;
  setSide: (s: SideStyle) => void;
  setShowGuides: (g: boolean) => void;

  setMasterImage: (url: string | null, name: string | null) => void;
  setMasterCrop: (crop: CropRect | null) => void;
  setMasterScale: (scale: number) => void;

  setFaceImage: (face: FaceIndex, url: string | null, name: string | null) => void;
  setFaceCrop: (face: FaceIndex, crop: CropRect | null) => void;
  setFaceScale: (face: FaceIndex, scale: number) => void;
  setFaceOverride: (face: FaceIndex, useOverride: boolean) => void;
  clearFace: (face: FaceIndex) => void;
}

const INITIAL_PRESET = BOX_PRESETS.find((p) => p.id === DEFAULT_PRESET_ID)!;

const INITIAL_FACES: FaceState[] = [
  makeFace(false),
  makeFace(false),
  makeFace(false),
  makeFace(false),
  makeFace(true),
  makeFace(true),
];

export const useBoxStore = create<BoxState>((set) => ({
  L: INITIAL_PRESET.defaultL,
  W: INITIAL_PRESET.defaultW,
  H: INITIAL_PRESET.defaultH,
  presetId: DEFAULT_PRESET_ID,
  side: "kraft",
  showGuides: false,

  masterImage: null,
  masterImageName: null,
  masterCrop: null,
  masterScale: 1.0,

  faces: INITIAL_FACES,

  setDims: (d) => set((s) => ({ ...s, ...d })),
  applyPreset: (presetId) => {
    const preset = BOX_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      set({ presetId, L: preset.defaultL, W: preset.defaultW, H: preset.defaultH });
    }
  },
  setSide: (side) => set({ side }),
  setShowGuides: (showGuides) => set({ showGuides }),

  setMasterImage: (masterImage, masterImageName) => set({ masterImage, masterImageName }),
  setMasterCrop: (masterCrop) => set({ masterCrop }),
  setMasterScale: (masterScale) => set({ masterScale }),

  setFaceImage: (face, image, imageName) =>
    set((s) => {
      const faces = [...s.faces];
      faces[face] = { ...faces[face], image, imageName };
      return { faces };
    }),
  setFaceCrop: (face, crop) =>
    set((s) => {
      const faces = [...s.faces];
      faces[face] = { ...faces[face], crop };
      return { faces };
    }),
  setFaceScale: (face, scale) =>
    set((s) => {
      const faces = [...s.faces];
      faces[face] = { ...faces[face], scale };
      return { faces };
    }),
  setFaceOverride: (face, useOverride) =>
    set((s) => {
      const faces = [...s.faces];
      faces[face] = { ...faces[face], useOverride };
      return { faces };
    }),
  clearFace: (face) =>
    set((s) => {
      const faces = [...s.faces];
      faces[face] = makeFace(faces[face].useOverride);
      return { faces };
    }),
}));
