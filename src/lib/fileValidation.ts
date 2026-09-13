/**
 * Shared file validation for image uploads.
 *
 * Single source of truth used by BOTH the drag-drop handler AND the
 * file-picker `change` handler. Never duplicate the check —
 * path-dependent validation is a real bug (one path rejects, the other
 * silently accepts).
 *
 * Supports: PNG, JPG, SVG, PDF (plus WebP, GIF).
 * Explicitly rejects: .psd, .cdr (proprietary — user exports SVG/PDF).
 */

export const ACCEPTED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/svg+xml",
  "application/pdf",
  "image/webp",
  "image/gif",
] as const;

export const ACCEPTED_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".svg",
  ".pdf",
  ".webp",
  ".gif",
] as const;

/**
 * Rejected proprietary formats — detected by extension BEFORE the generic
 * extension check so we can return a helpful message naming the supported
 * alternatives instead of a generic "unsupported" error.
 */
export const REJECTED_FORMATS: Record<string, { name: string; exportHint: string }> = {
  ".psd": { name: "Adobe Photoshop (PSD)", exportHint: "export as PNG or PDF from Photoshop" },
  ".cdr": { name: "CorelDraw (CDR)", exportHint: "export as SVG or PDF from CorelDraw" },
};

export const SUPPORTED_FORMATS_LIST = "PNG, JPG, SVG, PDF";

/** 50 MB limit for raster uploads. SVG is text-based, no practical limit needed. */
export const FILE_SIZE_LIMIT_BYTES = 50 * 1024 * 1024;

export const ACCEPT_STRING =
  ACCEPTED_MIME_TYPES.join(",") + "," + ACCEPTED_EXTENSIONS.join(",");

export interface ValidationResult {
  valid: boolean;
  error: string | null;
}

/** Returns true if the file is an SVG (by MIME or extension). */
export function isSvgFile(file: File): boolean {
  if (file.type === "image/svg+xml") return true;
  const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
  return ext === ".svg";
}

/**
 * Validate a file for upload. Checks rejected proprietary formats first
 * (so the user gets a helpful "export as…" message), then MIME type
 * (with extension fallback), then size limit.
 * Used by BOTH the drop handler and the file-picker change handler
 * so behavior is identical across every input path.
 */
export function validateFile(file: File): ValidationResult {
  const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));

  // Check rejected proprietary formats first — give a helpful message.
  const rejected = REJECTED_FORMATS[ext];
  if (rejected) {
    return {
      valid: false,
      error: `Cannot import ${rejected.name} files. Please ${rejected.exportHint}. Supported formats: ${SUPPORTED_FORMATS_LIST}.`,
    };
  }

  if (file.type) {
    if (!ACCEPTED_MIME_TYPES.includes(file.type as (typeof ACCEPTED_MIME_TYPES)[number])) {
      return {
        valid: false,
        error: `Unsupported type "${file.type}". Accepted: ${SUPPORTED_FORMATS_LIST} (max ${formatFileSize(FILE_SIZE_LIMIT_BYTES)}).`,
      };
    }
  } else {
    if (!ext || !ACCEPTED_EXTENSIONS.includes(ext as (typeof ACCEPTED_EXTENSIONS)[number])) {
      return {
        valid: false,
        error: `Unsupported extension "${ext || "?"}". Accepted: .png, .jpg, .svg, .pdf, .webp, .gif.`,
      };
    }
  }

  if (file.size > FILE_SIZE_LIMIT_BYTES) {
    return {
      valid: false,
      error: `File too large: ${formatFileSize(file.size)}. Maximum: ${formatFileSize(FILE_SIZE_LIMIT_BYTES)}.`,
    };
  }

  if (file.size === 0) {
    return { valid: false, error: "File is empty." };
  }

  return { valid: true, error: null };
}

/** Format bytes into a human-readable string (KB, MB). */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Maximum dimension allowed for any image before downscaling.
 * Keeps canvas responsive — a 12MP photo (e.g. 4000×3000) gets
 * downscaled to this on its longest edge before being placed.
 */
export const MAX_DIMENSION = 2048;

/**
 * Downscale an image's longest edge to MAX_DIMENSION while preserving
 * aspect ratio. Returns the new dimensions.
 */
export function computeDownscale(
  naturalWidth: number,
  naturalHeight: number
): { width: number; height: number } {
  const max = Math.max(naturalWidth, naturalHeight);
  if (max <= MAX_DIMENSION) {
    return { width: naturalWidth, height: naturalHeight };
  }
  const ratio = MAX_DIMENSION / max;
  return {
    width: Math.round(naturalWidth * ratio),
    height: Math.round(naturalHeight * ratio),
  };
}

/**
 * Pixel dimension recommended for crisp print at the given DPI.
 * mm -> inches -> pixels, rounded up.
 */
export function recommendedPixels(boxMM: number, dpi = 300): number {
  return Math.ceil((boxMM / 25.4) * dpi);
}
