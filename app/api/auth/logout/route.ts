import { appendAuthCookie, createPocketBase } from "@/lib/pocketbase/server";

export const runtime = "nodejs";

export async function POST() {
  const pb = createPocketBase();
  pb.authStore.clear();

  const response = Response.json({ ok: true });
  return appendAuthCookie(response, pb);
}
