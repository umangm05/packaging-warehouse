# Packaging Warehouse

A **white-label 3D packaging preview** tool (pacdora-style): upload a logo / artwork,
set box dimensions, and see it rendered live on a parametric 3D folding-carton box.

> **Status: P0 spike.** Proves the riskiest assumption — *upload → live wrap on a
> parametric 3D box with per-face UV remap* — before the full MVP.

## Stack

- **Next.js 16 + TypeScript** — app shell
- **React Three Fiber + Drei** — declarative 3D scene, orbit controls, environment lighting
- **Zustand** — lightweight scene state (no context re-render storms)
- **Three.js** — geometry + UV remapping

## Run

```bash
npm install
npm run dev      # http://localhost:3000
```

Production build:

```bash
npm run build
npm start
```

## What the P0 proves

1. Upload a PNG/JPG/WEBP logo (drag-and-drop or click).
2. See it **cover-fitted onto the front panel** of a folding-carton box in real time.
3. Change **Width × Depth × Height** (mm) — the mesh rebuilds and each face's UVs
   **remap live** so artwork lands on the correct face without distortion.
4. **Orbit / zoom** to inspect every panel; toggle UV guide outlines.

## Vector Designer (S1 — canvas & unit model)

A 2D vector design tool living alongside the 3D box preview at [`/designer`](src/app/designer/page.tsx).
Compose arbitrary-size canvases from shapes, text, images, and backgrounds — then export
print-ready vector SVG + PDF (CorelDRAW interchange) and raster PNG/JPG at 300/600 DPI.

> **Status: S1 shipped** — route, canvas, unit model, viewport. S2-S8 follow the chain
> in the [working notes](#) (shapes → text → images → export → raster editing → save → hardening).

### Run

```bash
npm install
npm run dev      # http://localhost:3000/designer
```

### What S1 ships

1. **`/designer` route** — toolbar, SVG canvas viewport, side-panel skeleton.
2. **Arbitrary-size canvas** — any physical size in mm/cm/in/px, no maximum enforced.
   Unit switching (mm↔cm↔in↔px) preserves physical size exactly.
3. **Viewport** — fit-to-view, percent zoom (scroll / ± buttons), pan (Alt+drag),
   live mm cursor readout, default 210×297 mm canvas, "change canvas size" control.
4. **Zustand designer store** (`src/store/designer.ts`) — separate from the 3D box store.
5. **Unit engine** (`src/lib/units.ts`) — mm-canonical conversions with zero round-trip error.

### Design decisions

- **Vector output = SVG + PDF.** CorelDRAW's native `.cdr` cannot be produced outside
  CorelDRAW; SVG is its interchange format. Text always exports as outlines (curves), so
  fonts never substitute on another machine.
- **sRGB emission.** The tool works in sRGB; CMYK conversion stays downstream (the print
  shop's RIP handles it). This keeps the pipeline simple and the on-screen preview honest.
- **DPI-aware px.** The px unit is derived from mm via the document DPI (default 300),
  so "100 px" means a real physical length, not a screen pixel.

### Verified

- `npm run build` passes clean; `/designer` renders with no console errors.
- 24100 × 610 mm canvas renders and reports exact dimensions (284646 × 7205 px @300).
- 100 × 150 mm canvas renders and reports exact dimensions.
- Unit switch mm→in→px preserves physical size (round-trip error = 0).

## Export (v1 — PNG + PDF)

The 3D box preview can leave the app as two distinct deliverables:

### PNG — live 3D capture (client/WhatsApp preview)
Captures the **live 3D canvas** at selectable resolution and background:

| Option | Values |
|--------|--------|
| Resolution | `1×` · `2×` · `4×` (multiplier on current canvas buffer) |
| Background | `transparent` · `studio` (matches `#101318`) · `white` |

- Implemented in [`src/lib/export.ts`](src/lib/export.ts) → `captureLivePNG()`.
- Temporarily bumps the renderer pixel ratio, renders once, grabs the buffer, restores.
- Triggered from `BoxScene.tsx`'s `onCreated` callback, which exposes `gl`, `scene`, `camera` to the parent via `useImperativeHandle`.

### PDF — front face at physical dimensions (print brief)
Produces a **print-shaped PDF** whose page size equals the box's front face (L × H mm):

| Option | Values |
|--------|--------|
| DPI | `150` · `300` |

- Front face pixel size: `(L × DPI / 25.4) × (H × DPI / 25.4)`.
- Page size in PDF points: `(L × 72/25.4) × (H × 72/25.4)`.
- Implemented in [`src/lib/export.ts`](src/lib/export.ts) → `drawFrontCanvas()` + `generatePDF()` (pdf-lib).
- Artwork is cover-fitted onto the front face before embedding.

### Deterministic filename
```
box-L{l}xW{w}xH{h}-{ISO-timestamp}.{ext}
# e.g. box-L240xW160xH90-2026-09-12T08-44-16.pdf
```

### UI
The **Export** section in the right sidebar (`src/app/page.tsx`) provides:
- Format toggle (PNG / PDF)
- Format-specific options (resolution + background / DPI)
- Download button with deterministic filename

### Verification
```bash
npm run build    # must pass clean
# Open http://localhost:3000 → click "Download PNG" / "Download PDF"
```

Evidence artifacts committed under `test-artifacts/`:
- `box-L240xW160xH90-sample.png` — front face at 150 DPI (1417 × 531 px)
- `box-L240xW160xH90-sample.pdf` — page = 680.31 × 255.12 pt (= 240 × 90 mm)
- `box-L240xW160xH90-2026-09-12T08-44-16.pdf` — browser-exported PDF (verified 240 × 90 mm)
- `live-box-snapshot.png` — browser-exported live 3D capture (960 × 584 px)

> **Scope guard (v1):** Shareable link is deferred to v2. Import formats (SVG, AI, etc.)
> are a separate task (`PKG3D-V1-IMPORT-20260912`). This task covers export only.

## Architecture notes

The core reusable asset is the **dieline layout** in [`src/lib/box.ts`](src/lib/box.ts):
a single layout function (`computeLayout`) produces per-face UV sub-rectangles on one
shared atlas texture. `remapBoxUVs` applies them to the `BoxGeometry` material groups;
`drawAtlas` paints the neutral panels and cover-fits artwork onto the front face. Every
future product type (container, sachet) follows the same pattern — author UV regions once,
map artwork onto them.

### P0 scope guardrails (deliberately deferred)

- Fabric.js crop/resize/rotate editor
- Sachet / container geometry
- Material presets & super-render export
- Dieline (Mode B) full-flat mapping
- Accounts / cloud saving

See the research briefs under `common/projects/3d-packaging-preview/` for the full plan.
