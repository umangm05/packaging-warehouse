"use client";

import { useDesignerStore } from "@/store/designer";
import { formatUnit } from "@/lib/units";
import { getObjectBounds } from "@/lib/designerTypes";

export function DesignerStatusBar() {
  const widthMm = useDesignerStore((s) => s.widthMm);
  const heightMm = useDesignerStore((s) => s.heightMm);
  const unit = useDesignerStore((s) => s.unit);
  const dpi = useDesignerStore((s) => s.dpi);
  const zoom = useDesignerStore((s) => s.zoom);
  const objects = useDesignerStore((s) => s.objects);
  const selectedId = useDesignerStore((s) => s.selectedId);

  const selected = selectedId ? objects.find((o) => o.id === selectedId) : null;
  const bounds = selected ? getObjectBounds(selected) : null;

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
        {selected && bounds && (
          <span className="text-amber-400">
            {selected.name} @ {bounds.x.toFixed(1)},{bounds.y.toFixed(1)} — {bounds.width.toFixed(1)}×{bounds.height.toFixed(1)}
            {selected.rotation !== 0 && ` ${selected.rotation.toFixed(0)}°`}
          </span>
        )}
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
        <span>
          Objects: <span className="font-mono text-neutral-300">{objects.length}</span>
        </span>
      </div>
    </footer>
  );
}
