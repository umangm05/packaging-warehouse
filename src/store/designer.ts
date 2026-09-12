"use client";

import { create } from "zustand";
import { type DesignObject } from "@/lib/designerTypes";
import { type Unit } from "@/lib/units";

/**
 * Viewport fit mode. "fit" auto-scales the canvas to fill the viewport minus
 * padding; a number is a fixed zoom multiplier (1 = 100%).
 */
export type ZoomMode = "fit" | number;

interface DesignerState {
  // --- document ---
  widthMm: number;
  heightMm: number;
  unit: Unit;
  dpi: number;

  // --- viewport ---
  zoom: ZoomMode;
  panX: number;
  panY: number;

  // --- scene ---
  objects: DesignObject[];
  selectedId: string | null;

  // --- document actions ---
  setCanvasSize: (widthMm: number, heightMm: number) => void;
  setUnit: (unit: Unit) => void;
  setDpi: (dpi: number) => void;

  // --- viewport actions ---
  setZoom: (zoom: ZoomMode) => void;
  setPan: (x: number, y: number) => void;
  fit: () => void;

  // --- scene actions (S2+) ---
  addObject: (obj: DesignObject) => void;
  selectObject: (id: string | null) => void;
}

export const useDesignerStore = create<DesignerState>((set) => ({
  // Default canvas: A4-ish portrait in mm — a sane starting point.
  widthMm: 210,
  heightMm: 297,
  unit: "mm",
  dpi: 300,

  zoom: "fit",
  panX: 0,
  panY: 0,

  objects: [],
  selectedId: null,

  setCanvasSize: (widthMm, heightMm) =>
    set({ widthMm: Math.max(1, widthMm), heightMm: Math.max(1, heightMm) }),

  // Switching unit preserves the physical size (mm); the display number
  // changes but the underlying mm is unchanged — callers that want to
  // *resize* in the new unit must convert first.
  setUnit: (unit) => set({ unit }),

  setDpi: (dpi) => set({ dpi: Math.max(72, Math.min(2400, dpi)) }),

  setZoom: (zoom) => set({ zoom }),
  setPan: (panX, panY) => set({ panX, panY }),
  fit: () => set({ zoom: "fit" }),

  addObject: (obj) => set((s) => ({ objects: [...s.objects, obj] })),
  selectObject: (selectedId) => set({ selectedId }),
}));
