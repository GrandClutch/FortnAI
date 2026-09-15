import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import {
  designSchema,
  layoutItemSchema,
  persistedDesignSchema,
  STYLE_PRESETS,
  type StylePresetId,
} from "@/lib/schema";
import { ANALYSIS_SYSTEM_PROMPT, buildAnalysisUserPrompt } from "@/lib/prompts";
import { containsUnsafeContent } from "@/lib/safety";
import { solveLayout } from "@/lib/placement";
import { getRequestAuth } from "@/lib/auth/requireUser";
import { assertOwner } from "@/lib/auth/authorization";
import { designRunRequestSchema, projectInputSchema } from "@/lib/persistence/schema";
import { assetDataUrl } from "@/lib/pocketbase/files";
import { appendAuthCookie } from "@/lib/pocketbase/server";
import { checkRateLimit, rateLimitResponse } from "@/lib/security/rateLimit";

export const runtime = "nodejs";

function safeError(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export async function POST(request: Request) {
  const limit = checkRateLimit(request, "design-analysis", 5, 15 * 60 * 1000);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfter);

  const { pb, user } = await getRequestAuth();
  if (!user) {
    const response = Response.json({ error: "Sign in to design a room" }, { status: 401 });
    return appendAuthCookie(response, pb);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const requestData = designRunRequestSchema.safeParse(body);
  if (!requestData.success) {
    return Response.json({ error: "Project and room image are required" }, { status: 400 });
  }

  const { projectId, assetId } = requestData.data;
  const idempotencyKey = requestData.data.idempotencyKey ?? `analysis-${projectId}-${Date.now()}`;
  let run: { id: string } | null = null;
  let projectRecordId: string | null = null;

  try {
    const project = await pb.collection("projects").getOne(projectId);
    assertOwner(project, user.id);
    projectRecordId = project.id;

    const asset = await pb.collection("assets").getOne(assetId);
    assertOwner(asset, user.id);
    if (asset.project !== project.id || asset.kind !== "roomPhoto") {
      return Response.json({ error: "Invalid room image" }, { status: 400 });
    }

    const projectInput = projectInputSchema.safeParse({
      width: project.roomWidthFt,
      length: project.roomLengthFt,
      height: project.roomHeightFt,
      stylePreset: project.stylePreset || null,
      customPrompt: project.customPrompt || "",
      obstacles: Array.isArray(project.obstacles) ? project.obstacles : [],
      title: project.title || "Untitled room",
    });
    if (!projectInput.success) {
      return Response.json({ error: "Saved project data is invalid" }, { status: 500 });
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

    if (existingRun?.status === "completed" && existingRun.outputVersion) {
      const version = await pb.collection("designVersions").getOne(existingRun.outputVersion);
      assertOwner(version, user.id);
      const savedDesign = persistedDesignSchema.safeParse(version.designData);
      if (savedDesign.success) {
        const response = Response.json({
          ...savedDesign.data,
          projectId: project.id,
          versionId: version.id,
          runId: existingRun.id,
          layoutWarnings: version.layoutWarnings ?? [],
        });
        return appendAuthCookie(response, pb);
      }
    }

    if (existingRun?.status === "running") {
      return Response.json({ error: "This design is already being generated" }, { status: 409 });
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
          kind: "analysis",
          status: "running",
          model: "gemini-3.6-flash",
          inputAsset: asset.id,
          idempotencyKey,
          usageData: {},
          startedAt: new Date().toISOString(),
        });

    if (!run) throw new Error("Unable to create the design run");
    const activeRun = run;

    const startedAt = Date.now();
    const imageBase64 = await assetDataUrl(pb, asset);
    const styleId: StylePresetId | null = STYLE_PRESETS.some(
      (preset) => preset.id === projectInput.data.stylePreset
    )
      ? projectInput.data.stylePreset as StylePresetId
      : null;

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
              text: buildAnalysisUserPrompt({
                width: projectInput.data.width,
                length: projectInput.data.length,
                height: projectInput.data.height,
                styleId,
                customPrompt: projectInput.data.customPrompt,
                obstacles: projectInput.data.obstacles,
              }),
            },
            { type: "image", image: imageBase64 },
          ],
        },
      ],
    });

    if (containsUnsafeContent(JSON.stringify(result.object))) {
      await pb.collection("designRuns").update(activeRun.id, {
        status: "failed",
        errorMessage: "Unsafe generated content was rejected",
        finishedAt: new Date().toISOString(),
      });
      await pb.collection("projects").update(project.id, { status: "failed" });
      return Response.json({ error: "The generated design could not be made safe" }, { status: 400 });
    }

    const solved = solveLayout(result.object.furnitureRecommendations, {
      widthFt: projectInput.data.width,
      lengthFt: projectInput.data.length,
      heightFt: projectInput.data.height,
      obstacles: projectInput.data.obstacles,
    });

    const layoutCheck = layoutItemSchema.array().safeParse(solved.items);
    if (!layoutCheck.success) throw new Error("The generated layout was invalid");

    const savedDesign = {
      ...result.object,
      layout: layoutCheck.data,
      layoutWarnings: solved.warnings,
    };

    const latestVersion = await pb
      .collection("designVersions")
      .getList(1, 1, {
        filter: pb.filter("project = {:project}", { project: project.id }),
        sort: "-versionNumber",
      });
    const versionNumber = (latestVersion.items[0]?.versionNumber ?? 0) + 1;

    const version = await pb.collection("designVersions").create({
      project: project.id,
      owner: user.id,
      versionNumber,
      sourceRun: activeRun.id,
      inputSnapshot: projectInput.data,
      designData: savedDesign,
      layoutWarnings: solved.warnings,
      status: "draft",
    });

    await pb.collection("designRuns").update(activeRun.id, {
      status: "completed",
      outputVersion: version.id,
      finishedAt: new Date().toISOString(),
      usageData: { durationMs: Date.now() - startedAt },
    });

    await pb.collection("projects").update(project.id, {
      currentVersion: version.id,
      status: "ready",
    });

    const response = Response.json({
      ...savedDesign,
      projectId: project.id,
      versionId: version.id,
      runId: activeRun.id,
    });
    return appendAuthCookie(response, pb);
  } catch (error) {
    console.error("Design generation failed:", error);
    if (run) {
      await pb
        .collection("designRuns")
        .update(run.id, {
          status: "failed",
          errorMessage: safeError(error, "Design generation failed"),
          finishedAt: new Date().toISOString(),
        })
        .catch(() => undefined);
    }
    if (projectRecordId) {
      await pb.collection("projects").update(projectRecordId, { status: "failed" }).catch(() => undefined);
    }
    return Response.json(
      { error: "Design generation failed. Please try again." },
      { status: 500 }
    );
  }
}
