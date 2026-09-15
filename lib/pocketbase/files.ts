import { createHash } from "node:crypto";
import type { RecordModel } from "pocketbase";
import type PocketBase from "pocketbase";

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function validateImageFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return "Please upload a JPG, PNG, or WEBP image.";
  }
  if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
    return "Images must be smaller than 8 MB.";
  }
  return null;
}

export async function contentHash(file: File): Promise<string> {
  const bytes = Buffer.from(await file.arrayBuffer());
  return createHash("sha256").update(bytes).digest("hex");
}

export async function assetDataUrl(pb: PocketBase, asset: RecordModel): Promise<string> {
  const filename = typeof asset.file === "string" ? asset.file : "";
  if (!filename) throw new Error("Asset has no file");

  const token = await pb.files.getToken();
  const url = pb.files.getURL(asset, filename, { token });
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Unable to read asset (${response.status})`);

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength > MAX_UPLOAD_BYTES) throw new Error("Asset is too large");

  const mediaType =
    typeof asset.mimeType === "string" && asset.mimeType
      ? asset.mimeType
      : response.headers.get("content-type")?.split(";", 1)[0] ?? "image/jpeg";

  return `data:${mediaType};base64,${bytes.toString("base64")}`;
}

export function base64ToFile(base64: string, mediaType: string, name: string): File {
  return new File([Buffer.from(base64, "base64")], name, { type: mediaType });
}
