import { createHmac, timingSafeEqual } from "node:crypto";

export interface GoogleOAuthChallenge {
  state: string;
  codeVerifier: string;
  redirectURL: string;
  expiresAt: number;
}

const OAUTH_SECRET =
  process.env.AUTH_OAUTH_SECRET ?? "fortnai-local-oauth-secret-change-me";

function sign(payload: string): string {
  return createHmac("sha256", OAUTH_SECRET).update(payload).digest("base64url");
}

export function serializeOAuthChallenge(challenge: GoogleOAuthChallenge): string {
  const payload = Buffer.from(JSON.stringify(challenge)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function parseOAuthChallenge(value: string | undefined): GoogleOAuthChallenge | null {
  if (!value) return null;

  try {
    const [payload, signature] = decodeURIComponent(value).split(".");
    if (!payload || !signature) return null;

    const expected = sign(payload);
    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (
      signatureBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(signatureBuffer, expectedBuffer)
    ) {
      return null;
    }

    const challenge = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as GoogleOAuthChallenge;

    if (
      typeof challenge.state !== "string" ||
      typeof challenge.codeVerifier !== "string" ||
      typeof challenge.redirectURL !== "string" ||
      typeof challenge.expiresAt !== "number" ||
      challenge.expiresAt < Date.now()
    ) {
      return null;
    }

    return challenge;
  } catch {
    return null;
  }
}
