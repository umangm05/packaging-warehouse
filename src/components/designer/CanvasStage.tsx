"use client";

import { useDesignerStore } from "@/store/designer";
import {
  type DesignObject,
  type Fill,
  getObjectBounds,
} from "@/lib/designerTypes";
import { colorToCss } from "@/lib/colorUtils";
import { useCallback, useEffect, useRef, useState } from "react";

const FIT_PADDING = 40;
const HANDLE_SIZE = 6;

interface DragState {
  type: "move" | "draw";
  startMmX: number;
  startMmY: number;
  tool?: "rect" | "ellipse" | "line" | "polygon";
  currentMmX?: number;
  currentMmY?: number;
}

export function CanvasStage({
  onReady,
}: {
  onReady?: (el: SVGSVGElement) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const widthMm = useDesignerStore((s) => s.widthMm);
  const heightMm = useDesignerStore((s) => s.heightMm);
  const zoom = useDesignerStore((s) => s.zoom);
  const panX = useDesignerStore((s) => s.panX);
  const panY = useDesignerStore((s) => s.panY);
  const setZoom = useDesignerStore((s) => s.setZoom);
  const setPan = useDesignerStore((s) => s.setPan);
  const fit = useDesignerStore((s) => s.fit);
  const objects = useDesignerStore((s) => s.objects);
  const selectedId = useDesignerStore((s) => s.selectedId);
  const selectedIds = useDesignerStore((s) => s.selectedIds);
  const selectObject = useDesignerStore((s) => s.selectObject);
  const selectAdd = useDesignerStore((s) => s.selectAdd);
  const clearSelection = useDesignerStore((s) => s.clearSelection);
  const activeTool = useDesignerStore((s) => s.activeTool);
  const setActiveTool = useDesignerStore((s) => s.setActiveTool);
  const addObject = useDesignerStore((s) => s.addObject);
  const moveSelected = useDesignerStore((s) => s.moveSelected);
  const background = useDesignerStore((s) => s.background);

  const [mouseMm, setMouseMm] = useState<{ x: number; y: number } | null>(null);
  const isPanning = useRef(false);
  const lastPan = useRef({ x: 0, y: 0 });
  const dragState = useRef<DragState | null>(null);

  // Fit zoom
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

  const screenToMm = useCallback(
    (px: number, py: number) => {
      const svg = svgRef.current;
      if (!svg) return { x: 0, y: 0 };
      const rect = svg.getBoundingClientRect();
      const sx = px - rect.left;
      const sy = py - rect.top;
      return {
        x: (sx - panX) / effectiveZoom,
        y: (sy - panY) / effectiveZoom,
      };
    },
    [panX, panY, effectiveZoom]
  );

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (zoom === "fit") {
      const next = Math.max(0.05, Math.min(20, fitZoom - e.deltaY * 0.001 * fitZoom));
      setZoom(next);
      return;
    }
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    const next = Math.max(0.05, Math.min(20, (zoom as number) * factor));
    setZoom(next);
  };

  const objectAt = useCallback(
    (mmX: number, mmY: number): DesignObject | null => {
      for (let i = objects.length - 1; i >= 0; i--) {
        const obj = objects[i];
        if (!obj.visible || obj.locked) continue;
        const b = getObjectBounds(obj);
        if (mmX >= b.x && mmX <= b.x + b.width && mmY >= b.y && mmY <= b.y + b.height) {
          return obj;
        }
      }
      return null;
    },
    [objects]
  );

  const onMouseDown = (e: React.MouseEvent) => {
    const mm = screenToMm(e.clientX, e.clientY);

    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      isPanning.current = true;
      lastPan.current = { x: e.clientX, y: e.clientY };
      e.preventDefault();
      return;
    }

    if (e.button !== 0) return;

    if (activeTool === "select") {
      const obj = objectAt(mm.x, mm.y);
      if (obj) {
        if (e.shiftKey) selectAdd(obj.id);
        else if (selectedId !== obj.id) selectObject(obj.id);
        dragState.current = { type: "move", startMmX: mm.x, startMmY: mm.y };
      } else {
        clearSelection();
      }
      return;
    }

    // Drawing tools
    if (["rect", "ellipse", "line", "polygon"].includes(activeTool)) {
      dragState.current = {
        type: "draw",
        startMmX: mm.x,
        startMmY: mm.y,
        tool: activeTool as any,
        currentMmX: mm.x,
        currentMmY: mm.y,
      };
    }
  };

  const onMouseMove = (e: React.MouseEvent) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const pxX = e.clientX - rect.left;
    const pyY = e.clientY - rect.top;
    const mmX = (pxX - panX) / effectiveZoom;
    const mmY = (pyY - panY) / effectiveZoom;
    setMouseMm({ x: mmX, y: mmY });

    if (isPanning.current) {
      const dx = e.clientX - lastPan.current.x;
      const dy = e.clientY - lastPan.current.y;
      lastPan.current = { x: e.clientX, y: e.clientY };
      setPan(panX + dx, panY + dy);
      return;
    }

    const ds = dragState.current;
    if (!ds) return;

    if (ds.type === "move" && selectedId && activeTool === "select") {
      const dx = mmX - ds.startMmX;
      const dy = mmY - ds.startMmY;
      if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
        moveSelected(dx, dy);
        ds.startMmX = mmX;
        ds.startMmY = mmY;
      }
    }

    if (ds.type === "draw") {
      ds.currentMmX = mmX;
      ds.currentMmY = mmY;
    }
  };

  const onMouseUp = () => {
    isPanning.current = false;

    const ds = dragState.current;
    if (ds && ds.type === "draw" && ds.currentMmX !== undefined && ds.currentMmY !== undefined) {
      const x1 = ds.startMmX;
      const y1 = ds.startMmY;
      const x2 = ds.currentMmX;
      const y2 = ds.currentMmY;
      const dx = x2 - x1;
      const dy = y2 - y1;

      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        const defaultFill: Fill = { type: "solid", color: "#4f8cff" };
        const defaultStroke = "#1e3a5f";

        if (ds.tool === "rect") {
          addObject({
            type: "rect",
            x: Math.min(x1, x2),
            y: Math.min(y1, y2),
            width: Math.abs(dx),
            height: Math.abs(dy),
            rotation: 0,
            fill: defaultFill,
            fillOpacity: 1,
            stroke: defaultStroke,
            strokeWidth: 1,
            visible: true,
            locked: false,
          });
        } else if (ds.tool === "ellipse") {
          addObject({
            type: "ellipse",
            x: x1,
            y: y1,
            rx: Math.max(1, Math.abs(dx) / 2),
            ry: Math.max(1, Math.abs(dy) / 2),
            rotation: 0,
            fill: defaultFill,
            fillOpacity: 1,
            stroke: defaultStroke,
            strokeWidth: 1,
            visible: true,
            locked: false,
          });
        } else if (ds.tool === "line") {
          addObject({
            type: "line",
            x: x1,
            y: y1,
            x2: x2,
            y2: y2,
            rotation: 0,
            fill: { type: "solid", color: "#000000" },
            fillOpacity: 1,
            stroke: "#1e3a5f",
            strokeWidth: 2,
            visible: true,
            locked: false,
          });
        } else if (ds.tool === "polygon") {
          const radius = Math.sqrt(dx * dx + dy * dy);
          const sides = 6;
          if (radius > 2) {
            const points = Array.from({ length: sides }, (_, i) => {
              const angle = (i * 2 * Math.PI) / sides - Math.PI / 2;
              return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
            });
            addObject({
              type: "polygon",
              x: x1,
              y: y1,
              points,
              sides,
              rotation: 0,
              fill: defaultFill,
              fillOpacity: 1,
              stroke: defaultStroke,
              strokeWidth: 1,
              visible: true,
              locked: false,
            });
          }
        }
      }
    }

    dragState.current = null;
  };

  useEffect(() => {
    if (svgRef.current) onReady?.(svgRef.current);
  }, [onReady]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        clearSelection();
        setActiveTool("select");
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedId) useDesignerStore.getState().removeObject(selectedId);
      }
      // Tool shortcuts
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.key === "v" || e.key === "V") setActiveTool("select");
        if (e.key === "r" || e.key === "R") setActiveTool("rect");
        if (e.key === "o" || e.key === "O") setActiveTool("ellipse");
        if (e.key === "l" || e.key === "L") setActiveTool("line");
        if (e.key === "p" || e.key === "P") setActiveTool("polygon");
      }
      // Undo/redo
      if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z")) {
        if (e.shiftKey) useDesignerStore.getState().redo();
        else useDesignerStore.getState().undo();
        e.preventDefault();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || e.key === "Y")) {
        useDesignerStore.getState().redo();
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedId, clearSelection, setActiveTool]);

  // Preview rect while drawing
  const previewObj = (() => {
    const ds = dragState.current;
    if (!ds || ds.type !== "draw" || ds.currentMmX === undefined || ds.currentMmY === undefined) return null;
    const x1 = ds.startMmX;
    const y1 = ds.startMmY;
    const x2 = ds.currentMmX;
    const y2 = ds.currentMmY;
    const dx = x2 - x1;
    const dy = y2 - y1;

    if (ds.tool === "rect") {
      return (
        <rect
          x={Math.min(x1, x2)}
          y={Math.min(y1, y2)}
          width={Math.abs(dx)}
          height={Math.abs(dy)}
          fill="rgba(79,140,255,0.3)"
          stroke="#4f8cff"
          strokeWidth={0.5}
          strokeDasharray="2 2"
          vectorEffect="non-scaling-stroke"
        />
      );
    }
    if (ds.tool === "ellipse") {
      return (
        <ellipse
          cx={x1}
          cy={y1}
          rx={Math.abs(dx) / 2}
          ry={Math.abs(dy) / 2}
          fill="rgba(79,140,255,0.3)"
          stroke="#4f8cff"
          strokeWidth={0.5}
          strokeDasharray="2 2"
          vectorEffect="non-scaling-stroke"
        />
      );
    }
    if (ds.tool === "line") {
      return (
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke="#4f8cff"
          strokeWidth={1}
          strokeDasharray="2 2"
          vectorEffect="non-scaling-stroke"
        />
      );
    }
    if (ds.tool === "polygon") {
      const radius = Math.sqrt(dx * dx + dy * dy);
      if (radius < 2) return null;
      const sides = 6;
      const pts = Array.from({ length: sides }, (_, i) => {
        const angle = (i * 2 * Math.PI) / sides - Math.PI / 2;
        return `${x1 + Math.cos(angle) * radius},${y1 + Math.sin(angle) * radius}`;
      }).join(" ");
      return (
        <polygon
          points={pts}
          fill="rgba(79,140,255,0.3)"
          stroke="#4f8cff"
          strokeWidth={0.5}
          strokeDasharray="2 2"
          vectorEffect="non-scaling-stroke"
        />
      );
    }
    return null;
  })();

  const cursor = activeTool === "select" ? "default" : "crosshair";

  return (
    <svg
      ref={svgRef}
      className="h-full w-full select-none"
      style={{ cursor: isPanning.current ? "grabbing" : cursor }}
      onWheel={onWheel}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp as any}
      onMouseLeave={onMouseUp as any}
    >
      <rect x={0} y={0} width="100%" height="100%" fill="#0a0d12" />

      <g transform={`translate(${panX}, ${panY}) scale(${effectiveZoom})`}>
        {/* Canvas background */}
        <rect
          x={0}
          y={0}
          width={widthMm}
          height={heightMm}
          fill={
            background.type === "solid"
              ? background.color
              : "url(#canvas-bg-gradient)"
          }
          stroke="#3b82f6"
          strokeWidth={0.5}
          vectorEffect="non-scaling-stroke"
        />

        {background.type === "linear-gradient" && (
          <defs>
            <linearGradient
              id="canvas-bg-gradient"
              x1="0%"
              y1="0%"
              x2={`${
                Math.cos(((background.angle - 90) * Math.PI) / 180) * 50 + 50
              }%`}
              y2={`${
                Math.sin(((background.angle - 90) * Math.PI) / 180) * 50 + 50
              }%`}
            >
              {background.stops.map((s, i) => (
                <stop key={i} offset={`${s.offset * 100}%`} stopColor={s.color} />
              ))}
            </linearGradient>
          </defs>
        )}

        {/* Objects */}
        {objects.map((obj) => (
          <ObjectRenderer key={obj.id} obj={obj} />
        ))}

        {/* Drawing preview */}
        {previewObj}

        {/* Selection handles */}
        {selectedId && objects.find((o) => o.id === selectedId) && (
          <SelectionHandles obj={objects.find((o) => o.id === selectedId)!} />
        )}

        {/* Crosshair */}
        {mouseMm &&
          mouseMm.x >= 0 &&
          mouseMm.x <= widthMm &&
          mouseMm.y >= 0 &&
          mouseMm.y <= heightMm && (
            <g
              pointerEvents="none"
              stroke="#3b82f6"
              strokeWidth={0.2}
              vectorEffect="non-scaling-stroke"
            >
              <line x1={mouseMm.x} y1={0} x2={mouseMm.x} y2={heightMm} />
              <line x1={0} y1={mouseMm.y} x2={widthMm} y2={mouseMm.y} />
            </g>
          )}
      </g>
    </svg>
  );
}

