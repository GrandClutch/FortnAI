import { NextRequest, NextResponse } from "next/server";
import {
  appendOAuthCookie,
  createPocketBase,
} from "@/lib/pocketbase/server";
import { serializeOAuthChallenge } from "@/lib/auth/oauth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const pb = createPocketBase();

  try {
    const methods = await pb.collection("users").listAuthMethods();
    const provider = methods.oauth2?.providers.find((item) => item.name === "google");

    if (!provider) {
      return Response.json(
        { error: "Google sign-in is not configured in PocketBase" },
        { status: 503 }
      );
    }

    const redirectURL = new URL("/api/auth/google/callback", request.nextUrl.origin).toString();
    const providerURL = new URL(provider.authURL);
    providerURL.searchParams.set("redirect_uri", redirectURL);

    const response = NextResponse.redirect(providerURL);
    appendOAuthCookie(
      response,
      serializeOAuthChallenge({
        state: provider.state,
        codeVerifier: provider.codeVerifier,
        redirectURL,
        expiresAt: Date.now() + 10 * 60 * 1000,
      })
    );

    return response;
  } catch (error) {
    console.error("Google OAuth start failed:", error);
    return Response.json(
      { error: "Google sign-in is currently unavailable" },
      { status: 503 }
    );
  }
}
