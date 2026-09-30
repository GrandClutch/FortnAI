import type { FurnitureItem, FurniturePlacement, LayoutItem, Obstacle } from "@/lib/schema";
import { fitModeFor, frontDegFor } from "@/lib/furnitureModels";

export const CM_TO_M = 0.01;
export const WALL_GAP_M = 0.08;
const ITEM_GAP_M = 0.15;
const NUDGE_STEP_M = 0.15;
const MAX_NUDGE_TRIES = 24;
const OBSTACLE_DEPTH_M = 0.3;

type WallRef = "north" | "south" | "east" | "west";
type Align = "left" | "center" | "right";

interface RoomInput {
  widthM: number;
  lengthM: number;
  heightM: number;
  obstacles: Obstacle[];
}

interface Resolved {
  item: LayoutItem;
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

function isFloorCovering(category: string): boolean {
  return category === "Rug";
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function normalizeRotation(deg: number | undefined): number {
  const d = Math.round(((((deg ?? 0) % 360) + 360) % 360) / 90) * 90;
  return d % 360;
}

function rotatedExtents(widthM: number, depthM: number, rotationDeg: number): { ex: number; ez: number } {
  const rad = (rotationDeg * Math.PI) / 180;
  const ca = Math.abs(Math.cos(rad));
  const sa = Math.abs(Math.sin(rad));
  return { ex: ca * widthM + sa * depthM, ez: sa * widthM + ca * depthM };
}

function boxAt(cx: number, cz: number, widthM: number, depthM: number, rotationDeg: number): AABB {
  const { ex, ez } = rotatedExtents(widthM, depthM, rotationDeg);
  return { minX: cx - ex / 2, maxX: cx + ex / 2, minZ: cz - ez / 2, maxZ: cz + ez / 2 };
}

function frontDirection(rotationDeg: number, frontOffsetDeg = 0): { dx: number; dz: number } {
  const rad = ((rotationDeg + frontOffsetDeg) * Math.PI) / 180;
  return { dx: -Math.sin(rad), dz: -Math.cos(rad) };
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

function obstacleGeometry(o: Obstacle, widthM: number, lengthM: number): { aabb: AABB; swing?: SwingCircle } {
  const w = o.widthM;
  const cx = o.wallRef === "north" || o.wallRef === "south" ? clamp(o.offsetM, 0, widthM) : clamp(o.offsetM, 0, lengthM);
  let aabb: AABB;
  switch (o.wallRef) {
    case "north":
      aabb = { minX: cx - w / 2, maxX: cx + w / 2, minZ: 0, maxZ: OBSTACLE_DEPTH_M };
      break;
    case "south":
      aabb = { minX: cx - w / 2, maxX: cx + w / 2, minZ: lengthM - OBSTACLE_DEPTH_M, maxZ: lengthM };
      break;
    case "west":
      aabb = { minX: 0, maxX: OBSTACLE_DEPTH_M, minZ: cx - w / 2, maxZ: cx + w / 2 };
      break;
    case "east":
      aabb = { minX: widthM - OBSTACLE_DEPTH_M, maxX: widthM, minZ: cx - w / 2, maxZ: cx + w / 2 };
      break;
  }
  const swing =
    o.type === "door" && o.swingClearanceM
      ? {
          cx: o.wallRef === "north" || o.wallRef === "south" ? cx : o.wallRef === "west" ? 0 : widthM,
          cz: o.wallRef === "east" || o.wallRef === "west" ? cx : o.wallRef === "north" ? 0 : lengthM,
          r: o.swingClearanceM,
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
    offsetM: 0,
  };
}

function findByName(resolved: Resolved[], name: string | undefined): Resolved | undefined {
  if (!name) return undefined;
  const n = name.toLowerCase();
  return resolved.find((r) => r.item.item.toLowerCase() === n);
}

function referencedName(f: FurnitureItem): string | undefined {
  const p = f.placement;
  return p?.adjacentTo ?? p?.onTopOf ?? p?.facesToward ?? p?.frontOf ?? p?.behindOf;
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

  const W = Math.min(Math.max(0.15, furniture.width * CM_TO_M), room.widthM - 2 * WALL_GAP_M);
  const D = Math.min(Math.max(0.15, furniture.depth * CM_TO_M), room.lengthM - 2 * WALL_GAP_M);
  const H = Math.max(0.1, furniture.height * CM_TO_M);

  const ceiling =
    fitModeFor({ item: furniture.item, category: furniture.category }) === "ceiling";

  let rot = normalizeRotation(placement.rotationDeg);

  const adjacentTarget = findByName(resolved, placement.adjacentTo);
  const topTarget = findByName(resolved, placement.onTopOf);
  const faceTarget = findByName(resolved, placement.facesToward);
  const frontTarget = findByName(resolved, placement.frontOf);
  const behindTarget = findByName(resolved, placement.behindOf);

  let cx: number;
  let cz: number;

  const onNorthSouth = wall === "north" || wall === "south";
  const alongRun = onNorthSouth ? room.widthM : room.lengthM;

  if (ceiling) {
    cx = room.widthM / 2;
    cz = room.lengthM / 2;
  } else if (placement.centerOfRoom) {
    cx = room.widthM / 2;
    cz = room.lengthM / 2;
  } else if (topTarget) {
    cx = topTarget.item.x;
    cz = topTarget.item.z;
  } else if (frontTarget) {
    const t = frontTarget.item;
    const fd = frontDirection(t.rotationDeg, frontDegFor(t));
    const gap = Math.max(t.widthM, t.depthM) / 2 + Math.max(W, D) / 2 + ITEM_GAP_M;
    cx = t.x + fd.dx * gap;
    cz = t.z + fd.dz * gap;
    rot = normalizeRotation(t.rotationDeg + 180);
  } else if (behindTarget) {
    const t = behindTarget.item;
    const fd = frontDirection(t.rotationDeg, frontDegFor(t));
    const gap = Math.max(t.widthM, t.depthM) / 2 + Math.max(W, D) / 2 + ITEM_GAP_M;
    cx = t.x - fd.dx * gap;
    cz = t.z - fd.dz * gap;
    rot = normalizeRotation(t.rotationDeg);
  } else {
    if (placement.rotationDeg == null) {
      rot = wall === "north" ? 180 : wall === "south" ? 0 : wall === "west" ? 270 : 90;
    }
    let along: number;
    if (adjacentTarget) {
      const sign = placement.offsetM >= 0 ? 1 : -1;
      const te = rotatedExtents(adjacentTarget.item.widthM, adjacentTarget.item.depthM, adjacentTarget.item.rotationDeg);
      const targetHalf = (onNorthSouth ? te.ex : te.ez) / 2;
      const half = (onNorthSouth ? rotatedExtents(W, D, rot).ex : rotatedExtents(W, D, rot).ez) / 2;
      along = (onNorthSouth ? adjacentTarget.item.x : adjacentTarget.item.z) + sign * (targetHalf + half + ITEM_GAP_M);
    } else {
      along = anchorAlong(wall, align, alongRun) + placement.offsetM;
    }

    const { ex, ez } = rotatedExtents(W, D, rot);
    const into =
      wall === "north"
        ? ez / 2 + WALL_GAP_M
        : wall === "south"
          ? room.lengthM - ez / 2 - WALL_GAP_M
          : wall === "west"
            ? ex / 2 + WALL_GAP_M
            : room.widthM - ex / 2 - WALL_GAP_M;

    const lo = (onNorthSouth ? ex : ez) / 2 + WALL_GAP_M;
    const hi = (onNorthSouth ? room.widthM - ex / 2 : room.lengthM - ez / 2) - WALL_GAP_M;
    along = clamp(along, lo, hi);

    if (onNorthSouth) {
      cx = along;
      cz = into;
    } else {
      cx = into;
      cz = along;
    }
  }

  if (faceTarget) {
    const dx = faceTarget.item.x - cx;
    const dz = faceTarget.item.z - cz;
    if (Math.abs(dx) >= Math.abs(dz)) rot = dx >= 0 ? 270 : 90;
    else rot = dz >= 0 ? 180 : 0;
  }

  const f = rotatedExtents(W, D, rot);
  const loX = f.ex / 2 + WALL_GAP_M;
  const hiX = room.widthM - f.ex / 2 - WALL_GAP_M;
  const loZ = f.ez / 2 + WALL_GAP_M;
  const hiZ = room.lengthM - f.ez / 2 - WALL_GAP_M;
  cx = clamp(cx, loX, hiX);
  cz = clamp(cz, loZ, hiZ);

  const base: Resolved = {
    item: {
      itemId: `item-${index}`,
      item: furniture.item,
      category: furniture.category,
      x: 0,
      z: 0,
      rotationDeg: rot,
      widthM: W,
      depthM: D,
      heightM: H,
      estimatedCostUSD: furniture.estimatedCostUSD,
      placementNotes: furniture.placementNotes,
    },
  };

  const collidesAt = (px: number, pz: number): boolean => {
    const box = boxAt(px, pz, W, D, rot);
    const sameKind = (r: Resolved) => isFloorCovering(r.item.category) === isFloorCovering(base.item.category);
    if (resolved.some((r) => sameKind(r) && rectOverlap(box, boxAt(r.item.x, r.item.z, r.item.widthM, r.item.depthM, r.item.rotationDeg)))) {
      return true;
    }
    return obstacles.some((o) => rectOverlap(box, o.aabb) || (o.swing ? circleRectOverlap(o.swing, box) : false));
  };

  if (!ceiling && collidesAt(cx, cz)) {
    let fixed = false;
    outer: for (let t = 1; t <= MAX_NUDGE_TRIES && !fixed; t++) {
      const cands: Array<[number, number]> = [];
      for (const sx of [1, -1]) cands.push([clamp(cx + sx * t * NUDGE_STEP_M, loX, hiX), cz]);
      for (const sz of [1, -1]) cands.push([cx, clamp(cz + sz * t * NUDGE_STEP_M, loZ, hiZ)]);
      for (const sx of [1, -1]) for (const sz of [1, -1]) cands.push([clamp(cx + sx * t * NUDGE_STEP_M, loX, hiX), clamp(cz + sz * t * NUDGE_STEP_M, loZ, hiZ)]);
      for (const [nx, nz] of cands) {
        if (!collidesAt(nx, nz)) {
          cx = nx;
          cz = nz;
          fixed = true;
          break outer;
        }
      }
    }
    base.item.status = fixed ? "ok" : "overlap";
  }

  base.item.x = Math.round(cx * 100) / 100;
  base.item.z = Math.round(cz * 100) / 100;
  return base;
}

export function solveLayout(furniture: FurnitureItem[], room: RoomInput): SolveResult {
  const warnings: string[] = [];
  const obstacles = room.obstacles.map((o) => obstacleGeometry(o, room.widthM, room.lengthM));

  const byName = new Map(furniture.map((f) => [f.item.toLowerCase(), f]));
  const ordered: FurnitureItem[] = [];
  const done = new Set<string>();
  const visiting = new Set<string>();
  const visit = (f: FurnitureItem) => {
    const key = f.item.toLowerCase();
    if (done.has(key) || visiting.has(key)) return;
    visiting.add(key);
    const ref = referencedName(f);
    if (ref) {
      const target = byName.get(ref.toLowerCase());
      if (target) visit(target);
    }
    visiting.delete(key);
    done.add(key);
    ordered.push(f);
  };
  for (const f of furniture) visit(f);

  const resolved: Resolved[] = [];
  for (let i = 0; i < ordered.length; i++) {
    const f = ordered[i];
    const ref = referencedName(f);
    if (ref && !findByName(resolved, ref)) {
      warnings.push(`"${f.item}" references "${ref}", which isn't placed; falling back to wall placement.`);
    }
    const r = resolveItem(f, i, room, resolved, obstacles);
    if (r.item.status === "overlap") {
      warnings.push(`"${r.item.item}" couldn't be placed without overlapping something and was skipped.`);
      continue;
    }
    resolved.push(r);
  }

  return { items: resolved.map((r) => r.item), warnings };
}