function ObjectRenderer({ obj }: { obj: DesignObject }) {
  if (!obj.visible) return null;

  const fillCss =
    obj.fill.type === "solid"
      ? colorToCss(obj.fill.color, obj.fillOpacity)
      : `url(#grad-${obj.id})`;

  const strokeCss =
    obj.stroke === "transparent" ? "none" : colorToCss(obj.stroke, obj.fillOpacity);

  const transform = obj.rotation ? `rotate(${obj.rotation})` : undefined;

  switch (obj.type) {
    case "rect":
      return (
        <g>
          {obj.fill.type === "linear-gradient" && (
            <GradientDef id={`grad-${obj.id}`} fill={obj.fill} />
          )}
          <rect
            x={obj.x}
            y={obj.y}
            width={obj.width}
            height={obj.height}
            fill={fillCss}
            stroke={strokeCss}
            strokeWidth={obj.strokeWidth}
            transform={transform}
          />
        </g>
      );

    case "ellipse":
      return (
        <g>
          {obj.fill.type === "linear-gradient" && (
            <GradientDef id={`grad-${obj.id}`} fill={obj.fill} />
          )}
          <ellipse
            cx={obj.x}
            cy={obj.y}
            rx={obj.rx}
            ry={obj.ry}
            fill={fillCss}
            stroke={strokeCss}
            strokeWidth={obj.strokeWidth}
            transform={transform}
          />
        </g>
      );

    case "line":
      return (
        <line
          x1={obj.x}
          y1={obj.y}
          x2={obj.x2}
          y2={obj.y2}
          stroke={strokeCss === "none" ? "#000000" : strokeCss}
          strokeWidth={obj.strokeWidth}
          strokeLinecap="round"
        />
      );

    case "polygon": {
      const pts = obj.points
        .map((p) => `${obj.x + p.x},${obj.y + p.y}`)
        .join(" ");
      return (
        <g>
          {obj.fill.type === "linear-gradient" && (
            <GradientDef id={`grad-${obj.id}`} fill={obj.fill} />
          )}
          <polygon
            points={pts}
            fill={fillCss}
            stroke={strokeCss}
            strokeWidth={obj.strokeWidth}
            transform={transform}
          />
        </g>
      );
    }

    case "text":
      return (
        <text
          x={obj.x}
          y={obj.y}
          fontFamily={obj.fontFamily}
          fontSize={obj.fontSize}
          fill={fillCss}
          dominantBaseline="hanging"
          transform={transform}
        >
          {obj.content}
        </text>
      );

    case "image":
      return (
        <image
          x={obj.x}
          y={obj.y}
          width={obj.width}
          height={obj.height}
          href={obj.src}
          preserveAspectRatio="xMidYMid meet"
        />
      );

    default:
      return null;
  }
}

