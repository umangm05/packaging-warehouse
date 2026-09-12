"use client";

import { useDesignerStore } from "@/store/designer";
import { formatUnit, fromMm, toMm, UNIT_OPTIONS } from "@/lib/units";
import { useState } from "react";

/**
 * Side panel: canvas size control, position readout, and a skeleton for
 * future layers/properties panels (S2+).
 */
export function DesignerSidePanel() {
  const widthMm = useDesignerStore((s) => s.widthMm);
  const heightMm = useDesignerStore((s) => s.heightMm);
  const unit = useDesignerStore((s) => s.unit);
  const dpi = useDesignerStore((s) => s.dpi);
  const setCanvasSize = useDesignerStore((s) => s.setCanvasSize);

  const [editW, setEditW] = useState("");
  const [editH, setEditH] = useState("");
  const [editing, setEditing] = useState(false);

  const startEdit = () => {
    setEditW(formatUnit(widthMm, unit, dpi));
    setEditH(formatUnit(heightMm, unit, dpi));
    setEditing(true);
  };

  const commit = () => {
    const w = parseFloat(editW);
    const h = parseFloat(editH);
    if (!isNaN(w) && !isNaN(h) && w > 0 && h > 0) {
      setCanvasSize(toMm(w, unit, dpi), toMm(h, unit, dpi));
    }
    setEditing(false);
  };

  return (
    <aside className="flex w-72 flex-col gap-4 overflow-y-auto border-l border-neutral-800 bg-neutral-900 p-4">
      {/* Canvas size */}
      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Canvas size
        </h2>
        {editing ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <label className="w-6 text-xs text-neutral-400">W</label>
              <input
                type="number"
                value={editW}
                onChange={(e) => setEditW(e.target.value)}
                className="flex-1 rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-sm text-neutral-100"
                autoFocus
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="w-6 text-xs text-neutral-400">H</label>
              <input
                type="number"
                value={editH}
                onChange={(e) => setEditH(e.target.value)}
                className="flex-1 rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-sm text-neutral-100"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={commit}
                className="flex-1 rounded bg-amber-500 px-2 py-1 text-xs font-medium text-neutral-900 hover:bg-amber-400"
              >
                Apply
              </button>
              <button
                onClick={() => setEditing(false)}
                className="flex-1 rounded bg-neutral-700 px-2 py-1 text-xs text-neutral-200 hover:bg-neutral-600"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={startEdit}
            className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-left text-sm text-neutral-200 hover:border-amber-500/60"
          >
            <div className="font-medium">
              {formatUnit(widthMm, unit, dpi)} × {formatUnit(heightMm, unit, dpi)} {unit}
            </div>
            <div className="text-[11px] text-neutral-500">
              {formatUnit(widthMm, "mm", dpi)} × {formatUnit(heightMm, "mm", dpi)} mm
            </div>
          </button>
        )}
      </section>

      {/* Position readout */}
      <PositionReadout />

      {/* Layers skeleton */}
      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Layers
        </h2>
        <div className="rounded-md border border-neutral-800 bg-neutral-800/40 p-3 text-[11px] text-neutral-500">
          No layers yet — shapes, text, and images appear here (S2+).
        </div>
      </section>

      {/* Properties skeleton */}
      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Properties
        </h2>
        <div className="rounded-md border border-neutral-800 bg-neutral-800/40 p-3 text-[11px] text-neutral-500">
          Select an object to edit its properties.
        </div>
      </section>
    </aside>
  );
}

function PositionReadout() {
  const widthMm = useDesignerStore((s) => s.widthMm);
  const heightMm = useDesignerStore((s) => s.heightMm);
  const unit = useDesignerStore((s) => s.unit);
  const dpi = useDesignerStore((s) => s.dpi);

  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
        Document
      </h2>
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded border border-neutral-800 bg-neutral-800/40 p-2">
          <div className="text-neutral-500">Width</div>
          <div className="font-mono text-neutral-200">
            {formatUnit(widthMm, unit, dpi)} {unit}
          </div>
        </div>
        <div className="rounded border border-neutral-800 bg-neutral-800/40 p-2">
          <div className="text-neutral-500">Height</div>
          <div className="font-mono text-neutral-200">
            {formatUnit(heightMm, unit, dpi)} {unit}
          </div>
        </div>
        <div className="rounded border border-neutral-800 bg-neutral-800/40 p-2">
          <div className="text-neutral-500">DPI</div>
          <div className="font-mono text-neutral-200">{dpi}</div>
        </div>
        <div className="rounded border border-neutral-800 bg-neutral-800/40 p-2">
          <div className="text-neutral-500">Px @ DPI</div>
          <div className="font-mono text-neutral-200">
            {Math.round(fromMm(widthMm, "px", dpi))} × {Math.round(fromMm(heightMm, "px", dpi))}
          </div>
        </div>
      </div>
    </section>
  );
}
