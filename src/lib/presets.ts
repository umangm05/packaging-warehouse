/**
 * Generic box presets — Pacdora-style product types.
 *
 * Each preset sets a sensible default L×W/H and a real-world use label.
 * Every preset stays fully resizable via the shared DimField sliders;
 * the preset is a starting shape, not a locked mode.
 *
 * Dimensions are millimetres. No brand-specific values — these are
 * industry-standard packaging types.
 */

export interface BoxPreset {
  id: string;
  name: string;
  useCase: string;
  defaultL: number;
  defaultW: number;
  defaultH: number;
}

export const BOX_PRESETS: BoxPreset[] = [
  {
    id: "mailer",
    name: "Mailer Box",
    useCase: "E-commerce shipping — corrugated, tuck-front closure",
    defaultL: 200,
    defaultW: 150,
    defaultH: 80,
  },
  {
    id: "rigid",
    name: "Rigid Setup Box",
    useCase: "Luxury gift / cosmetics — thick walls, lift-off lid",
    defaultL: 120,
    defaultW: 80,
    defaultH: 60,
  },
  {
    id: "folding-carton",
    name: "Folding Carton",
    useCase: "Retail shelf product — cereal, snacks, small electronics",
    defaultL: 100,
    defaultW: 100,
    defaultH: 40,
  },
  {
    id: "flat-pouch",
    name: "Flat Pouch / Sachet",
    useCase: "Sample pouches, flat-pack inserts, slim mailers",
    defaultL: 180,
    defaultW: 120,
    defaultH: 15,
  },
  {
    id: "long-tube",
    name: "Long Box / Tube",
    useCase: "Wine bottles, posters, elongated items",
    defaultL: 300,
    defaultW: 60,
    defaultH: 60,
  },
];

export const DEFAULT_PRESET_ID = BOX_PRESETS[0].id;
