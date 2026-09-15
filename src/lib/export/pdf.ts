import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import {
  type DesignObject,
  type Fill,
  getObjectBounds,
} from '@/lib/designerTypes';
import { PT_TO_MM } from '@/lib/fonts';
import { textToSvgPathData, loadFont } from './textPaths';
import { buildFilterString, applyBgRemoval } from '@/lib/imageFilters';

/** mm → PDF points (72dpi) */
const MM_TO_PT = 72 / 25.4;

export interface PdfExportOptions {
  widthMm: number;
  heightMm: number;
  background: Fill;
  objects: DesignObject[];
}

export async function exportPdf(opts: PdfExportOptions): Promise<Uint8Array> {
  const { widthMm, heightMm, background, objects } = opts;

  const pdfDoc = await PDFDocument.create();
  const pageWidthPt = widthMm * MM_TO_PT;
  const pageHeightPt = heightMm * MM_TO_PT;
  const page = pdfDoc.addPage([pageWidthPt, pageHeightPt]);

  // Background
  if (background.type === 'solid') {
    const c = hexToRgbNorm(background.color);
    page.drawRectangle({
      x: 0,
      y: 0,
      width: pageWidthPt,
      height: pageHeightPt,
      color: rgb(c.r, c.g, c.b),
    });
  }

  for (const obj of objects) {
    if (!obj.visible) continue;

    if (obj.type === 'text') {
      if (obj.convertOutlines) {
        await renderTextAsPdfPaths(page, obj);
      } else {
        drawLiveText(page, obj, pdfDoc, heightMm);
      }
      continue;
    }

    switch (obj.type) {
      case 'rect':
        drawRect(page, obj, heightMm);
        break;
      case 'ellipse':
        drawEllipse(page, obj, heightMm);
        break;
      case 'line':
        drawLine(page, obj, heightMm);
        break;
      case 'polygon':
        drawPolygon(page, obj, heightMm);
        break;
      case 'image':
        await drawImage(page, obj, pdfDoc, heightMm);
        break;
    }
  }

  return await pdfDoc.save();
}

function isTextOutlined(obj: DesignObject): obj is Extract<DesignObject, { type: 'text' }> {
  return obj.type === 'text' && obj.convertOutlines;
}

function drawRect(page: any, obj: any, heightMm: number): void {
  const fillColor = obj.fill.type === 'solid' ? hexToRgbNorm(obj.fill.color) : null;
  const strokeColor = obj.stroke !== 'transparent' ? hexToRgbNorm(obj.stroke) : null;
  page.drawRectangle({
    x: obj.x * MM_TO_PT,
    y: (heightMm - obj.y - obj.height) * MM_TO_PT,
    width: obj.width * MM_TO_PT,
    height: obj.height * MM_TO_PT,
    color: fillColor ? rgb(fillColor.r, fillColor.g, fillColor.b) : undefined,
    borderColor: strokeColor ? rgb(strokeColor.r, strokeColor.g, strokeColor.b) : undefined,
    borderWidth: obj.strokeWidth * MM_TO_PT,
  });
}

function drawEllipse(page: any, obj: any, heightMm: number): void {
  const fillColor = obj.fill.type === 'solid' ? hexToRgbNorm(obj.fill.color) : null;
  const strokeColor = obj.stroke !== 'transparent' ? hexToRgbNorm(obj.stroke) : null;
  page.drawEllipse({
    x: (obj.x - obj.rx) * MM_TO_PT,
    y: (heightMm - obj.y - obj.ry) * MM_TO_PT,
    xScale: obj.rx * MM_TO_PT,
    yScale: obj.ry * MM_TO_PT,
    color: fillColor ? rgb(fillColor.r, fillColor.g, fillColor.b) : undefined,
    borderColor: strokeColor ? rgb(strokeColor.r, strokeColor.g, strokeColor.b) : undefined,
    borderWidth: obj.strokeWidth * MM_TO_PT,
  });
}

