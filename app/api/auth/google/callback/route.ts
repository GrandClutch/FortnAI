import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { appendAuthCookie, clearOAuthCookie, createPocketBase, GOOGLE_OAUTH_COOKIE_NAME } from "@/lib/pocketbase/server";
import { parseOAuthChallenge } from "@/lib/auth/oauth";
import { publicUser } from "@/lib/auth/types";

export const runtime = "nodejs";

function callbackPage(origin: string, type: "success" | "error", message?: string): Response {
  const safeOrigin = JSON.stringify(origin);
  const safeHome = JSON.stringify(new URL("/", origin).toString());
  const safeMessage = JSON.stringify(message ?? "");

  const html = `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>FortnAI authentication</title></head>
  <body>
    <p>${type === "success" ? "Signed in. You can close this window." : "Sign-in failed. You can close this window."}</p>
    <script>
      const payload = { source: "fortnai-auth", type: ${JSON.stringify(type)}, message: ${safeMessage} };
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage(payload, ${safeOrigin});
        window.close();
      } else {
        window.location.replace(${safeHome});
      }
    </script>
  </body>
</html>`;

  return new Response(html, {
    status: type === "success" ? 200 : 400,
    headers: {
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'none'; script-src 'unsafe-inline'",
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const error = request.nextUrl.searchParams.get("error");
  if (error) {
    const response = callbackPage(origin, "error", "Google sign-in was cancelled");
    return clearOAuthCookie(response);
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const cookieStore = await cookies();
  const challenge = parseOAuthChallenge(cookieStore.get(GOOGLE_OAUTH_COOKIE_NAME)?.value);

  if (!code || !state || !challenge || challenge.state !== state) {
    const response = callbackPage(origin, "error", "The Google sign-in session expired");
    return clearOAuthCookie(response);
  }

  const pb = createPocketBase();

  try {
    await pb.collection("users").authWithOAuth2Code(
      "google",
      code,
      challenge.codeVerifier,
      challenge.redirectURL,
      { role: "user", emailVisibility: false }
    );

    const user = publicUser(pb.authStore.record);
    if (!user) throw new Error("Google authentication returned no user");

    const response = callbackPage(origin, "success");
    appendAuthCookie(response, pb);
    return clearOAuthCookie(response);
  } catch (error) {
    console.error("Google OAuth callback failed:", error);
    const response = callbackPage(origin, "error", "Google sign-in could not be completed");
    return clearOAuthCookie(response);
  }
}
