import type * as THREE from "three";

/**
 * Parametric folding-carton box — geometry layout, UV remap and "dieline" atlas.
 *
 * Core idea (see RND-TECH §2.2): author UV regions ONCE per product type, then map
 * flat artwork onto the correct folded 3D face. Here the box is built from a single
 * shared `BoxGeometry`, and each of the 6 material groups' UVs are remapped to a
 * sub-rectangle of one shared canvas texture (the "atlas"). The front face carries the
 * uploaded artwork; the other faces sample neutral panel regions, so the box reads as
 * clean, unprinted packaging.
 *
 * Faces follow three.js BoxGeometry material-group order:
 *   index 0 = +x (right), 1 = -x (left), 2 = +y (top), 3 = -y (bottom),
 *   index 4 = +z (FRONT), 5 = -z (back).
 *
 * Dimensions are millimetres: L = width  (x), W = depth (z), H = height (y).
 */

export interface FaceRect {
  /** normalized [0..1] sub-rect of the atlas for a face */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** +1 = keep u direction, -1 = flip u; +1 v up, -1 v down. Corrected empirically. */
  flipU?: number;
  flipV?: number;
}

export interface BoxLayout {
  /** px canvas size for the atlas */
  canvasW: number;
  canvasH: number;
  /** normalized UV rect for each BoxGeometry material group index */
  faces: FaceRect[];
  /** where on the atlas the artwork should be drawn (normalized) */
  artRect: { x0: number; y0: number; x1: number; y1: number };
}

/** Uniform kraft / panel fill. */
export const KRAFT = "#d9cbb0";
export const KRAFT_DARK = "#c8b893";
export const PANEL_WHITE = "#f3efdc";

/** Cap atlas longest edge to keep GPU textures sane. */
const MAX_EDGE = 2048;

/**
 * Lay out the four upright panels in a proportional horizontal band
 * (front | right | back | left, widths L,W,L,W, all height H) and reserve a
 * slim uniform-color column for the top & bottom faces to sample.
 */
export function computeLayout(L: number, W: number, H: number): BoxLayout {
  const U = L; // upright widths: front/back span x (length L)
  const V = W; //                 right/left span z (depth W)
  const T = H; // upright height (y)

  // Choose a scale so the band fits within MAX_EDGE, keeping aspect true.
  const bandW = 2 * (U + V);
  const bandH = T;
  const kraftCol = Math.max(24, 0.05 * bandW); // slim uniform column for top/bottom

  const totalW = bandW + kraftCol;
  let scale = MAX_EDGE / Math.max(totalW, bandH);
  if (scale > 1) scale = 1; // do not upscale beyond natural units below 1x
  // Clamp so the smaller texture dimension never goes tiny.
  const canvasW = Math.max(256, Math.round(totalW * scale));
  const canvasH = Math.max(256, Math.round(bandH * scale));

  // normalized rects within [0..1] canvas
  const nx = (px: number) => px / canvasW;
  const ny = (px: number) => px / canvasH;

  const bandW_px = bandW * scale;
  const U_px = U * scale;
  const V_px = V * scale;
  const bandH_px = bandH * scale;

  // row left->right: front(L), right(W), back(L), left(W)
  let x = 0;
  const rFront = { x0: nx(x), y0: ny(0), x1: nx(x + U_px), y1: ny(bandH_px) };
  x += U_px;
  const rRight = { x0: nx(x), y0: ny(0), x1: nx(x + V_px), y1: ny(bandH_px) };
  x += V_px;
  const rBack = { x0: nx(x), y0: ny(0), x1: nx(x + U_px), y1: ny(bandH_px) };
  x += U_px;
  const rLeft = { x0: nx(x), y0: ny(0), x1: nx(x + V_px), y1: ny(bandH_px) };
  x += V_px;

  // uniform column to the right for top/bottom faces
  const kraftX0 = nx(x);

  // group 0 = +x right, 1 = -x left, 2 = +y top, 3 = -y bottom,
  // 4 = +z FRONT, 5 = -z back
  const faces: FaceRect[] = [
    { ...rRight, flipU: 1, flipV: 1 }, // +x right
    { ...rLeft, flipU: 1, flipV: 1 }, // -x left
    { x0: kraftX0, y0: 0, x1: 1, y1: 1, flipU: 1, flipV: 1 }, // +y top -> kraft col
    { x0: kraftX0, y0: 0, x1: 1, y1: 1, flipU: 1, flipV: 1 }, // -y bottom -> kraft col
    { ...rFront, flipU: 1, flipV: 1 }, // +z FRONT (artwork)
    { ...rBack, flipU: 1, flipV: 1 }, // -z back
  ];

  return {
    canvasW,
    canvasH,
    faces,
    artRect: rFront,
  };
}

