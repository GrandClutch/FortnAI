import type { FurnitureItem, FurniturePlacement, LayoutItem, Obstacle } from "@/lib/schema";

const IN_TO_FT = 1 / 12;
const WALL_GAP_FT = 0.25;
const ITEM_GAP_FT = 0.5;
const NUDGE_STEP_FT = 0.5;
const MAX_NUDGE_TRIES = 24;
const OBSTACLE_DEPTH_FT = 1.0;

type WallRef = "north" | "south" | "east" | "west";
type Axis = "x" | "z";
type Align = "left" | "center" | "right";

interface RoomInput {
  widthFt: number;
  lengthFt: number;
  heightFt: number;
  obstacles: Obstacle[];
}

interface Resolved {
  item: LayoutItem;
  along: number;
  axis: Axis;
  into: number;
  sw: number;
  sr: number;
}

interface AABB {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

interface SwingCircle {
  cx: number;
  cz: number;
  r: number;
}

export interface SolveResult {
  items: LayoutItem[];
  warnings: string[];
}

const DEFAULT_WALLS: WallRef[] = ["north", "south", "east", "west"];

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function normalizeRotation(deg: number | undefined): number {
  const d = Math.round(((deg ?? 0) % 360) / 90) * 90;
  return d === 270 ? 90 : d;
}

function rectOverlap(a: AABB, b: AABB): boolean {
  return a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;
}

function circleRectOverlap(c: SwingCircle, r: AABB): boolean {
  const px = clamp(c.cx, r.minX, r.maxX);
  const pz = clamp(c.cz, r.minZ, r.maxZ);
  const dx = c.cx - px;
  const dz = c.cz - pz;
  return dx * dx + dz * dz <= c.r * c.r;
}

function toAABB(r: Resolved): AABB {
  if (r.axis === "x") {
    return { minX: r.along - r.sw / 2, maxX: r.along + r.sw / 2, minZ: r.into - r.sr / 2, maxZ: r.into + r.sr / 2 };
  }
  return { minX: r.into - r.sr / 2, maxX: r.into + r.sr / 2, minZ: r.along - r.sw / 2, maxZ: r.along + r.sw / 2 };
}

function obstacleGeometry(o: Obstacle, widthFt: number, lengthFt: number): { aabb: AABB; swing?: SwingCircle } {
  const w = o.widthFt;
  const cx = o.wallRef === "north" || o.wallRef === "south" ? clamp(o.offsetFt, 0, widthFt) : clamp(o.offsetFt, 0, lengthFt);
  let aabb: AABB;
  switch (o.wallRef) {
    case "north":
      aabb = { minX: cx - w / 2, maxX: cx + w / 2, minZ: 0, maxZ: OBSTACLE_DEPTH_FT };
      break;
    case "south":
      aabb = { minX: cx - w / 2, maxX: cx + w / 2, minZ: lengthFt - OBSTACLE_DEPTH_FT, maxZ: lengthFt };
      break;
    case "west":
      aabb = { minX: 0, maxX: OBSTACLE_DEPTH_FT, minZ: cx - w / 2, maxZ: cx + w / 2 };
      break;
    case "east":
      aabb = { minX: widthFt - OBSTACLE_DEPTH_FT, maxX: widthFt, minZ: cx - w / 2, maxZ: cx + w / 2 };
      break;
  }
  const swing =
    o.type === "door" && o.swingClearanceFt
      ? {
          cx: o.wallRef === "north" || o.wallRef === "south" ? cx : o.wallRef === "west" ? 0 : widthFt,
          cz: o.wallRef === "east" || o.wallRef === "west" ? cx : o.wallRef === "north" ? 0 : lengthFt,
          r: o.swingClearanceFt,
        }
      : undefined;
  return { aabb, swing };
}

function anchorAlong(wall: WallRef, align: Align, run: number): number {
  if (align === "left") return 0;
  if (align === "right") return run;
  return run / 2;
}

function defaultPlacement(index: number): FurniturePlacement {
  return {
    wallRef: DEFAULT_WALLS[index % DEFAULT_WALLS.length],
    align: "center",
    offsetFt: 0,
  };
}

function resolveItem(
  furniture: FurnitureItem,
  index: number,
  room: RoomInput,
  resolved: Resolved[],
  obstacles: { aabb: AABB; swing?: SwingCircle }[]
): Resolved {
  const placement = furniture.placement ?? defaultPlacement(index);
  const wall: WallRef = placement.wallRef ?? defaultPlacement(index).wallRef;
  const align: Align = placement.align ?? "center";
  const rot = normalizeRotation(placement.rotationDeg);

  let sw = Math.max(0.5, furniture.width * IN_TO_FT);
  let sr = Math.max(0.5, furniture.depth * IN_TO_FT);
  const height = Math.max(0.1, furniture.height * IN_TO_FT);
  if (rot === 90) [sw, sr] = [sr, sw];

  const onNorthSouth = wall === "north" || wall === "south";
  const alongRun = onNorthSouth ? room.widthFt : room.lengthFt;
  const intoRun = onNorthSouth ? room.lengthFt : room.widthFt;

  sw = Math.min(sw, alongRun - 2 * WALL_GAP_FT);
  sr = Math.min(sr, intoRun - 2 * WALL_GAP_FT);

  const axis: Axis = onNorthSouth ? "x" : "z";
  const anchor = anchorAlong(wall, align, alongRun);

  let along: number;
  const adjacentTarget = placement.adjacentTo
    ? resolved.find((r) => r.item.item.toLowerCase() === placement.adjacentTo!.toLowerCase())
    : undefined;

  if (adjacentTarget) {
    const sign = placement.offsetFt >= 0 ? 1 : -1;
    along = adjacentTarget.along + sign * (adjacentTarget.sw / 2 + sw / 2 + ITEM_GAP_FT);
  } else {
    along = anchor + placement.offsetFt;
  }

  const into =
    wall === "north"
      ? sr / 2 + WALL_GAP_FT
      : wall === "south"
        ? room.lengthFt - sr / 2 - WALL_GAP_FT
        : wall === "west"
          ? sr / 2 + WALL_GAP_FT
          : room.widthFt - sr / 2 - WALL_GAP_FT;

  const base: Resolved = {
    item: {
      itemId: `item-${index}`,
      item: furniture.item,
      category: furniture.category,
      x: 0,
      z: 0,
      rotationDeg: rot,
      widthFt: sw,
      depthFt: sr,
      heightFt: height,
      estimatedCostUSD: furniture.estimatedCostUSD,
      placementNotes: furniture.placementNotes,
    },
    along,
    axis,
    into,
    sw,
    sr,
  };

  const collidesAt = (candidateAlong: number, candidateInto: number): boolean => {
    const probe: Resolved = { ...base, along: candidateAlong, into: candidateInto };
    const box = toAABB(probe);
    if (resolved.some((r) => rectOverlap(box, toAABB(r)))) return true;
    return obstacles.some((o) => rectOverlap(box, o.aabb) || (o.swing ? circleRectOverlap(o.swing, box) : false));
  };

  if (collidesAt(along, into)) {
    let fixed = false;
    for (let t = 1; t <= MAX_NUDGE_TRIES && !fixed; t++) {
      for (const dir of [1, -1]) {
        const candidate = clamp(along + dir * NUDGE_STEP_FT * t, sw / 2 + WALL_GAP_FT, alongRun - sw / 2 - WALL_GAP_FT);
        if (!collidesAt(candidate, into)) {
          along = candidate;
          fixed = true;
          break;
        }
      }
    }
    base.item.status = fixed ? "ok" : "overlap";
  }

  const x = axis === "x" ? along : into;
  const z = axis === "x" ? into : along;
  base.item.x = Math.round(x * 100) / 100;
  base.item.z = Math.round(z * 100) / 100;
  base.along = along;
  base.into = into;
  return base;
}

export function solveLayout(furniture: FurnitureItem[], room: RoomInput): SolveResult {
  const warnings: string[] = [];
  const obstacles = room.obstacles.map((o) => obstacleGeometry(o, room.widthFt, room.lengthFt));

  const resolved: Resolved[] = [];
  for (let i = 0; i < furniture.length; i++) {
    const r = resolveItem(furniture[i], i, room, resolved, obstacles);
    resolved.push(r);
    if (r.item.status === "overlap") {
      warnings.push(`"${r.item.item}" could not be placed without overlapping something and was left in place.`);
    }
  }

  return { items: resolved.map((r) => r.item), warnings };
}