"use client";

import { create } from "zustand";
import {
  type DesignObject,
  type Fill,
  nextId,
} from "@/lib/designerTypes";
import { type Unit } from "@/lib/units";

export type ZoomMode = "fit" | number;

/** A snapshot of undoable state. */
interface HistoryEntry {
  objects: DesignObject[];
  background: Fill;
  selectedId: string | null;
}

type OmitIdName<T> = T extends DesignObject ? Omit<T, "id" | "name"> : never;

interface DesignerState {
  // --- document ---
  widthMm: number;
  heightMm: number;
  unit: Unit;
  dpi: number;
  background: Fill;

  // --- viewport ---
  zoom: ZoomMode;
  panX: number;
  panY: number;

  // --- scene ---
  objects: DesignObject[];
  selectedId: string | null;
  selectedIds: string[];

  // --- history ---
  history: HistoryEntry[];
  redoStack: HistoryEntry[];

  // --- active tool ---
  activeTool: "select" | "rect" | "ellipse" | "line" | "polygon";

  // --- document actions ---
  setCanvasSize: (widthMm: number, heightMm: number) => void;
  setUnit: (unit: Unit) => void;
  setDpi: (dpi: number) => void;
  setBackground: (bg: Fill) => void;

  // --- viewport actions ---
  setZoom: (zoom: ZoomMode) => void;
  setPan: (x: number, y: number) => void;
  fit: () => void;

  // --- interaction (resize/rotate drag) ---
  interactionSnapshot: HistoryEntry | null;

  // --- scene actions ---
  setActiveTool: (tool: DesignerState["activeTool"]) => void;
  addObject: (obj: OmitIdName<DesignObject>) => string;
  removeObject: (id: string) => void;
  deleteSelected: () => void;
  updateObject: (id: string, patch: Partial<DesignObject>) => void;
  beginInteraction: () => void;
  liveUpdateObject: (id: string, patch: Partial<DesignObject>) => void;
  endInteraction: () => void;
  selectObject: (id: string | null) => void;
  selectAdd: (id: string) => void;
  clearSelection: () => void;

  // --- transform actions ---
  moveObject: (id: string, dx: number, dy: number) => void;
  moveSelected: (dx: number, dy: number) => void;
  rotateObject: (id: string, degrees: number) => void;
  setObjectRotation: (id: string, degrees: number) => void;
  scaleObject: (id: string, factor: number, anchor?: "center" | "topLeft") => void;

  // --- layer actions ---
  renameObject: (id: string, name: string) => void;
  toggleLock: (id: string) => void;
  toggleVisible: (id: string) => void;
  moveLayer: (id: string, newIndex: number) => void;
  bringForward: (id: string) => void;
  sendBackward: (id: string) => void;

