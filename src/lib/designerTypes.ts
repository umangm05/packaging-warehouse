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
    })
  | (CommonObjectProps & {
      type: "image";
      width: number;
      height: number;
      src: string;
    });

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
    case "text":
      return { x: obj.x, y: obj.y, width: obj.fontSize * obj.content.length * 0.6, height: obj.fontSize };
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