function GradientDef({ id, fill }: { id: string; fill: Fill }) {
  if (fill.type !== "linear-gradient") return null;
  return (
    <linearGradient
      id={id}
      x1="0%"
      y1="0%"
      x2={`${Math.cos(((fill.angle - 90) * Math.PI) / 180) * 50 + 50}%`}
      y2={`${Math.sin(((fill.angle - 90) * Math.PI) / 180) * 50 + 50}%`}
    >
      {fill.stops.map((s, i) => (
        <stop key={i} offset={`${s.offset * 100}%`} stopColor={s.color} />
      ))}
    </linearGradient>
  );
}

function SelectionHandles({ obj }: { obj: DesignObject }) {
  if (!obj) return null;
  const b = getObjectBounds(obj);
  const center = { x: b.x + b.width / 2, y: b.y + b.height / 2 };

  const handles = [
    { id: "nw", x: b.x, y: b.y },
    { id: "n", x: center.x, y: b.y },
    { id: "ne", x: b.x + b.width, y: b.y },
    { id: "e", x: b.x + b.width, y: center.y },
    { id: "se", x: b.x + b.width, y: b.y + b.height },
    { id: "s", x: center.x, y: b.y + b.height },
    { id: "sw", x: b.x, y: b.y + b.height },
    { id: "w", x: b.x, y: center.y },
  ];

  const selectObject = useDesignerStore((s) => s.selectObject);

  const onHandleMouseDown = (e: React.MouseEvent, handleId: string) => {
    e.stopPropagation();
    selectObject(obj.id);
  };

  return (
    <g pointerEvents="all">
      <rect
        x={b.x}
        y={b.y}
        width={b.width}
        height={b.height}
        fill="none"
        stroke="#3b82f6"
        strokeWidth={0.5}
        strokeDasharray="2 2"
        vectorEffect="non-scaling-stroke"
        pointerEvents="none"
      />
      <line
        x1={center.x}
        y1={b.y}
        x2={center.x}
        y2={b.y - 18}
        stroke="#3b82f6"
        strokeWidth={0.3}
        vectorEffect="non-scaling-stroke"
        pointerEvents="none"
      />
      {handles.map((h) => (
        <circle
          key={h.id}
          cx={h.x}
          cy={h.y}
          r={HANDLE_SIZE / 2}
          fill="#3b82f6"
          stroke="#fff"
          strokeWidth={0.5}
          vectorEffect="non-scaling-stroke"
          onMouseDown={(e) => onHandleMouseDown(e, h.id)}
          style={{ cursor: "pointer" }}
        />
      ))}
    </g>
  );
}