  // --- history ---
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

/** Capture the current state into a history entry. */
function snapshot(state: DesignerState): HistoryEntry {
  return {
    objects: state.objects.map((o) => ({ ...o, fill: { ...o.fill } })),
    background: { ...state.background },
    selectedId: state.selectedId,
  };
}

/** Apply a history entry back to the store (without pushing history). */
function applyEntry(state: DesignerState, entry: HistoryEntry): Partial<DesignerState> {
  return {
    objects: entry.objects.map((o) => ({ ...o, fill: { ...o.fill } })),
    background: { ...entry.background },
    selectedId: entry.selectedId,
    selectedIds: entry.selectedId ? [entry.selectedId] : [],
    redoStack: [], // applying an entry from redo should clear redo? No — handled by caller
  };
}

export const useDesignerStore = create<DesignerState>((set, get) => {
  /** Commit the current state into history, clearing redo. */
  const commit = (mutator: (s: DesignerState) => Partial<DesignerState>) => {
    set((s) => {
      const snap = snapshot(s);
      const next = mutator(s);
      // Only push if something changed (simple reference check on objects)
      const historyChanged = next.objects !== undefined && next.objects !== s.objects;
      const bgChanged = next.background !== undefined && next.background !== s.background;
      const selChanged = next.selectedId !== undefined && next.selectedId !== s.selectedId;
      if (!historyChanged && !bgChanged && !selChanged) {
        // Selection-only changes go to history too (undo should restore selection)
        if (next.selectedId !== s.selectedId) {
          return {
            ...next,
            history: [...s.history, { objects: s.objects, background: s.background, selectedId: s.selectedId }],
            redoStack: [],
          };
        }
        return next;
      }
      return {
        ...next,
        history: [...s.history, snap],
        redoStack: [],
      };
    });
  };

  return {
    // Default canvas: A4 portrait in mm
    widthMm: 210,
    heightMm: 297,
    unit: "mm",
    dpi: 300,
    background: { type: "solid", color: "#ffffff" },

    zoom: "fit",
    panX: 0,
    panY: 0,

    objects: [],
    selectedId: null,
    selectedIds: [],

    history: [],
    redoStack: [],
    interactionSnapshot: null,

    activeTool: "select",

    setCanvasSize: (widthMm, heightMm) =>
      set({ widthMm: Math.max(1, widthMm), heightMm: Math.max(1, heightMm) }),

    setUnit: (unit) => set({ unit }),

    setDpi: (dpi) => set({ dpi: Math.max(72, Math.min(2400, dpi)) }),

    setBackground: (background) =>
      commit(() => ({ background })),

    setZoom: (zoom) => set({ zoom }),
    setPan: (panX, panY) => set({ panX, panY }),
    fit: () => set({ zoom: "fit" }),

    setActiveTool: (activeTool) => set({ activeTool }),

    addObject: (obj) => {
      const id = nextId(obj.type);
      const name = `${obj.type.charAt(0).toUpperCase() + obj.type.slice(1)} ${get().objects.length + 1}`;
      const newObj: DesignObject = { ...obj, id, name } as DesignObject;
      commit(() => ({ objects: [...get().objects, newObj] }));
      // Auto-select newly added
      set({ selectedId: id, selectedIds: [id] });
      return id;
    },

    removeObject: (id) =>
      commit((s) => {
        const objects = s.objects.filter((o) => o.id !== id);
        const selectedId = s.selectedId === id ? null : s.selectedId;
        const selectedIds = s.selectedIds.filter((sid) => sid !== id);
        return { objects, selectedId, selectedIds };
      }),

    deleteSelected: () => {
      const { selectedIds } = get();
      if (selectedIds.length === 0) return;
      commit((s) => ({
        objects: s.objects.filter((o) => !s.selectedIds.includes(o.id)),
        selectedId: null,
        selectedIds: [],
      }));
    },

    beginInteraction: () => {
      const s = get();
      if (s.interactionSnapshot === null) {
        set({ interactionSnapshot: snapshot(s) });
      }
    },

    liveUpdateObject: (id, patch) => {
      set((s) => ({
        objects: s.objects.map((o) =>
          o.id === id ? ({ ...o, ...patch } as DesignObject) : o
        ),
      }));
    },

    endInteraction: () => {
      const { interactionSnapshot } = get();
      if (interactionSnapshot !== null) {
        set((s) => ({
          history: [...s.history, interactionSnapshot],
          redoStack: [],
          interactionSnapshot: null,
        }));
      }
    },

    updateObject: (id, patch) =>
      commit((s) => ({
        objects: s.objects.map((o) =>
          o.id === id ? ({ ...o, ...patch } as DesignObject) : o
        ),
      })),

    selectObject: (selectedId) =>
      set({ selectedId, selectedIds: selectedId ? [selectedId] : [] }),

    selectAdd: (id) =>
      set((s) => {
        if (s.selectedIds.includes(id)) {
          // Remove from selection
          const selectedIds = s.selectedIds.filter((sid) => sid !== id);
          return { selectedIds, selectedId: selectedIds[selectedIds.length - 1] ?? null };
        }
        const selectedIds = [...s.selectedIds, id];
        return { selectedIds, selectedId: id };
      }),

    clearSelection: () => set({ selectedId: null, selectedIds: [] }),

    moveObject: (id, dx, dy) =>
      commit((s) => ({
        objects: s.objects.map((o) => {
          if (o.id !== id) return o;
          // Line: move both endpoints
          if (o.type === "line") {
            return { ...o, x: o.x + dx, y: o.y + dy, x2: o.x2 + dx, y2: o.y2 + dy };
          }
          // Polygon: move all points
          if (o.type === "polygon") {
            return { ...o, x: o.x + dx, y: o.y + dy };
          }
          return { ...o, x: o.x + dx, y: o.y + dy };
        }),
      })),

    moveSelected: (dx, dy) => {
      const { selectedIds } = get();
      if (selectedIds.length === 0) return;
      commit((s) => ({
        objects: s.objects.map((o) => {
          if (!s.selectedIds.includes(o.id)) return o;
          if (o.type === "line") {
            return { ...o, x: o.x + dx, y: o.y + dy, x2: o.x2 + dx, y2: o.y2 + dy };
          }
          return { ...o, x: o.x + dx, y: o.y + dy };
        }),
      }));
    },

    rotateObject: (id, degrees) =>
      commit((s) => ({
        objects: s.objects.map((o) =>
          o.id === id
            ? ({ ...o, rotation: (o.rotation + degrees) % 360 } as DesignObject)
            : o
        ),
      })),

    setObjectRotation: (id, degrees) =>
      commit((s) => ({
        objects: s.objects.map((o) =>
          o.id === id ? ({ ...o, rotation: degrees % 360 } as DesignObject) : o
        ),
      })),

    scaleObject: (id, factor, anchor = "center") =>
      commit((s) => ({
        objects: s.objects.map((o) => {
          if (o.id !== id) return o;
          if (o.type === "rect") {
            return {
              ...o,
              width: Math.max(1, o.width * factor),
              height: Math.max(1, o.height * factor),
            } as DesignObject;
          }
          if (o.type === "ellipse") {
            return {
              ...o,
              rx: Math.max(1, o.rx * factor),
              ry: Math.max(1, o.ry * factor),
            } as DesignObject;
          }
          if (o.type === "polygon") {
            const points = o.points.map((p) => ({
              x: p.x * factor,
              y: p.y * factor,
            }));
            return { ...o, points } as DesignObject;
          }
          return o;
        }),
      })),

    renameObject: (id, name) =>
      commit((s) => ({
        objects: s.objects.map((o) =>
          o.id === id ? ({ ...o, name } as DesignObject) : o
        ),
      })),

    toggleLock: (id) =>
      commit((s) => ({
        objects: s.objects.map((o) =>
          o.id === id ? ({ ...o, locked: !o.locked } as DesignObject) : o
        ),
      })),

    toggleVisible: (id) =>
      commit((s) => ({
        objects: s.objects.map((o) =>
          o.id === id ? ({ ...o, visible: !o.visible } as DesignObject) : o
        ),
      })),

    moveLayer: (id, newIndex) =>
      commit((s) => {
        const idx = s.objects.findIndex((o) => o.id === id);
        if (idx === -1) return {};
        const objects = [...s.objects];
        const [item] = objects.splice(idx, 1);
        const clamped = Math.max(0, Math.min(objects.length, newIndex));
        objects.splice(clamped, 0, item);
        return { objects };
      }),

    bringForward: (id) =>
      commit((s) => {
        const idx = s.objects.findIndex((o) => o.id === id);
        if (idx === -1 || idx >= s.objects.length - 1) return {};
        const objects = [...s.objects];
        const temp = objects[idx];
        objects[idx] = objects[idx + 1];
        objects[idx + 1] = temp;
        return { objects };
      }),

    sendBackward: (id) =>
      commit((s) => {
        const idx = s.objects.findIndex((o) => o.id === id);
        if (idx <= 0) return {};
        const objects = [...s.objects];
        const temp = objects[idx];
        objects[idx] = objects[idx - 1];
        objects[idx - 1] = temp;
        return { objects };
      }),

    undo: () =>
      set((s) => {
        if (s.history.length === 0) return {};
        const prev = s.history[s.history.length - 1];
        const redoEntry = snapshot(s);
        return {
          objects: prev.objects.map((o) => ({ ...o, fill: { ...o.fill } })),
          background: { ...prev.background },
          selectedId: prev.selectedId,
          selectedIds: prev.selectedId ? [prev.selectedId] : [],
          history: s.history.slice(0, -1),
          redoStack: [...s.redoStack, redoEntry],
        };
      }),

    redo: () =>
      set((s) => {
        if (s.redoStack.length === 0) return {};
        const next = s.redoStack[s.redoStack.length - 1];
        const undoEntry = snapshot(s);
        return {
          objects: next.objects.map((o) => ({ ...o, fill: { ...o.fill } })),
          background: { ...next.background },
          selectedId: next.selectedId,
          selectedIds: next.selectedId ? [next.selectedId] : [],
          history: [...s.history, undoEntry],
          redoStack: s.redoStack.slice(0, -1),
        };
      }),

    canUndo: () => get().history.length > 0,
    canRedo: () => get().redoStack.length > 0,
  };
});
