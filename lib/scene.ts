import type { LayoutItem } from "@/lib/schema";

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
  const hx = (ca * item.widthM + sa * item.depthM) / 2;
  const hz = (sa * item.widthM + ca * item.depthM) / 2;
  const cx = clamp(item.x, hx, width - hx);
  const cz = clamp(item.z, hz, length - hz);
  const x = cx - width / 2;
  const z = -(cz - length / 2);
  const rotation = ((-item.rotationDeg || 0) * Math.PI) / 180;
  return { x, z, rotation };
}