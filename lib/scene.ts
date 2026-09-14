import type { LayoutItem, Obstacle } from "@/lib/schema";

export const WALL_THICKNESS = 0.15;

export interface WallSegment {
  key: string;
  position: [number, number, number];
  args: [number, number, number];
}

export function wallSegments(width: number, length: number, height: number): WallSegment[] {
  const t = WALL_THICKNESS;
  return [
    { key: "north", position: [0, height / 2, length / 2], args: [width, height, t] },
    { key: "south", position: [0, height / 2, -length / 2], args: [width, height, t] },
    { key: "east", position: [width / 2, height / 2, 0], args: [t, height, length] },
    { key: "west", position: [-width / 2, height / 2, 0], args: [t, height, length] },
  ];
}

export function furnitureTransform(item: LayoutItem, width: number, length: number) {
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const rad = ((item.rotationDeg || 0) * Math.PI) / 180;
  const ca = Math.abs(Math.cos(rad));
  const sa = Math.abs(Math.sin(rad));
  const hx = (ca * item.widthFt + sa * item.depthFt) / 2;
  const hz = (sa * item.widthFt + ca * item.depthFt) / 2;
  const cx = clamp(item.x, hx, width - hx);
  const cz = clamp(item.z, hz, length - hz);
  const x = cx - width / 2;
  const z = -(cz - length / 2);
  const rotation = ((-item.rotationDeg || 0) * Math.PI) / 180;
  return { x, z, rotation };
}

export function obstacleTransform(
  obstacle: Obstacle,
  width: number,
  length: number,
  height: number
) {
  const w = obstacle.widthFt;
  const offset = obstacle.offsetFt;
  const door = obstacle.type === "door";
  const oh = height * (door ? 0.85 : 0.7);

  let position: [number, number, number];
  let args: [number, number, number];

  if (obstacle.wallRef === "north") {
    position = [offset - width / 2, oh / 2, length / 2 - 0.09];
    args = [w, oh, 0.05];
  } else if (obstacle.wallRef === "south") {
    position = [offset - width / 2, oh / 2, -length / 2 + 0.09];
    args = [w, oh, 0.05];
  } else if (obstacle.wallRef === "east") {
    position = [width / 2 - 0.09, oh / 2, -(offset - length / 2)];
    args = [0.05, oh, w];
  } else {
    position = [-width / 2 + 0.09, oh / 2, -(offset - length / 2)];
    args = [0.05, oh, w];
  }

  return { position, args, door };
}