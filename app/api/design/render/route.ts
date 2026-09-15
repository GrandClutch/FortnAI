import { google } from "@ai-sdk/google";
import { generateImage } from "ai";
import {
  persistedDesignSchema,
  roomDimensionsSchema,
  sanitizeCustomPrompt,
  STYLE_PRESETS,
  type StylePresetId,
} from "@/lib/schema";
import { buildRenderPrompt } from "@/lib/prompts";
import { containsUnsafeContent, unsafeContentMessage } from "@/lib/safety";
import { assertOwner } from "@/lib/auth/authorization";
import { getRequestAuth } from "@/lib/auth/requireUser";
import { renderRunRequestSchema } from "@/lib/persistence/schema";
import { assetDataUrl, base64ToFile, contentHash } from "@/lib/pocketbase/files";
import { appendAuthCookie } from "@/lib/pocketbase/server";
import { checkRateLimit, rateLimitResponse } from "@/lib/security/rateLimit";

export const runtime = "nodejs";

const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL ?? "gemini-2.5-flash-image";

export async function POST(request: Request) {
  const limit = checkRateLimit(request, "design-render", 3, 15 * 60 * 1000);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfter);

  const { pb, user } = await getRequestAuth();
  if (!user) {
    const response = Response.json({ error: "Sign in to render a room" }, { status: 401 });
    return appendAuthCookie(response, pb);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const requestData = renderRunRequestSchema.safeParse(body);
  if (!requestData.success) {
    return Response.json({ error: "Project and design version are required" }, { status: 400 });
  }

  const { projectId, versionId } = requestData.data;
  const idempotencyKey = requestData.data.idempotencyKey ?? `render-${versionId}`;
  let run: { id: string } | null = null;

  try {
    const project = await pb.collection("projects").getOne(projectId);
    assertOwner(project, user.id);

    const version = await pb.collection("designVersions").getOne(versionId);
    assertOwner(version, user.id);
    if (version.project !== project.id) {
      return Response.json({ error: "Invalid design version" }, { status: 400 });
    }

    const existingRun = await pb
      .collection("designRuns")
      .getFirstListItem(
        pb.filter("project = {:project} && idempotencyKey = {:key}", {
          project: project.id,
          key: idempotencyKey,
        })
      )
      .catch(() => null);

    if (existingRun?.status === "completed" && existingRun.outputAsset) {
      const asset = await pb.collection("assets").getOne(existingRun.outputAsset);
      assertOwner(asset, user.id);
      const image = await assetDataUrl(pb, asset);
      const response = Response.json({
        image,
        projectId: project.id,
        versionId: version.id,
        runId: existingRun.id,
        assetId: asset.id,
      });
      return appendAuthCookie(response, pb);
    }

    if (existingRun?.status === "running") {
      return Response.json({ error: "This render is already being generated" }, { status: 409 });
    }

    const roomDimensions = roomDimensionsSchema.safeParse({
      width: project.roomWidthFt,
      length: project.roomLengthFt,
      height: project.roomHeightFt,
    });
    if (!roomDimensions.success) {
      return Response.json({ error: "Saved room dimensions are invalid" }, { status: 500 });
    }

    const designCheck = persistedDesignSchema.safeParse(version.designData);
    if (!designCheck.success) {
      return Response.json({ error: "Saved design version is invalid" }, { status: 500 });
    }

    if (containsUnsafeContent(JSON.stringify(version.designData))) {
      return Response.json({ error: unsafeContentMessage() }, { status: 400 });
    }

    const photoAssetId = project.roomPhotoAsset;
    if (typeof photoAssetId !== "string" || !photoAssetId) {
      return Response.json({ error: "Room image is missing" }, { status: 400 });
    }
    const photoAsset = await pb.collection("assets").getOne(photoAssetId);
    assertOwner(photoAsset, user.id);
    const imageBase64 = await assetDataUrl(pb, photoAsset);

    const styleId: StylePresetId | null = STYLE_PRESETS.some(
      (preset) => preset.id === project.stylePreset
    )
      ? project.stylePreset as StylePresetId
      : null;
    const customPrompt = sanitizeCustomPrompt(project.customPrompt);
    if (containsUnsafeContent(customPrompt)) {
      return Response.json({ error: unsafeContentMessage() }, { status: 400 });
    }

    run = existingRun
      ? await pb.collection("designRuns").update(existingRun.id, {
          status: "running",
          errorMessage: "",
          startedAt: new Date().toISOString(),
          finishedAt: "",
        })
      : await pb.collection("designRuns").create({
          project: project.id,
          owner: user.id,
          kind: "render",
          status: "running",
          model: IMAGE_MODEL,
          inputAsset: photoAsset.id,
          inputVersion: version.id,
          idempotencyKey,
          usageData: {},
          startedAt: new Date().toISOString(),
        });

    if (!run) throw new Error("Unable to create the render run");
    const activeRun = run;

    const result = await generateImage({
      model: google.image(IMAGE_MODEL),
      prompt: {
        images: [imageBase64],
        text: buildRenderPrompt({
          design: designCheck.data,
          styleId,
          width: roomDimensions.data.width,
          length: roomDimensions.data.length,
          customPrompt,
        }),
      },
      aspectRatio: "1:1",
      maxRetries: 1,
    });

    const image = result.images[0];
    if (!image) throw new Error("No image was generated");

    const imageFile = base64ToFile(
      image.base64,
      image.mediaType,
      `render-${project.id}-${version.id}.png`
    );
    const asset = await pb.collection("assets").create({
      project: project.id,
      owner: user.id,
      kind: "render",
      file: imageFile,
      mimeType: image.mediaType,
      sizeBytes: imageFile.size,
      contentHash: await contentHash(imageFile),
      sourceRun: activeRun.id,
      designVersion: version.id,
    });

    await pb.collection("designVersions").update(version.id, {
      renderAsset: asset.id,
    });
    await pb.collection("designRuns").update(activeRun.id, {
      status: "completed",
      outputAsset: asset.id,
      finishedAt: new Date().toISOString(),
    });

    const response = Response.json({
      image: `data:${image.mediaType};base64,${image.base64}`,
      projectId: project.id,
      versionId: version.id,
      runId: activeRun.id,
      assetId: asset.id,
    });
    return appendAuthCookie(response, pb);
  } catch (error) {
    console.error("Render generation failed:", error);
    if (run) {
      await pb
        .collection("designRuns")
        .update(run.id, {
          status: "failed",
          errorMessage: error instanceof Error ? error.message : "Render generation failed",
          finishedAt: new Date().toISOString(),
        })
        .catch(() => undefined);
    }
    return Response.json(
      { error: "Render generation failed. Please try again." },
      { status: 500 }
    );
  }
}
