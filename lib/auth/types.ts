export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
  verified: boolean;
}

type AuthRecord = Record<string, unknown> & { id?: string };

export function publicUser(record: unknown): AuthUser | null {
  if (!record || typeof record !== "object") return null;

  const data = record as AuthRecord;
  if (typeof data.id !== "string" || !data.id) return null;

  return {
    id: data.id,
    email: typeof data.email === "string" ? data.email : "",
    displayName: typeof data.displayName === "string" ? data.displayName : "",
    role: typeof data.role === "string" && data.role ? data.role : "user",
    verified: data.verified === true,
  };
}
