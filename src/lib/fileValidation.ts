// Shared file validation for packaging-warehouse image uploads.
// Single source of truth for drag-drop AND file-picker paths.

export const ACCEPTED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/avif",
] as const;

export const ACCEPTED_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif"] as const;

/** 50 MB — generous headroom for print-quality artwork. */
export const FILE_SIZE_LIMIT_BYTES = 50 * 1024 * 1024;

export const ACCEPT_STRING = ACCEPTED_MIME_TYPES.join(",");

export interface FileValidationResult {
  valid: boolean;
  error: string | null;
}

export interface ImageResolution {
  width: number;
  height: number;
}

export interface ImageFileInfo extends ImageResolution {
  fileSize: number;
}

/**
 * Validate a file for upload. Checks MIME type (with extension fallback)
 * and size limit. Used by BOTH the drop handler and the file-picker
 * change handler so behavior is identical across every input path.
 */
export function validateFile(file: File): FileValidationResult {
  if (file.type) {
    if (!ACCEPTED_MIME_TYPES.includes(file.type as (typeof ACCEPTED_MIME_TYPES)[number])) {
      return {
        valid: false,
        error: `Unsupported type "${file.type}". Accepted: PNG, JPG, WEBP, GIF, AVIF.`,
      };
    }
  } else {
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
    if (!ext || !ACCEPTED_EXTENSIONS.includes(ext as (typeof ACCEPTED_EXTENSIONS)[number])) {
      return {
        valid: false,
        error: `Unsupported extension "${ext || "?"}". Accepted: .png, .jpg, .webp, .gif, .avif.`,
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

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Pixel dimension recommended for crisp print at the given DPI.
 * mm -> inches -> pixels, rounded up.
 */
export function recommendedPixels(boxMM: number, dpi = 300): number {
  return Math.ceil((boxMM / 25.4) * dpi);
}

export function resolutionLabel(info: ImageResolution): string {
  return `${info.width} × ${info.height} px`;
}
