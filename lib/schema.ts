import { z } from "zod";

export const STYLE_PRESETS = [
  {
    id: "minimalist",
    label: "Modern Minimalist",
    description: "Clean lines, neutral palette, light + airy",
  },
  {
    id: "japandi",
    label: "Japandi",
    description: "Japanese + Scandinavian calm, natural wood",
  },
  {
    id: "maximalist",
    label: "Maximalist Dorm",
    description: "Bold color, layered texture, energetic",
  },
  {
    id: "industrial",
    label: "Industrial Loft",
    description: "Exposed materials, metal + concrete",
  },
  {
    id: "scandinavian",
    label: "Scandinavian",
    description: "Bright, functional, cozy hygge",
  },
  {
    id: "coastal",
    label: "Coastal Retreat",
    description: "Light, breezy, beach-inspired",
  },
] as const;

export type StylePresetId = (typeof STYLE_PRESETS)[number]["id"];

export const roomDimensionsSchema = z.object({
  width: z.coerce.number().finite().min(1, "Width must be at least 1 foot").max(100, "Width is too large"),
  length: z.coerce.number().finite().min(1, "Length must be at least 1 foot").max(100, "Length is too large"),
  height: z.coerce.number().finite().min(1, "Height must be at least 1 foot").max(30, "Height is too large"),
});

export type RoomDimensions = z.infer<typeof roomDimensionsSchema>;

export const MAX_CUSTOM_PROMPT_LENGTH = 2000;

export function sanitizeCustomPrompt(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, MAX_CUSTOM_PROMPT_LENGTH);
}

export const placementSchema = z.object({
  wallRef: z.enum(["north", "south", "east", "west"]).describe("Which wall the item is placed against"),
  align: z.enum(["left", "center", "right"]).describe("Alignment anchor along the wall"),
  offsetFt: z.number().finite().min(-100).max(100).describe("Distance in feet along the wall from the align anchor"),
  adjacentTo: z.string().optional().describe("Name of another furniture item this must sit adjacent to"),
  rotationDeg: z.number().finite().optional().describe("Optional rotation in degrees"),
  onTopOf: z.string().optional().describe("Name of another furniture item this must sit centered on (e.g., a rug)"),
  facesToward: z.string().optional().describe("Name of another furniture item this must face"),
  frontOf: z.string().optional().describe("Name of another furniture item this must sit in front of, facing it"),
  behindOf: z.string().optional().describe("Name of another furniture item this must sit directly behind, facing the same direction"),
  centerOfRoom: z.boolean().optional().describe("Place the item centered in the room instead of against a wall"),
});

export type FurniturePlacement = z.infer<typeof placementSchema>;

export const obstacleSchema = z.object({
  type: z.enum(["door", "window"]),
  wallRef: z.enum(["north", "south", "east", "west"]),
  offsetFt: z.number().finite().min(0).max(100).describe("Center position in feet along the wall from the wall's north/left end"),
  widthFt: z.number().finite().positive().max(30),
  swingClearanceFt: z.number().finite().min(0).max(30).optional().describe("For doors: radius of the swing arc in feet"),
});

export type Obstacle = z.infer<typeof obstacleSchema>;

export const layoutItemSchema = z.object({
  itemId: z.string(),
  item: z.string(),
  category: z.string(),
  x: z.number().describe("Center x in feet (0 = west wall)"),
  z: z.number().describe("Center z in feet (0 = north wall)"),
  rotationDeg: z.number(),
  widthFt: z.number().finite().nonnegative(),
  depthFt: z.number().finite().nonnegative(),
  heightFt: z.number().finite().nonnegative(),
  estimatedCostUSD: z.number().finite().nonnegative(),
  placementNotes: z.string(),
  status: z.enum(["ok", "overlap"]).optional(),
});

export type LayoutItem = z.infer<typeof layoutItemSchema>;

export const furnitureItemSchema = z.object({
  item: z.string().describe("Name of the furniture piece"),
  category: z
    .enum(["Seating", "Table", "Storage", "Bed", "Lighting", "Decor", "Rug", "Other"])
    .describe("Furniture category"),
  placement: placementSchema
    .optional()
    .describe("Relationship-based placement relative to a wall. Never raw coordinates."),
  width: z
    .number()
    .finite()
    .positive()
    .max(1000)
    .describe("Recommended max width in inches, sized to the room"),
  depth: z
    .number()
    .finite()
    .positive()
    .max(1000)
    .describe("Recommended max depth in inches"),
  height: z
    .number()
    .finite()
    .positive()
    .max(1000)
    .describe("Recommended height in inches"),
  placementNotes: z
    .string()
    .describe("Where to place it in the room and why"),
  estimatedCostUSD: z
    .number()
    .finite()
    .nonnegative()
    .describe("Realistic retail price estimate in USD"),
  shoppingLink: z
    .string()
    .url()
    .optional()
    .describe("Optional search URL to a retailer for this item"),
});

export const designSchema = z.object({
  designTheme: z.string().describe("One-line summary of the chosen design direction"),
  spatialStrategy: z
    .string()
    .describe("How furniture is arranged and why, given the room dimensions"),
  furnitureRecommendations: z
    .array(furnitureItemSchema)
    .min(4)
    .max(10)
    .describe("Recommended furniture pieces with dimensions and cost"),
  totalEstimatedBudget: z
    .number()
    .nonnegative()
    .describe("Sum of all furniture estimated costs in USD"),
  lightingAdvice: z
    .string()
    .describe("Lighting recommendation for the room"),
  colorPalette: z
    .array(z.string().regex(/^#[0-9a-fA-F]{6}$/, "Palette entries must be hex colors"))
    .min(3)
    .max(5)
    .describe("3-5 hex color codes representing the palette"),
});

export const persistedDesignSchema = designSchema.extend({
  layout: layoutItemSchema.array(),
  layoutWarnings: z.array(z.string()).optional(),
});

export type FurnitureItem = z.infer<typeof furnitureItemSchema>;
export type DesignResult = z.infer<typeof designSchema> & {
  layout: LayoutItem[];
  layoutWarnings?: string[];
};
