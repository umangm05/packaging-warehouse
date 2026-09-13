// Convert SVG and PDF source files to a decoded HTMLImageElement for the
// box artwork pipeline. SVG is rasterised at high resolution so logos stay
// crisp; PDF is rasterised from page 1 at print-preview resolution.

import type { PDFDocumentProxy } from "pdfjs-dist/types/src/display/api";

type PdfjsLib = typeof import("pdfjs-dist");

let pdfjsCache: PdfjsLib | null = null;
let workerSetup = false;

async function getPdfjs(): Promise<PdfjsLib> {
  if (pdfjsCache) return pdfjsCache;
  pdfjsCache = await import("pdfjs-dist");
  if (!workerSetup) {
    pdfjsCache.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.mjs",
      import.meta.url,
    ).toString();
    workerSetup = true;
  }
  return pdfjsCache;
}

/**
 * Rasterise an SVG string to a high-resolution Image. The SVG's viewBox
 * (or width/height) determines the intrinsic size, scaled up to a minimum
 * of `minSize` pixels on the long edge so logos stay crisp when drawn onto
 * the box face. Returns an Image whose src is a PNG data URL.
 */
export function svgToImage(svgText: string, minSize: number = 2048): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, "image/svg+xml");
    const svgEl = doc.documentElement;

    let vbX = 0;
    let vbY = 0;
    let vbW = 300;
    let vbH = 150;

    const viewBox = svgEl.getAttribute("viewBox");
    if (viewBox) {
      const parts = viewBox.trim().split(/[\s,]+/).map(Number);
      if (parts.length === 4 && !parts.some(isNaN)) {
        [vbX, vbY, vbW, vbH] = parts;
      }
    } else {
      const wAttr = svgEl.getAttribute("width");
      const hAttr = svgEl.getAttribute("height");
      if (wAttr && hAttr) {
        const wN = parseFloat(wAttr);
        const hN = parseFloat(hAttr);
        if (!isNaN(wN) && !isNaN(hN) && wN > 0 && hN > 0) {
          vbW = wN;
          vbH = hN;
        }
      }
    }

    const longEdge = Math.max(vbW, vbH);
    const scale = Math.max(1, minSize / longEdge);
    const targetW = Math.round(vbW * scale);
    const targetH = Math.round(vbH * scale);

    svgEl.setAttribute("width", String(targetW));
    svgEl.setAttribute("height", String(targetH));

    const serializer = new XMLSerializer();
    const modifiedSvg = serializer.serializeToString(doc);

    const blob = new Blob([modifiedSvg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

/**
 * Rasterise page 1 of a PDF ArrayBuffer to an Image at print-preview
 * resolution (~220 DPI at the PDF's native page size). Multi-page PDFs
 * deterministically import page 1 only.
 */
export async function pdfToImage(
  buffer: ArrayBuffer,
  opts: { dpi?: number } = {},
): Promise<{ image: HTMLImageElement; pageCount: number; dpi: number }> {
  const pdfjs = await getPdfjs();
  const loadingTask = pdfjs.getDocument({ data: buffer });
  const pdf: PDFDocumentProxy = await loadingTask.promise;
  const pageCount = pdf.numPages;
  const page = await pdf.getPage(1);

  const baseDpi = 72;
  const targetDpi = opts.dpi ?? 220;
  const scale = targetDpi / baseDpi;

  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext("2d")!;

  await page.render({
    canvasContext: ctx,
    viewport,
  }).promise;

  const dataUrl = canvas.toDataURL("image/png");
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = dataUrl;
  });

  return { image: img, pageCount, dpi: targetDpi };
}

export type FileKind = "image" | "svg" | "pdf";

/** Determine the kind of an uploaded file from its MIME type or extension. */
export function fileKind(file: File): FileKind {
  const type = file.type.toLowerCase();
  if (type === "image/svg+xml") return "svg";
  if (type === "application/pdf") return "pdf";
  if (!type) {
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
    if (ext === ".svg") return "svg";
    if (ext === ".pdf") return "pdf";
  }
  return "image";
}

export interface PreparedImage {
  url: string;
  width: number;
  height: number;
  fileKind: FileKind;
  pageCount?: number;
  dpi?: number;
}

/**
 * Prepare any supported file for upload. Returns a data URL plus intrinsic
 * dimensions. For raster images (PNG/JPG/etc) the URL is an object URL;
 * for SVG and PDF it's a rasterised PNG data URL.
 */
export async function prepareFileAsImage(file: File): Promise<PreparedImage> {
  const kind = fileKind(file);

  if (kind === "svg") {
    const text = await file.text();
    const img = await svgToImage(text);
    return {
      url: img.src,
      width: img.naturalWidth,
      height: img.naturalHeight,
      fileKind: "svg",
    };
  }

  if (kind === "pdf") {
    const buffer = await file.arrayBuffer();
    const { image: img, pageCount, dpi } = await pdfToImage(buffer);
    return {
      url: img.src,
      width: img.naturalWidth,
      height: img.naturalHeight,
      fileKind: "pdf",
      pageCount,
      dpi,
    };
  }

  const url = URL.createObjectURL(file);
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = url;
  });
  return {
    url,
    width: img.naturalWidth,
    height: img.naturalHeight,
    fileKind: "image",
  };
}
