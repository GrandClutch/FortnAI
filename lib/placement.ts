import type { FurnitureItem, FurniturePlacement, LayoutItem, Obstacle } from "@/lib/schema";
import { frontDegFor } from "@/lib/furnitureModels";

const IN_TO_FT = 1 / 12;
const WALL_GAP_FT = 0.25;
const ITEM_GAP_FT = 0.5;
const NUDGE_STEP_FT = 0.5;
const MAX_NUDGE_TRIES = 24;
const OBSTACLE_DEPTH_FT = 1.0;

type WallRef = "north" | "south" | "east" | "west";
type Align = "left" | "center" | "right";

interface RoomInput {
  widthFt: number;
  lengthFt: number;
  heightFt: number;
  obstacles: Obstacle[];
}

interface Resolved {
  item: LayoutItem;
  heightExceeded: boolean;
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

function rotatedExtents(widthFt: number, depthFt: number, rotationDeg: number): { ex: number; ez: number } {
  const rad = (rotationDeg * Math.PI) / 180;
  const ca = Math.abs(Math.cos(rad));
  const sa = Math.abs(Math.sin(rad));
  return { ex: ca * widthFt + sa * depthFt, ez: sa * widthFt + ca * depthFt };
}

function boxAt(cx: number, cz: number, widthFt: number, depthFt: number, rotationDeg: number): AABB {
  const { ex, ez } = rotatedExtents(widthFt, depthFt, rotationDeg);
  return { minX: cx - ex / 2, maxX: cx + ex / 2, minZ: cz - ez / 2, maxZ: cz + ez / 2 };
}

function frontDirection(rotationDeg: number, frontOffsetDeg = 0): { dx: number; dz: number } {
  const rad = ((rotationDeg + frontOffsetDeg) * Math.PI) / 180;
  return { dx: -Math.sin(rad), dz: -Math.cos(rad) };
}

function rectOverlap(a: AABB, b: AABB): boolean {
  return a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;
}

function expandAABB(box: AABB, amount: number): AABB {
  return {
    minX: box.minX - amount,
    maxX: box.maxX + amount,
    minZ: box.minZ - amount,
    maxZ: box.maxZ + amount,
  };
}

function circleRectOverlap(c: SwingCircle, r: AABB): boolean {
  const px = clamp(c.cx, r.minX, r.maxX);
  const pz = clamp(c.cz, r.minZ, r.maxZ);
  const dx = c.cx - px;
  const dz = c.cz - pz;
  return dx * dx + dz * dz <= c.r * c.r;
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

  const W = Math.min(Math.max(0.5, furniture.width * IN_TO_FT), room.widthFt - 2 * WALL_GAP_FT);
  const D = Math.min(Math.max(0.5, furniture.depth * IN_TO_FT), room.lengthFt - 2 * WALL_GAP_FT);
  const requestedHeight = Math.max(0.1, furniture.height * IN_TO_FT);
  const heightExceeded = requestedHeight > room.heightFt;
  const H = Math.min(requestedHeight, room.heightFt);

  let rot = normalizeRotation(placement.rotationDeg);

  const adjacentTarget = findByName(resolved, placement.adjacentTo);
  const topTarget = findByName(resolved, placement.onTopOf);
  const faceTarget = findByName(resolved, placement.facesToward);
  const frontTarget = findByName(resolved, placement.frontOf);
  const behindTarget = findByName(resolved, placement.behindOf);

  let cx: number;
  let cz: number;

  const onNorthSouth = wall === "north" || wall === "south";
  const alongRun = onNorthSouth ? room.widthFt : room.lengthFt;

  if (placement.centerOfRoom) {
    cx = room.widthFt / 2;
    cz = room.lengthFt / 2;
  } else if (topTarget) {
    cx = topTarget.item.x;
    cz = topTarget.item.z;
  } else if (frontTarget) {
    const t = frontTarget.item;
    const fd = frontDirection(t.rotationDeg, frontDegFor(t.category));
    const gap = Math.max(t.widthFt, t.depthFt) / 2 + Math.max(W, D) / 2 + ITEM_GAP_FT;
    cx = t.x + fd.dx * gap;
    cz = t.z + fd.dz * gap;
    rot = normalizeRotation(t.rotationDeg + 180);
  } else if (behindTarget) {
    const t = behindTarget.item;
    const fd = frontDirection(t.rotationDeg, frontDegFor(t.category));
    const gap = Math.max(t.widthFt, t.depthFt) / 2 + Math.max(W, D) / 2 + ITEM_GAP_FT;
    cx = t.x - fd.dx * gap;
    cz = t.z - fd.dz * gap;
    rot = normalizeRotation(t.rotationDeg);
  } else {
    if (placement.rotationDeg == null) {
      rot = wall === "north" ? 180 : wall === "south" ? 0 : wall === "west" ? 270 : 90;
    }
    let along: number;
    if (adjacentTarget) {
      const sign = placement.offsetFt >= 0 ? 1 : -1;
      const te = rotatedExtents(adjacentTarget.item.widthFt, adjacentTarget.item.depthFt, adjacentTarget.item.rotationDeg);
      const targetHalf = (onNorthSouth ? te.ex : te.ez) / 2;
      const half = (onNorthSouth ? rotatedExtents(W, D, rot).ex : rotatedExtents(W, D, rot).ez) / 2;
      along = (onNorthSouth ? adjacentTarget.item.x : adjacentTarget.item.z) + sign * (targetHalf + half + ITEM_GAP_FT);
    } else {
      along = anchorAlong(wall, align, alongRun) + placement.offsetFt;
    }

    const { ex, ez } = rotatedExtents(W, D, rot);
    const into =
      wall === "north"
        ? ez / 2 + WALL_GAP_FT
        : wall === "south"
          ? room.lengthFt - ez / 2 - WALL_GAP_FT
          : wall === "west"
            ? ex / 2 + WALL_GAP_FT
            : room.widthFt - ex / 2 - WALL_GAP_FT;

    const lo = (onNorthSouth ? ex : ez) / 2 + WALL_GAP_FT;
    const hi = (onNorthSouth ? room.widthFt - ex / 2 : room.lengthFt - ez / 2) - WALL_GAP_FT;
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
  const loX = f.ex / 2 + WALL_GAP_FT;
  const hiX = room.widthFt - f.ex / 2 - WALL_GAP_FT;
  const loZ = f.ez / 2 + WALL_GAP_FT;
  const hiZ = room.lengthFt - f.ez / 2 - WALL_GAP_FT;
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
      widthFt: W,
      depthFt: D,
      heightFt: H,
      estimatedCostUSD: furniture.estimatedCostUSD,
      placementNotes: furniture.placementNotes,
    },
    heightExceeded,
  };

