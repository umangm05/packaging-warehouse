"use client";

import { useEffect, useRef } from "react";
import { useDesignerStore } from "@/store/designer";

/**
 * Autosave hook — saves the current design to localStorage on every change.
 *
 * - Debounced 500ms so we don't write on every mouse move during a drag.
 * - On mount, restores the last-opened design if one exists.
 * - Refreshes the design list on mount.
 */
export function useAutosave() {
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRestoring = useRef(true);

  // Subscribe to state changes for autosave
  const objects = useDesignerStore((s) => s.objects);
  const background = useDesignerStore((s) => s.background);
  const widthMm = useDesignerStore((s) => s.widthMm);
  const heightMm = useDesignerStore((s) => s.heightMm);
  const unit = useDesignerStore((s) => s.unit);
  const dpi = useDesignerStore((s) => s.dpi);
  const currentDesignId = useDesignerStore((s) => s.currentDesignId);
  const currentDesignName = useDesignerStore((s) => s.currentDesignName);
  const saveDesign = useDesignerStore((s) => s.saveDesign);
  const openDesign = useDesignerStore((s) => s.openDesign);
  const refreshDesignList = useDesignerStore((s) => s.refreshDesignList);

  // Restore on mount
  useEffect(() => {
    const restore = async () => {
      try {
        const lastId = localStorage.getItem("designer:last-open");
        if (lastId) {
          await openDesign(lastId);
        }
        await refreshDesignList();
      } finally {
        // Mark restoration complete after a tick so the first autosave
        // doesn't immediately overwrite with the just-restored state
        setTimeout(() => {
          isRestoring.current = false;
        }, 100);
      }
    };
    restore();
  }, [openDesign, refreshDesignList]);

  // Track the last-open id
  useEffect(() => {
    if (currentDesignId) {
      localStorage.setItem("designer:last-open", currentDesignId);
    }
  }, [currentDesignId]);

  // Autosave on state changes (debounced)
  useEffect(() => {
    if (isRestoring.current) return;

    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
    }
    saveTimer.current = setTimeout(async () => {
      await saveDesign();
    }, 500);

    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }
    };
  }, [objects, background, widthMm, heightMm, unit, dpi, currentDesignName, saveDesign]);
}
