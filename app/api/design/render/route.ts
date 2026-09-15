import { google } from "@ai-sdk/google";
import { generateImage } from "ai";
import { sanitizeCustomPrompt, STYLE_PRESETS, type StylePresetId } from "@/lib/schema";
import { buildRenderPrompt } from "@/lib/prompts";
import { containsUnsafeContent, unsafeContentMessage } from "@/lib/safety";
import { appendAuthCookie, getPocketBaseFromRequest } from "@/lib/pocketbase/server";

export const runtime = "nodejs";

const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL ?? "gemini-2.5-flash-image";

export async function POST(req: Request) {
  try {
    const { pb } = await getPocketBaseFromRequest();
    if (!pb.authStore.isValid) {
      const response = Response.json({ error: "Sign in to render a room" }, { status: 401 });
      return appendAuthCookie(response, pb);
    }

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
    const styleId: StylePresetId | null = STYLE_PRESETS.some((p) => p.id === body.stylePreset)
      ? body.stylePreset
      : null;

    const customPrompt = sanitizeCustomPrompt(body.customPrompt);
    if (containsUnsafeContent(customPrompt)) {
      return Response.json({ error: unsafeContentMessage() }, { status: 400 });
    }

    const prompt = buildRenderPrompt({
      design,
      styleId,
      width,
      length,
      customPrompt,
    });

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

    const response = Response.json({ image: dataUrl });
    return appendAuthCookie(response, pb);
  } catch (err) {
    console.error("Render generation failed:", err);
    const message = err instanceof Error ? err.message : "Render generation failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
