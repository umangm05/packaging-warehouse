'use client';

import { useState, useRef } from 'react';
import { useDesignerStore } from '@/store/designer';
import { formatUnit, UNIT_OPTIONS } from '@/lib/units';
import { ExportDialog } from './ExportDialog';

const TOOLS = [
  { id: "select", label: "Select", shortcut: "V" },
  { id: "text", label: "Text", shortcut: "T" },
  { id: "rect", label: "Rectangle", shortcut: "R" },
  { id: "ellipse", label: "Ellipse", shortcut: "O" },
  { id: "line", label: "Line", shortcut: "L" },
  { id: "polygon", label: "Polygon", shortcut: "P" },
  { id: "image", label: "Image", shortcut: "I" },
] as const;

export function DesignerToolbar() {
  const [showExport, setShowExport] = useState(false);
  const [showDesigns, setShowDesigns] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const zoom = useDesignerStore((s) => s.zoom);
  const setZoom = useDesignerStore((s) => s.setZoom);
  const fit = useDesignerStore((s) => s.fit);
  const unit = useDesignerStore((s) => s.unit);
  const setUnit = useDesignerStore((s) => s.setUnit);
  const dpi = useDesignerStore((s) => s.dpi);
  const setDpi = useDesignerStore((s) => s.setDpi);
  const widthMm = useDesignerStore((s) => s.widthMm);
  const heightMm = useDesignerStore((s) => s.heightMm);
  const activeTool = useDesignerStore((s) => s.activeTool);
  const setActiveTool = useDesignerStore((s) => s.setActiveTool);
  const undo = useDesignerStore((s) => s.undo);
  const redo = useDesignerStore((s) => s.redo);
  const canUndo = useDesignerStore((s) => s.history.length > 0);
  const canRedo = useDesignerStore((s) => s.redoStack.length > 0);

  // persistence
  const currentDesignId = useDesignerStore((s) => s.currentDesignId);
  const currentDesignName = useDesignerStore((s) => s.currentDesignName);
  const setCurrentDesignName = useDesignerStore((s) => s.setCurrentDesignName);
  const saveDesign = useDesignerStore((s) => s.saveDesign);
  const openDesign = useDesignerStore((s) => s.openDesign);
  const renameDesign = useDesignerStore((s) => s.renameDesign);
  const duplicateDesign = useDesignerStore((s) => s.duplicateDesign);
  const deleteDesign = useDesignerStore((s) => s.deleteDesign);
  const newDesign = useDesignerStore((s) => s.newDesign);
  const designs = useDesignerStore((s) => s.designs);
  const refreshDesignList = useDesignerStore((s) => s.refreshDesignList);
  const exportDesign = useDesignerStore((s) => s.exportDesign);
  const importDesign = useDesignerStore((s) => s.importDesign);

  const zoomPct = zoom === "fit" ? "fit" : `${Math.round(zoom * 100)}%`;

  const handleSave = async () => {
    await saveDesign();
    await refreshDesignList();
  };

  const handleExportJson = () => {
    const json = exportDesign();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${currentDesignName || "design"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      await importDesign(text);
    } catch (err) {
      alert(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    // reset input so the same file can be re-imported
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <header className="flex items-center justify-between border-b border-neutral-800 bg-neutral-900 px-4 py-2">
      <div className="flex items-baseline gap-3">
        <h1 className="text-sm font-bold tracking-tight">
          <span className="text-amber-400">Vector</span> Designer
        </h1>
        <span className="hidden text-[11px] text-neutral-500 sm:block">
          {formatUnit(widthMm, unit, dpi)} × {formatUnit(heightMm, unit, dpi)} {unit}
        </span>
        {/* Current design name */}
        <input
          type="text"
          value={currentDesignName}
          onChange={(e) => setCurrentDesignName(e.target.value)}
          onBlur={handleSave}
          className="rounded border border-neutral-700 bg-neutral-800 px-2 py-0.5 text-xs text-neutral-200 outline-none focus:border-amber-500"
          title="Design name — edits autosave"
        />
      </div>

      <div className="flex items-center gap-2">
        {/* Tool buttons */}
        <div className="flex items-center gap-1 rounded-md border border-neutral-700 bg-neutral-800 px-1 py-0.5">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTool(t.id as any)}
              className={`rounded px-2 py-0.5 text-xs ${
                activeTool === t.id
                  ? "bg-amber-500 text-neutral-900"
                  : "text-neutral-300 hover:bg-neutral-700"
              }`}
              title={`${t.label} (${t.shortcut})`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Undo / Redo */}
        <div className="flex items-center gap-1 rounded-md border border-neutral-700 bg-neutral-800 px-1 py-0.5">
          <button
            onClick={undo}
            disabled={!canUndo}
            className="rounded px-1.5 py-0.5 text-xs text-neutral-300 hover:bg-neutral-700 disabled:opacity-40"
            title="Undo (Ctrl+Z)"
          >
            ↶
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            className="rounded px-1.5 py-0.5 text-xs text-neutral-300 hover:bg-neutral-700 disabled:opacity-40"
            title="Redo (Ctrl+Y)"
          >
            ↷
          </button>
        </div>

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

        {/* Save */}
        <button
          onClick={handleSave}
          className="rounded-md border border-green-600 bg-green-600 px-3 py-1 text-xs font-bold text-white hover:bg-green-500"
          title="Save design (Ctrl+S)"
        >
          Save
        </button>

        {/* Designs dropdown */}
        <div className="relative">
          <button
            onClick={async () => {
              await refreshDesignList();
              setShowDesigns(!showDesigns);
            }}
            className="rounded-md border border-neutral-600 bg-neutral-800 px-3 py-1 text-xs text-neutral-200 hover:bg-neutral-700"
            title="Open a saved design"
          >
            Designs ▾
          </button>
          {showDesigns && (
            <div className="absolute right-0 top-full z-50 mt-1 w-72 rounded-md border border-neutral-700 bg-neutral-900 p-2 shadow-xl">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-2 mb-2">
                <span className="text-xs font-semibold text-neutral-300">Saved Designs</span>
                <button
                  onClick={() => {
                    newDesign();
                    setShowDesigns(false);
                  }}
                  className="rounded bg-amber-500 px-2 py-0.5 text-[11px] font-bold text-neutral-900 hover:bg-amber-400"
                >
                  + New
                </button>
              </div>
              <div className="flex flex-col gap-1 max-h-60 overflow-y-auto">
                {designs.length === 0 ? (
                  <div className="rounded border border-neutral-800 bg-neutral-800/40 p-3 text-[11px] text-neutral-500">
                    No saved designs yet — draw something and hit Save.
                  </div>
                ) : (
                  designs.map((d) => (
                    <div
                      key={d.id}
                      className={`flex items-center gap-2 rounded border px-2 py-1 text-xs cursor-pointer ${
                        currentDesignId === d.id
                          ? "border-amber-500/60 bg-amber-500/10 text-amber-200"
                          : "border-neutral-800 bg-neutral-800/40 text-neutral-300 hover:border-neutral-700"
                      }`}
                    >
                      <button
                        onClick={async () => {
                          await openDesign(d.id);
                          setShowDesigns(false);
                        }}
                        className="flex-1 truncate text-left"
                        title={d.name}
                      >
                        {d.name}
                      </button>
                      <span className="text-[10px] text-neutral-500">
                        {new Date(d.updatedAt).toLocaleDateString()}
                      </span>
                      <button
                        onClick={async () => {
                          const newName = prompt("Rename design", d.name);
                          if (newName && newName.trim()) {
                            await renameDesign(d.id, newName.trim());
                          }
                        }}
                        className="text-[10px] text-neutral-500 hover:text-neutral-200"
                        title="Rename"
                      >
                        ✎
                      </button>
                      <button
                        onClick={async () => {
                          const newName = prompt(`Duplicate "${d.name}" as:`, `${d.name} copy`);
                          if (newName && newName.trim()) {
                            await duplicateDesign(d.id, newName.trim());
                          }
                        }}
                        className="text-[10px] text-neutral-500 hover:text-neutral-200"
                        title="Duplicate"
                      >
                        ⎘
                      </button>
                      <button
                        onClick={async () => {
                          if (confirm(`Delete "${d.name}"? This cannot be undone.`)) {
                            await deleteDesign(d.id);
                          }
                        }}
                        className="text-[10px] text-red-500 hover:text-red-400"
                        title="Delete"
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Import / Export JSON */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleImportJson}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="rounded-md border border-neutral-600 bg-neutral-800 px-3 py-1 text-xs text-neutral-200 hover:bg-neutral-700"
          title="Import a .json design file"
        >
          Import
        </button>
        <button
          onClick={handleExportJson}
          className="rounded-md border border-neutral-600 bg-neutral-800 px-3 py-1 text-xs text-neutral-200 hover:bg-neutral-700"
          title="Export design as .json file"
        >
          JSON
        </button>

        {/* Export button (SVG/PDF/PNG/JPG) */}
        <button
          onClick={() => setShowExport(true)}
          className="rounded-md border border-amber-600 bg-amber-500 px-3 py-1 text-xs font-bold text-neutral-900 hover:bg-amber-400"
          title="Export design (SVG / PDF / PNG / JPG)"
        >
          Export
        </button>
      </div>

      {showExport && <ExportDialog onClose={() => setShowExport(false)} />}
    </header>
  );
}
