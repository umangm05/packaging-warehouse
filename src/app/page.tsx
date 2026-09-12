"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BoxCanvas } from "@/components/BoxScene";
import { FaceCropTool } from "@/components/FaceCropTool";
import { useBoxStore } from "@/store/box";
import { FACE_NAMES } from "@/store/box";
import type { FaceIndex, SideStyle } from "@/store/box";
import { BOX_PRESETS } from "@/lib/presets";
import {
  validateFile,
  formatFileSize,
  ACCEPT_STRING,
  recommendedPixels,
  type ImageFileInfo,
} from "@/lib/fileValidation";

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

const FACE_ICONS = ["→", "←", "↑", "↓", "⬗", "⬖"];

function FaceButton({
  index,
  label,
  icon,
  active,
  onClick,
}: {
  index: number;
  label: string;
  icon: string;
  active: boolean;
  onClick: () => void;
}) {
  const face = useBoxStore((s) => s.faces[index as FaceIndex]);
  const hasOwnImage = face.useOverride && face.image !== null;
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 rounded-md border px-2 py-1.5 text-center transition ${
        active
          ? "border-amber-400 bg-amber-400/15 text-amber-200"
          : "border-neutral-700 bg-neutral-800/40 text-neutral-300 hover:border-neutral-500"
      }`}
    >
      <span className="text-lg leading-none">{icon}</span>
      <span className="text-[10px] font-medium leading-tight">{label}</span>
      {hasOwnImage && (
        <span className="h-1 w-1 rounded-full bg-amber-400" title="Custom artwork" />
      )}
    </button>
  );
}

function FaceEditor({ faceIndex }: { faceIndex: FaceIndex }) {
  const face = useBoxStore((s) => s.faces[faceIndex]);
  const setFaceImage = useBoxStore((s) => s.setFaceImage);
  const setFaceCrop = useBoxStore((s) => s.setFaceCrop);
  const setFaceScale = useBoxStore((s) => s.setFaceScale);
  const setFaceOverride = useBoxStore((s) => s.setFaceOverride);
  const clearFace = useBoxStore((s) => s.clearFace);

  const masterImage = useBoxStore((s) => s.masterImage);
  const masterCrop = useBoxStore((s) => s.masterCrop);
  const masterScale = useBoxStore((s) => s.masterScale);
  const L = useBoxStore((s) => s.L);
  const W = useBoxStore((s) => s.W);
  const H = useBoxStore((s) => s.H);

  const fileRef = useRef<HTMLInputElement>(null);
  const [showCrop, setShowCrop] = useState(false);
  const [cropImage, setCropImage] = useState<HTMLImageElement | null>(null);
  const [processing, setProcessing] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [imageInfo, setImageInfo] = useState<ImageFileInfo | null>(null);
  const pendingSizeRef = useRef<number>(0);

  const displayedCrop = face.useOverride ? face.crop : masterCrop;
  const displayedScale = face.useOverride ? face.scale : masterScale;
  const displayedImage = face.useOverride ? face.image : masterImage;
  const isOverridden = face.useOverride;

  const faceMM = [L, W, H, L, W, W][faceIndex];
  const recommendedPx = recommendedPixels(faceMM);

  const handleFile = useCallback(
    (file: File | null | undefined) => {
      if (!file) return;
      const result = validateFile(file);
      if (!result.valid) {
        setFileError(result.error);
        setProcessing(false);
        return;
      }
      setFileError(null);
      setProcessing(true);
      pendingSizeRef.current = file.size;
      if (face.image) URL.revokeObjectURL(face.image);
      const url = URL.createObjectURL(file);
      setFaceImage(faceIndex, url, file.name);
      if (!face.useOverride) setFaceOverride(faceIndex, true);
    },
    [face.image, face.useOverride, faceIndex, setFaceImage, setFaceOverride],
  );

  useEffect(() => {
    if (!displayedImage) {
      setCropImage(null);
      setProcessing(false);
      setImageInfo(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    let cancelled = false;
    (async () => {
      try {
        await img.decode();
      } catch {
        img.onload = () => {
          if (cancelled) return;
          setCropImage(img);
          setImageInfo({ width: img.naturalWidth, height: img.naturalHeight, fileSize: pendingSizeRef.current });
          setProcessing(false);
        };
        img.src = displayedImage;
        return;
      }
      if (cancelled) return;
      setCropImage(img);
      setImageInfo({ width: img.naturalWidth, height: img.naturalHeight, fileSize: pendingSizeRef.current });
      setProcessing(false);
    })();
    img.src = displayedImage;
    return () => {
      cancelled = true;
    };
  }, [displayedImage]);

  return (
    <div className="rounded-lg border border-neutral-700 bg-neutral-800/40 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-xs font-semibold text-neutral-300">
          {FACE_NAMES[faceIndex]} Face
        </h4>
        <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-neutral-400">
          <input
            type="checkbox"
            checked={isOverridden}
            onChange={(e) => setFaceOverride(faceIndex, e.target.checked)}
            className="accent-amber-500"
          />
          Custom artwork
        </label>
      </div>

      {!isOverridden && (
        <p className="mb-2 text-[10px] text-neutral-500">
          Inherits master panel. Toggle &quot;Custom artwork&quot; to upload a unique image.
        </p>
      )}

      {isOverridden && (
        <>
          <div
            onClick={() => !processing && fileRef.current?.click()}
            className={`relative mb-2 flex cursor-pointer flex-col items-center justify-center gap-1 rounded border border-dashed py-3 text-center text-[11px] transition ${
              fileError
                ? "border-red-500/70 bg-red-500/5"
                : processing
                  ? "border-amber-500/50 bg-amber-500/5"
                  : "border-neutral-600 bg-neutral-800/50 hover:border-amber-500/60"
            } ${processing ? "pointer-events-none" : ""}`}
          >
            {processing && (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded bg-neutral-950/60 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-amber-300">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
                  </svg>
                  <span className="text-[11px] font-medium">Decoding image…</span>
                </div>
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT_STRING}
              className="hidden"
              onChange={(e) => {
                handleFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            {face.image ? (
              <span className="text-neutral-200">Replace image</span>
            ) : processing ? (
              <span className="text-neutral-400">Selecting…</span>
            ) : (
              <>
                <span className="text-2xl">🖼️</span>
                <span>Click to upload</span>
                <span className="text-[9px] text-neutral-600">
                  Need ~{recommendedPx} px for crisp print
                </span>
              </>
            )}
          </div>

          {fileError && (
            <div className="mb-2 flex flex-col gap-1 rounded border border-red-500/60 bg-red-500/10 px-2 py-1.5 text-[10px] text-red-300">
              <span className="font-semibold">⚠ Upload error</span>
              <span>{fileError}</span>
              <span className="text-red-400/70">Accepted: PNG, JPG, WEBP, GIF, AVIF ≤ 50 MB</span>
            </div>
          )}

          {imageInfo && !processing && (
            <div className="mb-2 flex items-center justify-between rounded bg-neutral-800/70 px-2 py-1 text-[10px] text-neutral-400">
              <span>{imageInfo.width} × {imageInfo.height} px</span>
              <span>{formatFileSize(imageInfo.fileSize)}</span>
            </div>
          )}

          {face.image && (
            <div className="mb-2 flex gap-1">
              <button
                onClick={() => setShowCrop(!showCrop)}
                className="flex-1 rounded bg-neutral-700 px-2 py-1 text-[11px] text-neutral-200 hover:bg-neutral-600"
              >
                {showCrop ? "Hide crop tool" : "✂️ Crop tool"}
              </button>
              <button
                onClick={() => clearFace(faceIndex)}
                className="rounded bg-neutral-700 px-2 py-1 text-[11px] text-red-300 hover:bg-red-600"
              >
                Clear
              </button>
            </div>
          )}

          {showCrop && cropImage && (
            <div className="mb-2">
              <FaceCropTool
                image={cropImage}
                initialCrop={displayedCrop}
                onChange={(c) => setFaceCrop(faceIndex, c)}
                onApply={() => setShowCrop(false)}
                onCancel={() => {
                  setShowCrop(false);
                  setFaceCrop(faceIndex, displayedCrop);
                }}
              />
            </div>
          )}

          <div className="flex items-center gap-2 text-[11px] text-neutral-400">
            <span>Scale:</span>
            <input
              type="range"
              min={0.1}
              max={3}
              step={0.05}
              value={displayedScale}
              onChange={(e) => setFaceScale(faceIndex, Number(e.target.value))}
              className="flex-1 accent-amber-500"
            />
            <span className="w-10 text-right">{displayedScale.toFixed(2)}×</span>
          </div>
        </>
      )}
    </div>
  );
}

export default function Page() {
  const L = useBoxStore((s) => s.L);
  const W = useBoxStore((s) => s.W);
  const H = useBoxStore((s) => s.H);
  const presetId = useBoxStore((s) => s.presetId);
  const side = useBoxStore((s) => s.side);
  const showGuides = useBoxStore((s) => s.showGuides);
  const setDims = useBoxStore((s) => s.setDims);
  const applyPreset = useBoxStore((s) => s.applyPreset);
  const setSide = useBoxStore((s) => s.setSide);
  const setShowGuides = useBoxStore((s) => s.setShowGuides);

  const masterImage = useBoxStore((s) => s.masterImage);
  const masterImageName = useBoxStore((s) => s.masterImageName);
  const setMasterImage = useBoxStore((s) => s.setMasterImage);
  const setMasterCrop = useBoxStore((s) => s.setMasterCrop);
  const setMasterScale = useBoxStore((s) => s.setMasterScale);

  const [selectedFace, setSelectedFace] = useState<FaceIndex>(4);
  const [showMasterCrop, setShowMasterCrop] = useState(false);
  const [masterCropImage, setMasterCropImage] = useState<HTMLImageElement | null>(null);
  const [masterProcessing, setMasterProcessing] = useState(false);
  const [masterError, setMasterError] = useState<string | null>(null);
  const [masterInfo, setMasterInfo] = useState<ImageFileInfo | null>(null);
  const masterPendingSizeRef = useRef<number>(0);

  // Recommended pixel count for the master — uses longest box edge at 300 DPI.
  const masterMM = Math.max(L, W, H);
  const masterRecommendedPx = recommendedPixels(masterMM);

  useEffect(() => {
    if (!masterImage) {
      setMasterCropImage(null);
      setMasterProcessing(false);
      setMasterInfo(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    let cancelled = false;
    (async () => {
      try {
        await img.decode();
      } catch {
        img.onload = () => {
          if (cancelled) return;
          setMasterCropImage(img);
          setMasterInfo({ width: img.naturalWidth, height: img.naturalHeight, fileSize: masterPendingSizeRef.current });
          setMasterProcessing(false);
        };
        img.src = masterImage;
        return;
      }
      if (cancelled) return;
      setMasterCropImage(img);
      setMasterInfo({ width: img.naturalWidth, height: img.naturalHeight, fileSize: masterPendingSizeRef.current });
      setMasterProcessing(false);
    })();
    img.src = masterImage;
    return () => {
      cancelled = true;
    };
  }, [masterImage]);

  const masterFileRef = useRef<HTMLInputElement>(null);
  const masterDragOver = useRef(false);

  const handleMasterFile = useCallback(
    (file: File | null | undefined) => {
      if (!file) return;
      const result = validateFile(file);
      if (!result.valid) {
        setMasterError(result.error);
        setMasterProcessing(false);
        return;
      }
      setMasterError(null);
      setMasterProcessing(true);
      masterPendingSizeRef.current = file.size;
      if (masterImage) URL.revokeObjectURL(masterImage);
      const url = URL.createObjectURL(file);
      setMasterImage(url, file.name);
    },
    [masterImage, setMasterImage],
  );

  const removeMasterImage = () => {
    if (masterImage) URL.revokeObjectURL(masterImage);
    setMasterImage(null, null);
    setMasterCrop(null);
    setMasterError(null);
    setMasterInfo(null);
  };

  const sideOptions: { id: SideStyle; label: string; swatch: string }[] = [
    { id: "kraft", label: "Kraft", swatch: "#d9cbb0" },
    { id: "white", label: "White", swatch: "#f3efdc" },
    { id: "dark", label: "Dark", swatch: "#c8b893" },
  ];

  return (
    <main className="flex h-screen w-screen flex-col overflow-hidden bg-neutral-950 font-sans text-neutral-100">
      <header className="flex items-center justify-between border-b border-neutral-800 px-5 py-3">
        <div className="flex items-baseline gap-3">
          <h1 className="text-base font-bold tracking-tight">
            <span className="text-amber-400">Packaging</span> Warehouse
          </h1>
          <span className="hidden text-xs text-neutral-500 sm:block">
            3D box preview · multi-face artwork
          </span>
        </div>
        <div className="text-xs text-neutral-500">React Three Fiber · Next.js</div>
      </header>

      <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
        <section className="relative min-h-0 flex-1">
          <BoxCanvas />
          <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-[11px] text-neutral-300">
            drag to orbit · scroll to zoom
          </div>
        </section>

        <aside className="flex w-full flex-col gap-3 overflow-y-auto border-t border-neutral-800 bg-neutral-900 p-4 md:w-96 md:border-l md:border-t-0">
          <div>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Box preset
            </h2>
            <div className="grid grid-cols-2 gap-1.5">
              {BOX_PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => applyPreset(p.id)}
                  className={`rounded-md border px-3 py-1.5 text-left transition ${
                    presetId === p.id
                      ? "border-amber-400 bg-amber-400/10 text-amber-200"
                      : "border-neutral-700 bg-neutral-800/50 text-neutral-300 hover:border-neutral-500"
                  }`}
                >
                  <div className="text-xs font-medium">{p.name}</div>
                  <div className="font-mono text-[10px] text-neutral-600">
                    {p.defaultL}×{p.defaultW}×{p.defaultH} mm
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Faces
            </h2>
            <div className="grid grid-cols-3 gap-1.5">
              {FACE_NAMES.map((name, i) => (
                <FaceButton
                  key={i}
                  index={i}
                  label={name}
                  icon={FACE_ICONS[i]}
                  active={selectedFace === i}
                  onClick={() => setSelectedFace(i as FaceIndex)}
                />
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-neutral-700 bg-neutral-800/30 p-3">
            <h3 className="mb-2 text-xs font-semibold text-neutral-300">
              Master panel <span className="text-neutral-500">(default for non-overridden faces)</span>
            </h3>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                masterDragOver.current = true;
              }}
              onDragLeave={() => (masterDragOver.current = false)}
              onDrop={(e) => {
                e.preventDefault();
                masterDragOver.current = false;
                handleMasterFile(e.dataTransfer.files?.[0]);
              }}
              onClick={() => !masterProcessing && masterFileRef.current?.click()}
              className={`relative flex cursor-pointer flex-col items-center justify-center gap-1 rounded border-2 border-dashed px-3 py-3 text-center text-[11px] transition ${
                masterError
                  ? "border-red-500/70 bg-red-500/5"
                  : masterDragOver.current
                    ? "border-amber-400 bg-amber-400/10"
                    : masterProcessing
                      ? "border-amber-500/50 bg-amber-500/5"
                      : "border-neutral-700 bg-neutral-800/50 hover:border-amber-500/60"
              } ${masterProcessing ? "pointer-events-none" : ""}`}
            >
              {masterProcessing && (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded bg-neutral-950/60 backdrop-blur-sm">
                  <div className="flex items-center gap-2 text-amber-300">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
                    </svg>
                    <span className="text-[11px] font-medium">Decoding image…</span>
                  </div>
                </div>
              )}
              <input
                ref={masterFileRef}
                type="file"
                accept={ACCEPT_STRING}
                className="hidden"
                onChange={(e) => {
                  handleMasterFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              {masterImage ? (
                <div className="flex flex-col items-center gap-1">
                  <img
                    src={masterImage}
                    alt="master"
                    className="max-h-10 rounded border border-neutral-700 object-contain"
                  />
                  <span className="max-w-full truncate text-neutral-300">{masterImageName}</span>
                  {masterInfo && (
                    <span className="text-[10px] text-neutral-500">
                      {masterInfo.width}×{masterInfo.height} px · {formatFileSize(masterInfo.fileSize)}
                    </span>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeMasterImage();
                    }}
                    className="rounded bg-neutral-700 px-2 py-0.5 text-[10px] text-neutral-200 hover:bg-red-600"
                  >
                    Remove
                  </button>
                </div>
              ) : masterProcessing ? (
                <span className="text-neutral-400">Selecting…</span>
              ) : (
                <>
                  <span className="text-2xl">🖼️</span>
                  <span className="font-medium">Master image</span>
                  <span className="text-neutral-500">Upload once · inherited by faces</span>
                  <span className="text-[9px] text-neutral-600">
                    Need ~{masterRecommendedPx} px for crisp print
                  </span>
                </>
              )}
            </div>

            {masterError && (
              <div className="mt-2 flex flex-col gap-1 rounded border border-red-500/60 bg-red-500/10 px-2 py-1.5 text-[10px] text-red-300">
                <span className="font-semibold">⚠ Upload error</span>
                <span>{masterError}</span>
                <span className="text-red-400/70">Accepted: PNG, JPG, WEBP, GIF, AVIF ≤ 50 MB</span>
              </div>
            )}
            {masterImage && (
              <div className="mt-2 space-y-1">
                <button
                  onClick={() => setShowMasterCrop(!showMasterCrop)}
                  className="w-full rounded bg-neutral-700 px-2 py-1 text-[11px] text-neutral-200 hover:bg-neutral-600"
                >
                  {showMasterCrop ? "Hide master crop" : "✂️ Crop master image"}
                </button>
                <div className="flex items-center gap-2 text-[11px] text-neutral-400">
                  <span>Scale:</span>
                  <input
                    type="range"
                    min={0.1}
                    max={3}
                    step={0.05}
                    value={useBoxStore.getState().masterScale}
                    onChange={(e) => setMasterScale(Number(e.target.value))}
                    className="flex-1 accent-amber-500"
                  />
                  <span className="w-10 text-right">
                    {useBoxStore.getState().masterScale.toFixed(2)}×
                  </span>
                </div>
              </div>
            )}
            {showMasterCrop && masterCropImage && (
              <div className="mt-2">
                <FaceCropTool
                  image={masterCropImage}
                  initialCrop={useBoxStore.getState().masterCrop}
                  onChange={(c) => setMasterCrop(c)}
                  onApply={() => setShowMasterCrop(false)}
                  onCancel={() => {
                    setShowMasterCrop(false);
                    setMasterCrop(useBoxStore.getState().masterCrop);
                  }}
                />
              </div>
            )}
          </div>

          <FaceEditor faceIndex={selectedFace} />

          <div>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Box dimensions
            </h2>
            <div className="flex flex-col gap-2">
              <DimField label="L" value={L} min={10} max={500} onChange={(v) => setDims({ L: v })} />
              <DimField label="W" value={W} min={10} max={500} onChange={(v) => setDims({ W: v })} />
              <DimField label="H" value={H} min={10} max={400} onChange={(v) => setDims({ H: v })} />
            </div>
            <p className="mt-1 text-[10px] text-neutral-600">
              Mesh rebuilds &amp; UVs remap in real time.
            </p>
          </div>

          <div>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Panel style
            </h2>
            <div className="flex gap-2">
              {sideOptions.map((o) => (
                <button
                  key={o.id}
                  onClick={() => setSide(o.id)}
                  className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition ${
                    side === o.id
                      ? "border-amber-400 bg-amber-400/10 text-amber-200"
                      : "border-neutral-700 text-neutral-300 hover:border-neutral-500"
                  }`}
                >
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full border border-black/30"
                    style={{ background: o.swatch }}
                  />
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center justify-between text-xs text-neutral-300">
            <span>Show UV guide outlines</span>
            <input
              type="checkbox"
              checked={showGuides}
              onChange={(e) => setShowGuides(e.target.checked)}
              className="accent-amber-500"
            />
          </label>

          <div className="rounded-lg bg-neutral-800/40 p-2 text-[10px] leading-relaxed text-neutral-500">
            <strong className="text-neutral-400">Multi-face note:</strong> master panel fills
            all faces by default. Toggle &quot;Custom artwork&quot; on a face to upload a
            different image, crop it, and scale it independently. Front and Back default
            to custom artwork.
          </div>
        </aside>
      </div>
    </main>
  );
}
