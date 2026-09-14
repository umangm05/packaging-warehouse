import {
  type DesignObject,
  type Fill,
  type GradientStop,
  getObjectBounds,
  isTextObject,
} from '@/lib/designerTypes';
import { colorToCss } from '@/lib/colorUtils';
import { PT_TO_MM } from '@/lib/fonts';
import { textToSvgPathData, loadFont } from './textPaths';

export interface SvgExportOptions {
  widthMm: number;
  heightMm: number;
  dpi: number;
  background: Fill;
  objects: DesignObject[];
}

/**
 * Generate a true-vector SVG string from the designer scene.
 *
 * - Physical size encoded in viewBox + width/height (mm).
 * - Text converted to path outlines (no font dependency).
 * - All coordinates in mm — no transforms that could confuse CorelDRAW.
 * - Gradients exported as SVG <linearGradient> definitions.
 */
export async function exportSvg(opts: SvgExportOptions): Promise<string> {
  const { widthMm, heightMm, background, objects } = opts;

  let defs = '';
  let body = '';
  let gradientIdCounter = 0;

  // Background
  if (background.type === 'solid') {
    body += `<rect x="0" y="0" width="${widthMm}" height="${heightMm}" fill="${background.color}"/>`;
  } else if (background.type === 'linear-gradient') {
    const gid = `g${gradientIdCounter++}`;
    defs += linearGradientDef(gid, background.angle, background.stops);
    body += `<rect x="0" y="0" width="${widthMm}" height="${heightMm}" fill="url(#${gid})"/>`;
  }
  // transparent background: no rect

  // Process each object
  for (const obj of objects) {
    if (!obj.visible) continue;

    const fillCss = fillToCss(obj.fill, obj.fillOpacity);
    const strokeCss =
      obj.stroke === 'transparent' ? 'none' : colorToCss(obj.stroke, obj.fillOpacity);
    const transform = obj.rotation ? ` transform="rotate(${obj.rotation.toFixed(3)})"` : '';
    const transformOrigin = obj.rotation ? getTransformOrigin(obj) : '';

    if (obj.type === 'text' && obj.convertOutlines) {
      // Convert text to SVG path data (outlined)
      body += await renderTextAsPaths(obj, fillCss, transform, transformOrigin);
      continue;
    }

    switch (obj.type) {
      case 'rect':
        body += `<rect x="${obj.x.toFixed(3)}" y="${obj.y.toFixed(3)}" width="${obj.width.toFixed(3)}" height="${obj.height.toFixed(3)}" fill="${fillCss}" stroke="${strokeCss}" stroke-width="${obj.strokeWidth.toFixed(3)}"${transform}${transformOrigin}/>`;
        break;

      case 'ellipse':
        body += `<ellipse cx="${obj.x.toFixed(3)}" cy="${obj.y.toFixed(3)}" rx="${obj.rx.toFixed(3)}" ry="${obj.ry.toFixed(3)}" fill="${fillCss}" stroke="${strokeCss}" stroke-width="${obj.strokeWidth.toFixed(3)}"${transform}${transformOrigin}/>`;
        break;

      case 'line':
        body += `<line x1="${obj.x.toFixed(3)}" y1="${obj.y.toFixed(3)}" x2="${obj.x2.toFixed(3)}" y2="${obj.y2.toFixed(3)}" stroke="${strokeCss === 'none' ? '#000000' : strokeCss}" stroke-width="${obj.strokeWidth.toFixed(3)}" stroke-linecap="round"/>`;
        break;

      case 'polygon': {
        const pts = obj.points
          .map((p) => `${(obj.x + p.x).toFixed(3)},${(obj.y + p.y).toFixed(3)}`)
          .join(' ');
        body += `<polygon points="${pts}" fill="${fillCss}" stroke="${strokeCss}" stroke-width="${obj.strokeWidth.toFixed(3)}"${transform}${transformOrigin}/>`;
        break;
      }

      case 'text': {
        // Live text (not outlined) — embed as <text> with font-family
        const textColor = obj.textColor || '#000000';
        const textFill = colorToCss(textColor, obj.fillOpacity);
        const lines = obj.content.split('\n');
        const lineHeightMm = obj.fontSize * PT_TO_MM * obj.lineHeight;
        const anchor =
          obj.textAlign === 'center'
            ? 'middle'
            : obj.textAlign === 'right'
              ? 'end'
              : 'start';
        const b = getObjectBounds(obj);
        const xPos =
          obj.textAlign === 'center'
            ? obj.x + b.width / 2
            : obj.textAlign === 'right'
              ? obj.x + b.width
              : obj.x;

        body += `<text x="${xPos.toFixed(3)}" y="${obj.y.toFixed(3)}" font-family="${obj.fontFamily}, sans-serif" font-size="${obj.fontSize}" font-weight="${obj.fontWeight}" font-style="${obj.fontStyle}" fill="${textFill}" dominant-baseline="hanging" text-anchor="${anchor}" letter-spacing="${obj.letterSpacing}"${transform}${transformOrigin}>`;
        lines.forEach((line, i) => {
          const dy = i === 0 ? 0 : lineHeightMm.toFixed(3);
          body += `<tspan x="${xPos.toFixed(3)}" dy="${dy}">${escapeXml(line || ' ')}</tspan>`;
        });
        body += `</text>`;
        break;
      }

      case 'image': {
        // Images are embedded as data URLs (raster) or SVG data URLs (vector)
        const preserveAspectRatio =
          obj.imageFit === 'stretch'
            ? 'none'
            : obj.imageFit === 'cover'
              ? 'xMidYMid slice'
              : 'xMidYMid meet';
        body += `<image x="${obj.x.toFixed(3)}" y="${obj.y.toFixed(3)}" width="${obj.width.toFixed(3)}" height="${obj.height.toFixed(3)}" href="${obj.src}" preserveAspectRatio="${preserveAspectRatio}"/>`;
        break;
      }
    }

    // Gradient defs
    if (obj.fill.type === 'linear-gradient') {
      const gid = `g${gradientIdCounter++}`;
      defs += linearGradientDef(gid, obj.fill.angle, obj.fill.stops);
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${widthMm}mm" height="${heightMm}mm" viewBox="0 0 ${widthMm} ${heightMm}">
${defs ? `<defs>\n${defs}</defs>\n` : ''}${body}
</svg>`;
}

async function renderTextAsPaths(
  obj: Extract<DesignObject, { type: 'text' }>,
  fillCss: string,
  transform: string,
  transformOrigin: string,
): Promise<string> {
  const font = await loadFont(obj.fontFamily, obj.fontWeight);
  if (!font) {
    // Fallback: render as live text if font load fails
    const textColor = obj.textColor || '#000000';
    const textFill = colorToCss(textColor, obj.fillOpacity);
    const b = getObjectBounds(obj);
    const anchor =
      obj.textAlign === 'center'
        ? 'middle'
        : obj.textAlign === 'right'
          ? 'end'
          : 'start';
    const xPos =
      obj.textAlign === 'center'
        ? obj.x + b.width / 2
        : obj.textAlign === 'right'
          ? obj.x + b.width
          : obj.x;
    return `<text x="${xPos.toFixed(3)}" y="${obj.y.toFixed(3)}" font-family="${obj.fontFamily}, sans-serif" font-size="${obj.fontSize}" font-weight="${obj.fontWeight}" font-style="${obj.fontStyle}" fill="${textFill}" dominant-baseline="hanging" text-anchor="${anchor}" letter-spacing="${obj.letterSpacing}"${transform}${transformOrigin}>${escapeXml(obj.content)}</text>`;
  }

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

  if (!pathData) return '';

  // Apply rotation transform to the path
  const transformAttr = obj.rotation
    ? ` transform="rotate(${obj.rotation.toFixed(3)} ${getTransformOriginAttr(obj)})"`
    : '';

  return `<path d="${pathData}" fill="${fillCss}" stroke="none"${transformAttr}/>`;
}

function getTransformOrigin(obj: DesignObject): string {
  const b = getObjectBounds(obj);
  const cx = b.x + b.width / 2;
  const cy = b.y + b.height / 2;
  return ` style="transform-origin: ${cx.toFixed(3)}px ${cy.toFixed(3)}px"`;
}

function getTransformOriginAttr(obj: DesignObject): string {
  const b = getObjectBounds(obj);
  const cx = b.x + b.width / 2;
  const cy = b.y + b.height / 2;
  return `${cx.toFixed(3)} ${cy.toFixed(3)}`;
}

function fillToCss(fill: Fill, opacity: number): string {
  if (fill.type === 'transparent') return 'none';
  if (fill.type === 'solid') return colorToCss(fill.color, opacity);
  return 'none'; // gradient handled separately
}

function linearGradientDef(id: string, angle: number, stops: GradientStop[]): string {
  // Convert angle to x1/y1/x2/y2
  const rad = ((angle - 90) * Math.PI) / 180;
  const x1 = 50 + Math.cos(rad) * 50;
  const y1 = 50 + Math.sin(rad) * 50;
  const x2 = 50 - Math.cos(rad) * 50;
  const y2 = 50 - Math.sin(rad) * 50;

  const stopEls = stops
    .map(
      (s) =>
        `<stop offset="${(s.offset * 100).toFixed(1)}%" stop-color="${s.color}"/>`,
    )
    .join('');

  return `<linearGradient id="${id}" x1="${x1.toFixed(1)}%" y1="${y1.toFixed(1)}%" x2="${x2.toFixed(1)}%" y2="${y2.toFixed(1)}%">${stopEls}</linearGradient>`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
