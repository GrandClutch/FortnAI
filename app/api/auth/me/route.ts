import { publicUser } from "@/lib/auth/types";
import { appendAuthCookie, getPocketBaseFromRequest } from "@/lib/pocketbase/server";

export const runtime = "nodejs";

export async function GET() {
  const { pb } = await getPocketBaseFromRequest();
  const response = Response.json({ user: publicUser(pb.authStore.record) }, {
    headers: { "Cache-Control": "no-store" },
  });

  return appendAuthCookie(response, pb);
}
