"use client";

import { useCallback, useRef, useState } from "react";
import { BoxCanvas } from "@/components/BoxScene";
import { useBoxStore } from "@/store/box";
import type { SideStyle } from "@/store/box";

function DimField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="w-6 font-semibold text-neutral-400">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-amber-500"
      />
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-16 rounded border border-neutral-700 bg-neutral-800 px-2 py-0.5 text-right text-sm text-neutral-100"
      />
      <span className="w-8 text-xs text-neutral-500">mm</span>
    </label>
  );
}

export default function Page() {
  const L = useBoxStore((s) => s.L);
  const W = useBoxStore((s) => s.W);
  const H = useBoxStore((s) => s.H);
  const side = useBoxStore((s) => s.side);
  const showGuides = useBoxStore((s) => s.showGuides);
  const artworkUrl = useBoxStore((s) => s.artworkUrl);
  const artworkName = useBoxStore((s) => s.artworkName);
  const setDims = useBoxStore((s) => s.setDims);
  const setSide = useBoxStore((s) => s.setSide);
  const setShowGuides = useBoxStore((s) => s.setShowGuides);
  const setArtwork = useBoxStore((s) => s.setArtwork);

  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback(
    (file: File | null | undefined) => {
      if (!file) return;
      if (!/image\/(png|jpe?g|webp|gif|avif)/i.test(file.type)) {
        alert("Please drop a PNG, JPG, WEBP or GIF image.");
        return;
      }
      // revoke any previous object URL
      if (artworkUrl) URL.revokeObjectURL(artworkUrl);
      const url = URL.createObjectURL(file);
      setArtwork(url, file.name);
    },
    [artworkUrl, setArtwork],
  );

  const removeArtwork = () => {
    if (artworkUrl) URL.revokeObjectURL(artworkUrl);
    setArtwork(null, null);
  };

  const sideOptions: { id: SideStyle; label: string; swatch: string }[] = [
    { id: "kraft", label: "Kraft", swatch: "#d9cbb0" },
    { id: "white", label: "White", swatch: "#f3efdc" },
    { id: "dark", label: "Dark", swatch: "#c8b893" },
  ];

  return (
    <main className="flex h-screen w-screen flex-col overflow-hidden bg-neutral-950 font-sans text-neutral-100">
      {/* header */}
      <header className="flex items-center justify-between border-b border-neutral-800 px-5 py-3">
        <div className="flex items-baseline gap-3">
          <h1 className="text-base font-bold tracking-tight">
            <span className="text-amber-400">Packaging</span> Warehouse
          </h1>
          <span className="hidden text-xs text-neutral-500 sm:block">
            3D box preview · P0 spike
          </span>
        </div>
        <div className="text-xs text-neutral-500">React Three Fiber · Next.js</div>
      </header>

      <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
        {/* 3D viewport */}
        <section className="relative min-h-0 flex-1">
          <BoxCanvas />
          <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-[11px] text-neutral-300">
            drag to orbit · scroll to zoom
          </div>
        </section>

        {/* control panel */}
        <aside className="flex w-full flex-col gap-4 overflow-y-auto border-t border-neutral-800 bg-neutral-900 p-5 md:w-80 md:border-l md:border-t-0">
          {/* artwork */}
          <div>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Artwork
            </h2>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                handleFile(e.dataTransfer.files?.[0]);
              }}
              onClick={() => fileRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-3 py-5 text-center text-sm transition ${
                dragOver
                  ? "border-amber-400 bg-amber-400/10"
                  : "border-neutral-700 bg-neutral-800/50 hover:border-amber-500/60"
              }`}
            >
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={(e) => {
                  handleFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              {artworkUrl ? (
                <div className="flex flex-col items-center gap-1">
                  <img
                    src={artworkUrl}
                    alt="artwork preview"
                    className="max-h-16 rounded border border-neutral-700 object-contain"
                  />
                  <span className="max-w-full truncate text-xs text-neutral-300">
                    {artworkName}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeArtwork();
                    }}
                    className="rounded bg-neutral-700 px-2 py-0.5 text-[11px] text-neutral-200 hover:bg-red-600"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <>
                  <span className="text-2xl">🖼️</span>
                  <span className="font-medium">Drop a logo / image here</span>
                  <span className="text-xs text-neutral-500">or click to browse · PNG / JPG / WEBP</span>
                </>
              )}
            </div>
          </div>

          {/* dimensions */}
          <div>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Box dimensions
            </h2>
            <div className="flex flex-col gap-2">
              <DimField label="W" value={L} min={20} max={500} onChange={(v) => setDims({ L: v })} />
              <DimField label="D" value={W} min={20} max={500} onChange={(v) => setDims({ W: v })} />
              <DimField label="H" value={H} min={20} max={400} onChange={(v) => setDims({ H: v })} />
            </div>
            <p className="mt-1 text-[11px] text-neutral-600">
              Mesh rebuilds &amp; UVs remap in real time.
            </p>
          </div>

          {/* side style */}
          <div>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Panel style
            </h2>
            <div className="flex gap-2">
              {sideOptions.map((o) => (
                <button
                  key={o.id}
                  onClick={() => setSide(o.id)}
                  className={`flex items-center gap-2 rounded-md border px-2 py-1 text-sm transition ${
                    side === o.id
                      ? "border-amber-400 bg-amber-400/10 text-amber-200"
                      : "border-neutral-700 text-neutral-300 hover:border-neutral-500"
                  }`}
                >
                  <span
                    className="inline-block h-3 w-3 rounded-full border border-black/30"
                    style={{ background: o.swatch }}
                  />
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* guides toggle */}
          <label className="flex items-center justify-between text-sm text-neutral-300">
            <span>Show UV guide outlines</span>
            <input
              type="checkbox"
              checked={showGuides}
              onChange={(e) => setShowGuides(e.target.checked)}
              className="accent-amber-500"
            />
          </label>

          <div className="rounded-lg bg-neutral-800/40 p-3 text-[11px] leading-relaxed text-neutral-400">
            <strong className="text-neutral-300">UV-remap note:</strong> artwork maps to the
            front face only; the other five faces sample neutral panels of the same shared
            atlas texture. Geometry and per-face UVs rebuild live when you change dimensions.
          </div>
        </aside>
      </div>
    </main>
  );
}
