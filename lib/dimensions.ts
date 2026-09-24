import { WALL_GAP_M } from "@/lib/placement";

export interface ParsedDimensions {
  widthCm: number;
  depthCm: number;
  heightCm: number;
}

export interface RoomSize {
  widthM: number;
  lengthM: number;
  heightM: number;
}

export interface DetailEntry {
  name: string;
  value: string;
}

const UNIT_TO_CM: Record<string, number> = {
  cm: 1,
  mm: 0.1,
  in: 2.54,
  inch: 2.54,
  inches: 2.54,
  '"': 2.54,
  "''": 2.54,
  ft: 30.48,
  feet: 30.48,
  "'": 30.48,
};

const AXIS_ALIASES: Record<string, "width" | "depth" | "height" | "length" | "diameter"> = {
  w: "width",
  width: "width",
  d: "depth",
  depth: "depth",
  h: "height",
  height: "height",
  l: "length",
  length: "length",
  diameter: "diameter",
};

function normalizeUnit(raw: string | undefined, fallback: string | undefined): string | undefined {
  const unit = (raw ?? fallback ?? "").toLowerCase().trim();
  return unit.length > 0 ? unit : undefined;
}

function toCm(value: number, unit: string | undefined): number | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  const factor = unit ? UNIT_TO_CM[unit] : undefined;
  if (!factor) return null;
  const cm = value * factor;
  if (cm <= 0 || cm > 1000) return null;
  return Math.round(cm * 10) / 10;
}

function globalUnit(text: string): string | undefined {
  if (/"/.test(text)) return '"';
  const match = /\b(cm|mm|ft|feet|inches|inch|in)\b/i.exec(text);
  return match ? match[1].toLowerCase() : undefined;
}

function assemble(
  values: Partial<Record<"width" | "depth" | "height" | "length" | "diameter", number>>
): ParsedDimensions | null {
  const width = values.width ?? values.diameter;
  const depth = values.depth ?? values.length ?? values.diameter;
  const height = values.height;
  if (width === undefined || depth === undefined || height === undefined) return null;
  return { widthCm: width, depthCm: depth, heightCm: height };
}

function parseWordLabels(text: string): ParsedDimensions | null {
  const re =
    /(length|width|height|depth|diameter)\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(inches|inch|in|cm|mm|ft|feet|"|'|'')?/gi;
  const values: Partial<Record<"width" | "depth" | "height" | "length" | "diameter", number>> = {};
  const fallback = globalUnit(text);
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const axis = AXIS_ALIASES[match[1].toLowerCase()];
    const cm = toCm(Number(match[2]), normalizeUnit(match[3], fallback));
    if (axis && cm !== null && values[axis] === undefined) values[axis] = cm;
  }
  return assemble(values);
}

function parseLetterLabels(text: string): ParsedDimensions | null {
  const re = /(\d+(?:\.\d+)?)\s*(inches|inch|in|cm|mm|ft|feet|"|'|'')?\s*([ldwh])(?![a-z0-9])/gi;
  const values: Partial<Record<"width" | "depth" | "height" | "length" | "diameter", number>> = {};
  const fallback = globalUnit(text);
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const axis = AXIS_ALIASES[match[3].toLowerCase()];
    const cm = toCm(Number(match[1]), normalizeUnit(match[2], fallback));
    if (axis && cm !== null && values[axis] === undefined) values[axis] = cm;
  }
  return assemble(values);
}

function candidateStrings(raw: string | DetailEntry[] | undefined): string[] {
  if (!raw) return [];
  if (typeof raw === "string") return [raw];
  const preferred: string[] = [];
  const other: string[] = [];
  for (const entry of raw) {
    const name = (entry.name ?? "").toLowerCase();
    const value = entry.value ?? "";
    if (!/dimension/.test(name) || !value) continue;
    if (/(package|shipping)/.test(name)) other.push(value);
    else preferred.push(value);
  }
  return [...preferred, ...other];
}

export function parseDimensions(
  raw: string | DetailEntry[] | undefined
): ParsedDimensions | null {
  for (const text of candidateStrings(raw)) {
    const cleaned = text.replace(/×/g, "x").replace(/[″”]/g, '"').replace(/[’‘]/g, "'");
    const parsed = parseWordLabels(cleaned) ?? parseLetterLabels(cleaned);
    if (parsed) return parsed;
  }
  return null;
}

export function fitsRoom(dims: ParsedDimensions, room: RoomSize): boolean {
  const roomW = room.widthM * 100;
  const roomL = room.lengthM * 100;
  const roomH = room.heightM * 100;
  const gap = WALL_GAP_M * 100;
  const footprint =
    (dims.widthCm <= roomW - 2 * gap && dims.depthCm <= roomL - 2 * gap) ||
    (dims.widthCm <= roomL - 2 * gap && dims.depthCm <= roomW - 2 * gap);
  return footprint && dims.heightCm <= roomH;
}
