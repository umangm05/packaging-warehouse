"use client";

import { useDesignerStore } from "@/store/designer";
import { useEffect, useRef, useState } from "react";

/** Padding around the canvas when fitting to viewport (px). */
const FIT_PADDING = 40;

/**
 * The SVG canvas stage. Renders the physical canvas at the current zoom/pan
 * and reports the mouse position in document mm.
 *
 * Coordinate system: SVG user units map 1:1 to mm at zoom=1. The <g> transform
 * applies pan (translate) then zoom (scale), so child coordinates stay in mm.
 */
export function CanvasStage({ onReady }: { onReady?: (el: SVGSVGElement) => void }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const widthMm = useDesignerStore((s) => s.widthMm);
  const heightMm = useDesignerStore((s) => s.heightMm);
  const zoom = useDesignerStore((s) => s.zoom);
  const panX = useDesignerStore((s) => s.panX);
  const panY = useDesignerStore((s) => s.panY);
  const setZoom = useDesignerStore((s) => s.setZoom);
  const setPan = useDesignerStore((s) => s.setPan);
  const fit = useDesignerStore((s) => s.fit);
  const unit = useDesignerStore((s) => s.unit);
  const dpi = useDesignerStore((s) => s.dpi);

  const [mouseMm, setMouseMm] = useState<{ x: number; y: number } | null>(null);
  const isPanning = useRef(false);
  const lastPan = useRef({ x: 0, y: 0 });

  // Compute fit zoom whenever the canvas size or container changes.
  const [fitZoom, setFitZoom] = useState(1);
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const resize = () => {
      const rect = el.getBoundingClientRect();
      const availW = rect.width - FIT_PADDING * 2;
      const availH = rect.height - FIT_PADDING * 2;
      if (availW <= 0 || availH <= 0) return;
      const z = Math.min(availW / widthMm, availH / heightMm);
      setFitZoom(z);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    return () => ro.disconnect();
  }, [widthMm, heightMm]);

  const effectiveZoom = zoom === "fit" ? fitZoom : zoom;

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (zoom === "fit") {
      // Switch to manual zoom, anchored at fit.
      const next = Math.max(0.05, Math.min(20, fitZoom - e.deltaY * 0.001 * fitZoom));
      setZoom(next);
      return;
    }
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    const next = Math.max(0.05, Math.min(20, (zoom as number) * factor));
    setZoom(next);
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      // Middle-click or Alt+click = pan
      isPanning.current = true;
      lastPan.current = { x: e.clientX, y: e.clientY };
      e.preventDefault();
    }
  };

  const onMouseMove = (e: React.MouseEvent) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const pxX = e.clientX - rect.left;
    const pxY = e.clientY - rect.top;
    // screen = pan + mm * zoom => mm = (screen - pan) / zoom
    const mmX = (pxX - panX) / effectiveZoom;
    const mmY = (pxY - panY) / effectiveZoom;
    setMouseMm({ x: mmX, y: mmY });

    if (isPanning.current) {
      const dx = e.clientX - lastPan.current.x;
      const dy = e.clientY - lastPan.current.y;
      lastPan.current = { x: e.clientX, y: e.clientY };
      setPan(panX + dx, panY + dy);
    }
  };

  const onMouseUp = () => {
    isPanning.current = false;
  };

  useEffect(() => {
    if (svgRef.current) onReady?.(svgRef.current);
  }, [onReady]);

  return (
    <svg
      ref={svgRef}
      className="h-full w-full select-none"
      style={{ cursor: isPanning.current ? "grabbing" : "crosshair" }}
      onWheel={onWheel}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      {/* Checker / matte behind the canvas */}
      <rect x={0} y={0} width="100%" height="100%" fill="#0a0d12" />

      <g transform={`translate(${panX}, ${panY}) scale(${effectiveZoom})`}>
        {/* Canvas background (white by default — printable area) */}
        <rect
          x={0}
          y={0}
          width={widthMm}
          height={heightMm}
          fill="#ffffff"
          stroke="#3b82f6"
          strokeWidth={0.5}
          vectorEffect="non-scaling-stroke"
        />

        {/* Canvas objects would render here in S2+ */}

        {/* Crosshair cursor (only when not over an object) */}
        {mouseMm && mouseMm.x >= 0 && mouseMm.x <= widthMm && mouseMm.y >= 0 && mouseMm.y <= heightMm && (
          <g pointerEvents="none" stroke="#3b82f6" strokeWidth={0.2} vectorEffect="non-scaling-stroke">
            <line x1={mouseMm.x} y1={0} x2={mouseMm.x} y2={heightMm} />
            <line x1={0} y1={mouseMm.y} x2={widthMm} y2={mouseMm.y} />
          </g>
        )}
      </g>
    </svg>
  );
}
