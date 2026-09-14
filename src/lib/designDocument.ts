/**
 * DesignDocument — the serialisable, versioned unit of persistence.
 *
 * Schema version lets us evolve the document format without breaking old
 * files. Bump SCHEMA_VERSION when the shape changes; migration helpers go
 * below.
 */

export const SCHEMA_VERSION = 1;

/** A single saved design — the full canvas state plus metadata. */
export interface DesignDocument {
  schemaVersion: number;
  id: string;
  name: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601

  // --- canvas state ---
  widthMm: number;
  heightMm: number;
  unit: string;
  dpi: number;
  background: unknown;
  objects: unknown[];
}

/** Metadata only — used for the design list (no heavy canvas state). */
export interface DesignSummary {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  schemaVersion: number;
}

/** Wrap current canvas state into a DesignDocument. */
export function createDesignDocument(params: {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
  unit: string;
  dpi: number;
  background: unknown;
  objects: unknown[];
}): DesignDocument {
  const now = new Date().toISOString();
  return {
    schemaVersion: SCHEMA_VERSION,
    id: params.id,
    name: params.name,
    createdAt: now,
    updatedAt: now,
    widthMm: params.widthMm,
    heightMm: params.heightMm,
    unit: params.unit,
    dpi: params.dpi,
    background: params.background,
    objects: params.objects,
  };
}

/** Return true if the document schema version is one we can read. */
export function isReadableSchema(doc: DesignDocument): boolean {
  return doc.schemaVersion === SCHEMA_VERSION;
}

/** Serialise a document to a JSON string (pretty-printed for diffability). */
export function serializeDesign(doc: DesignDocument): string {
  return JSON.stringify(doc, null, 2);
}

/** Parse a JSON string into a DesignDocument, validating the shape. */
export function deserializeDesign(json: string): DesignDocument {
  const parsed = JSON.parse(json) as DesignDocument;
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof parsed.id !== "string" ||
    typeof parsed.name !== "string" ||
    typeof parsed.schemaVersion !== "number" ||
    !Array.isArray(parsed.objects)
  ) {
    throw new Error("Invalid design document: missing required fields");
  }
  if (!isReadableSchema(parsed)) {
    throw new Error(
      `Unsupported schema version ${parsed.schemaVersion} (expected ${SCHEMA_VERSION})`
    );
  }
  return parsed;
}

/** Strip canvas state to produce a lightweight summary. */
export function toSummary(doc: DesignDocument): DesignSummary {
  return {
    id: doc.id,
    name: doc.name,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    schemaVersion: doc.schemaVersion,
  };
}

/** Generate a unique design id. */
export function generateDesignId(): string {
  return `design_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}
