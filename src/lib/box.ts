import type * as THREE from "three";

/**
 * Parametric folding-carton box — geometry layout, UV remap and "dieline" atlas.
 *
 * Faces follow three.js BoxGeometry material-group order:
 *   index 0 = +x (right), 1 = -x (left), 2 = +y (top), 3 = -y (bottom),
 *   index 4 = +z (FRONT), 5 = -z (back).
 *
 * Dimensions are millimetres: L = width  (x), W = depth (z), H = height (y).
 */

export interface FaceRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  flipU?: number;
  flipV?: number;
}

export interface BoxLayout {
  canvasW: number;
  canvasH: number;
  faces: FaceRect[];
}

export const KRAFT = "#d9cbb0";
export const KRAFT_DARK = "#c8b893";
export const PANEL_WHITE = "#f3efdc";

const MAX_EDGE = 2048;

export function computeLayout(L: number, W: number, H: number): BoxLayout {
  const U = L;
  const V = W;
  const T = H;

  const bandW = 2 * (U + V);
  const bandH = T + 2 * W;
  const kraftCol = Math.max(24, 0.05 * bandW);

  const totalW = bandW + kraftCol;
  let scale = MAX_EDGE / Math.max(totalW, bandH);
  if (scale > 1) scale = 1;
  const canvasW = Math.max(256, Math.round(totalW * scale));
  const canvasH = Math.max(256, Math.round(bandH * scale));

  const nx = (px: number) => px / canvasW;
  const ny = (px: number) => px / canvasH;

  const U_px = U * scale;
  const V_px = V * scale;
  const T_px = T * scale;
  const W_px = W * scale;

  // Top (+Y, face 2) and Bottom (-Y, face 3) are L x W panels placed
  // above and below the 4-panel band so all 6 faces map independently.
  const rTop = { x0: nx(0), y0: ny(0), x1: nx(U_px), y1: ny(W_px) };

  const bandY0 = W_px;
  const bandY1 = W_px + T_px;
  const rFront = { x0: nx(0), y0: ny(bandY0), x1: nx(U_px), y1: ny(bandY1) };
  const rRight = { x0: nx(U_px), y0: ny(bandY0), x1: nx(U_px + V_px), y1: ny(bandY1) };
  const rBack = { x0: nx(U_px + V_px), y0: ny(bandY0), x1: nx(2 * U_px + V_px), y1: ny(bandY1) };
  const rLeft = { x0: nx(2 * U_px + V_px), y0: ny(bandY0), x1: nx(2 * U_px + 2 * V_px), y1: ny(bandY1) };

  const rBottom = { x0: nx(0), y0: ny(bandY1), x1: nx(U_px), y1: ny(bandY1 + W_px) };

  const faces: FaceRect[] = [
    { ...rRight, flipU: 1, flipV: 1 },
    { ...rLeft, flipU: 1, flipV: 1 },
    { ...rTop, flipU: 1, flipV: 1 },
    { ...rBottom, flipU: 1, flipV: 1 },
    { ...rFront, flipU: 1, flipV: 1 },
    { ...rBack, flipU: 1, flipV: 1 },
  ];

  return { canvasW, canvasH, faces };
}

export function remapBoxUVs(geometry: THREE.BufferGeometry, layout: BoxLayout): void {
  const uv = geometry.getAttribute("uv");
  const groups = geometry.groups;
  const uvArr = uv.array as Float32Array;

  for (const g of groups) {
    const mi = g.materialIndex ?? 0;
    const face = layout.faces[mi];
    if (!face) continue;
    const { x0, y0, x1, y1, flipU = 1, flipV = 1 } = face;
    const index = geometry.getIndex();
    const groupVerts = g.count;
    const start = g.start;
    for (let k = 0; k < groupVerts; k++) {
      const vi = index ? index.getX(start + k) : start + k;
      const u = uv.getX(vi);
      const v = uv.getY(vi);
      const nu = flipU === 1 ? x0 + (x1 - x0) * u : x1 - (x1 - x0) * u;
      const nv = flipV === 1 ? y0 + (y1 - y0) * v : y1 - (y1 - y0) * v;
      uvArr[vi * 2] = nu;
      uvArr[vi * 2 + 1] = nv;
    }
  }
  uv.needsUpdate = true;
}

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FaceArtwork {
  image: HTMLImageElement | null;
  crop: CropRect | null;
  scale: number;
}

function drawFaceArtwork(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  facePx: { x: number; y: number; w: number; h: number },
  crop: CropRect | null,
  scale: number,
  fillColor: string,
) {
  const { x: dx, y: dy, w: dw, h: dh } = facePx;
  const sx = crop ? crop.x : 0;
  const sy = crop ? crop.y : 0;
  const sw = crop ? crop.width : img.width;
  const sh = crop ? crop.height : img.height;

  ctx.save();
  ctx.beginPath();
  ctx.rect(dx, dy, dw, dh);
  ctx.clip();
  ctx.fillStyle = fillColor;
  ctx.fillRect(dx, dy, dw, dh);

  const faceAspect = dw / dh;
  const srcAspect = sw / sh;
  let fitW = dw;
  let fitH = dw / srcAspect;
  if (fitH < dh) {
    fitH = dh;
    fitW = dh * srcAspect;
  }
  fitW *= scale;
  fitH *= scale;
  const ox = dx + (dw - fitW) / 2;
  const oy = dy + (dh - fitH) / 2;

  ctx.drawImage(img, sx, sy, sw, sh, ox, oy, fitW, fitH);
  ctx.restore();
}

export function drawAtlas(
  layout: BoxLayout,
  artworks: (FaceArtwork | null)[],
  opts: { side: string; showGuides: boolean } = { side: "kraft", showGuides: false },
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = layout.canvasW;
  canvas.height = layout.canvasH;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = KRAFT_DARK;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const sideFill = opts.side === "white" ? PANEL_WHITE : opts.side === "kraft" ? KRAFT : KRAFT_DARK;
  const px = (n: number, dim: number) => Math.round(n * dim);

  for (let i = 0; i <= 5; i++) {
    const f = layout.faces[i];
    const x = px(f.x0, canvas.width);
    const y = px(f.y0, canvas.height);
    const w = Math.max(1, px(f.x1, canvas.width) - x);
    const h = Math.max(1, px(f.y1, canvas.height) - y);

    const art = artworks[i];
    const fillColor = i === 2 || i === 3 ? PANEL_WHITE : sideFill;

    if (art && art.image && art.image.width > 0) {
      drawFaceArtwork(ctx, art.image, { x, y, w, h }, art.crop, art.scale, fillColor);
    } else {
      ctx.fillStyle = fillColor;
      ctx.fillRect(x, y, w, h);
    }
  }

  if (opts.showGuides) {
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 2;
    for (let i = 0; i <= 5; i++) {
      const f = layout.faces[i];
      const x = px(f.x0, canvas.width);
      const y = px(f.y0, canvas.height);
      const w = Math.max(1, px(f.x1, canvas.width) - x);
      const h = Math.max(1, px(f.y1, canvas.height) - y);
      ctx.strokeRect(x, y, w, h);
    }
  }

  return canvas;
}
