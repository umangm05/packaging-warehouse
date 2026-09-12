/**
 * Shared file validation for image uploads.
 *
 * Single source of truth used by BOTH the drag-drop handler AND the
 * file-picker `change` handler. Never duplicate the check —
 * path-dependent validation is a real bug (one path rejects, the other
 * silently accepts).
 *
 * Supports: PNG, JPG, WebP, GIF, SVG.
 */

export const ACCEPTED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
] as const;

export const ACCEPTED_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".svg",
] as const;

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
 * Validate an upload before decoding.
 *
 * - MIME type or extension must be in the accepted list.
 * - Raster files must be under 50 MB and non-empty.
 * - SVG files skip the size limit (they're XML text, not pixels).
 */
export function validateFile(file: File): ValidationResult {
  if (file.size === 0) {
    return { valid: false, error: "File is empty." };
  }

  // SVG is text-based — no pixel size limit needed
  const isSvg = isSvgFile(file);

  if (!isSvg) {
    if (file.size > FILE_SIZE_LIMIT_BYTES) {
      return {
        valid: false,
        error: `File too large: ${formatFileSize(file.size)}. Maximum: 50 MB.`,
      };
    }
    // Check MIME type or extension for raster
    if (file.type) {
      if (!ACCEPTED_MIME_TYPES.includes(file.type as any)) {
        return {
          valid: false,
          error: `Unsupported type "${file.type}". Accepted: PNG, JPG, WebP, GIF, SVG.`,
        };
      }
    } else {
      const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
      if (!ext || !ACCEPTED_EXTENSIONS.includes(ext as any)) {
        return {
          valid: false,
          error: `Unsupported extension "${ext}". Accepted: .png, .jpg, .webp, .gif, .svg.`,
        };
      }
    }
  } else {
    // SVG — still validate extension matches
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
    if (ext !== ".svg") {
      return {
        valid: false,
        error: `SVG files must have a .svg extension (got "${ext}").`,
      };
    }
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
