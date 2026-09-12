"use client";

import { useDesignerStore } from "@/store/designer";
import { formatUnit, fromMm, toMm, UNIT_OPTIONS } from "@/lib/units";
import { type DesignObject, type Fill, getObjectBounds, OPEN_LICENSED_FONTS } from "@/lib/designerTypes";
import { colorToCss, formatColorForMode, parseColor } from "@/lib/colorUtils";
import { useState } from "react";
import {
  type FontFamily,
  type FontWeightOption,
  type FontStyleOption,
  type TextAlignment,
  type TextTransformOption,
} from "@/lib/designerTypes";

export function DesignerSidePanel() {
  const widthMm = useDesignerStore((s) => s.widthMm);
  const heightMm = useDesignerStore((s) => s.heightMm);
  const unit = useDesignerStore((s) => s.unit);
  const dpi = useDesignerStore((s) => s.dpi);
  const setCanvasSize = useDesignerStore((s) => s.setCanvasSize);
  const background = useDesignerStore((s) => s.background);
  const setBackground = useDesignerStore((s) => s.setBackground);
  const objects = useDesignerStore((s) => s.objects);
  const selectedId = useDesignerStore((s) => s.selectedId);
  const selectedIds = useDesignerStore((s) => s.selectedIds);
  const selectObject = useDesignerStore((s) => s.selectObject);
  const updateObject = useDesignerStore((s) => s.updateObject);
  const removeObject = useDesignerStore((s) => s.removeObject);
  const toggleLock = useDesignerStore((s) => s.toggleLock);
  const toggleVisible = useDesignerStore((s) => s.toggleVisible);
  const renameObject = useDesignerStore((s) => s.renameObject);
  const bringForward = useDesignerStore((s) => s.bringForward);
  const sendBackward = useDesignerStore((s) => s.sendBackward);
  const moveLayer = useDesignerStore((s) => s.moveLayer);

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

  const selected = selectedId ? objects.find((o) => o.id === selectedId) : null;

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

      {/* Background */}
      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Background
        </h2>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <label className="w-12 text-xs text-neutral-400">Type</label>
            <select
              value={background.type === "solid" ? "solid" : background.type === "transparent" ? "transparent" : "linear-gradient"}
              onChange={(e) =>
                setBackground(
                  e.target.value === "solid"
                    ? { type: "solid", color: background.type === "solid" ? background.color : "#ffffff" }
                    : e.target.value === "transparent"
                    ? { type: "transparent" }
                    : {
                        type: "linear-gradient",
                        angle: 0,
                        stops: [
                          { offset: 0, color: "#ffffff" },
                          { offset: 1, color: "#000000" },
                        ],
                      }
                )
              }
              className="flex-1 rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-xs text-neutral-200"
            >
              <option value="solid">Solid</option>
              <option value="linear-gradient">Linear Gradient</option>
              <option value="transparent">Transparent</option>
            </select>
          </div>
          {background.type === "solid" ? (
            <div className="flex items-center gap-2">
              <label className="w-12 text-xs text-neutral-400">Color</label>
              <input
                type="color"
                value={background.color}
                onChange={(e) => setBackground({ type: "solid", color: e.target.value })}
                className="h-7 w-7 cursor-pointer rounded border border-neutral-700 bg-transparent"
              />
              <input
                type="text"
                value={background.color}
                onChange={(e) => {
                  const c = parseColor(e.target.value);
                  if (c) setBackground({ type: "solid", color: c });
                }}
                className="flex-1 rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-xs text-neutral-200"
              />
            </div>
          ) : background.type === "linear-gradient" ? (
            <>
              <div className="flex items-center gap-2">
                <label className="w-12 text-xs text-neutral-400">Angle</label>
                <input
                  type="number"
                  value={background.angle}
                  onChange={(e) =>
                    setBackground({ ...background, angle: Number(e.target.value) } as Fill)
                  }
                  className="flex-1 rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-xs text-neutral-200"
                />
              </div>
              {background.stops.map((stop, i) => (
                <div key={i} className="flex items-center gap-2">
                  <label className="w-12 text-xs text-neutral-400">
                    Stop {i + 1}
                  </label>
                  <input
                    type="color"
                    value={stop.color}
                    onChange={(e) => {
                      const stops = [...background.stops];
                      stops[i] = { ...stops[i], color: e.target.value };
                      setBackground({ ...background, stops } as Fill);
                    }}
                    className="h-7 w-7 cursor-pointer rounded border border-neutral-700 bg-transparent"
                  />
                  <input
                    type="number"
                    min={0}
                    max={1}
                    step={0.01}
                    value={stop.offset}
                    onChange={(e) => {
                      const stops = [...background.stops];
                      stops[i] = { ...stops[i], offset: Number(e.target.value) };
                      setBackground({ ...background, stops } as Fill);
                    }}
                    className="w-16 rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-xs text-neutral-200"
                  />
                </div>
              ))}
            </>
          ) : (
            <div className="text-[11px] text-neutral-500">Transparent background — no fill rendered.</div>
          )}
        </div>
      </section>

      {/* Position readout */}
      <PositionReadout />

      {/* Properties panel */}
      {selected && (
        <PropertiesPanel obj={selected} updateObject={updateObject} removeObject={removeObject} />
      )}

      {/* Layers panel */}
      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Layers
        </h2>
        <div className="flex flex-col gap-1">
          {objects.length === 0 ? (
            <div className="rounded-md border border-neutral-800 bg-neutral-800/40 p-3 text-[11px] text-neutral-500">
              No layers yet — draw shapes to add them.
            </div>
          ) : (
            [...objects].reverse().map((obj, idx) => {
              const realIdx = objects.length - 1 - idx;
              return (
                <div
                  key={obj.id}
                  onClick={() => selectObject(obj.id)}
                  className={`flex items-center gap-2 rounded border px-2 py-1 text-xs cursor-pointer ${
                    selectedIds.includes(obj.id)
                      ? "border-amber-500/60 bg-amber-500/10 text-amber-200"
                      : "border-neutral-800 bg-neutral-800/40 text-neutral-300 hover:border-neutral-700"
                  }`}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleVisible(obj.id);
                    }}
                    className={`text-[10px] ${obj.visible ? "text-neutral-400" : "text-neutral-600"}`}
                    title={obj.visible ? "Hide" : "Show"}
                  >
                    {obj.visible ? "👁" : "👁‍🗨"}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleLock(obj.id);
                    }}
                    className={`text-[10px] ${obj.locked ? "text-amber-400" : "text-neutral-600"}`}
                    title={obj.locked ? "Unlock" : "Lock"}
                  >
                    {obj.locked ? "🔒" : "🔓"}
                  </button>
                  <span className="flex-1 truncate">{obj.name}</span>
                  <div className="flex gap-0.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        bringForward(obj.id);
                      }}
                      disabled={realIdx === objects.length - 1}
                      className="text-[10px] text-neutral-500 hover:text-neutral-200 disabled:opacity-30"
                      title="Bring forward"
                    >
                      ↑
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        sendBackward(obj.id);
                      }}
                      disabled={realIdx === 0}
                      className="text-[10px] text-neutral-500 hover:text-neutral-200 disabled:opacity-30"
                      title="Send backward"
                    >
                      ↓
                    </button>
                  </div>
                </div>
              );
            })
          )}
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

