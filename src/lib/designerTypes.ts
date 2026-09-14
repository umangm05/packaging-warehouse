/**
 * Shared designer-object types.
 *
 * S2 ships the full object schema so that S3 (text) and S4 (images) can
 * extend the union without a schema migration. Each object is positioned
 * in millimetres from the top-left of the canvas.
 *
 * Common properties (every object):
 *   - fill / fillOpacity / stroke / strokeWidth — appearance
 *   - rotation — degrees clockwise around the object's center
 *   - visible / lock — layer panel controls
 *   - name — user-facing label in the layers panel
 */

/** A gradient stop: 0 → 1 position, colour hex. */
export interface GradientStop {
  offset: number; // 0–1
  color: string; // hex
}

export type Fill =
  | { type: "solid"; color: string } // hex
  | { type: "transparent" }
  | {
      type: "linear-gradient";
      angle: number; // degrees, 0 = left-to-right
      stops: GradientStop[];
    };

export interface CommonObjectProps {
  id: string;
  type: string;
  x: number;
  y: number;
  rotation: number; // degrees clockwise around center
  fill: Fill;
  fillOpacity: number; // 0–1
  stroke: string; // hex or "transparent"
  strokeWidth: number; // mm
  visible: boolean;
  locked: boolean;
  name: string;
}

export type DesignObject =
  | (CommonObjectProps & {
      type: "rect";
      width: number;
      height: number;
    })
  | (CommonObjectProps & {
      type: "ellipse";
      rx: number; // horizontal radius (mm)
      ry: number; // vertical radius (mm)
    })
  | (CommonObjectProps & {
      type: "line";
      x2: number; // endpoint in mm (absolute canvas coords)
      y2: number;
    })
  | (CommonObjectProps & {
      type: "polygon";
      points: Array<{ x: number; y: number }>; // relative to x,y
      sides: number; // for the tool (3=triangle, 4=square, etc.)
    })
  | (CommonObjectProps & {
      type: "text";
      content: string;
      fontFamily: string;
      fontSize: number;
      fontWeight: number;
      fontStyle: "normal" | "italic";
      textColor: string;
      textAlign: "left" | "center" | "right";
      lineHeight: number;
      letterSpacing: number;
      textTransform: "none" | "uppercase" | "lowercase" | "capitalize";
      convertOutlines: boolean;
    })
  | (CommonObjectProps & {
      type: "image";
      width: number;
      height: number;
      src: string;
      /** How the image fills its bounds when aspect ratio doesn't match. */
      imageFit: ImageFit;
      /** Clipping mask applied to the rendered image. */
      maskType: MaskType;
      /** True when source is SVG (rendered as vector, never rasterised). */
      isSvg: boolean;
      /** Source pixel dimensions — used for aspect-lock and resolution readout. */
      naturalWidth: number;
      naturalHeight: number;
      /** Crop rectangle in source-pixel coords (null = full image). */
      crop: { x: number; y: number; width: number; height: number } | null;
      adjustments: ImageAdjustments;
    });

/** How an image fits within its bounding box when aspect ratios differ. */
export type ImageFit = "contain" | "cover" | "stretch";

/** Clipping mask shape applied to an image. */
export type MaskType = "none" | "rect" | "ellipse";

export interface ImageAdjustments {
  brightness: number; // -100..100, 0 = unchanged
  contrast: number; // -100..100, 0 = unchanged
  saturation: number; // -100..100, 0 = unchanged
  blur: number; // 0..10 (radius in px at 300 DPI equivalent)
  flipH: boolean;
  flipV: boolean;
  bgRemoval: { r: number; g: number; b: number; tolerance: number } | null;
}

export const DEFAULT_IMAGE_ADJUSTMENTS: ImageAdjustments = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  blur: 0,
  flipH: false,
  flipV: false,
  bgRemoval: null,
};

/** Curated open-licence font list for the vector designer. All are Google Fonts
 *  (SIL Open Font License) — no unlicensed uploads. */
