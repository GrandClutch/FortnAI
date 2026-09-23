import { getAuthenticatedClient } from "@/lib/pocketbase/server";
import { getOwnedProject, toVersionSummary } from "@/lib/history";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const pb = await getAuthenticatedClient();
  if (!pb) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!(await getOwnedProject(pb, id))) {
    return Response.json({ error: "Design not found" }, { status: 404 });
  }

  const versions = await pb.collection("designVersions").getFullList({
    filter: `project = "${id}"`,
    sort: "-versionNumber",
  });

  return Response.json({ items: versions.map((v) => toVersionSummary(pb, v)) });
}