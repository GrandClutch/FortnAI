import { signupSchema } from "@/lib/auth/schemas";
import { publicUser } from "@/lib/auth/types";
import { appendAuthCookie, createPocketBase } from "@/lib/pocketbase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Check your signup details" },
      { status: 400 }
    );
  }

  const pb = createPocketBase();

  try {
    await pb.collection("users").create({
      email: parsed.data.email,
      password: parsed.data.password,
      passwordConfirm: parsed.data.passwordConfirm,
      emailVisibility: false,
      role: "user",
    });

    await pb.collection("users").authWithPassword(parsed.data.email, parsed.data.password);

    const user = publicUser(pb.authStore.record);
    if (!user) {
      return Response.json({ error: "Account creation failed" }, { status: 500 });
    }

    const response = Response.json({ user }, { status: 201 });
    return appendAuthCookie(response, pb);
  } catch (error) {
    console.error("Signup failed:", error);
    return Response.json(
      { error: "Unable to create your account. Check your details and try again." },
      { status: 400 }
    );
  }
}