function PropertiesPanel({
  obj,
  updateObject,
  removeObject,
}: {
  obj: DesignObject;
  updateObject: (id: string, patch: Partial<DesignObject>) => void;
  removeObject: (id: string) => void;
}) {
  const b = getObjectBounds(obj);
  const [fillMode, setFillMode] = useState<"hex" | "rgb" | "hsl">("hex");
  const [strokeMode, setStrokeMode] = useState<"hex" | "rgb" | "hsl">("hex");

  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
        Properties
      </h2>
      <div className="flex flex-col gap-2 text-xs">
        {/* Name */}
        <div className="flex items-center gap-2">
          <label className="w-12 text-neutral-400">Name</label>
          <input
            type="text"
            value={obj.name}
            onChange={(e) => updateObject(obj.id, { name: e.target.value } as any)}
            className="flex-1 rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-neutral-200"
          />
        </div>

        {/* Position */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-1">
            <label className="text-neutral-400">X</label>
            <input
              type="number"
              value={parseFloat(b.x.toFixed(2))}
              onChange={(e) => updateObject(obj.id, { x: Number(e.target.value) } as any)}
              className="w-full rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-neutral-200"
              step={1}
            />
          </div>
          <div className="flex items-center gap-1">
            <label className="text-neutral-400">Y</label>
            <input
              type="number"
              value={parseFloat(b.y.toFixed(2))}
              onChange={(e) => updateObject(obj.id, { y: Number(e.target.value) } as any)}
              className="w-full rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-neutral-200"
              step={1}
            />
          </div>
        </div>

        {/* Size */}
        {(obj.type === "rect" || obj.type === "image") && (
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-1">
              <label className="text-neutral-400">W</label>
              <input
                type="number"
                value={parseFloat(b.width.toFixed(2))}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (obj.type === "rect") updateObject(obj.id, { width: val } as any);
                  else updateObject(obj.id, { width: val } as any);
                }}
                className="w-full rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-neutral-200"
                step={1}
              />
            </div>
            <div className="flex items-center gap-1">
              <label className="text-neutral-400">H</label>
              <input
                type="number"
                value={parseFloat(b.height.toFixed(2))}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (obj.type === "rect") updateObject(obj.id, { height: val } as any);
                  else updateObject(obj.id, { height: val } as any);
                }}
                className="w-full rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-neutral-200"
                step={1}
              />
            </div>
          </div>
        )}

        {obj.type === "ellipse" && (
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-1">
              <label className="text-neutral-400">Rx</label>
              <input
                type="number"
                value={parseFloat(obj.rx.toFixed(2))}
                onChange={(e) => updateObject(obj.id, { rx: Number(e.target.value) } as any)}
                className="w-full rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-neutral-200"
                step={1}
              />
            </div>
            <div className="flex items-center gap-1">
              <label className="text-neutral-400">Ry</label>
              <input
                type="number"
                value={parseFloat(obj.ry.toFixed(2))}
                onChange={(e) => updateObject(obj.id, { ry: Number(e.target.value) } as any)}
                className="w-full rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-neutral-200"
                step={1}
              />
            </div>
          </div>
        )}

        {/* Rotation */}
        <div className="flex items-center gap-2">
          <label className="w-12 text-neutral-400">Rot</label>
          <input
            type="number"
            value={parseFloat(obj.rotation.toFixed(1))}
            onChange={(e) => updateObject(obj.id, { rotation: Number(e.target.value) } as any)}
            className="flex-1 rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-neutral-200"
            step={5}
          />
          <span className="text-neutral-500">°</span>
        </div>

        {/* Fill */}
        <div className="flex items-center gap-2">
          <label className="w-12 text-neutral-400">Fill</label>
          <select
            value={obj.fill.type === "solid" ? "solid" : obj.fill.type === "transparent" ? "transparent" : "linear-gradient"}
            onChange={(e) =>
              updateObject(obj.id, {
                fill: e.target.value === "solid"
                  ? { type: "solid", color: "#4f8cff" }
                  : e.target.value === "transparent"
                  ? { type: "transparent" }
                  : { type: "linear-gradient", angle: 0, stops: [{ offset: 0, color: "#ffffff" }, { offset: 1, color: "#000000" }] },
              } as any)
            }
            className="rounded border border-neutral-700 bg-neutral-800 px-1 py-1 text-[10px] text-neutral-200"
          >
            <option value="solid">Solid</option>
            <option value="linear-gradient">Gradient</option>
            <option value="transparent">None</option>
          </select>
        </div>

        {obj.fill.type === "solid" && (
          <div className="flex items-center gap-2">
            <label className="w-12 text-neutral-400">Color</label>
            <input
              type="color"
              value={obj.fill.color}
              onChange={(e) => updateObject(obj.id, { fill: { type: "solid", color: e.target.value } } as any)}
              className="h-7 w-7 cursor-pointer rounded border border-neutral-700 bg-transparent"
            />
            <input
              type="text"
              value={formatColorForMode(obj.fill.color, fillMode)}
              onChange={(e) => {
                const c = parseColor(e.target.value);
                if (c) updateObject(obj.id, { fill: { type: "solid", color: c } } as any);
              }}
              className="flex-1 rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-neutral-200"
            />
            <select
              value={fillMode}
              onChange={(e) => setFillMode(e.target.value as any)}
              className="w-12 rounded border border-neutral-700 bg-neutral-800 px-1 py-1 text-[10px] text-neutral-200"
            >
              <option value="hex">hex</option>
              <option value="rgb">rgb</option>
              <option value="hsl">hsl</option>
            </select>
          </div>
        )}

        {obj.fill.type === "linear-gradient" && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <label className="w-12 text-neutral-400">Angle</label>
              <input
                type="number"
                value={obj.fill.angle}
                onChange={(e) => updateObject(obj.id, { fill: { ...obj.fill, angle: Number(e.target.value) } } as any)}
                className="flex-1 rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-neutral-200"
              />
            </div>
            {obj.fill.stops.map((stop, i) => (
              <div key={i} className="flex items-center gap-2">
                <label className="w-12 text-neutral-400">Stop {i + 1}</label>
                <input
                  type="color"
                  value={stop.color}
                  onChange={(e) => {
                    const stops = [...(obj.fill as any).stops];
                    stops[i] = { ...stops[i], color: e.target.value };
                    updateObject(obj.id, { fill: { ...obj.fill, stops } } as any);
                  }}
                  className="h-7 w-7 cursor-pointer rounded border border-neutral-700 bg-transparent"
                />
                <input
                  type="number"
                  min={0} max={1} step={0.01}
                  value={stop.offset}
                  onChange={(e) => {
                    const stops = [...(obj.fill as any).stops];
                    stops[i] = { ...stops[i], offset: Number(e.target.value) };
                    updateObject(obj.id, { fill: { ...obj.fill, stops } } as any);
                  }}
                  className="w-16 rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-neutral-200"
                />
              </div>
            ))}
          </div>
        )}

        {/* Palette */}
        <div className="flex items-center gap-2">
          <label className="w-12 text-neutral-400">Palette</label>
          <div className="flex flex-wrap gap-1">
            {["#000000","#ffffff","#ef4444","#f59e0b","#10b981","#3b82f6","#8b5cf6","#ec4899","#6b7280"].map((c) => (
              <button
                key={c}
                onClick={() => updateObject(obj.id, { fill: { type: "solid", color: c } } as any)}
                className="h-5 w-5 rounded border border-neutral-700"
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
          </div>
        </div>

        {/* Polygon sides */}
        {obj.type === "polygon" && (
          <div className="flex items-center gap-2">
            <label className="w-12 text-neutral-400">Sides</label>
            <input
              type="number"
              min={3} max={20}
              value={obj.sides}
              onChange={(e) => {
                const sides = Math.max(3, Math.min(20, Number(e.target.value)));
                const radius = Math.max(...obj.points.map((p) => Math.sqrt(p.x * p.x + p.y * p.y)), 10);
                const points = Array.from({ length: sides }, (_, i) => {
                  const angle = (i * 2 * Math.PI) / sides - Math.PI / 2;
                  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
                });
                updateObject(obj.id, { sides, points } as any);
              }}
              className="flex-1 rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-neutral-200"
            />
          </div>
        )}

        {/* Text properties */}
        {obj.type === "text" && (
          <>
            <div className="flex items-center gap-2">
              <label className="w-12 text-neutral-400">Font</label>
              <select
                value={obj.fontFamily}
                onChange={(e) => updateObject(obj.id, { fontFamily: e.target.value as FontFamily } as any)}
                className="flex-1 rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-neutral-200"
              >
                {OPEN_LICENSED_FONTS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-1">
                <label className="text-neutral-400">Size</label>
                <input
                  type="number"
                  value={obj.fontSize}
                  onChange={(e) => updateObject(obj.id, { fontSize: Math.max(4, Number(e.target.value)) } as any)}
                  className="w-full rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-neutral-200"
                  min={4}
                  max={200}
                  step={1}
                />
              </div>
              <div className="flex items-center gap-1">
                <label className="text-neutral-400">Weight</label>
                <select
                  value={obj.fontWeight}
                  onChange={(e) => updateObject(obj.id, { fontWeight: Number(e.target.value) as FontWeightOption } as any)}
                  className="w-full rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-neutral-200"
                >
                  {[100, 200, 300, 400, 500, 600, 700, 800, 900].map((w) => (
                    <option key={w} value={w}>{w}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-1">
                <label className="text-neutral-400">Style</label>
                <select
                  value={obj.fontStyle}
                  onChange={(e) => updateObject(obj.id, { fontStyle: e.target.value as FontStyleOption } as any)}
                  className="w-full rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-neutral-200"
                >
                  <option value="normal">Normal</option>
                  <option value="italic">Italic</option>
                </select>
              </div>
              <div className="flex items-center gap-1">
                <label className="text-neutral-400">Align</label>
                <select
                  value={obj.textAlign}
                  onChange={(e) => updateObject(obj.id, { textAlign: e.target.value as TextAlignment } as any)}
                  className="w-full rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-neutral-200"
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-1">
                <label className="text-neutral-400">LH</label>
                <input
                  type="number"
                  value={obj.lineHeight}
                  onChange={(e) => updateObject(obj.id, { lineHeight: Math.max(0.5, Number(e.target.value)) } as any)}
                  className="w-full rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-neutral-200"
                  min={0.5}
                  max={3}
                  step={0.1}
                />
              </div>
              <div className="flex items-center gap-1">
                <label className="text-neutral-400">LS</label>
                <input
                  type="number"
                  value={obj.letterSpacing}
                  onChange={(e) => updateObject(obj.id, { letterSpacing: Number(e.target.value) } as any)}
                  className="w-full rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-neutral-200"
                  min={-2}
                  max={10}
                  step={0.1}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label className="w-12 text-neutral-400">Color</label>
              <input
                type="color"
                value={obj.textColor}
                onChange={(e) => updateObject(obj.id, { textColor: e.target.value } as any)}
                className="h-7 w-7 cursor-pointer rounded border border-neutral-700 bg-transparent"
              />
              <input
                type="text"
                value={obj.textColor}
                onChange={(e) => {
                  const c = parseColor(e.target.value);
                  if (c) updateObject(obj.id, { textColor: c } as any);
                }}
                className="flex-1 rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-neutral-200"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="w-12 text-neutral-400">Transform</label>
              <select
                value={obj.textTransform}
                onChange={(e) => updateObject(obj.id, { textTransform: e.target.value as TextTransformOption } as any)}
                className="flex-1 rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-neutral-200"
              >
                <option value="none">None</option>
                <option value="uppercase">UPPERCASE</option>
                <option value="lowercase">lowercase</option>
                <option value="capitalize">Capitalize</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={obj.convertOutlines}
                onChange={(e) => updateObject(obj.id, { convertOutlines: e.target.checked } as any)}
                className="h-4 w-4 rounded border border-neutral-700"
              />
              <label className="text-neutral-300">Convert to outlines on export</label>
            </div>
          </>
        )}

        {/* Fill opacity */}
        <div className="flex items-center gap-2">
          <label className="w-12 text-neutral-400">Opac</label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={obj.fillOpacity}
            onChange={(e) => updateObject(obj.id, { fillOpacity: Number(e.target.value) } as any)}
            className="flex-1"
          />
          <span className="w-10 text-right font-mono text-[10px] text-neutral-400">
            {Math.round(obj.fillOpacity * 100)}%
          </span>
        </div>

        {/* Stroke */}
        <div className="flex items-center gap-2">
          <label className="w-12 text-neutral-400">Stroke</label>
          <input
            type="color"
            value={obj.stroke === "transparent" ? "#000000" : obj.stroke}
            onChange={(e) => updateObject(obj.id, { stroke: e.target.value } as any)}
            className="h-7 w-7 cursor-pointer rounded border border-neutral-700 bg-transparent"
          />
          <input
            type="number"
            value={obj.strokeWidth}
            onChange={(e) => updateObject(obj.id, { strokeWidth: Number(e.target.value) } as any)}
            className="w-16 rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-neutral-200"
            step={0.5}
            min={0}
          />
        </div>

        {/* Delete */}
        <button
          onClick={() => removeObject(obj.id)}
          className="mt-2 rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-500"
        >
          Delete
        </button>
      </div>
    </section>
  );
}
