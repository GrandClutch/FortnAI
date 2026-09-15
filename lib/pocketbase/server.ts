import PocketBase from "pocketbase";
import { cookies } from "next/headers";

export const AUTH_COOKIE_NAME = "pb_auth";
export const GOOGLE_OAUTH_COOKIE_NAME = "fortnai_google_oauth";
export const POCKETBASE_URL = process.env.POCKETBASE_URL ?? "http://127.0.0.1:8090";

const isProduction = process.env.NODE_ENV === "production";

export function createPocketBase(): PocketBase {
  return new PocketBase(POCKETBASE_URL);
}

export async function getPocketBaseFromRequest(): Promise<{
  pb: PocketBase;
  refreshed: boolean;
}> {
  const pb = createPocketBase();
  const cookieStore = await cookies();
  pb.authStore.loadFromCookie(cookieStore.toString(), AUTH_COOKIE_NAME);

  let refreshed = false;
  if (pb.authStore.isValid) {
    try {
      await pb.collection("users").authRefresh();
      refreshed = true;
    } catch {
      pb.authStore.clear();
      refreshed = true;
    }
  }

  return { pb, refreshed };
}

export function appendAuthCookie(response: Response, pb: PocketBase): Response {
  response.headers.append(
    "Set-Cookie",
    pb.authStore.exportToCookie(
      {
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax",
        path: "/",
      },
      AUTH_COOKIE_NAME
    )
  );

  return response;
}

export function appendOAuthCookie(
  response: Response,
  value: string,
  maxAge = 600
): Response {
  const secure = isProduction ? "; Secure" : "";
  response.headers.append(
    "Set-Cookie",
    `${GOOGLE_OAUTH_COOKIE_NAME}=${encodeURIComponent(value)}; Path=/api/auth/google; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`
  );
  return response;
}

export function clearOAuthCookie(response: Response): Response {
  return appendOAuthCookie(response, "", 0);
}
