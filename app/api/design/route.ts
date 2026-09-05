import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import {
  designSchema,
  roomDimensionsSchema,
  sanitizeCustomPrompt,
  STYLE_PRESETS,
  type StylePresetId,
} from "@/lib/schema";
import { ANALYSIS_SYSTEM_PROMPT, buildAnalysisUserPrompt } from "@/lib/prompts";
import { containsUnsafeContent, unsafeContentMessage } from "@/lib/safety";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const dims = roomDimensionsSchema.safeParse({
      width: body.width,
      length: body.length,
      height: body.height,
    });
    if (!dims.success) {
      return Response.json({ error: "Invalid room dimensions" }, { status: 400 });
    }

    const imageBase64: string | undefined = body.imageBase64;
    if (!imageBase64 || typeof imageBase64 !== "string") {
      return Response.json({ error: "Room image is required" }, { status: 400 });
    }

    const styleId: StylePresetId | null = STYLE_PRESETS.some((p) => p.id === body.stylePreset)
      ? body.stylePreset
      : null;

    const customPrompt = sanitizeCustomPrompt(body.customPrompt);
    if (containsUnsafeContent(customPrompt)) {
      return Response.json({ error: unsafeContentMessage() }, { status: 400 });
    }

    const { width, length, height } = dims.data;

    const result = await generateObject({
      model: google("gemini-3.6-flash"),
      schemaName: "room-design",
      schemaDescription: "A complete room design specification with furniture dimensions and budget.",
      schema: designSchema,
      system: ANALYSIS_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: buildAnalysisUserPrompt({ width, length, height, styleId, customPrompt }),
            },
            { type: "image", image: imageBase64 },
          ],
        },
      ],
    });

    return Response.json(result.object);
  } catch (err) {
    console.error("Design generation failed:", err);
    const message = err instanceof Error ? err.message : "Design generation failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
