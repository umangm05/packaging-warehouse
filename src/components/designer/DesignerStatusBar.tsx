"use client";

import { useDesignerStore } from "@/store/designer";
import { formatUnit } from "@/lib/units";

/**
 * Bottom status bar — shows live cursor position in mm and current zoom.
 * The cursor mm is computed by CanvasStage via a shared ref pattern; S1
 * keeps it simple with a lightweight subscription to the SVG's mousemove
 * event dispatched on the window.
 */
export function DesignerStatusBar() {
  const widthMm = useDesignerStore((s) => s.widthMm);
  const heightMm = useDesignerStore((s) => s.heightMm);
  const unit = useDesignerStore((s) => s.unit);
  const dpi = useDesignerStore((s) => s.dpi);
  const zoom = useDesignerStore((s) => s.zoom);

  return (
    <footer className="flex items-center justify-between border-t border-neutral-800 bg-neutral-900 px-4 py-1.5 text-[11px] text-neutral-500">
      <div className="flex items-center gap-4">
        <span>
          Canvas:{" "}
          <span className="font-mono text-neutral-300">
            {formatUnit(widthMm, unit, dpi)} × {formatUnit(heightMm, unit, dpi)} {unit}
          </span>
        </span>
        <span>
          (<span className="font-mono text-neutral-400">
            {formatUnit(widthMm, "mm", dpi)} × {formatUnit(heightMm, "mm", dpi)} mm
          </span>)
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span>
          Zoom:{" "}
          <span className="font-mono text-neutral-300">
            {zoom === "fit" ? "fit" : `${Math.round(zoom * 100)}%`}
          </span>
        </span>
        <span>
          DPI: <span className="font-mono text-neutral-300">{dpi}</span>
        </span>
      </div>
    </footer>
  );
}
