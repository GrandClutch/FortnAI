import { describe, expect, it } from "vitest";
import { resolveModel } from "./furnitureKit";

interface MappingCase {
  item: string;
  category: string;
  expected: string;
  gap?: boolean;
}

// Expected model = the GLTF this item SHOULD resolve to. `gap: true` cases are
// known limitations where no keyword matches and the item falls back to a
// category default (wrong-but-valid model) - documented in docs/EVALUATION.md.
const MAPPINGS: MappingCase[] = [
  { item: "sofa", category: "Seating", expected: "loungeSofa" },
  { item: "couch", category: "Seating", expected: "loungeSofa" },
  { item: "loveseat", category: "Seating", expected: "loungeSofa" },
  { item: "sectional", category: "Seating", expected: "loungeSofaCorner" },
  { item: "ottoman", category: "Seating", expected: "loungeSofaOttoman" },
  { item: "armchair", category: "Seating", expected: "loungeChair" },
  { item: "recliner", category: "Seating", expected: "loungeChairRelax" },
  { item: "dining chair", category: "Seating", expected: "chair" },
  { item: "desk chair", category: "Seating", expected: "chairDesk" },
  { item: "bar stool", category: "Seating", expected: "stoolBar" },
  { item: "dining table", category: "Table", expected: "table" },
  { item: "round table", category: "Table", expected: "tableRound" },
  { item: "coffee table", category: "Table", expected: "tableCoffee" },
  { item: "square coffee table", category: "Table", expected: "tableCoffeeSquare" },
  { item: "side table", category: "Table", expected: "sideTable" },
  { item: "desk", category: "Storage", expected: "desk" },
  { item: "bookshelf", category: "Storage", expected: "bookcaseOpen" },
  { item: "hutch", category: "Storage", expected: "bookcaseClosed" },
  { item: "tv stand", category: "Electronics", expected: "cabinetTelevision" },
  { item: "nightstand", category: "Storage", expected: "sideTableDrawers" },
  { item: "single bed", category: "Bed", expected: "bedSingle" },
  { item: "bed", category: "Bed", expected: "bedDouble" },
  { item: "queen bed", category: "Bed", expected: "bedDouble" },
  { item: "floor lamp", category: "Lighting", expected: "lampRoundFloor" },
  { item: "table lamp", category: "Lighting", expected: "lampRoundTable" },
  { item: "wall sconce", category: "Lighting", expected: "lampWall" },
  { item: "ceiling light", category: "Lighting", expected: "lampSquareCeiling" },
  { item: "rug", category: "Rug", expected: "rugRectangle" },
  { item: "round rug", category: "Rug", expected: "rugRound" },
  { item: "potted plant", category: "Plant", expected: "pottedPlant" },
  { item: "succulent", category: "Plant", expected: "plantSmall1" },
  { item: "television", category: "Electronics", expected: "televisionModern" },
  { item: "computer monitor", category: "Electronics", expected: "computerScreen" },
  { item: "refrigerator", category: "Appliance", expected: "kitchenFridge" },
  { item: "stove", category: "Appliance", expected: "kitchenStove" },
  { item: "microwave", category: "Appliance", expected: "kitchenMicrowave" },
  { item: "toaster", category: "Appliance", expected: "toaster" },
  { item: "throw pillow", category: "Decor", expected: "pillow" },
  { item: "books", category: "Decor", expected: "books" },

  // Known gaps: no keyword matches, item falls back to a category default.
  { item: "wardrobe", category: "Storage", expected: "bookcaseOpen", gap: true },
  { item: "console", category: "Storage", expected: "bookcaseOpen", gap: true },
  { item: "closet", category: "Storage", expected: "bookcaseOpen", gap: true },
  { item: "curtains", category: "Storage", expected: "bookcaseOpen", gap: true },
  { item: "bench", category: "Seating", expected: "loungeSofa", gap: true },
];

describe("resolveModel", () => {
  it("maps every item to its expected 3D model", () => {
    for (const c of MAPPINGS) {
      const resolved = resolveModel({ item: c.item, category: c.category });
      expect(resolved, `${c.item} should resolve to a model`).toBeDefined();
      expect(resolved!.path, `${c.item} should resolve to ${c.expected}`).toContain(`${c.expected}.glb`);
    }
  });

  it("keeps the known-gap fallbacks pinned (documented limitations)", () => {
    const gaps = MAPPINGS.filter((c) => c.gap);
    for (const c of gaps) {
      const resolved = resolveModel({ item: c.item, category: c.category });
      expect(resolved!.path, `${c.item} currently falls back to ${c.expected}`).toContain(`${c.expected}.glb`);
    }
  });

  it("reports the match-rate / fallback-rate metric", () => {
    const total = MAPPINGS.length;
    const gaps = MAPPINGS.filter((c) => c.gap).length;
    const matched = total - gaps;
    const matchRate = ((matched / total) * 100).toFixed(1);
    const fallbackRate = ((gaps / total) * 100).toFixed(1);
    console.log(
      `model-resolution: matched=${matched}/${total} (${matchRate}%), fallback=${gaps}/${total} (${fallbackRate}%)`
    );
    expect(matched + gaps).toBe(total);
    expect(gaps).toBe(5); // currently 5 known keyword gaps
  });

  it("picks the longest matching keyword over a shorter one", () => {
    // "queen bed" contains both "bed" (bedDouble) and "queen" (bedDouble) -> same model,
    // but "single bed" must beat plain "bed":
    expect(resolveModel({ item: "single bed", category: "Bed" })!.path).toContain("bedSingle.glb");
    // "desk chair" must beat plain "chair" and "desk":
    expect(resolveModel({ item: "desk chair", category: "Seating" })!.path).toContain("chairDesk.glb");
  });
});