function drawLine(page: any, obj: any, heightMm: number): void {
  const strokeColor = obj.stroke !== 'transparent' ? hexToRgbNorm(obj.stroke) : { r: 0, g: 0, b: 0 };
  page.drawLine({
    start: { x: obj.x * MM_TO_PT, y: (heightMm - obj.y) * MM_TO_PT },
    end: { x: obj.x2 * MM_TO_PT, y: (heightMm - obj.y2) * MM_TO_PT },
    color: rgb(strokeColor.r, strokeColor.g, strokeColor.b),
    thickness: obj.strokeWidth * MM_TO_PT,
  });
}

function drawPolygon(page: any, obj: any, heightMm: number): void {
  const fillColor = obj.fill.type === 'solid' ? hexToRgbNorm(obj.fill.color) : null;
  const strokeColor = obj.stroke !== 'transparent' ? hexToRgbNorm(obj.stroke) : null;
  
  // pdf-lib doesn't have native polygon, so we draw connected lines
  if (obj.points.length < 2) return;
  
  const pts = obj.points.map((p: any) => ({
    x: (obj.x + p.x) * MM_TO_PT,
    y: (heightMm - obj.y - p.y) * MM_TO_PT,
  }));
  
  // Draw polygon as filled path using content stream
  const path = pts.map((p: any, i: number) => `${i === 0 ? 'm' : 'l'} ${p.x} ${p.y}`).join(' ') + ' h';
  const contentStream = buildFilledPath(path, fillColor, strokeColor, obj.strokeWidth);
  page.doc.context.content(contentStream);
}

function drawLiveText(page: any, obj: any, pdfDoc: PDFDocument, heightMm: number): void {
  const textColor = obj.textColor || '#000000';
  const c = hexToRgbNorm(textColor);
  const font = pdfDoc.embedFont(StandardFonts.Helvetica);
  page.drawText(obj.content.split('\n')[0], {
    x: obj.x * MM_TO_PT,
    y: (heightMm - obj.y - obj.fontSize * PT_TO_MM) * MM_TO_PT,
    size: obj.fontSize,
    font,
    color: rgb(c.r, c.g, c.b),
  });
}

async function drawImage(page: any, obj: any, pdfDoc: PDFDocument, heightMm: number): Promise<void> {
  try {
    // For data URLs, we need to fetch via canvas
    let buffer: ArrayBuffer;
    if (obj.src.startsWith('data:')) {
      const response = await fetch(obj.src);
      buffer = await response.arrayBuffer();
    } else {
      const response = await fetch(obj.src);
      buffer = await response.arrayBuffer();
    }

    // Bake adjustments via offscreen canvas if any are active
    const hasAdjustments = obj.adjustments && (
      obj.adjustments.brightness !== 0 ||
      obj.adjustments.contrast !== 0 ||
      obj.adjustments.saturation !== 0 ||
      obj.adjustments.blur > 0 ||
      obj.adjustments.flipH ||
      obj.adjustments.flipV ||
      obj.adjustments.bgRemoval
    );

    let finalBuffer = buffer;
    let isPng = obj.src.startsWith('image/png') || obj.src.includes('png');

    if (hasAdjustments) {
      // Decode image
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = obj.src;
      });

      // Apply crop
      const crop = obj.crop;
      const sx = crop ? crop.x : 0;
      const sy = crop ? crop.y : 0;
      const sw = crop ? crop.width : img.width;
      const sh = crop ? crop.height : img.height;

      const canvas = document.createElement('canvas');
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext('2d')!;

      // Apply filter
      const filterStr = buildFilterString(obj.adjustments);
      if (filterStr !== 'none') ctx.filter = filterStr;

      // Apply flip
      if (obj.adjustments.flipH || obj.adjustments.flipV) {
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.scale(obj.adjustments.flipH ? -1 : 1, obj.adjustments.flipV ? -1 : 1);
        ctx.translate(-canvas.width / 2, -canvas.height / 2);
      }

      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

      if (obj.adjustments.flipH || obj.adjustments.flipV) {
        ctx.restore();
      }

      // Background removal
      if (obj.adjustments.bgRemoval && obj.adjustments.bgRemoval.tolerance >= 0) {
        const bg = obj.adjustments.bgRemoval;
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        applyBgRemoval(imageData.data, { r: bg.r, g: bg.g, b: bg.b }, bg.tolerance);
        ctx.putImageData(imageData, 0, 0);
      }

      // Convert to PNG buffer
      const blob: Blob = await new Promise((resolve, reject) => {
        canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/png');
      });
      finalBuffer = await blob.arrayBuffer();
      isPng = true;
    }

    const img = isPng ? await pdfDoc.embedPng(finalBuffer) : await pdfDoc.embedJpg(finalBuffer);
    page.drawImage(img, {
      x: obj.x * MM_TO_PT,
      y: (heightMm - obj.y - obj.height) * MM_TO_PT,
      width: obj.width * MM_TO_PT,
      height: obj.height * MM_TO_PT,
    });
  } catch {
    // Skip failed images
  }
}

