import { google } from "@ai-sdk/google";
import { generateImage } from "ai";
import { designSchema, type StylePresetId } from "@/lib/schema";
import { STYLE_PRESETS } from "@/lib/schema";

export const runtime = "nodejs";

const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL ?? "gemini-2.5-flash-image";

function getStylePrompt(styleId: StylePresetId): string {
  const preset = STYLE_PRESETS.find((p) => p.id === styleId);
  return preset ? preset.prompt : "A cohesive, beautiful room design.";
}

function buildRenderPrompt(design: unknown, styleId: StylePresetId, width: number, length: number): string {
  const parsed = designSchema.safeParse(design);
  const d = parsed.success ? parsed.data : null;

  const furniture = d
    ? d.furnitureRecommendations
        .map((f) => `${f.item} (${f.width}"W × ${f.depth}"D × ${f.height}"H)`)
        .join("; ")
    : "well-chosen furniture";

  return [
    `Redesign this exact room interior. Keep the same camera angle, room shell, walls, windows, door positions, and floor plan.`,
    `The room is ${width} ft wide by ${length} ft long.`,
    `Replace the current contents with this curated furniture layout: ${furniture}.`,
    `Style: ${getStylePrompt(styleId)}.`,
    d
      ? `Follow this color palette: ${d.colorPalette.join(", ")}.`
      : "",
    `Lighting: ${d ? d.lightingAdvice : "warm, inviting lighting"}.`,
    `Photorealistic interior rendering, natural lighting, high detail, magazine-quality, 4k.`,
  ]
    .filter(Boolean)
    .join(" ");
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const imageBase64: string | undefined = body.imageBase64;
    if (!imageBase64 || typeof imageBase64 !== "string") {
      return Response.json({ error: "Room image is required" }, { status: 400 });
    }

    const design = body.design;
    if (!design) {
      return Response.json({ error: "Design specification is required" }, { status: 400 });
    }

    const width = Number(body.width ?? 12);
    const length = Number(body.length ?? 12);
    const styleId: StylePresetId = STYLE_PRESETS.some((p) => p.id === body.stylePreset)
      ? body.stylePreset
      : "minimalist";

    const prompt = buildRenderPrompt(design, styleId, width, length);

    const result = await generateImage({
      model: google.image(IMAGE_MODEL),
      prompt: {
        images: [imageBase64],
        text: prompt,
      },
      aspectRatio: "1:1",
      maxRetries: 1,
    });

    const image = result.images[0];
    if (!image) {
      return Response.json({ error: "No image was generated" }, { status: 500 });
    }

    const dataUrl = `data:${image.mediaType};base64,${image.base64}`;

    return Response.json({ image: dataUrl });
  } catch (err) {
    console.error("Render generation failed:", err);
    const message = err instanceof Error ? err.message : "Render generation failed";
    return Response.json({ error: message }, { status: 500 });
  }
}