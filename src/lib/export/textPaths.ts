import { parse, load, type Font, type Path } from 'opentype.js';
import { PT_TO_MM } from '@/lib/fonts';

/**
 * Font loader and text-to-paths utility for the vector designer export engine.
 *
 * Uses opentype.js to convert live text into SVG path data so exports
 * never depend on font substitution in CorelDRAW or the print shop.
 */

const fontCache = new Map<string, Promise<Font | null>>();

/**
 * Load a font from Google Fonts CSS2 API. Falls back to system fonts on failure.
 * The font binary is cached per (family, weight) so repeated lookups are instant.
 */
export function loadFont(fontFamily: string, fontWeight: number = 400): Promise<Font | null> {
  const key = `${fontFamily}-${fontWeight}`;
  const cached = fontCache.get(key);
  if (cached) return cached;

  const promise = fetchGoogleFont(fontFamily, fontWeight);
  fontCache.set(key, promise);
  return promise;
}

async function fetchGoogleFont(fontFamily: string, fontWeight: number): Promise<Font | null> {
  try {
    const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontFamily)}:wght@${fontWeight}&display=swap`;
    const cssResponse = await fetch(cssUrl);
    if (!cssResponse.ok) return null;
    const css = await cssResponse.text();

    // Find the .ttf/.opentype URL — opentype.js cannot parse woff2.
    const ttfMatch = css.match(
      /src:\s*url\(([^)]+\.(?:ttf|otf))\)\s*format\(['"](?:truetype|opentype)['"]\)/i,
    );
    if (!ttfMatch) return null;

    const fontUrl = ttfMatch[1].replace(/['"]/g, '');
    const fontResponse = await fetch(fontUrl);
    if (!fontResponse.ok) return null;
    const buffer = await fontResponse.arrayBuffer();
    return parse(buffer);
  } catch {
    return null;
  }
}

/**
 * Convert a single line of text to SVG path data in millimetres.
 * Y-axis is flipped from font-space (up) to SVG-space (down).
 */
export function textLineToPathData(
  font: Font,
  text: string,
  xMm: number,
  yMm: number, // baseline position in mm
  fontSizePt: number,
): string {
  if (!text) return '';

  const scale = (fontSizePt * PT_TO_MM) / font.unitsPerEm;
  const path = font.getPath(text, 0, 0, fontSizePt);
  const raw = path.toPathData(3);

  // Transform: scale to mm, flip y-axis, translate to position.
  return transformPathData(raw, {
    scaleX: scale,
    scaleY: -scale,
    translateX: xMm,
    translateY: yMm + font.ascender * scale, // shift by ascent so yMm is the top of the line
  });
}

/**
 * Convert a full text object (possibly multi-line) into SVG path data.
 * Handles alignment and letter-spacing.
 */
export function textToSvgPathData(args: {
  font: Font;
  content: string;
  x: number;
  y: number;
  width: number;
  fontSize: number;
  fontWeight: number;
  textAlign: 'left' | 'center' | 'right';
  lineHeight: number;
  letterSpacing: number;
}): string {
  const { font, content, x, y, width, fontSize, textAlign, lineHeight, letterSpacing } = args;
  const scale = (fontSize * PT_TO_MM) / font.unitsPerEm;
  const lineHeightMm = fontSize * PT_TO_MM * lineHeight;
  const letterSpacingMm = letterSpacing * PT_TO_MM;
  const lines = content.split('\n');

  let result = '';
  lines.forEach((line, lineIdx) => {
    if (!line) return;

    // Measure line width for alignment
    const lineWidthPx = font.getAdvanceWidth(line, fontSize);
    const lineWidthMm = lineWidthPx * scale + (line.length - 1) * letterSpacingMm;

    let lineX = x;
    if (textAlign === 'center') {
      lineX = x + width / 2 - lineWidthMm / 2;
    } else if (textAlign === 'right') {
      lineX = x + width - lineWidthMm;
    }

    const lineY = y + font.ascender * scale + lineIdx * lineHeightMm;

    // Build path with letter-spacing: render each character and advance manually
    let cursorX = lineX;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const charPath = font.getPath(char, 0, 0, fontSize);
      const charData = charPath.toPathData(3);
      const transformed = transformPathData(charData, {
        scaleX: scale,
        scaleY: -scale,
        translateX: cursorX,
        translateY: lineY,
      });
      result += transformed;

      const advancePx = font.getAdvanceWidth(char, fontSize);
      cursorX += advancePx * scale + letterSpacingMm;
    }
  });

  return result;
}

/**
 * Transform SVG path data: scale (x, y independently) and translate.
 * Parses the path `d` attribute and re-emits it with transformed coordinates.
 * Curves (C, Q, etc.) and arcs (A) are handled by transforming all numeric args.
 */
function transformPathData(
  d: string,
  t: { scaleX: number; scaleY: number; translateX: number; translateY: number },
): string {
  // Tokenize path: commands (letters) and numbers
  const tokens = d.match(/[MmLlHhVvCcSsQqTtAaZz]|-?\d*\.?\d+(?:[eE][+-]?\d+)?/g);
  if (!tokens) return '';

  let out = '';
  let i = 0;
  let currentX = 0;
  let currentY = 0;

  while (i < tokens.length) {
    const token = tokens[i];

    if (/[A-Za-z]/.test(token)) {
      out += token;
      i++;

      const cmd = token;
      const isRelative = cmd === cmd.toLowerCase();
      const upper = cmd.toUpperCase();

      // Determine how many numeric args follow this command
      let argCount = 0;
      switch (upper) {
        case 'M':
        case 'L':
        case 'T':
          argCount = 2;
          break;
        case 'H':
        case 'V':
          argCount = 1;
          break;
        case 'C':
          argCount = 6;
          break;
        case 'S':
        case 'Q':
          argCount = 4;
          break;
        case 'A':
          argCount = 7;
          break;
        case 'Z':
          argCount = 0;
          break;
        default:
          argCount = 2; // safe default
      }

      // Read and transform the args
      for (let a = 0; a < argCount; a += 2) {
        if (i >= tokens.length) break;
        const rawX = parseFloat(tokens[i]);
        const rawY = parseFloat(tokens[i + 1]);

        let newX: number;
        let newY: number;

        if (upper === 'H') {
          // Horizontal line: single x value
          newX = rawX * t.scaleX + (isRelative ? 0 : t.translateX);
          out += ` ${round3(newX)}`;
          currentX = isRelative ? currentX + newX : newX;
          i += 1;
          continue;
        }

        if (upper === 'V') {
          // Vertical line: single y value
          newY = rawY * t.scaleY + (isRelative ? 0 : t.translateY);
          out += ` ${round3(newY)}`;
          currentY = isRelative ? currentY + newY : newY;
          i += 1;
          continue;
        }

        if (upper === 'A') {
          // Arc: rx ry xrot large-arc sweep x y
          // Transform endpoint (x, y), keep radii/flags as-is
          const rx = rawX;
          const ry = parseFloat(tokens[i + 1]);
          const xRot = parseFloat(tokens[i + 2]);
          const largeArc = parseFloat(tokens[i + 3]);
          const sweep = parseFloat(tokens[i + 4]);
          const endX = parseFloat(tokens[i + 5]);
          const endY = parseFloat(tokens[i + 6]);
          const tEndX = endX * t.scaleX + (isRelative ? 0 : t.translateX);
          const tEndY = endY * t.scaleY + (isRelative ? 0 : t.translateY);
          out += ` ${round3(rx)} ${round3(ry)} ${round3(xRot)} ${largeArc} ${sweep} ${round3(tEndX)} ${round3(tEndY)}`;
          currentX = isRelative ? currentX + endX : endX;
          currentY = isRelative ? currentY + endY : endY;
          i += 7;
          continue;
        }

        // Standard (x, y) pair
        newX = rawX * t.scaleX + (isRelative ? 0 : t.translateX);
        newY = rawY * t.scaleY + (isRelative ? 0 : t.translateY);
        out += ` ${round3(newX)} ${round3(newY)}`;
        currentX = isRelative ? currentX + rawX : newX;
        currentY = isRelative ? currentY + rawY : newY;
        i += 2;
      }
    } else {
      // Bare number (implicit repeat of last command) — rare in our output but handle it
      const lastCmd = out.trim().slice(-1);
      if (/[MmLlCcSsQqTt]/.test(lastCmd)) {
        const rawX = parseFloat(token);
        const rawY = parseFloat(tokens[i + 1] || '0');
        const isRelative = lastCmd === lastCmd.toLowerCase();
        const newX = rawX * t.scaleX + (isRelative ? 0 : t.translateX);
        const newY = rawY * t.scaleY + (isRelative ? 0 : t.translateY);
        out += ` ${round3(newX)} ${round3(newY)}`;
        i += 2;
      } else {
        i++;
      }
    }
  }

  return out;
}

function round3(n: number): string {
  return (Math.round(n * 1000) / 1000).toString();
}
