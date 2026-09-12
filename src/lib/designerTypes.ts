/**
 * Shared designer-object types.
 *
 * S1 ships only the type definitions and an empty objects array so that S2-S4
 * (shapes / text / images) can extend the union without a schema migration.
 * Each object is positioned in millimetres from the top-left of the canvas.
 */
export type DesignObject =
  | {
      id: string;
      type: "rect";
      x: number;
      y: number;
      width: number;
      height: number;
      fill: string;
    }
  | {
      id: string;
      type: "text";
      x: number;
      y: number;
      content: string;
      fontFamily: string;
      fontSize: number;
      fill: string;
    }
  | {
      id: string;
      type: "image";
      x: number;
      y: number;
      width: number;
      height: number;
      src: string;
    };

let idCounter = 0;
export function nextId(prefix = "obj"): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter}`;
}
