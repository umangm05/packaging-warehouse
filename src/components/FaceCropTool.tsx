"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * FaceCropTool — drag-to-crop UI.
 *
 * Renders the source image at natural size with a semi-transparent overlay outside
 * the draggable/resizable crop rectangle. Returns the crop region in source-image
 * pixels. Caller owns the actual image element.
 */
export function FaceCropTool({
  image,
  initialCrop,
  onChange,
  onApply,
  onCancel,
}: {
  image: HTMLImageElement;
  initialCrop: { x: number; y: number; width: number; height: number } | null;
  onChange: (crop: { x: number; y: number; width: number; height: number } | null) => void;
  onApply: () => void;
  onCancel: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [crop, setCrop] = useState<{ x: number; y: number; width: number; height: number } | null>(initialCrop);
  const drag = useRef<{
    mode: "move" | "resize-br" | "resize-tr" | "resize-bl" | "resize-tl" | "new";
    startX: number;
    startY: number;
    origCrop: { x: number; y: number; width: number; height: number };
  } | null>(null);

  // Image display size (fit to container width, max 400px tall).
  const [displayW, setDisplayW] = useState(0);
  const [displayH, setDisplayH] = useState(0);

  useEffect(() => {
    if (!containerRef.current || !image.width || !image.height) return;
    const maxW = containerRef.current.clientWidth;
    const maxH = 400;
    const scale = Math.min(1, maxW / image.width, maxH / image.height);
    setDisplayW(image.width * scale);
    setDisplayH(image.height * scale);
  }, [image]);

  const scaleX = image.width / displayW;
  const scaleY = image.height / displayH;

  const toImageCoords = (clientX: number, clientY: number) => {
    const rect = containerRef.current!.getBoundingClientRect();
    const lx = clientX - rect.left;
    const ly = clientY - rect.top;
    return {
      ix: Math.round(lx * scaleX),
      iy: Math.round(ly * scaleY),
    };
  };

  const onPointerDown = useCallback(
    (e: React.PointerEvent, mode: "move" | "resize-br" | "resize-tr" | "resize-bl" | "resize-tl" | "new" = "new") => {
      e.preventDefault();
      e.stopPropagation();
      const { ix, iy } = toImageCoords(e.clientX, e.clientY);
      if (mode === "new") {
        const newCrop = { x: ix, y: iy, width: 1, height: 1 };
        drag.current = { mode: "new", startX: ix, startY: iy, origCrop: newCrop };
        setCrop(newCrop);
      } else if (crop) {
        drag.current = { mode, startX: ix, startY: iy, origCrop: { ...crop } };
      }
    },
    [crop, scaleX, scaleY],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!drag.current) return;
      e.preventDefault();
      const { ix, iy } = toImageCoords(e.clientX, e.clientY);
      const { mode, origCrop } = drag.current;

      let next = { ...origCrop };

      if (mode === "new" || mode === "resize-br") {
        next.width = Math.max(1, ix - origCrop.x);
        next.height = Math.max(1, iy - origCrop.y);
      } else if (mode === "resize-tl") {
        const right = origCrop.x + origCrop.width;
        const bottom = origCrop.y + origCrop.height;
        next.x = Math.min(right - 1, ix);
        next.y = Math.min(bottom - 1, iy);
        next.width = right - next.x;
        next.height = bottom - next.y;
      } else if (mode === "resize-tr") {
        const left = origCrop.x;
        const bottom = origCrop.y + origCrop.height;
        next.y = Math.min(bottom - 1, iy);
        next.width = Math.max(1, ix - left);
        next.height = bottom - next.y;
      } else if (mode === "resize-bl") {
        const right = origCrop.x + origCrop.width;
        const top = origCrop.y;
        next.x = Math.min(right - 1, ix);
        next.width = right - next.x;
        next.height = Math.max(1, iy - top);
      } else if (mode === "move") {
        next.x = origCrop.x + (ix - drag.current.startX);
        next.y = origCrop.y + (iy - drag.current.startY);
      }

      // Clamp to image bounds.
      next.x = Math.max(0, Math.min(image.width - 1, next.x));
      next.y = Math.max(0, Math.min(image.height - 1, next.y));
      next.width = Math.max(1, Math.min(image.width - next.x, next.width));
      next.height = Math.max(1, Math.min(image.height - next.y, next.height));

      setCrop(next);
      onChange(next);
    },
    [image.width, image.height, onChange, scaleX, scaleY],
  );

  const onPointerUp = useCallback(() => {
    drag.current = null;
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={containerRef}
        className="relative select-none overflow-hidden rounded border border-neutral-700"
        style={{ width: displayW || "100%", height: displayH || "auto", cursor: "crosshair" }}
        onPointerDown={(e) => onPointerDown(e, "new")}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <img
          src={image.src}
          alt="crop source"
          className="pointer-events-none block"
          style={{ width: displayW, height: displayH }}
          draggable={false}
        />
        {crop && (
          <>
            {/* Dark overlay outside crop */}
            <div
              className="absolute inset-0 bg-black/50"
              style={{
                clipPath: `polygon(0% 0%, 0% 100%, ${Math.max(0, crop.x / scaleX)}px 100%, ${Math.max(0, crop.x / scaleX)}px ${Math.max(0, crop.y / scaleY)}px, ${Math.min(displayW, (crop.x + crop.width) / scaleX)}px ${Math.max(0, crop.y / scaleY)}px, ${Math.min(displayW, (crop.x + crop.width) / scaleX)}px ${Math.min(displayH, (crop.y + crop.height) / scaleY)}px, ${Math.max(0, crop.x / scaleX)}px ${Math.min(displayH, (crop.y + crop.height) / scaleY)}px, ${Math.max(0, crop.x / scaleX)}px 100%, 100% 100%, 100% 0%)`,
              }}
            />
            {/* Crop rectangle border + handles */}
            <div
              className="absolute border-2 border-amber-400"
              style={{
                left: crop.x / scaleX,
                top: crop.y / scaleY,
                width: crop.width / scaleX,
                height: crop.height / scaleY,
              }}
            >
              {/* move handle (center) */}
              <div
                className="absolute inset-0 cursor-move"
                onPointerDown={(e) => onPointerDown(e, "move")}
              />
              {/* corner handles */}
              <div
                className="absolute -left-1.5 -top-1.5 h-3 w-3 cursor-nwse-resize rounded-full bg-amber-400"
                onPointerDown={(e) => onPointerDown(e, "resize-tl")}
              />
              <div
                className="absolute -right-1.5 -top-1.5 h-3 w-3 cursor-nesw-resize rounded-full bg-amber-400"
                onPointerDown={(e) => onPointerDown(e, "resize-tr")}
              />
              <div
                className="absolute -bottom-1.5 -left-1.5 h-3 w-3 cursor-nesw-resize rounded-full bg-amber-400"
                onPointerDown={(e) => onPointerDown(e, "resize-bl")}
              />
              <div
                className="absolute -bottom-1.5 -right-1.5 h-3 w-3 cursor-nwse-resize rounded-full bg-amber-400"
                onPointerDown={(e) => onPointerDown(e, "resize-br")}
              />
            </div>
          </>
        )}
      </div>
      <div className="flex items-center justify-between text-[11px] text-neutral-400">
        <span>
          {crop
            ? `Crop: ${crop.x},${crop.y} ${crop.width}×${crop.height}`
            : "Drag to select a crop region"}
        </span>
        <div className="flex gap-1">
          <button
            onClick={() => {
              setCrop(null);
              onChange(null);
            }}
            className="rounded bg-neutral-700 px-2 py-0.5 text-[11px] text-neutral-200 hover:bg-neutral-600"
          >
            Reset
          </button>
          <button
            onClick={onCancel}
            className="rounded bg-neutral-700 px-2 py-0.5 text-[11px] text-neutral-200 hover:bg-red-600"
          >
            Cancel
          </button>
          <button
            onClick={onApply}
            className="rounded bg-amber-500 px-2 py-0.5 text-[11px] text-black hover:bg-amber-400"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
