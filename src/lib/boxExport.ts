/**
 * Export engine for packaging-warehouse.
 *
 * Two distinct outputs:
 *   1. PNG  — capture the LIVE 3D canvas at selectable resolution (client preview).
 *   2. PDF  — render the front face at print DPI and place it on a page whose
 *             dimensions equal the box's physical L×H in mm (print brief).
 *
 * The front face is L (width) × H (height). W (depth) does not appear on the
 * front face, so the PDF page is L×H, not L×W.
 */

import { PDFDocument } from "pdf-lib";
import * as THREE from "three";
import { computeLayout, drawAtlas } from "./box";
import type { BoxLayout } from "./box";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PNGBackground = "transparent" | "studio" | "white";
export type ExportFormat = "png" | "pdf";

export interface PNGOptions {
  /** Multiplier on the current canvas buffer size. */
  scale: 1 | 2 | 4;
  /** Background fill. */
  background: PNGBackground;
}

export interface PDFOptions {
  /** DPI for the embedded front-face raster. Page size is always physical L×H. */
  dpi: 150 | 300;
}

// ---------------------------------------------------------------------------
// Deterministic filename
// ---------------------------------------------------------------------------

export function makeFilename(
  L: number,
  W: number,
  H: number,
  ext: "png" | "pdf",
): string {
  // ISO-ish, filesystem-safe: box-L240xW160xH90-2026-09-12T08-00-00.png
  const ts = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .slice(0, 19);
  return `box-L${L}xW${W}xH${H}-${ts}.${ext}`;
}

// ---------------------------------------------------------------------------
// PNG — capture the live 3D canvas
// ---------------------------------------------------------------------------

/**
 * Temporarily bump the renderer's pixel ratio, render once, grab the buffer,
 * then restore. Returns a PNG data URL.
 */
export function captureLivePNG(
  gl: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  opts: PNGOptions,
): string {
  const cssSize = new THREE.Vector2();
  gl.getSize(cssSize);
  const oldPR = gl.getPixelRatio();
  const oldClear = gl.getClearColor(new THREE.Color());
  const oldAlpha = gl.getClearAlpha();

  // --- background setup ---
  if (opts.background === "transparent") {
    gl.setClearColor(0x000000, 0);
  } else if (opts.background === "white") {
    gl.setClearColor(0xffffff, 1);
  } else {
    // studio — match the scene background #101318
    gl.setClearColor(0x101318, 1);
  }

  // --- bump resolution ---
  const newPR = oldPR * opts.scale;
  gl.setPixelRatio(newPR);
  // setSize with updateStyle=false: buffer grows, CSS layout untouched
  gl.setSize(cssSize.x, cssSize.y, false);
  gl.render(scene, camera);

  const dataUrl = gl.domElement.toDataURL("image/png");

  // --- restore ---
  gl.setPixelRatio(oldPR);
  gl.setSize(cssSize.x, cssSize.y, false);
  gl.setClearColor(oldClear, oldAlpha);
  gl.render(scene, camera);

  return dataUrl;
}

// ---------------------------------------------------------------------------
// PDF — front face at physical dimensions
// ---------------------------------------------------------------------------

/**
 * Draw the front face (L×H) onto a fresh canvas at the requested pixel size,
 * replicating the cover-fit artwork logic from drawAtlas but for a single face.
 */
export function drawFrontCanvas(
  layout: BoxLayout,
  artwork: HTMLImageElement | null,
  widthPx: number,
  heightPx: number,
  side: string,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = widthPx;
  canvas.height = heightPx;
  const ctx = canvas.getContext("2d")!;

  // Side fill (match box.ts palette)
  const sideFill =
    side === "white"
      ? "#f3efdc"
      : side === "dark"
        ? "#c8b893"
        : "#d9cbb0";
  ctx.fillStyle = sideFill;
  ctx.fillRect(0, 0, widthPx, heightPx);

  if (artwork && artwork.width > 0 && artwork.height > 0) {
    // cover-fit artwork into the full canvas, preserving aspect, centred
    const canvasAspect = widthPx / heightPx;
    const imgAspect = artwork.width / artwork.height;
    let dw = widthPx;
    let dh = widthPx / imgAspect;
    if (dh < heightPx) {
      dh = heightPx;
      dw = heightPx * imgAspect;
    }
    const dx = (widthPx - dw) / 2;
    const dy = (heightPx - dh) / 2;
    ctx.drawImage(artwork, dx, dy, dw, dh);
  } else {
    // placeholder
    ctx.fillStyle = "rgba(120,105,80,0.55)";
    ctx.font = `${Math.max(14, Math.round(heightPx * 0.08))}px system-ui, sans-serif`;
    ctx.textAlign = "center";
  ctx.textBaseline = "middle";
    ctx.fillText("YOUR ARTWORK", widthPx / 2, heightPx / 2);
  }

  return canvas;
}

/** mm → PDF points (72 points per inch, 25.4 mm per inch). */
const MM_TO_PT = 72 / 25.4;

/**
 * Build a PDF whose page size equals the box front face (Lmm × Hmm) with the
 * front-face artwork embedded at the requested DPI. Returns PDF bytes.
 */
export async function generatePDF(
  L: number,
  H: number,
  frontCanvas: HTMLCanvasElement,
  filename: string,
): Promise<Uint8Array> {
  const pageW = L * MM_TO_PT;
  const pageH = H * MM_TO_PT;

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([pageW, pageH]);

  // Encode front canvas as PNG and embed
  const pngData = await new Promise<Uint8Array>((resolve, reject) => {
    frontCanvas.toBlob((blob) => {
      if (!blob) return reject(new Error("front canvas toBlob failed"));
      blob.arrayBuffer().then((buf) => resolve(new Uint8Array(buf)));
    }, "image/png");
  });
  const pngImage = await pdf.embedPng(pngData);

  // Draw image to fill the entire page (artwork already cover-fitted)
  page.drawImage(pngImage, {
    x: 0,
    y: 0,
    width: pageW,
    height: pageH,
  });

  return pdf.save();
}

// ---------------------------------------------------------------------------
// Download helpers
// ---------------------------------------------------------------------------

export function downloadDataUrl(dataUrl: string, filename: string): void {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function downloadBytes(bytes: Uint8Array, filename: string): void {
  // Slice to a guaranteed ArrayBuffer (pdf-lib returns Uint8Array<ArrayBufferLike>)
  const ab = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  const blob = new Blob([ab], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
