import { z } from "zod";
import {
  MAX_CUSTOM_PROMPT_LENGTH,
  obstacleSchema,
  roomDimensionsSchema,
  STYLE_PRESETS,
} from "@/lib/schema";

const styleIds = STYLE_PRESETS.map((preset) => preset.id) as [string, ...string[]];

export const projectInputSchema = z
  .object({
    width: roomDimensionsSchema.shape.width,
    length: roomDimensionsSchema.shape.length,
    height: roomDimensionsSchema.shape.height,
    stylePreset: z.enum(styleIds).nullable().optional(),
    customPrompt: z.string().trim().max(MAX_CUSTOM_PROMPT_LENGTH).default(""),
    obstacles: obstacleSchema.array().max(16).default([]),
    title: z.string().trim().min(1).max(120).default("Untitled room"),
  })
  .superRefine((input, context) => {
    for (const [index, obstacle] of input.obstacles.entries()) {
      const run = obstacle.wallRef === "north" || obstacle.wallRef === "south"
        ? input.width
        : input.length;
      if (obstacle.offsetFt > run) {
        context.addIssue({
          code: "custom",
          path: ["obstacles", index, "offsetFt"],
          message: "Obstacle position must be inside the room",
        });
      }
      if (obstacle.offsetFt - obstacle.widthFt / 2 < 0 || obstacle.offsetFt + obstacle.widthFt / 2 > run) {
        context.addIssue({
          code: "custom",
          path: ["obstacles", index, "widthFt"],
          message: "Obstacle must fit along the wall",
        });
      }
    }
  });

export type ProjectInput = z.infer<typeof projectInputSchema>;

export const designRunRequestSchema = z.object({
  projectId: z.string().trim().min(1).max(100),
  assetId: z.string().trim().min(1).max(100),
  idempotencyKey: z.string().trim().min(1).max(160).optional(),
});

export const renderRunRequestSchema = z.object({
  projectId: z.string().trim().min(1).max(100),
  versionId: z.string().trim().min(1).max(100),
  idempotencyKey: z.string().trim().min(1).max(160).optional(),
});
