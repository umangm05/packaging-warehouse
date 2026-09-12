export type Unit = "mm" | "cm" | "in" | "px";

export const UNIT_OPTIONS: Unit[] = ["mm", "cm", "in", "px"];

export const UNIT_LABELS: Record<Unit, string> = {
  mm: "mm",
  cm: "cm",
  in: "in",
  px: "px",
};

const MM_PER_INCH = 25.4;
const MM_PER_CM = 10;

/**
 * Convert a value from the given display unit to millimetres (the internal
 * canonical unit). px conversion depends on DPI.
 */
export function toMm(value: number, unit: Unit, dpi: number): number {
  switch (unit) {
    case "mm":
      return value;
    case "cm":
      return value * MM_PER_CM;
    case "in":
      return value * MM_PER_INCH;
    case "px":
      return value * (MM_PER_INCH / dpi);
  }
}

/**
 * Convert an internal mm value to the given display unit.
 */
export function fromMm(mm: number, unit: Unit, dpi: number): number {
  switch (unit) {
    case "mm":
      return mm;
    case "cm":
      return mm / MM_PER_CM;
    case "in":
      return mm / MM_PER_INCH;
    case "px":
      return mm * (dpi / MM_PER_INCH);
  }
}

/**
 * Format a mm value for display in the given unit, with sensible precision.
 */
export function formatUnit(mm: number, unit: Unit, dpi: number): string {
  const v = fromMm(mm, unit, dpi);
  switch (unit) {
    case "px":
      return Math.round(v).toLocaleString();
    case "in":
      return v.toFixed(4);
    case "cm":
      return v.toFixed(2);
    case "mm":
    default:
      return v.toFixed(1);
  }
}