async function renderTextAsPdfPaths(page: any, obj: any): Promise<void> {
  const font = await loadFont(obj.fontFamily, obj.fontWeight);
  if (!font) return;

  const b = getObjectBounds(obj);
  const pathData = textToSvgPathData({
    font,
    content: obj.content,
    x: obj.x,
    y: obj.y,
    width: b.width,
    fontSize: obj.fontSize,
    fontWeight: obj.fontWeight,
    textAlign: obj.textAlign,
    lineHeight: obj.lineHeight,
    letterSpacing: obj.letterSpacing,
  });

  if (!pathData) return;

  const fillColor = obj.textColor ? hexToRgbNorm(obj.textColor) : { r: 0, g: 0, b: 0 };
  const contentStream = buildPathFromSvg(pathData, b.height + b.y, fillColor);
  page.doc.context.content(contentStream);
}

/**
 * Convert an SVG path `d` string to a PDF content stream containing only
 * moveto/lineto/curveto/closepath. PDF has no native support for quadratic
 * Béziers (Q/q, T/t), smooth cubics (S/s), or elliptical arcs (A/a), so we
 * flatten them to cubic Béziers here.
 *
 * Quadratic → cubic: given Q with control P1 and endpoint P2 from current P0,
 *   C1 = P0 + 2/3 (P1 − P0)    C2 = P2 + 2/3 (P1 − P2)
 *
 * Smooth cubic (S/s): first control point is the reflection of the previous
 *   cubic's second control point about the current point.
 *
 * Smooth quadratic (T/t): same reflection logic, then quadratic → cubic.
 *
 * Arc (A/a): split into ≤90° segments, each approximated by a cubic using
 *   the standard SVG arc-to-cubic formula with α = sin(Δη)(√(4+3tan²(Δη/4))−1)/3.
 *
 * Y-axis is flipped (SVG y-down → PDF y-up) and sweep direction is inverted
 * for arcs because the flip reverses orientation.
 */
