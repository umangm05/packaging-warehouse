"use client";

import { CanvasStage } from "@/components/designer/CanvasStage";
import { DesignerToolbar } from "@/components/designer/DesignerToolbar";
import { DesignerSidePanel } from "@/components/designer/DesignerSidePanel";
import { DesignerStatusBar } from "@/components/designer/DesignerStatusBar";

/**
 * The Vector Designer shell.
 *
 * Layout:
 *   ┌─────────────────────────────────────┐
 *   │            Toolbar                   │
 *   ├──────────────────────┬──────────────┤
 *   │                      │  Side panel  │
 *   │    Canvas stage      │  (props /    │
 *   │    (SVG)             │   layers)    │
 *   │                      │              │
 *   ├──────────────────────┴──────────────┤
 *   │            Status bar                │
 *   └─────────────────────────────────────┘
 *
 * S1 ships the shell + canvas + unit model. S2-S8 fill the panel and toolbar.
 */
export function Designer() {
  return (
    <main className="flex h-screen w-screen flex-col overflow-hidden bg-neutral-950 font-sans text-neutral-100">
      <DesignerToolbar />

      <div className="flex min-h-0 flex-1">
        <section className="relative min-w-0 flex-1">
          <CanvasStage />
        </section>
        <DesignerSidePanel />
      </div>

      <DesignerStatusBar />
    </main>
  );
}
