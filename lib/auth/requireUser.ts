import { publicUser, type AuthUser } from "@/lib/auth/types";
import { getPocketBaseFromRequest } from "@/lib/pocketbase/server";
import type PocketBase from "pocketbase";

export interface RequestAuth {
  pb: PocketBase;
  user: AuthUser | null;
}

export async function getRequestAuth(): Promise<RequestAuth> {
  const { pb } = await getPocketBaseFromRequest();
  return { pb, user: publicUser(pb.authStore.record) };
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Authentication is required");
    this.name = "UnauthorizedError";
  }
}

export async function requireUser(): Promise<{
  pb: PocketBase;
  user: AuthUser;
}> {
  const { pb, user } = await getRequestAuth();
  if (!user) throw new UnauthorizedError();
  return { pb, user };
}
