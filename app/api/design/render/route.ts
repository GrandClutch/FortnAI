import { google } from "@ai-sdk/google";
import { generateImage } from "ai";
import { sanitizeCustomPrompt } from "@/lib/schema";
import { buildRenderPrompt } from "@/lib/prompts";
import { containsUnsafeContent, unsafeContentMessage } from "@/lib/safety";
import { isTimeoutError } from "@/lib/errors";
import { getAuthenticatedClient } from "@/lib/pocketbase/server";
import {
  attachRenderImage,
  getOwnedProject,
  recordFileDataUrl,
  stylePresetId,
} from "@/lib/history";

export const runtime = "nodejs";

const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL ?? "gemini-2.5-flash-image";
const RENDER_TIMEOUT_MS = 120_000;

export async function POST(req: Request) {
  try {
    const pb = await getAuthenticatedClient();
    if (!pb) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    const projectId: string | undefined = body.projectId;
    const versionId: string | undefined = body.versionId;
    if (typeof projectId !== "string" || typeof versionId !== "string") {
      return Response.json({ error: "projectId and versionId are required" }, { status: 400 });
    }

    const project = await getOwnedProject(pb, projectId);
    if (!project) {
      return Response.json({ error: "Design not found" }, { status: 404 });
    }

    let version;
    try {
      version = await pb.collection("designVersions").getOne(versionId);
    } catch {
      return Response.json({ error: "Design not found" }, { status: 404 });
    }
    if (version.project !== projectId || version.owner !== project.owner) {
      return Response.json({ error: "Design not found" }, { status: 404 });
    }
    if (version.status !== "completed" || !version.designResult) {
      return Response.json({ error: "No completed design to render" }, { status: 400 });
    }

    const styleId = stylePresetId(version.stylePreset);
    const customPrompt = sanitizeCustomPrompt(version.customPrompt);
    if (containsUnsafeContent(customPrompt)) {
      return Response.json({ error: unsafeContentMessage() }, { status: 400 });
    }

    const imageBase64 = await recordFileDataUrl(pb, project, "roomImage");

    const prompt = buildRenderPrompt({
      design: version.designResult,
      styleId,
      width: project.width as number,
      length: project.length as number,
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
      abortSignal: AbortSignal.timeout(RENDER_TIMEOUT_MS),
    });

    const image = result.images[0];
    if (!image) {
      return Response.json({ error: "No image was generated" }, { status: 500 });
    }

    const dataUrl = `data:${image.mediaType};base64,${image.base64}`;
    const updated = await attachRenderImage(pb, versionId, dataUrl);

    return Response.json({
      image: dataUrl,
      renderImageUrl: updated.renderImage
        ? pb.files.getURL(updated, updated.renderImage, { thumb: "768x768" })
        : null,
    });
  } catch (err) {
    console.error("Render generation failed:", err);
    if (isTimeoutError(err)) {
      return Response.json(
        { error: "Image generation timed out. Please try again." },
        { status: 504 }
      );
    }
    const message = err instanceof Error ? err.message : "Render generation failed";
    return Response.json({ error: message }, { status: 500 });
  }
}