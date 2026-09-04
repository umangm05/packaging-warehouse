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
