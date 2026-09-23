import { getAuthenticatedClient } from "@/lib/pocketbase/server";
import { listProjects } from "@/lib/history";

export async function GET(req: Request) {
  const pb = await getAuthenticatedClient();
  if (!pb) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const page = Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1;
    const result = await listProjects(pb, page);
    return Response.json(result);
  } catch (err) {
    console.error("Design history list failed:", err);
    return Response.json({ error: "Could not load design history" }, { status: 500 });
  }
}