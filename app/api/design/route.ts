import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { designSchema, roomDimensionsSchema, type StylePresetId } from "@/lib/schema";
import { STYLE_PRESETS } from "@/lib/schema";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `You are a world-class interior designer and spatial planner. You analyze a photograph of a room together with its physical dimensions (width × length × height) and produce a precise, buildable room design.

Rules:
- The provided dimensions are in feet. Use them to ensure every furniture piece fits comfortably with proper circulation space (at least 24" walkways).
- Recommend realistic, achievable pieces. For each, give a MAXIMUM dimension (in inches) that still leaves the room feeling open.
- Give realistic retail price estimates in USD for each piece.
- Output ONLY the JSON object matching the schema. No conversational text.`;

function getStylePrompt(styleId: StylePresetId): string {
  const preset = STYLE_PRESETS.find((p) => p.id === styleId);
  return preset ? preset.prompt : "A cohesive, beautiful room design.";
}

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

    const styleId: StylePresetId = STYLE_PRESETS.some((p) => p.id === body.stylePreset)
      ? body.stylePreset
      : "minimalist";

    const { width, length, height } = dims.data;

    const userPrompt = [
      `Room dimensions: ${width} ft (width) × ${length} ft (length) × ${height} ft (height).`,
      `Design style: ${getStylePrompt(styleId)}`,
      `The room image is attached. Produce the full design specification: theme, spatial strategy, furniture list with max dimensions and cost, total budget, lighting advice, and color palette.`,
    ].join("\n");

    const result = await generateObject({
      model: google("gemini-3.6-flash"),
      schemaName: "room-design",
      schemaDescription: "A complete room design specification with furniture dimensions and budget.",
      schema: designSchema,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: userPrompt },
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
