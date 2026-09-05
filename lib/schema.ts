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

export const furnitureItemSchema = z.object({
  item: z.string().describe("Name of the furniture piece"),
  category: z
    .enum(["Seating", "Table", "Storage", "Bed", "Lighting", "Decor", "Rug", "Other"])
    .describe("Furniture category"),
  width: z
    .number()
    .positive()
    .describe("Recommended max width in inches, sized to the room"),
  depth: z
    .number()
    .positive()
    .describe("Recommended max depth in inches"),
  height: z
    .number()
    .positive()
    .describe("Recommended height in inches"),
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
export type DesignResult = z.infer<typeof designSchema>;
