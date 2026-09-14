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

function buildPathFromSvg(pathData: string, originY: number, fillColor: { r: number; g: number; b: number }): string {
  const tokens = pathData.match(/[MmLlHhVvCcSsQqTtAaZz]|-?\d*\.?\d+(?:[eE][+-]?\d+)?/g);
  if (!tokens) return '';

  let stream = 'q '; // save graphics state
  stream += '1 0 0 1 0 0 cm '; // identity (we bake the mm→pt + flip into coordinates)

  let i = 0;
  let currentX = 0;
  let currentY = 0;

  while (i < tokens.length) {
    const token = tokens[i];
    if (/[A-Za-z]/.test(token)) {
      const cmd = token;
      i++;

      switch (cmd) {
        case 'M':
          currentX = parseFloat(tokens[i]) * MM_TO_PT;
          currentY = (originY - parseFloat(tokens[i + 1])) * MM_TO_PT;
          stream += `${currentX} ${currentY} m `;
          i += 2;
          break;
        case 'm':
          currentX += parseFloat(tokens[i]) * MM_TO_PT;
          currentY -= parseFloat(tokens[i + 1]) * MM_TO_PT;
          stream += `${currentX} ${currentY} m `;
          i += 2;
          break;
        case 'L':
          currentX = parseFloat(tokens[i]) * MM_TO_PT;
          currentY = (originY - parseFloat(tokens[i + 1])) * MM_TO_PT;
          stream += `${currentX} ${currentY} l `;
          i += 2;
          break;
        case 'l':
          currentX += parseFloat(tokens[i]) * MM_TO_PT;
          currentY -= parseFloat(tokens[i + 1]) * MM_TO_PT;
          stream += `${currentX} ${currentY} l `;
          i += 2;
          break;
        case 'H':
          currentX = parseFloat(tokens[i]) * MM_TO_PT;
          stream += `${currentX} ${currentY} l `;
          i += 1;
          break;
        case 'h':
          currentX += parseFloat(tokens[i]) * MM_TO_PT;
          stream += `${currentX} ${currentY} l `;
          i += 1;
          break;
        case 'V':
          currentY = (originY - parseFloat(tokens[i])) * MM_TO_PT;
          stream += `${currentX} ${currentY} l `;
          i += 1;
          break;
        case 'v':
          currentY -= parseFloat(tokens[i]) * MM_TO_PT;
          stream += `${currentX} ${currentY} l `;
          i += 1;
          break;
        case 'C': {
          const x1 = parseFloat(tokens[i]) * MM_TO_PT;
          const y1 = (originY - parseFloat(tokens[i + 1])) * MM_TO_PT;
          const x2 = parseFloat(tokens[i + 2]) * MM_TO_PT;
          const y2 = (originY - parseFloat(tokens[i + 3])) * MM_TO_PT;
          const x = parseFloat(tokens[i + 4]) * MM_TO_PT;
          const y = (originY - parseFloat(tokens[i + 5])) * MM_TO_PT;
          stream += `${x1} ${y1} ${x2} ${y2} ${x} ${y} c `;
          currentX = x;
          currentY = y;
          i += 6;
          break;
        }
        case 'c': {
          const x1 = currentX + parseFloat(tokens[i]) * MM_TO_PT;
          const y1 = currentY - parseFloat(tokens[i + 1]) * MM_TO_PT;
          const x2 = currentX + parseFloat(tokens[i + 2]) * MM_TO_PT;
          const y2 = currentY - parseFloat(tokens[i + 3]) * MM_TO_PT;
          const x = currentX + parseFloat(tokens[i + 4]) * MM_TO_PT;
          const y = currentY - parseFloat(tokens[i + 5]) * MM_TO_PT;
          stream += `${x1} ${y1} ${x2} ${y2} ${x} ${y} c `;
          currentX = x;
          currentY = y;
          i += 6;
          break;
        }
        case 'Q':
        case 'q':
          // Quadratic curves - approximate with cubic (pdf-lib has limited support)
          // For now, skip control point and go to endpoint
          i += 4;
          break;
        case 'Z':
        case 'z':
          stream += 'h ';
          break;
        default:
          break;
      }
    } else {
      i++;
    }
  }

  stream += `${fillColor.r} ${fillColor.g} ${fillColor.b} rg f Q`; // set fill color, fill, restore
  return stream;
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