  const collidesAt = (px: number, pz: number): boolean => {
    const box = boxAt(px, pz, W, D, rot);
    const sameKind = (r: Resolved) => isFloorCovering(r.item.category) === isFloorCovering(base.item.category);
    const paddedBox = expandAABB(box, ITEM_GAP_FT / 2);
    if (resolved.some((r) => {
      if (!sameKind(r)) return false;
      const otherBox = boxAt(r.item.x, r.item.z, r.item.widthFt, r.item.depthFt, r.item.rotationDeg);
      return rectOverlap(paddedBox, expandAABB(otherBox, ITEM_GAP_FT / 2));
    })) {
      return true;
    }
    return obstacles.some((o) => {
      const obstacleBox = expandAABB(o.aabb, ITEM_GAP_FT / 2);
      return rectOverlap(box, obstacleBox) || (o.swing ? circleRectOverlap(o.swing, paddedBox) : false);
    });
  };

  if (collidesAt(cx, cz)) {
    let fixed = false;
    outer: for (let t = 1; t <= MAX_NUDGE_TRIES && !fixed; t++) {
      const cands: Array<[number, number]> = [];
      for (const sx of [1, -1]) cands.push([clamp(cx + sx * t * NUDGE_STEP_FT, loX, hiX), cz]);
      for (const sz of [1, -1]) cands.push([cx, clamp(cz + sz * t * NUDGE_STEP_FT, loZ, hiZ)]);
      for (const sx of [1, -1]) for (const sz of [1, -1]) cands.push([clamp(cx + sx * t * NUDGE_STEP_FT, loX, hiX), clamp(cz + sz * t * NUDGE_STEP_FT, loZ, hiZ)]);
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
  const obstacles = room.obstacles.map((o) => obstacleGeometry(o, room.widthFt, room.lengthFt));

  const byName = new Map(furniture.map((f) => [f.item.toLowerCase(), f]));
  const ordered: FurnitureItem[] = [];
  const done = new Set<string>();
  const visiting = new Set<string>();
  const visit = (f: FurnitureItem) => {
    const key = f.item.toLowerCase();
    if (done.has(key) || visiting.has(key)) return;
    const ref = referencedName(f);
    if (ref) {
      const target = byName.get(ref.toLowerCase());
      if (target) visit(target);
    }
    done.add(key);
    visiting.add(key);
    ordered.push(f);
    visiting.delete(key);
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
    if (r.heightExceeded) {
      warnings.push(`"${r.item.item}" is taller than the room and was not placed.`);
      continue;
    }
    if (r.item.status === "overlap") {
      warnings.push(`"${r.item.item}" couldn't be placed without overlapping something and was skipped.`);
      continue;
    }
    resolved.push(r);
  }

  return { items: resolved.map((r) => r.item), warnings };
}
