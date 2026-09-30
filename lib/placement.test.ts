import { describe, expect, it } from "vitest";
import type { FurnitureItem, LayoutItem, Obstacle } from "./schema";
import { solveLayout } from "./placement";
import { CM_TO_M } from "./placement";

interface Room {
  widthM: number;
  lengthM: number;
  heightM: number;
  obstacles: Obstacle[];
}

const ROOM: Room = { widthM: 3.7, lengthM: 4.3, heightM: 2.7, obstacles: [] };

function boxOf(item: LayoutItem) {
  const rad = (item.rotationDeg * Math.PI) / 180;
  const ca = Math.abs(Math.cos(rad));
  const sa = Math.abs(Math.sin(rad));
  const ex = ca * item.widthM + sa * item.depthM;
  const ez = sa * item.widthM + ca * item.depthM;
  return {
    minX: item.x - ex / 2,
    maxX: item.x + ex / 2,
    minZ: item.z - ez / 2,
    maxZ: item.z + ez / 2,
  };
}

function overlaps(a: ReturnType<typeof boxOf>, b: ReturnType<typeof boxOf>) {
  return a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;
}

function item(name: string, category: FurnitureItem["category"], opts: Partial<FurnitureItem> = {}): FurnitureItem {
  return {
    item: name,
    category,
    width: 160,
    depth: 200,
    height: 50,
    estimatedCostUSD: 500,
    placementNotes: "test",
    ...opts,
  };
}

describe("solveLayout", () => {
  it("places every item inside the room with no overlaps", () => {
    const result = solveLayout(
      [
        item("Bed", "Bed", { placement: { wallRef: "north", align: "center", offsetM: 0 } }),
        item("Nightstand", "Storage", {
          placement: { wallRef: "north", align: "left", offsetM: 0, adjacentTo: "Bed" },
        }),
        item("Rug", "Rug", { placement: { wallRef: "south", align: "left", offsetM: 0 } }),
      ],
      ROOM
    );

    expect(result.items).toHaveLength(3);
    for (const it of result.items) {
      const b = boxOf(it);
      expect(b.minX).toBeGreaterThanOrEqual(0);
      expect(b.maxX).toBeLessThanOrEqual(ROOM.widthM);
      expect(b.minZ).toBeGreaterThanOrEqual(0);
      expect(b.maxZ).toBeLessThanOrEqual(ROOM.lengthM);
    }
    for (let i = 0; i < result.items.length; i++) {
      for (let j = i + 1; j < result.items.length; j++) {
        expect(overlaps(boxOf(result.items[i]), boxOf(result.items[j]))).toBe(false);
      }
    }
  });

  it("never places furniture over a door obstacle (nudges or drops it)", () => {
    const door: Obstacle = {
      type: "door",
      wallRef: "north",
      offsetM: ROOM.widthM / 2,
      widthM: 3.0,
      swingClearanceM: 0.9,
    };
    const result = solveLayout(
      [item("Bed", "Bed", { placement: { wallRef: "north", align: "center", offsetM: 0 } })],
      { ...ROOM, obstacles: [door] }
    );

    const doorBox = { minX: 0.35, maxX: 3.35, minZ: 0, maxZ: 0.3 };
    for (const it of result.items) {
      expect(overlaps(boxOf(it), doorBox)).toBe(false);
    }
    expect(result.warnings.length).toBeGreaterThanOrEqual(0);
  });

  it("falls back to wall placement when a referenced item is missing", () => {
    const result = solveLayout(
      [item("Sofa", "Seating", { placement: { wallRef: "north", align: "center", offsetM: 0, adjacentTo: "Ghost" } })],
      ROOM
    );

    expect(result.items).toHaveLength(1);
    expect(result.warnings.some((w) => w.includes("Ghost"))).toBe(true);
  });

  it("trims oversized furniture to fit a tiny room", () => {
    const tiny: Room = { widthM: 2.0, lengthM: 2.0, heightM: 2.5, obstacles: [] };
    const result = solveLayout(
      [item("Sofa", "Seating", { width: 400, depth: 500, placement: { wallRef: "west", align: "center", offsetM: 0 } })],
      tiny
    );

    expect(result.items).toHaveLength(1);
    const placed = result.items[0];
    expect(placed.widthM).toBeLessThanOrEqual(tiny.widthM - 2 * 0.08);
    expect(placed.depthM).toBeLessThanOrEqual(tiny.lengthM - 2 * 0.08);
    expect(placed.widthM).toBeLessThan(400 * CM_TO_M);
  });

  it("keeps room-fitting items at their recommended size (not trimmed)", () => {
    const result = solveLayout(
      [item("Bed", "Bed", { width: 160, depth: 200, placement: { wallRef: "north", align: "center", offsetM: 0 } })],
      ROOM
    );

    expect(result.items).toHaveLength(1);
    const placed = result.items[0];
    expect(placed.widthM).toBeCloseTo(160 * CM_TO_M, 2);
    expect(placed.depthM).toBeCloseTo(200 * CM_TO_M, 2);
  });

  it("handles cyclic furniture references without recursing forever (regression)", () => {
    const a = item("Sofa", "Seating", {
      placement: { wallRef: "north", align: "center", offsetM: 0, adjacentTo: "Coffee Table" },
    });
    const b = item("Coffee Table", "Table", {
      placement: { wallRef: "south", align: "center", offsetM: 0, adjacentTo: "Sofa" },
    });

    expect(() => solveLayout([a, b], ROOM)).not.toThrow();
    const result = solveLayout([a, b], ROOM);
    expect(result.items).toHaveLength(2);
  });
});