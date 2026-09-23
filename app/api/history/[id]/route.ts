import { z } from "zod";

import { getAuthenticatedClient } from "@/lib/pocketbase/server";
import {
  deleteProject,
  getProjectDetail,
  renameProject,
  setProjectArchived,
  touchProjectOpened,
} from "@/lib/history";

const patchSchema = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    archived: z.boolean().optional(),
  })
  .refine((d) => d.title !== undefined || d.archived !== undefined, {
    message: "Nothing to update",
  });

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const pb = await getAuthenticatedClient();
  if (!pb) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const detail = await getProjectDetail(pb, id);
  if (!detail) {
    return Response.json({ error: "Design not found" }, { status: 404 });
  }

  await touchProjectOpened(pb, id).catch(() => undefined);

  return Response.json(detail);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const pb = await getAuthenticatedClient();
  if (!pb) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!(await getProjectDetail(pb, id))) {
    return Response.json({ error: "Design not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid update" }, { status: 400 });
  }

  try {
    if (parsed.data.title !== undefined) {
      await renameProject(pb, id, parsed.data.title);
    }
    if (parsed.data.archived !== undefined) {
      await setProjectArchived(pb, id, parsed.data.archived);
    }
  } catch (err) {
    console.error("Design history update failed:", err);
    return Response.json({ error: "Could not update design" }, { status: 500 });
  }

  const detail = await getProjectDetail(pb, id);
  return Response.json(detail);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const pb = await getAuthenticatedClient();
  if (!pb) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!(await getProjectDetail(pb, id))) {
    return Response.json({ error: "Design not found" }, { status: 404 });
  }

  try {
    await deleteProject(pb, id);
  } catch (err) {
    console.error("Design history delete failed:", err);
    return Response.json({ error: "Could not delete design" }, { status: 500 });
  }

  return Response.json({ ok: true });
}