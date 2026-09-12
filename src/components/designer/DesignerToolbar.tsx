"use client";

import { useDesignerStore } from "@/store/designer";
import { formatUnit, UNIT_OPTIONS } from "@/lib/units";

/**
 * Top toolbar: zoom controls, unit selector, DPI readout, fit-to-view.
 * S1 ships the shell; S2+ will add tool buttons (select, rect, text, image).
 */
export function DesignerToolbar() {
  const zoom = useDesignerStore((s) => s.zoom);
  const setZoom = useDesignerStore((s) => s.setZoom);
  const fit = useDesignerStore((s) => s.fit);
  const unit = useDesignerStore((s) => s.unit);
  const setUnit = useDesignerStore((s) => s.setUnit);
  const dpi = useDesignerStore((s) => s.dpi);
  const setDpi = useDesignerStore((s) => s.setDpi);
  const widthMm = useDesignerStore((s) => s.widthMm);
  const heightMm = useDesignerStore((s) => s.heightMm);

  const zoomPct = zoom === "fit" ? "fit" : `${Math.round(zoom * 100)}%`;

  return (
    <header className="flex items-center justify-between border-b border-neutral-800 bg-neutral-900 px-4 py-2">
      <div className="flex items-baseline gap-3">
        <h1 className="text-sm font-bold tracking-tight">
          <span className="text-amber-400">Vector</span> Designer
        </h1>
        <span className="hidden text-[11px] text-neutral-500 sm:block">
          {formatUnit(widthMm, unit, dpi)} × {formatUnit(heightMm, unit, dpi)} {unit}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {/* Zoom controls */}
        <div className="flex items-center gap-1 rounded-md border border-neutral-700 bg-neutral-800 px-1 py-0.5">
          <button
            onClick={() => setZoom((zoom === "fit" ? 1 : (zoom as number)) / 1.2)}
            className="rounded px-1.5 py-0.5 text-xs text-neutral-300 hover:bg-neutral-700"
            title="Zoom out"
          >
            −
          </button>
          <span className="min-w-[3.5rem] text-center text-[11px] text-neutral-300">
            {zoomPct}
          </span>
          <button
            onClick={() => setZoom((zoom === "fit" ? 1 : (zoom as number)) * 1.2)}
            className="rounded px-1.5 py-0.5 text-xs text-neutral-300 hover:bg-neutral-700"
            title="Zoom in"
          >
            +
          </button>
          <button
            onClick={fit}
            className="rounded px-1.5 py-0.5 text-[11px] text-neutral-300 hover:bg-neutral-700"
            title="Fit to view"
          >
            fit
          </button>
        </div>

        {/* Unit selector */}
        <select
          value={unit}
          onChange={(e) => setUnit(e.target.value as typeof unit)}
          className="rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1 text-xs text-neutral-200"
          title="Display unit (preserves physical size)"
        >
          {UNIT_OPTIONS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>

        {/* DPI */}
        <div className="flex items-center gap-1 rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1">
          <label className="text-[11px] text-neutral-500">DPI</label>
          <input
            type="number"
            value={dpi}
            min={72}
            max={2400}
            step={1}
            onChange={(e) => setDpi(Number(e.target.value))}
            className="w-12 bg-transparent text-right text-xs text-neutral-200 outline-none"
          />
        </div>
      </div>
    </header>
  );
}
