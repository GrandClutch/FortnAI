import "server-only";

import { cookies } from "next/headers";
import PocketBase from "pocketbase";

import { AUTH_COOKIE_NAME, POCKETBASE_URL } from "./constants";

export async function createServerClient(options: { refresh?: boolean } = {}) {
  const pb = new PocketBase(POCKETBASE_URL);
  pb.autoCancellation(false);

  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  if (cookieHeader) {
    pb.authStore.loadFromCookie(cookieHeader, AUTH_COOKIE_NAME);
  }

  if (options.refresh && pb.authStore.isValid) {
    try {
      await pb.collection("users").authRefresh();
    } catch {
      pb.authStore.clear();
    }
  }

  return pb;
}

export async function getAuthenticatedClient() {
  const pb = await createServerClient({ refresh: true });
  return pb.authStore.isValid ? pb : null;
}

export async function setAuthCookie(pb: PocketBase) {
  const cookieStore = await cookies();
  cookieStore.set(
    AUTH_COOKIE_NAME,
    JSON.stringify({ token: pb.authStore.token, model: pb.authStore.model }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    }
  );
}

export async function clearAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE_NAME);
}