export const OPEN_LICENSED_FONTS = [
  { id: 'Inter', label: 'Inter' },
  { id: 'Roboto', label: 'Roboto' },
  { id: 'Roboto Mono', label: 'Roboto Mono' },
  { id: 'Open Sans', label: 'Open Sans' },
  { id: 'Lato', label: 'Lato' },
  { id: 'Montserrat', label: 'Montserrat' },
  { id: 'Poppins', label: 'Poppins' },
  { id: 'Playfair Display', label: 'Playfair Display' },
  { id: 'Oswald', label: 'Oswald' },
  { id: 'Raleway', label: 'Raleway' },
  { id: 'Nunito', label: 'Nunito' },
  { id: 'Merriweather', label: 'Merriweather' },
  { id: 'Source Code Pro', label: 'Source Code Pro' },
  { id: 'Fira Sans', label: 'Fira Sans' },
  { id: 'PT Sans', label: 'PT Sans' },
  { id: 'Ubuntu', label: 'Ubuntu' },
  { id: 'Rubik', label: 'Rubik' },
  { id: 'Space Grotesk', label: 'Space Grotesk' },
  { id: 'Work Sans', label: 'Work Sans' },
  { id: 'DM Sans', label: 'DM Sans' },
  { id: 'Crimson Text', label: 'Crimson Text' },
  { id: 'JetBrains Mono', label: 'JetBrains Mono' },
  { id: 'Dancing Script', label: 'Dancing Script' },
  { id: 'Pacifico', label: 'Pacifico' },
  { id: 'Permanent Marker', label: 'Permanent Marker' },
] as const;

export type FontFamily = (typeof OPEN_LICENSED_FONTS)[number]['id'];

export type TextAlignment = 'left' | 'center' | 'right';
export type FontWeightOption = 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
export type FontStyleOption = 'normal' | 'italic';
export type TextTransformOption = 'none' | 'uppercase' | 'lowercase' | 'capitalize';

/** Google Fonts CSS import URL covering all fonts in OPEN_LICENSED_FONTS. */
export const GOOGLE_FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Roboto:wght@400;700&family=Roboto+Mono:wght@400;700&family=Open+Sans:wght@400;700&family=Lato:wght@400;700&family=Montserrat:wght@400;700&family=Poppins:wght@400;700&family=Playfair+Display:wght@400;700&family=Oswald:wght@400;700&family=Raleway:wght@400;700&family=Nunito:wght@400;700&family=Merriweather:wght@400;700&family=Source+Code+Pro:wght@400;700&family=Fira+Sans:wght@400;700&family=PT+Sans:wght@400;700&family=Ubuntu:wght@400;700&family=Rubik:wght@400;700&family=Space+Grotesk:wght@400;700&family=Work+Sans:wght@400;700&family=DM+Sans:wght@400;700&family=Crimson+Text:wght@400;700&family=JetBrains+Mono:wght@400;700&family=Dancing+Script:wght@400;700&family=Pacifico&family=Permanent+Marker&display=swap';

/** Bounding box in canvas mm. */
export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

let idCounter = 0;
export function nextId(prefix = "obj"): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter}`;
}

/**
 * Compute the bounding box of an object in canvas mm.
 * Accounts for rotation only for rect/ellipse; for others uses a
 * conservative axis-aligned bounding box (good enough for selection handles).
 * For text, we use a simple heuristic since real metrics aren't available client-side.
 */
export function getObjectBounds(obj: DesignObject): Bounds {
  switch (obj.type) {
    case "rect":
      return { x: obj.x, y: obj.y, width: obj.width, height: obj.height };
    case "ellipse":
      return { x: obj.x - obj.rx, y: obj.y - obj.ry, width: obj.rx * 2, height: obj.ry * 2 };
    case "line":
      return {
        x: Math.min(obj.x, obj.x2),
        y: Math.min(obj.y, obj.y2),
        width: Math.abs(obj.x2 - obj.x),
        height: Math.abs(obj.y2 - obj.y),
      };
    case "polygon": {
      if (obj.points.length === 0) return { x: obj.x, y: obj.y, width: 0, height: 0 };
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      for (const p of obj.points) {
        minX = Math.min(minX, obj.x + p.x);
        minY = Math.min(minY, obj.y + p.y);
        maxX = Math.max(maxX, obj.x + p.x);
        maxY = Math.max(maxY, obj.y + p.y);
      }
      return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }
    case "text": {
      // Heuristic: approximate width from content length and font size
      // In a production app you'd use canvas measureText()
      const charWidth = obj.fontSize * 0.6;
      const lines = obj.content.split('\n');
      const longestLine = lines.reduce((max, l) => Math.max(max, l.length), 0);
      const lineCount = lines.length;
      return {
        x: obj.x,
        y: obj.y,
        width: longestLine * charWidth,
        height: lineCount * obj.fontSize * obj.lineHeight,
      };
    }
    case "image":
      return { x: obj.x, y: obj.y, width: obj.width, height: obj.height };
    default:
      return { x: 0, y: 0, width: 0, height: 0 };
  }
}

/** Center of an object in canvas mm. */
export function getObjectCenter(obj: DesignObject): { x: number; y: number } {
  const b = getObjectBounds(obj);
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

/** Extract text object properties (convenience for type narrowing). */
export function isTextObject(obj: DesignObject): obj is Extract<DesignObject, { type: "text" }> {
  return obj.type === "text";
}
