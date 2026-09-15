import type { AuthUser } from "@/lib/auth/types";

export type Permission =
  | "project:create"
  | "project:readOwn"
  | "project:updateOwn"
  | "project:deleteOwn"
  | "history:readOwn"
  | "history:updateOwn"
  | "history:deleteOwn"
  | "history:readAny"
  | "history:manageAny";

const ROLE_PERMISSIONS: Record<string, readonly Permission[]> = {
  user: [
    "project:create",
    "project:readOwn",
    "project:updateOwn",
    "project:deleteOwn",
    "history:readOwn",
    "history:updateOwn",
    "history:deleteOwn",
  ],
  designer: [
    "project:create",
    "project:readOwn",
    "project:updateOwn",
    "project:deleteOwn",
    "history:readOwn",
    "history:updateOwn",
    "history:deleteOwn",
  ],
  admin: [
    "project:create",
    "project:readOwn",
    "project:updateOwn",
    "project:deleteOwn",
    "history:readOwn",
    "history:updateOwn",
    "history:deleteOwn",
    "history:readAny",
    "history:manageAny",
  ],
};

export function hasPermission(user: AuthUser, permission: Permission): boolean {
  return ROLE_PERMISSIONS[user.role]?.includes(permission) ?? false;
}

export function permissionsForRole(role: string): readonly Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}
