/**
 * Storage layer for designs — local-first with a documented seam for R2.
 *
 * The `DesignStorage` interface is the ONLY contract the app code depends on.
 * Swapping localStorage for Cloudflare R2 later means writing one new
 * implementation of this interface — no app code changes.
 *
 * R2 seam notes (for the future implementation):
 *   - list() becomes a ListObjectsV2 call filtered by prefix
 *   - load(id) becomes GetObject with key `designs/${id}.json`
 *   - save(doc) becomes PutObject with key `designs/${id}.json`
 *   - delete(id) becomes DeleteObject
 *   - rename / duplicate are composite: load + save + (delete for rename)
 *   - All R2 calls go through a small API route so the client never holds
 *     credentials. The route is the only thing that changes.
 */

import {
  type DesignDocument,
  type DesignSummary,
  toSummary,
} from "./designDocument";

export interface DesignStorage {
  /** List all saved designs (metadata only, no canvas state). */
  list(): Promise<DesignSummary[]>;
  /** Load a full design by id. */
  load(id: string): Promise<DesignDocument | null>;
  /** Save (insert or update) a design. */
  save(doc: DesignDocument): Promise<void>;
  /** Delete a design by id. */
  delete(id: string): Promise<void>;
  /** Rename a design (keeps the same id). */
  rename(id: string, newName: string): Promise<void>;
  /** Duplicate a design — returns the new design's id. */
  duplicate(id: string, newName: string): Promise<string>;
}

// ---------------------------------------------------------------------------
// localStorage implementation
// ---------------------------------------------------------------------------

const INDEX_KEY = "designer:designs:index";
const DOC_PREFIX = "designer:designs:doc:";

function readIndex(): string[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeIndex(ids: string[]): void {
  localStorage.setItem(INDEX_KEY, JSON.stringify(ids));
}

export const localStorageDesignStorage: DesignStorage = {
  async list(): Promise<DesignSummary[]> {
    const ids = readIndex();
    const summaries: DesignSummary[] = [];
    for (const id of ids) {
      const raw = localStorage.getItem(DOC_PREFIX + id);
      if (!raw) continue;
      try {
        const doc = JSON.parse(raw) as DesignDocument;
        summaries.push(toSummary(doc));
      } catch {
        // skip corrupt entries
      }
    }
    // newest first
    summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return summaries;
  },

  async load(id: string): Promise<DesignDocument | null> {
    const raw = localStorage.getItem(DOC_PREFIX + id);
    if (!raw) return null;
    return JSON.parse(raw) as DesignDocument;
  },

  async save(doc: DesignDocument): Promise<void> {
    localStorage.setItem(DOC_PREFIX + doc.id, JSON.stringify(doc));
    const ids = readIndex();
    if (!ids.includes(doc.id)) {
      ids.push(doc.id);
      writeIndex(ids);
    }
  },

  async delete(id: string): Promise<void> {
    localStorage.removeItem(DOC_PREFIX + id);
    const ids = readIndex().filter((x) => x !== id);
    writeIndex(ids);
  },

  async rename(id: string, newName: string): Promise<void> {
    const raw = localStorage.getItem(DOC_PREFIX + id);
    if (!raw) throw new Error(`Design ${id} not found`);
    const doc = JSON.parse(raw) as DesignDocument;
    doc.name = newName;
    doc.updatedAt = new Date().toISOString();
    localStorage.setItem(DOC_PREFIX + id, JSON.stringify(doc));
  },

  async duplicate(id: string, newName: string): Promise<string> {
    const raw = localStorage.getItem(DOC_PREFIX + id);
    if (!raw) throw new Error(`Design ${id} not found`);
    const original = JSON.parse(raw) as DesignDocument;
    const newId = `design_${Date.now().toString(36)}_${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    const now = new Date().toISOString();
    const copy: DesignDocument = {
      ...original,
      id: newId,
      name: newName,
      createdAt: now,
      updatedAt: now,
    };
    localStorage.setItem(DOC_PREFIX + newId, JSON.stringify(copy));
    const ids = readIndex();
    ids.push(newId);
    writeIndex(ids);
    return newId;
  },
};
