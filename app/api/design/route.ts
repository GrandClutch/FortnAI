import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { designSchema, roomDimensionsSchema, obstacleSchema, type StylePresetId } from "@/lib/schema";
import { STYLE_PRESETS } from "@/lib/schema";
import { solveLayout } from "@/lib/placement";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `You are a world-class interior designer and spatial planner. You analyze a photograph of a room together with its physical dimensions (width × length × height) and produce a precise, buildable room design.

Rules:
- The provided dimensions are in feet. Use them to ensure every furniture piece fits comfortably with proper circulation space (at least 24" walkways).
- Recommend realistic, achievable pieces. For each, give a MAXIMUM dimension (in inches) that still leaves the room feeling open.
- Give realistic retail price estimates in USD for each piece.
- For every furniture piece, describe its placement as a RELATIONSHIP to a wall: wallRef (north/south/east/west), align (left/center/right), and offsetFt (distance in feet along that wall from the align anchor). Optionally set adjacentTo to another item's name. Never emit raw x/z coordinates.
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

    const obstaclesResult = obstacleSchema.array().safeParse(body.obstacles ?? []);
    if (!obstaclesResult.success) {
      return Response.json({ error: "Invalid doors/windows data" }, { status: 400 });
    }

    const { width, length, height } = dims.data;

    const userPrompt = [
      `Room dimensions: ${width} ft (width) × ${length} ft (length) × ${height} ft (height).`,
      obstaclesResult.data.length > 0
        ? `Fixed obstacles: ${obstaclesResult.data
            .map((o) => `${o.type} on ${o.wallRef} wall, ${o.offsetFt} ft from the wall's left/north end, ${o.widthFt} ft wide`)
            .join("; ")}. Keep furniture clear of these.`
        : "",
      `Design style: ${getStylePrompt(styleId)}`,
      `The room image is attached. Produce the full design specification: theme, spatial strategy, furniture list with max dimensions, cost, and wall-relative placement, total budget, lighting advice, and color palette.`,
    ]
      .filter(Boolean)
      .join("\n");

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

    const solved = solveLayout(result.object.furnitureRecommendations, {
      widthFt: width,
      lengthFt: length,
      heightFt: height,
      obstacles: obstaclesResult.data,
    });

    return Response.json({ ...result.object, layout: solved.items, layoutWarnings: solved.warnings });
  } catch (err) {
    console.error("Design generation failed:", err);
    const message = err instanceof Error ? err.message : "Design generation failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
