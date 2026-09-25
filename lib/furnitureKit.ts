export interface FurnitureKitModel {
  file: string;
  keywords: string[];
  frontOffsetDeg?: number;
  fitMode?: "footprint" | "floor" | "ceiling";
}

export interface ModelKey {
  item: string;
  category: string;
}

export interface ResolvedModel {
  path: string;
  frontOffsetDeg: number;
  fitMode: "footprint" | "floor" | "ceiling";
}

export const CATEGORY_ALIASES: Record<string, string> = {
  Decor: "Plant",
  Other: "Electronics",
};

export const CATEGORY_DEFAULTS: Record<string, string> = {
  Seating: "loungeSofa",
  Table: "tableCoffee",
  Bed: "bedDouble",
  Storage: "bookcaseOpen",
  Lighting: "lampRoundFloor",
  Rug: "rugRectangle",
  Plant: "pottedPlant",
  Electronics: "televisionModern",
  Appliance: "kitchenFridge",
};

export const KIT_MODELS: Record<string, FurnitureKitModel> = {
  loungeSofa: { file: "loungeSofa.glb", keywords: ["sofa", "couch", "loveseat", "settee"] },
  loungeSofaCorner: {
    file: "loungeSofaCorner.glb",
    keywords: ["sectional", "corner sofa", "l shaped sofa", "l-shaped sofa"],
  },
  loungeSofaOttoman: {
    file: "loungeSofaOttoman.glb",
    keywords: ["ottoman", "pouf", "pouffe", "footstool", "footrest"],
  },
  loungeChair: {
    file: "loungeChair.glb",
    keywords: ["armchair", "accent chair", "lounge chair", "easy chair", "wing chair"],
  },
  loungeChairRelax: { file: "loungeChairRelax.glb", keywords: ["recliner", "chaise", "relax chair"] },
  chair: { file: "chair.glb", keywords: ["dining chair", "side chair", "chair"] },
  chairDesk: {
    file: "chairDesk.glb",
    keywords: ["desk chair", "office chair", "ergonomic chair", "study chair"],
  },
  stoolBar: { file: "stoolBar.glb", keywords: ["bar stool", "counter stool", "stool"] },
  table: { file: "table.glb", keywords: ["dining table", "dining"] },
  tableRound: { file: "tableRound.glb", keywords: ["round table", "circular table"] },
  tableCoffee: { file: "tableCoffee.glb", keywords: ["coffee table", "cocktail table"] },
  tableCoffeeSquare: { file: "tableCoffeeSquare.glb", keywords: ["square coffee table"] },
  sideTable: { file: "sideTable.glb", keywords: ["side table", "end table", "accent table"] },
  desk: { file: "desk.glb", keywords: ["desk", "workstation", "vanity"] },
  bookcaseOpen: {
    file: "bookcaseOpen.glb",
    keywords: ["bookshelf", "bookcase", "shelving", "book shelf", "shelf"],
  },
  bookcaseClosed: {
    file: "bookcaseClosed.glb",
    keywords: ["hutch", "credenza", "buffet", "closed cabinet"],
  },
  cabinetTelevision: {
    file: "cabinetTelevision.glb",
    keywords: ["tv stand", "tv cabinet", "media console", "media unit", "entertainment center"],
  },
  sideTableDrawers: {
    file: "sideTableDrawers.glb",
    keywords: ["nightstand", "night stand", "dresser", "chest of drawers", "drawer", "bureau"],
  },
  cabinetBedDrawer: { file: "cabinetBedDrawer.glb", keywords: ["storage bed", "bed drawer"] },
  bedSingle: { file: "bedSingle.glb", keywords: ["single bed", "twin bed", "bunk bed", "cot"] },
  bedDouble: { file: "bedDouble.glb", keywords: ["bed", "mattress", "queen", "king"] },
  lampRoundFloor: {
    file: "lampRoundFloor.glb",
    keywords: ["floor lamp", "standing lamp", "tall lamp"],
  },
  lampSquareFloor: { file: "lampSquareFloor.glb", keywords: ["square floor lamp"] },
  lampRoundTable: {
    file: "lampRoundTable.glb",
    keywords: ["table lamp", "bedside lamp", "desk lamp", "night lamp"],
  },
  lampWall: { file: "lampWall.glb", keywords: ["wall lamp", "sconce", "wall light"] },
  lampSquareCeiling: {
    file: "lampSquareCeiling.glb",
    keywords: ["ceiling light", "ceiling lamp", "flush mount", "overhead light", "pendant"],
    fitMode: "ceiling",
  },
  rugRectangle: {
    file: "rugRectangle.glb",
    keywords: ["rug", "carpet", "runner", "floor mat"],
    fitMode: "floor",
  },
  rugRound: { file: "rugRound.glb", keywords: ["round rug", "circular rug"], fitMode: "floor" },
  pottedPlant: { file: "pottedPlant.glb", keywords: ["potted plant", "plant", "houseplant"] },
  plantSmall1: { file: "plantSmall1.glb", keywords: ["succulent", "small plant", "cactus"] },
  plantSmall2: { file: "plantSmall2.glb", keywords: ["aloe", "snake plant"] },
  pillow: { file: "pillow.glb", keywords: ["throw pillow", "cushion", "decorative pillow", "pillow"] },
  books: { file: "books.glb", keywords: ["book", "books"] },
  televisionModern: { file: "televisionModern.glb", keywords: ["television", "flat screen", "tv"] },
  computerScreen: { file: "computerScreen.glb", keywords: ["monitor", "computer", "pc", "desktop", "screen"] },
  radio: { file: "radio.glb", keywords: ["radio", "stereo", "boombox", "music player"] },
  speaker: { file: "speaker.glb", keywords: ["speaker", "soundbar", "audio"] },
  laptop: { file: "laptop.glb", keywords: ["laptop", "notebook"] },
  kitchenFridge: { file: "kitchenFridge.glb", keywords: ["fridge", "refrigerator", "freezer"] },
  kitchenStove: { file: "kitchenStove.glb", keywords: ["stove", "oven", "range", "cooktop"] },
  kitchenMicrowave: { file: "kitchenMicrowave.glb", keywords: ["microwave"] },
  toaster: { file: "toaster.glb", keywords: ["toaster"] },
};

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toResolved(model: FurnitureKitModel): ResolvedModel {
  return {
    path: `/models/furniture/${model.file}`,
    frontOffsetDeg: model.frontOffsetDeg ?? 0,
    fitMode: model.fitMode ?? "footprint",
  };
}

export function resolveModel(key: ModelKey): ResolvedModel | undefined {
  const name = normalizeName(key.item);
  let best: { score: number; model: FurnitureKitModel } | undefined;
  for (const model of Object.values(KIT_MODELS)) {
    for (const keyword of model.keywords) {
      const nkw = normalizeName(keyword);
      if (nkw.length > 0 && name.includes(nkw) && (!best || nkw.length > best.score)) {
        best = { score: nkw.length, model };
      }
    }
  }
  if (best) return toResolved(best.model);

  const canonical = CATEGORY_ALIASES[key.category] ?? key.category;
  const fallback = CATEGORY_DEFAULTS[canonical];
  const model = fallback ? KIT_MODELS[fallback] : undefined;
  return model ? toResolved(model) : undefined;
}

export function canonicalCategory(category: string): string {
  return CATEGORY_ALIASES[category] ?? category;
}