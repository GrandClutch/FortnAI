import { z } from "zod";

export const STYLE_PRESETS = [
  {
    id: "minimalist",
    label: "Modern Minimalist",
    description: "Clean lines, neutral palette, light + airy",
    image: "/styles/minimalist.jpg",
  },
  {
    id: "japandi",
    label: "Japandi",
    description: "Japanese + Scandinavian calm, natural wood",
    image: "/styles/japandi.jpg",
  },
  {
    id: "maximalist",
    label: "Maximalist Dorm",
    description: "Bold color, layered texture, energetic",
    image: "/styles/maximalist.jpg",
  },
  {
    id: "industrial",
    label: "Industrial Loft",
    description: "Exposed materials, metal + concrete",
    image: "/styles/industrial.jpg",
  },
  {
    id: "scandinavian",
    label: "Scandinavian",
    description: "Bright, functional, cozy hygge",
    image: "/styles/scandinavian.jpg",
  },
  {
    id: "coastal",
    label: "Coastal Retreat",
    description: "Light, breezy, beach-inspired",
    image: "/styles/coastal.jpg",
  },
] as const;

export type StylePresetId = (typeof STYLE_PRESETS)[number]["id"];

export const roomDimensionsSchema = z.object({
  width: z.coerce.number().positive("Width must be positive"),
  length: z.coerce.number().positive("Length must be positive"),
  height: z.coerce.number().positive("Height must be positive"),
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
  offsetM: z.number().describe("Distance in meters along the wall from the align anchor"),
  adjacentTo: z.string().optional().describe("Name of another furniture item this must sit adjacent to"),
  rotationDeg: z.number().optional().describe("Optional rotation in degrees"),
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
  offsetM: z.number().describe("Center position in meters along the wall from the wall's north/left end"),
  widthM: z.number().positive(),
  swingClearanceM: z.number().optional().describe("For doors: radius of the swing arc in meters"),
});

export type Obstacle = z.infer<typeof obstacleSchema>;

export const layoutItemSchema = z.object({
  itemId: z.string(),
  item: z.string(),
  category: z.string(),
  x: z.number().describe("Center x in meters (0 = west wall)"),
  z: z.number().describe("Center z in meters (0 = north wall)"),
  rotationDeg: z.number(),
  widthM: z.number(),
  depthM: z.number(),
  heightM: z.number(),
  estimatedCostUSD: z.number(),
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
    .positive()
    .describe("Recommended max width in centimeters, sized to the room"),
  depth: z
    .number()
    .positive()
    .describe("Recommended max depth in centimeters"),
  height: z
    .number()
    .positive()
    .describe("Recommended height in centimeters"),
  placementNotes: z
    .string()
    .describe("Where to place it in the room and why"),
  estimatedCostUSD: z
    .number()
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
    .array(z.string())
    .describe("3-5 hex color codes representing the palette"),
});

export type FurnitureItem = z.infer<typeof furnitureItemSchema>;

export const budgetRangeSchema = z
  .object({
    minUSD: z.number().nonnegative().describe("Minimum total budget in USD"),
    maxUSD: z.number().positive().describe("Maximum total budget in USD (hard cap)"),
  })
  .refine((d) => d.maxUSD >= d.minUSD, {
    message: "Maximum budget must be greater than or equal to the minimum",
  });

export type BudgetRange = z.infer<typeof budgetRangeSchema>;

export const productSchema = z.object({
  asin: z.string(),
  title: z.string(),
  retailer: z.string().describe("Retailer name, e.g. Amazon"),
  url: z.string().url().describe("Direct product URL"),
  imageUrl: z.string().url().optional(),
  priceUSD: z.number().nonnegative(),
  originalPriceUSD: z.number().nonnegative().optional(),
  rating: z.number().optional(),
  reviews: z.number().optional(),
});

export type Product = z.infer<typeof productSchema>;

export const dimensionsSourceSchema = z.enum(["product", "ai"]);

export type DimensionsSource = z.infer<typeof dimensionsSourceSchema>;

export const shoppingItemSchema = z.object({
  itemIndex: z.number(),
  item: z.string(),
  product: productSchema.nullable().describe("Null when no live product match was found"),
  priceUSD: z.number().describe("Effective price used for this item"),
  dimensionsSource: dimensionsSourceSchema,
  matchQuality: z.enum(["exact", "fallback"]),
});

export type ShoppingItem = z.infer<typeof shoppingItemSchema>;

export const shoppingResultSchema = z.object({
  minUSD: z.number(),
  maxUSD: z.number(),
  totalUSD: z.number(),
  inRange: z.boolean(),
  provider: z.literal("rapidapi-amazon"),
  fetchedAt: z.string(),
  items: z.array(shoppingItemSchema),
  warnings: z.array(z.string()).optional(),
});

export type ShoppingResult = z.infer<typeof shoppingResultSchema>;

export type DesignResult = z.infer<typeof designSchema> & {
  layout: LayoutItem[];
  layoutWarnings?: string[];
  budgetRange?: BudgetRange;
  shopping?: ShoppingResult;
};
