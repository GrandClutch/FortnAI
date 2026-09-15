import type { AuthUser } from "@/lib/auth/types";
import { hasPermission, type Permission } from "@/lib/auth/permissions";

export class ForbiddenError extends Error {
  constructor() {
    super("You do not have permission to perform this action");
    this.name = "ForbiddenError";
  }
}

export function requirePermission(user: AuthUser, permission: Permission): void {
  if (!hasPermission(user, permission)) throw new ForbiddenError();
}

export function assertOwner(record: unknown, userId: string): void {
  if (!record || typeof record !== "object" || (record as Record<string, unknown>).owner !== userId) {
    throw new ForbiddenError();
  }
}

export function canAccessRecord(
  user: AuthUser,
  record: unknown,
  ownPermission: Permission,
  anyPermission: Permission
): boolean {
  const owner = record && typeof record === "object"
    ? (record as Record<string, unknown>).owner
    : undefined;
  if (owner === user.id) return hasPermission(user, ownPermission);
  return hasPermission(user, anyPermission);
}
