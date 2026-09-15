import { getRequestAuth } from "@/lib/auth/requireUser";
import { projectInputSchema } from "@/lib/persistence/schema";
import { appendAuthCookie } from "@/lib/pocketbase/server";
import { contentHash, validateImageFile } from "@/lib/pocketbase/files";
import { containsUnsafeContent, unsafeContentMessage } from "@/lib/safety";
import { checkRateLimit, rateLimitResponse } from "@/lib/security/rateLimit";

export const runtime = "nodejs";

function parseObstacles(value: FormDataEntryValue | null): unknown[] {
  if (typeof value !== "string" || !value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function POST(request: Request) {
  const limit = checkRateLimit(request, "project-create", 10, 15 * 60 * 1000);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfter);

  const { pb, user } = await getRequestAuth();
  if (!user) {
    const response = Response.json({ error: "Sign in to create a project" }, { status: 401 });
    return appendAuthCookie(response, pb);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Invalid project upload" }, { status: 400 });
  }

  const photo = form.get("photo");
  if (!(photo instanceof File)) {
    return Response.json({ error: "Room image is required" }, { status: 400 });
  }

  const imageError = validateImageFile(photo);
  if (imageError) return Response.json({ error: imageError }, { status: 400 });

  let input: ReturnType<typeof projectInputSchema.safeParse>;
  try {
    input = projectInputSchema.safeParse({
      width: form.get("width"),
      length: form.get("length"),
      height: form.get("height"),
      stylePreset: form.get("stylePreset") || null,
      customPrompt: form.get("customPrompt") ?? "",
      obstacles: parseObstacles(form.get("obstacles")),
      title: form.get("title") || "Untitled room",
    });
  } catch {
    return Response.json({ error: "Invalid project details" }, { status: 400 });
  }

  if (!input.success) {
    return Response.json({ error: "Invalid project details" }, { status: 400 });
  }
  if (containsUnsafeContent(input.data.customPrompt)) {
    return Response.json({ error: unsafeContentMessage() }, { status: 400 });
  }

  let project: { id: string } | null = null;
  let asset: { id: string } | null = null;

  try {
    project = await pb.collection("projects").create({
      owner: user.id,
      title: input.data.title,
      status: "processing",
      roomWidthFt: input.data.width,
      roomLengthFt: input.data.length,
      roomHeightFt: input.data.height,
      stylePreset: input.data.stylePreset ?? "",
      customPrompt: input.data.customPrompt,
      obstacles: input.data.obstacles,
    });
    if (!project) throw new Error("Unable to create project");

    asset = await pb.collection("assets").create({
      project: project.id,
      owner: user.id,
      kind: "roomPhoto",
      file: photo,
      mimeType: photo.type,
      sizeBytes: photo.size,
      contentHash: await contentHash(photo),
    });
    if (!asset) throw new Error("Unable to create photo asset");

    await pb.collection("projects").update(project.id, {
      roomPhotoAsset: asset.id,
    });

    const response = Response.json(
      { projectId: project.id, assetId: asset.id },
      { status: 201 }
    );
    return appendAuthCookie(response, pb);
  } catch (error) {
    console.error("Project creation failed:", error);
    if (asset) {
      await pb.collection("assets").delete(asset.id).catch(() => undefined);
    }
    if (project) {
      await pb.collection("projects").delete(project.id).catch(() => undefined);
    }
    return Response.json(
      { error: "Unable to save this project. Check PocketBase configuration and try again." },
      { status: 500 }
    );
  }
}