/**
 * Rewrite a BoxGeometry's UV attribute so each material group samples its
 * sub-rectangle of the atlas, applying per-face orientation flips.
 */
export function remapBoxUVs(geometry: THREE.BufferGeometry, layout: BoxLayout): void {
  const uv = geometry.getAttribute("uv");
  const groups = geometry.groups;
  const uvArr = uv.array as Float32Array;

  for (const g of groups) {
    const mi = g.materialIndex ?? 0;
    const face = layout.faces[mi];
    if (!face) continue;
    const { x0, y0, x1, y1, flipU = 1, flipV = 1 } = face;
    // Iterate the vertices referenced by this group (via index when indexed).
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

/**
 * Build the atlas CanvasTexture. Draws the neutral kraft panels and, when an
 * artwork Image is present, cover-fits it into the front (art) rect.
 */
export function drawAtlas(
  layout: BoxLayout,
  artwork: HTMLImageElement | null,
  opts: { side: string; showGuides: boolean } = { side: "kraft", showGuides: false },
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = layout.canvasW;
  canvas.height = layout.canvasH;
  const ctx = canvas.getContext("2d")!;

  // fill background (never seen, safe)
  ctx.fillStyle = KRAFT_DARK;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // paint each upright face's region
  const sideFill = opts.side === "white" ? PANEL_WHITE : opts.side === "kraft" ? KRAFT : KRAFT_DARK;
  const px = (n: number, dim: number) => Math.round(n * dim);

  for (let i = 0; i <= 5; i++) {
    // skip front (index 4) when artwork present — painted below
    if (i === 4) continue;
    const f = layout.faces[i];
    const x = px(f.x0, canvas.width);
    const y = px(f.y0, canvas.height);
    const w = Math.max(1, px(f.x1, canvas.width) - x);
    const h = Math.max(1, px(f.y1, canvas.height) - y);
    ctx.fillStyle = i === 2 || i === 3 ? PANEL_WHITE : sideFill; // top/bottom bright white inner
    ctx.fillRect(x, y, w, h);
  }

  // front artwork rect
  const ar = layout.artRect;
  const ax = px(ar.x0, canvas.width);
  const ay = px(ar.y0, canvas.height);
  const aw = Math.max(1, px(ar.x1, canvas.width) - ax);
  const ah = Math.max(1, px(ar.y1, canvas.height) - ay);

  if (artwork && artwork.width > 0) {
    // cover-fit artwork into front rect, preserving aspect, centred
    ctx.save();
    ctx.beginPath();
    ctx.rect(ax, ay, aw, ah);
    ctx.clip();
    ctx.fillStyle = sideFill;
    ctx.fillRect(ax, ay, aw, ah);
    const arAspect = aw / ah;
    const imgAspect = artwork.width / artwork.height;
    let dw = aw;
    let dh = aw / imgAspect;
    if (dh < ah) {
      dh = ah;
      dw = ah * imgAspect;
    }
    const dx = ax + (aw - dw) / 2;
    const dy = ay + (ah - dh) / 2;
    ctx.drawImage(artwork, dx, dy, dw, dh);
    ctx.restore();
  } else {
    // placeholder so the front reads as a printable panel
    ctx.fillStyle = sideFill;
    ctx.fillRect(ax, ay, aw, ah);
    ctx.fillStyle = "rgba(120,105,80,0.55)";
    ctx.font = `${Math.max(14, Math.round(ah * 0.12))}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("YOUR ARTWORK", ax + aw / 2, ay + ah / 2);
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
