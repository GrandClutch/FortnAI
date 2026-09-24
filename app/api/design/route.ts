import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import {
  budgetRangeSchema,
  designSchema,
  obstacleSchema,
  roomDimensionsSchema,
  sanitizeCustomPrompt,
  STYLE_PRESETS,
  type StylePresetId,
} from "@/lib/schema";
import { ANALYSIS_SYSTEM_PROMPT, buildAnalysisUserPrompt } from "@/lib/prompts";
import { containsUnsafeContent, unsafeContentMessage } from "@/lib/safety";
import { solveLayout } from "@/lib/placement";
import { getAuthenticatedClient } from "@/lib/pocketbase/server";
import {
  completeVersion,
  createProject,
  createVersion,
  failVersion,
  getOwnedProject,
  maybeSetProjectTitle,
  touchProjectOpened,
  updateProjectInputs,
} from "@/lib/history";

export const runtime = "nodejs";

const DESIGN_MODEL = process.env.GEMINI_DESIGN_MODEL ?? "gemini-3.6-flash";

export async function POST(req: Request) {
  try {
    const pb = await getAuthenticatedClient();
    if (!pb) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    const obstaclesResult = obstacleSchema.array().safeParse(body.obstacles ?? []);
    if (!obstaclesResult.success) {
      return Response.json({ error: "Invalid doors/windows data" }, { status: 400 });
    }

    let budgetRange;
    if (body.budgetRange != null) {
      const budgetResult = budgetRangeSchema.safeParse(body.budgetRange);
      if (!budgetResult.success) {
        return Response.json({ error: "Invalid budget range" }, { status: 400 });
      }
      budgetRange = budgetResult.data;
    }

    const { width, length, height } = dims.data;

    const projectId =
      typeof body.projectId === "string" && body.projectId.length > 0 ? body.projectId : undefined;

    let project;
    if (projectId) {
      project = await getOwnedProject(pb, projectId);
      if (!project) {
        return Response.json({ error: "Design project not found" }, { status: 404 });
      }
      await updateProjectInputs(pb, project.id, { width, length, height, imageBase64 });
    } else {
      project = await createProject(pb, { width, length, height, imageBase64 });
    }

    if (project.archived) {
      return Response.json(
        { error: "This design is archived. Unarchive it before redesigning." },
        { status: 400 }
      );
    }

    await touchProjectOpened(pb, project.id).catch(() => undefined);

    const version = await createVersion(pb, {
      projectId: project.id,
      stylePreset: styleId,
      customPrompt,
      obstacles: obstaclesResult.data,
      model: DESIGN_MODEL,
    });

    try {
      const result = await generateObject({
        model: google(DESIGN_MODEL),
        schemaName: "room-design",
        schemaDescription:
          "A complete room design specification with furniture dimensions and budget.",
        schema: designSchema,
        system: ANALYSIS_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: buildAnalysisUserPrompt({
                  width,
                  length,
                  height,
                  styleId,
                  customPrompt,
                  obstacles: obstaclesResult.data,
                  budgetRange,
                }),
              },
              { type: "image", image: imageBase64 },
            ],
          },
        ],
      });

      const solved = solveLayout(result.object.furnitureRecommendations, {
        widthM: width,
        lengthM: length,
        heightM: height,
        obstacles: obstaclesResult.data,
      });

      const design = {
        ...result.object,
        layout: solved.items,
        layoutWarnings: solved.warnings,
        budgetRange,
      };

      await completeVersion(pb, version.id, design, result.object.designTheme);
      await maybeSetProjectTitle(pb, project.id, result.object.designTheme).catch(() => undefined);

      return Response.json({
        ...design,
        projectId: project.id,
        versionId: version.id,
      });
    } catch (genErr) {
      const message = genErr instanceof Error ? genErr.message : "Design generation failed";
      await failVersion(pb, version.id, message).catch(() => undefined);
      throw genErr;
    }
  } catch (err) {
    console.error("Design generation failed:", err);
    const message = err instanceof Error ? err.message : "Design generation failed";
    return Response.json({ error: message }, { status: 500 });
  }
}