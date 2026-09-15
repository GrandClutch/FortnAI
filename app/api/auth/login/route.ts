import { loginSchema } from "@/lib/auth/schemas";
import { publicUser } from "@/lib/auth/types";
import { appendAuthCookie, createPocketBase } from "@/lib/pocketbase/server";
import { checkRateLimit, rateLimitResponse } from "@/lib/security/rateLimit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const limit = checkRateLimit(request, "auth-login", 10, 15 * 60 * 1000);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfter);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Check your login details" },
      { status: 400 }
    );
  }

  const pb = createPocketBase();

  try {
    await pb.collection("users").authWithPassword(parsed.data.email, parsed.data.password);

    const user = publicUser(pb.authStore.record);
    if (!user) {
      return Response.json({ error: "Unable to sign in" }, { status: 401 });
    }

    const response = Response.json({ user });
    return appendAuthCookie(response, pb);
  } catch (error) {
    console.error("Login failed:", error);
    return Response.json(
      { error: "Email or password is incorrect" },
      { status: 401 }
    );
  }
}