export function buildPathFromSvg(
  pathData: string,
  originY: number,
  fillColor: { r: number; g: number; b: number },
): string {
  const tokens = pathData.match(/[MmLlHhVvCcSsQqTtAaZz]|-?\d*\.?\d+(?:[eE][+-]?\d+)?/g);
  if (!tokens) return '';

  let stream = 'q '; // save graphics state
  stream += '1 0 0 1 0 0 cm '; // identity (we bake the mm→pt + flip into coordinates)

  let i = 0;
  let currentX = 0;
  let currentY = 0;
  // Track previous curve control points for S/s (cubic) and T/t (quadratic) reflection
  let lastCubicCpX = 0;
  let lastCubicCpY = 0;
  let lastQuadCpX = 0;
  let lastQuadCpY = 0;
  let hasLastCubicCp = false;
  let hasLastQuadCp = false;

  /** Scale a value from mm to PDF points */
  const pt = (raw: number) => raw * MM_TO_PT;
  /** Scale + absolute y-flip: SVG y-down → PDF y-up */
  const ptY = (raw: number) => (originY - raw) * MM_TO_PT;

  while (i < tokens.length) {
    const token = tokens[i];
    if (/[A-Za-z]/.test(token)) {
      const cmd = token;
      i++;
      const isRelative = cmd === cmd.toLowerCase();
      const upper = cmd.toUpperCase();

      switch (upper) {
        case 'M': {
          if (isRelative) {
            currentX += pt(parseFloat(tokens[i]));
            currentY -= pt(parseFloat(tokens[i + 1]));
          } else {
            currentX = pt(parseFloat(tokens[i]));
            currentY = ptY(parseFloat(tokens[i + 1]));
          }
          stream += `${currentX} ${currentY} m `;
          i += 2;
          hasLastCubicCp = false;
          hasLastQuadCp = false;
          break;
        }
        case 'L': {
          if (isRelative) {
            currentX += pt(parseFloat(tokens[i]));
            currentY -= pt(parseFloat(tokens[i + 1]));
          } else {
            currentX = pt(parseFloat(tokens[i]));
            currentY = ptY(parseFloat(tokens[i + 1]));
          }
          stream += `${currentX} ${currentY} l `;
          i += 2;
          hasLastCubicCp = false;
          hasLastQuadCp = false;
          break;
        }
        case 'H': {
          if (isRelative) {
            currentX += pt(parseFloat(tokens[i]));
          } else {
            currentX = pt(parseFloat(tokens[i]));
          }
          stream += `${currentX} ${currentY} l `;
          i += 1;
          hasLastCubicCp = false;
          hasLastQuadCp = false;
          break;
        }
        case 'V': {
          if (isRelative) {
            currentY -= pt(parseFloat(tokens[i]));
          } else {
            currentY = ptY(parseFloat(tokens[i]));
          }
          stream += `${currentX} ${currentY} l `;
          i += 1;
          hasLastCubicCp = false;
          hasLastQuadCp = false;
          break;
        }
        case 'C': {
          let x1: number, y1: number, x2: number, y2: number, x: number, y: number;
          if (isRelative) {
            x1 = currentX + pt(parseFloat(tokens[i]));
            y1 = currentY - pt(parseFloat(tokens[i + 1]));
            x2 = currentX + pt(parseFloat(tokens[i + 2]));
            y2 = currentY - pt(parseFloat(tokens[i + 3]));
            x = currentX + pt(parseFloat(tokens[i + 4]));
            y = currentY - pt(parseFloat(tokens[i + 5]));
          } else {
            x1 = pt(parseFloat(tokens[i]));
            y1 = ptY(parseFloat(tokens[i + 1]));
            x2 = pt(parseFloat(tokens[i + 2]));
            y2 = ptY(parseFloat(tokens[i + 3]));
            x = pt(parseFloat(tokens[i + 4]));
            y = ptY(parseFloat(tokens[i + 5]));
          }
          stream += `${x1} ${y1} ${x2} ${y2} ${x} ${y} c `;
          lastCubicCpX = x2;
          lastCubicCpY = y2;
          hasLastCubicCp = true;
          hasLastQuadCp = false;
          currentX = x;
          currentY = y;
          i += 6;
          break;
        }
        case 'S': {
          let cp1x: number;
          let cp1y: number;
          if (hasLastCubicCp) {
            cp1x = 2 * currentX - lastCubicCpX;
            cp1y = 2 * currentY - lastCubicCpY;
          } else {
            cp1x = currentX;
            cp1y = currentY;
          }
          let x2s: number, y2s: number, xs: number, ys: number;
          if (isRelative) {
            x2s = currentX + pt(parseFloat(tokens[i]));
            y2s = currentY - pt(parseFloat(tokens[i + 1]));
            xs = currentX + pt(parseFloat(tokens[i + 2]));
            ys = currentY - pt(parseFloat(tokens[i + 3]));
          } else {
            x2s = pt(parseFloat(tokens[i]));
            y2s = ptY(parseFloat(tokens[i + 1]));
            xs = pt(parseFloat(tokens[i + 2]));
            ys = ptY(parseFloat(tokens[i + 3]));
          }
          stream += `${cp1x} ${cp1y} ${x2s} ${y2s} ${xs} ${ys} c `;
          lastCubicCpX = x2s;
          lastCubicCpY = y2s;
          hasLastCubicCp = true;
          hasLastQuadCp = false;
          currentX = xs;
          currentY = ys;
          i += 4;
          break;
        }
        case 'Q': {
          let qx1: number, qy1: number, qx: number, qy: number;
          if (isRelative) {
            qx1 = currentX + pt(parseFloat(tokens[i]));
            qy1 = currentY - pt(parseFloat(tokens[i + 1]));
            qx = currentX + pt(parseFloat(tokens[i + 2]));
            qy = currentY - pt(parseFloat(tokens[i + 3]));
          } else {
            qx1 = pt(parseFloat(tokens[i]));
            qy1 = ptY(parseFloat(tokens[i + 1]));
            qx = pt(parseFloat(tokens[i + 2]));
            qy = ptY(parseFloat(tokens[i + 3]));
          }
          if (isNaN(qx1) || isNaN(qy1) || isNaN(qx) || isNaN(qy)) {
            currentX = isNaN(qx) ? currentX : qx;
            currentY = isNaN(qy) ? currentY : qy;
            i += 4;
            break;
          }
          const cx1 = currentX + (2 / 3) * (qx1 - currentX);
          const cy1 = currentY + (2 / 3) * (qy1 - currentY);
          const cx2 = qx + (2 / 3) * (qx1 - qx);
          const cy2 = qy + (2 / 3) * (qy1 - qy);
          stream += `${cx1} ${cy1} ${cx2} ${cy2} ${qx} ${qy} c `;
          lastQuadCpX = qx1;
          lastQuadCpY = qy1;
          hasLastQuadCp = true;
          hasLastCubicCp = false;
          currentX = qx;
          currentY = qy;
          i += 4;
          break;
        }
        case 'T': {
          let qcp1x: number;
          let qcp1y: number;
          if (hasLastQuadCp) {
            qcp1x = 2 * currentX - lastQuadCpX;
            qcp1y = 2 * currentY - lastQuadCpY;
          } else {
            qcp1x = currentX;
            qcp1y = currentY;
          }
          let tx: number, ty: number;
          if (isRelative) {
            tx = currentX + pt(parseFloat(tokens[i]));
            ty = currentY - pt(parseFloat(tokens[i + 1]));
          } else {
            tx = pt(parseFloat(tokens[i]));
            ty = ptY(parseFloat(tokens[i + 1]));
          }
          if (isNaN(qcp1x) || isNaN(qcp1y) || isNaN(tx) || isNaN(ty)) {
            currentX = isNaN(tx) ? currentX : tx;
            currentY = isNaN(ty) ? currentY : ty;
            i += 2;
            break;
          }
          const cx1 = currentX + (2 / 3) * (qcp1x - currentX);
          const cy1 = currentY + (2 / 3) * (qcp1y - currentY);
          const cx2 = tx + (2 / 3) * (qcp1x - tx);
          const cy2 = ty + (2 / 3) * (qcp1y - ty);
          stream += `${cx1} ${cy1} ${cx2} ${cy2} ${tx} ${ty} c `;
          lastQuadCpX = qcp1x;
          lastQuadCpY = qcp1y;
          hasLastQuadCp = true;
          hasLastCubicCp = false;
          currentX = tx;
          currentY = ty;
          i += 2;
          break;
        }
        case 'A': {
          const rx = pt(parseFloat(tokens[i]));
          const ry = pt(parseFloat(tokens[i + 1]));
          const phi = (parseFloat(tokens[i + 2]) * Math.PI) / 180;
          const largeArc = parseInt(tokens[i + 3], 10);
          const sweep = parseInt(tokens[i + 4], 10);
          let ex: number, ey: number;
          if (isRelative) {
            ex = currentX + pt(parseFloat(tokens[i + 5]));
            ey = currentY - pt(parseFloat(tokens[i + 6]));
          } else {
            ex = pt(parseFloat(tokens[i + 5]));
            ey = ptY(parseFloat(tokens[i + 6]));
          }
          stream += arcToCubicPath(currentX, currentY, rx, ry, phi, largeArc, 1 - sweep, ex, ey);
          currentX = ex;
          currentY = ey;
          hasLastCubicCp = false;
          hasLastQuadCp = false;
          i += 7;
          break;
        }
        case 'Z': {
          stream += 'h ';
          break;
        }
      }
    } else {
      // Bare number (implicit repeat of last command) — rare in our output
      i++;
    }
  }

  stream += `${fillColor.r} ${fillColor.g} ${fillColor.b} rg f Q`; // set fill color, fill, restore
  return stream;
}

