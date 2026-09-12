export const DEFAULT_DIMS = { L: 240, W: 160, H: 90 } as const;

export const DIM_LIMITS = {
  L: { min: 20, max: 500 },
  W: { min: 20, max: 500 },
  H: { min: 20, max: 400 },
} as const;

export type DimKey = keyof typeof DEFAULT_DIMS;

export interface ValidationResult {
  valid: boolean;
  error: string | null;
}

export function parseDimension(raw: string): number {
  const trimmed = raw.trim();
  if (trimmed === "") return NaN;
  return Number(trimmed);
}

export function validateDimension(
  value: number,
  min: number,
  max: number,
): ValidationResult {
  if (!Number.isFinite(value)) {
    return { valid: false, error: "Enter a valid number" };
  }
  if (value <= 0) {
    return { valid: false, error: "Must be greater than 0" };
  }
  if (value < min) {
    return { valid: false, error: `Min ${min}mm` };
  }
  if (value > max) {
    return { valid: false, error: `Max ${max}mm` };
  }
  return { valid: true, error: null };
}
