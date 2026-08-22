import { z } from "zod";

export const STYLE_PRESETS = [
  {
    id: "minimalist",
    label: "Modern Minimalist",
    description: "Clean lines, neutral palette, light + airy",
    prompt:
      "Modern minimalist: crisp geometry, warm neutrals, soft natural light, uncluttered negative space, a few sculptural statement pieces.",
  },
  {
    id: "japandi",
    label: "Japandi",
    description: "Japanese + Scandinavian calm, natural wood",
    prompt:
      "Japandi: Japanese-Scandinavian calm, light oak wood tones, linen textures, low-profile furniture, warm minimal palette, tranquil.",
  },
  {
    id: "maximalist",
    label: "Maximalist Dorm",
    description: "Bold color, layered texture, energetic",
    prompt:
      "Maximalist: bold saturated color, layered textures and patterns, gallery walls, personality-packed, energetic, cozy-cluttered done well.",
  },
  {
    id: "industrial",
    label: "Industrial Loft",
    description: "Exposed materials, metal + concrete",
    prompt:
      "Industrial loft: exposed brick and concrete, black steel accents, leather and wood, Edison lighting, raw and urban.",
  },
  {
    id: "scandinavian",
    label: "Scandinavian",
    description: "Bright, functional, cozy hygge",
    prompt:
      "Scandinavian: bright white, pale wood, hygge warmth, wool and sheepskin textures, functional simplicity, cozy.",
  },
  {
    id: "coastal",
    label: "Coastal Retreat",
    description: "Light, breezy, beach-inspired",
    prompt:
      "Coastal retreat: soft blues and sandy neutrals, linen and rattan, breezy and bright, relaxed resort feel.",
  },
] as const;

export type StylePresetId = (typeof STYLE_PRESETS)[number]["id"];

export const roomDimensionsSchema = z.object({
  width: z.coerce.number().positive("Width must be positive"),
  length: z.coerce.number().positive("Length must be positive"),
  height: z.coerce.number().positive("Height must be positive"),
});

export type RoomDimensions = z.infer<typeof roomDimensionsSchema>;

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