/**
 * Approximate an elliptical arc with one or more cubic Bézier segments.
 * Implements the SVG arc-to-cubic algorithm (SMIL/SVG spec).
 */
function arcToCubicPath(
  x0: number,
  y0: number,
  rx: number,
  ry: number,
  phi: number,
  largeArc: number,
  sweep: number,
  x1: number,
  y1: number,
): string {
  // Degenerate cases
  if (x0 === x1 && y0 === y1) return '';
  if (rx === 0 || ry === 0) {
    return `${x1} ${y1} l `;
  }

  const cosP = Math.cos(phi);
  const sinP = Math.sin(phi);

  // Step 1: Compute (dx2, dy2) — half the chord
  const dx2 = (x0 - x1) / 2;
  const dy2 = (y0 - y1) / 2;

  // Step 2: Compute (x1p, y1p) in rotated coordinate space
  const x1p = cosP * dx2 + sinP * dy2;
  const y1p = -sinP * dx2 + cosP * dy2;

  // Step 3: Ensure radii are large enough (correct if chord > diameter)
  const rxs = rx * rx;
  const rys = ry * ry;
  const x1ps = x1p * x1p;
  const y1ps = y1p * y1p;
  const cr = x1ps / rxs + y1ps / rys;
  if (cr > 1) {
    const s = Math.sqrt(cr);
    rx *= s;
    ry *= s;
  }

  // Step 4: Compute center in rotated coordinate space
  const sq = Math.max(0, (rxs * rys - rxs * y1ps - rys * x1ps) / (rxs * y1ps + rys * x1ps));
  const coef = (largeArc === sweep ? -1 : 1) * Math.sqrt(sq);
  const cxp = coef * rx * y1p / ry;
  const cyp = coef * -ry * x1p / rx;

  // Step 5: Compute center in original coordinate space
  const cx = cosP * cxp - sinP * cyp + (x0 + x1) / 2;
  const cy = sinP * cxp + cosP * cyp + (y0 + y1) / 2;

  // Step 6: Compute start angle and sweep delta
  const angleBetween = (ux: number, uy: number, vx: number, vy: number) => {
    const dot = ux * vx + uy * vy;
    const len = Math.sqrt(ux * ux + uy * uy) * Math.sqrt(vx * vx + vy * vy);
    if (len === 0) return 0;
    const a = Math.acos(Math.max(-1, Math.min(1, dot / len)));
    return ux * vy - uy * vx >= 0 ? a : -a;
  };

  const theta = angleBetween(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let delta = angleBetween(
    (x1p - cxp) / rx,
    (y1p - cyp) / ry,
    (-x1p - cxp) / rx,
    (-y1p - cyp) / ry,
  );
  if (sweep === 0 && delta > 0) delta -= 2 * Math.PI;
  if (sweep === 1 && delta < 0) delta += 2 * Math.PI;

  // Step 7: Split into segments of ≤ 90° each
  const n = Math.max(1, Math.ceil(Math.abs(delta) / (Math.PI / 2)));
  const deltaN = delta / n;

  let out = '';
  let segX0 = x0;
  let segY0 = y0;
  for (let seg = 0; seg < n; seg++) {
    const eta1 = theta + seg * deltaN;
    const eta2 = theta + (seg + 1) * deltaN;
    out += cubicSegment(segX0, segY0, rx, ry, cx, cy, cosP, sinP, eta1, eta2);
    // Update start point for next segment
    const cos2 = Math.cos(eta2);
    const sin2 = Math.sin(eta2);
    segX0 = cx + cosP * rx * cos2 - sinP * ry * sin2;
    segY0 = cy + sinP * rx * cos2 + cosP * ry * sin2;
  }

  return out;
}

/**
 * Compute a single cubic Bézier segment approximating an arc segment
 * from angle eta1 to eta2 on an ellipse centered at (cx, cy) with radii
 * (rx, ry), rotated by phi (cosP, sinP).
 */
function cubicSegment(
  x0: number,
  _y0: number,
  rx: number,
  ry: number,
  cx: number,
  cy: number,
  cosP: number,
  sinP: number,
  eta1: number,
  eta2: number,
): string {
  const delta = eta2 - eta1;
  const tand4 = Math.tan(delta / 4);
  const alpha = (Math.sin(delta) * (Math.sqrt(4 + 3 * tand4 * tand4) - 1)) / 3;

  const cos1 = Math.cos(eta1);
  const sin1 = Math.sin(eta1);
  const cos2 = Math.cos(eta2);
  const sin2 = Math.sin(eta2);

  // Endpoints on ellipse (unrotated)
  const ex1 = rx * cos1;
  const ey1 = ry * sin1;
  const ex2 = rx * cos2;
  const ey2 = ry * sin2;

  // Tangents at endpoints (unrotated)
  const et1x = -rx * sin1;
  const et1y = ry * cos1;
  const et2x = -rx * sin2;
  const et2y = ry * cos2;

  // Control points (unrotated)
  const cpx1 = ex1 + alpha * et1x;
  const cpy1 = ey1 + alpha * et1y;
  const cpx2 = ex2 - alpha * et2x;
  const cpy2 = ey2 - alpha * et2y;

  // Rotate and translate to final position
  const cp1x = cx + cosP * cpx1 - sinP * cpy1;
  const cp1y = cy + sinP * cpx1 + cosP * cpy1;
  const cp2x = cx + cosP * cpx2 - sinP * cpy2;
  const cp2y = cy + sinP * cpx2 + cosP * cpy2;
  const endx = cx + cosP * ex2 - sinP * ey2;
  const endy = cy + sinP * ex2 + cosP * ey2;

  return `${cp1x} ${cp1y} ${cp2x} ${cp2y} ${endx} ${endy} c `;
}

function buildFilledPath(
  path: string,
  fillColor: { r: number; g: number; b: number } | null,
  strokeColor: { r: number; g: number; b: number } | null,
  strokeWidth: number,
): string {
  let stream = 'q ';
  stream += path;
  if (fillColor) {
    stream += `${fillColor.r} ${fillColor.g} ${fillColor.b} rg f `;
  }
  if (strokeColor) {
    stream += `${strokeColor.r} ${strokeColor.g} ${strokeColor.b} RG ${strokeWidth} w S `;
  }
  stream += 'Q';
  return stream;
}

function hexToRgbNorm(hex: string): { r: number; g: number; b: number } {
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  if (h.length !== 6) return { r: 0, g: 0, b: 0 };
  const n = parseInt(h, 16);
  return {
    r: ((n >> 16) & 0xff) / 255,
    g: ((n >> 8) & 0xff) / 255,
    b: (n & 0xff) / 255,
  };
}
