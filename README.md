# Packaging Warehouse

A **white-label 3D packaging preview** tool (pacdora-style): upload a logo / artwork,
set box dimensions, and see it rendered live on a parametric 3D folding-carton box.

> **Status: P1 multi-face artwork.** Front and back as separate uploads, master panel
> inheritance for remaining faces, per-face crop tool, and independent per-face scale/crop.

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

## What the P1 multi-face feature ships

1. **Front and back as separate artwork uploads** — distinct images for the two primary print panels.
2. **Master panel inheritance** — remaining faces (left, right, top, bottom) inherit a master
   panel by default, with a per-face override toggle for unique artwork.
3. **Per-face crop tool** — drag-to-crop any region of an uploaded image and place that region
   on the chosen box face.
4. **Different cuts per face** — crop and scale are independent per face.
5. **Clear face selector/indicator** — six face buttons with orientation icons and a dot
   indicator when a face has custom artwork.

## Verified

- `npm run build` passes clean.
- Distinct front and back artwork both render on their correct faces.
- Sides inherit the master panel; overriding one face leaves the others unchanged.
- Cropping a region shows only that region on the box face.
- Per-face scale slider adjusts artwork size independently.

## Architecture notes

The core reusable asset is the **dieline layout** in [`src/lib/box.ts`](src/lib/box.ts):
a single layout function (`computeLayout`) produces per-face UV sub-rectangles on one
shared atlas texture. `remapBoxUVs` applies them to the `BoxGeometry` material groups;
`drawAtlas` paints the neutral panels and per-face artwork (with crop + scale) onto each
face. Every future product type (container, sachet) follows the same pattern — author UV
regions once, map artwork onto them.

State lives in [`src/store/box.ts`](src/store/box.ts): a master panel (image + crop + scale)
and a `faces[]` array with per-face `{ image, crop, scale, useOverride }`. The 3D scene in
[`src/components/BoxScene.tsx`](src/components/BoxScene.tsx) decodes each face's image
asynchronously and rebuilds the atlas texture whenever any face changes.

### P1 scope guardrails (deliberately deferred)

- Fabric.js-style crop/resize/rotate editor (we use a simpler drag-to-crop)
- Sachet / container geometry
- Material presets & super-render export
- Dieline (Mode B) full-flat mapping
- Accounts / cloud saving

See the research briefs under `common/projects/3d-packaging-preview/` for the full plan.
