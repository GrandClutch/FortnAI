import "server-only";

import type PocketBase from "pocketbase";
import { type RecordModel } from "pocketbase";

import { STYLE_PRESETS, type DesignResult, type Obstacle, type StylePresetId } from "@/lib/schema";

export const HISTORY_PAGE_SIZE = 24;
export const MAX_HISTORY_PAGE = 20;

export const DEFAULT_PROJECT_TITLE = "New room analysis";
export const DEFAULT_VERSION_TITLE = "Design";

export type VersionStatus = "processing" | "completed" | "failed";

export interface VersionSummary {
  id: string;
  versionNumber: number;
  title: string;
  status: VersionStatus;
  model: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  renderImageUrl: string | null;
  hasRender: boolean;
}

export interface RecentVersionSummary {
  id: string;
  versionNumber: number;
  title: string;
  status: VersionStatus;
  budget: number | null;
  designTheme: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectSummary {
  id: string;
  title: string;
  width: number;
  length: number;
  height: number;
  archived: boolean;
  lastOpened: string | null;
  createdAt: string;
  updatedAt: string;
  roomImageUrl: string | null;
  latestVersion: RecentVersionSummary | null;
}

export interface ProjectDetail extends ProjectSummary {
  currentVersionId: string | null;
  stylePreset: StylePresetId | null;
  customPrompt: string | null;
  obstacles: Obstacle[];
  renderImageUrl: string | null;
  design: DesignResult | null;
}

export function stylePresetId(value: unknown): StylePresetId | null {
  return typeof value === "string" && STYLE_PRESETS.some((p) => p.id === value)
    ? (value as StylePresetId)
    : null;
}

export function imageParts(dataUrl: string): { mime: string; base64: string } {
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl.trim());
  if (!match) {
    throw new Error("Invalid image data URL");
  }
  return { mime: `image/${match[1]}`, base64: match[2] };
}

function base64ToBlob(base64: string, mime: string): Blob {
  const bytes = Buffer.from(base64, "base64");
  return new Blob([new Uint8Array(bytes)], { type: mime });
}

function fileUrl(
  pb: PocketBase,
  record: { collectionId: string; id: string },
  filename: string | undefined,
  thumb?: string
): string | null {
  if (!filename) return null;
  return pb.files.getURL(record, filename, thumb ? { thumb } : {});
}

export function toVersionSummary(pb: PocketBase, v: RecordModel): VersionSummary {
  return {
    id: v.id,
    versionNumber: v.versionNumber as number,
    title: (v.title as string) || DEFAULT_VERSION_TITLE,
    status: v.status as VersionStatus,
    model: (v.model as string | null) ?? null,
    errorMessage: (v.errorMessage as string | null) ?? null,
    createdAt: v.createdAt as string,
    updatedAt: v.updatedAt as string,
    renderImageUrl: fileUrl(pb, v, v.renderImage as string | undefined, "768x768"),
    hasRender: Boolean(v.renderImage),
  };
}

function toRecentVersionSummary(pb: PocketBase, v: RecordModel): RecentVersionSummary {
  const design = v.designResult as Partial<DesignResult> | null | undefined;
  return {
    id: v.id,
    versionNumber: v.versionNumber as number,
    title: (v.title as string) || DEFAULT_VERSION_TITLE,
    status: v.status as VersionStatus,
    budget:
      design && typeof design.totalEstimatedBudget === "number"
        ? design.totalEstimatedBudget
        : null,
    designTheme:
      design && typeof design.designTheme === "string" ? design.designTheme : null,
    createdAt: v.createdAt as string,
    updatedAt: v.updatedAt as string,
  };
}

function toProjectSummary(
  pb: PocketBase,
  p: RecordModel,
  latest: RecordModel | null
): ProjectSummary {
  return {
    id: p.id,
    title: (p.title as string) || DEFAULT_PROJECT_TITLE,
    width: p.width as number,
    length: p.length as number,
    height: p.height as number,
    archived: Boolean(p.archived),
    lastOpened: (p.lastOpened as string | null) ?? null,
    createdAt: p.createdAt as string,
    updatedAt: p.updatedAt as string,
    roomImageUrl: fileUrl(pb, p, p.roomImage as string | undefined, "256x256"),
    latestVersion: latest ? toRecentVersionSummary(pb, latest) : null,
  };
}

export async function latestVersionFor(
  pb: PocketBase,
  projectId: string
): Promise<RecordModel | null> {
  try {
    return await pb
      .collection("designVersions")
      .getFirstListItem(`project = "${projectId}"`, { sort: "-versionNumber", skipTotal: true });
  } catch {
    return null;
  }
}

async function latestVersionsForProjects(
  pb: PocketBase,
  projectIds: string[]
): Promise<Map<string, RecordModel>> {
  const map = new Map<string, RecordModel>();
  if (projectIds.length === 0) return map;
  const filter = projectIds.map((id) => `project = "${id}"`).join(" || ");
  const versions = await pb
    .collection("designVersions")
    .getFullList({ filter, sort: "-versionNumber" });
  for (const v of versions) {
    const project = v.project as string;
    if (!map.has(project)) map.set(project, v);
  }
  return map;
}

export interface ProjectListResult {
  items: ProjectSummary[];
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
}

export async function listProjects(pb: PocketBase, page: number): Promise<ProjectListResult> {
  const safePage = Math.min(MAX_HISTORY_PAGE, Math.max(1, page));
  const list = await pb.collection("projects").getList(safePage, HISTORY_PAGE_SIZE, {
    sort: "-updatedAt",
  });
  const latest = await latestVersionsForProjects(pb, list.items.map((p) => p.id));
  return {
    items: list.items.map((p) => toProjectSummary(pb, p, latest.get(p.id) ?? null)),
    page: list.page,
    perPage: list.perPage,
    totalItems: list.totalItems,
    totalPages: list.totalPages,
  };
}

export async function getOwnedProject(
  pb: PocketBase,
  projectId: string
): Promise<RecordModel | null> {
  try {
    return await pb.collection("projects").getOne(projectId);
  } catch {
    return null;
  }
}

export async function getProjectDetail(
  pb: PocketBase,
  projectId: string
): Promise<ProjectDetail | null> {
  const project = await getOwnedProject(pb, projectId);
  if (!project) return null;

  const versions = await pb.collection("designVersions").getFullList({
    filter: `project = "${projectId}"`,
    sort: "-versionNumber",
  });
  const latest = versions[0] ?? null;
  const current = versions.find((v) => v.status === "completed" && v.designResult) ?? latest;
  const design = current?.designResult as DesignResult | null | undefined;

  return {
    ...toProjectSummary(pb, project, latest),
    roomImageUrl: fileUrl(pb, project, project.roomImage as string | undefined),
    currentVersionId: current?.id ?? null,
    stylePreset: stylePresetId(current?.stylePreset),
    customPrompt: (current?.customPrompt as string | null) ?? null,
    obstacles: Array.isArray(current?.obstacles) ? (current.obstacles as Obstacle[]) : [],
    renderImageUrl: fileUrl(pb, current!, current?.renderImage as string | undefined, "768x768"),
    design: design ?? null,
  };
}

export async function createProject(
  pb: PocketBase,
  opts: { width: number; length: number; height: number; imageBase64: string }
): Promise<RecordModel> {
  const { mime, base64 } = imageParts(opts.imageBase64);
  return pb.collection("projects").create({
    owner: authRecordId(pb),
    title: DEFAULT_PROJECT_TITLE,
    width: opts.width,
    length: opts.length,
    height: opts.height,
    roomImage: base64ToBlob(base64, mime),
    lastOpened: new Date().toISOString(),
  });
}

export async function touchProjectOpened(pb: PocketBase, projectId: string): Promise<void> {
  await pb.collection("projects").update(projectId, { lastOpened: new Date().toISOString() });
}

export async function updateProjectInputs(
  pb: PocketBase,
  projectId: string,
  opts: { width: number; length: number; height: number; imageBase64: string }
): Promise<void> {
  const { mime, base64 } = imageParts(opts.imageBase64);
  await pb.collection("projects").update(projectId, {
    width: opts.width,
    length: opts.length,
    height: opts.height,
    roomImage: base64ToBlob(base64, mime),
    lastOpened: new Date().toISOString(),
  });
}

export async function renameProject(
  pb: PocketBase,
  projectId: string,
  title: string
): Promise<void> {
  await pb.collection("projects").update(projectId, { title: title.trim().slice(0, 120) });
}

export async function setProjectArchived(
  pb: PocketBase,
  projectId: string,
  archived: boolean
): Promise<void> {
  await pb.collection("projects").update(projectId, { archived });
}

export async function deleteProject(pb: PocketBase, projectId: string): Promise<void> {
  await pb.collection("projects").delete(projectId);
}

export async function nextVersionNumber(
  pb: PocketBase,
  projectId: string
): Promise<number> {
  const latest = await latestVersionFor(pb, projectId);
  return latest ? (latest.versionNumber as number) + 1 : 1;
}

export async function createVersion(
  pb: PocketBase,
  opts: {
    projectId: string;
    stylePreset: StylePresetId | null;
    customPrompt: string;
    obstacles: Obstacle[];
    model: string;
  }
): Promise<RecordModel> {
  const versionNumber = await nextVersionNumber(pb, opts.projectId);
  const data: Record<string, unknown> = {
    owner: authRecordId(pb),
    project: opts.projectId,
    versionNumber,
    title: DEFAULT_VERSION_TITLE,
    status: "processing",
    model: opts.model,
  };
  if (opts.stylePreset) data.stylePreset = opts.stylePreset;
  if (opts.customPrompt) data.customPrompt = opts.customPrompt;
  if (opts.obstacles.length > 0) data.obstacles = opts.obstacles;
  return pb.collection("designVersions").create(data);
}

export async function completeVersion(
  pb: PocketBase,
  versionId: string,
  designResult: DesignResult,
  title?: string
): Promise<void> {
  const data: Record<string, unknown> = { designResult, status: "completed", isSaved: true };
  if (title) data.title = title.trim().slice(0, 120) || DEFAULT_VERSION_TITLE;
  await pb.collection("designVersions").update(versionId, data);
}

export async function updateVersionDesign(
  pb: PocketBase,
  versionId: string,
  designResult: DesignResult
): Promise<void> {
  await pb.collection("designVersions").update(versionId, { designResult });
}

export async function failVersion(
  pb: PocketBase,
  versionId: string,
  message: string
): Promise<void> {
  await pb
    .collection("designVersions")
    .update(versionId, { status: "failed", errorMessage: message.slice(0, 2000) });
}

export async function maybeSetProjectTitle(
  pb: PocketBase,
  projectId: string,
  designTheme: string
): Promise<void> {
  const project = await pb.collection("projects").getOne(projectId, { fields: "title" });
  if (!project.title || project.title === DEFAULT_PROJECT_TITLE) {
    await pb
      .collection("projects")
      .update(projectId, { title: designTheme.trim().slice(0, 120) || DEFAULT_PROJECT_TITLE });
  }
}

export async function attachRenderImage(
  pb: PocketBase,
  versionId: string,
  imageDataUrl: string
): Promise<RecordModel> {
  const { mime, base64 } = imageParts(imageDataUrl);
  return pb.collection("designVersions").update(versionId, {
    renderImage: base64ToBlob(base64, mime),
  });
}

export async function recordFileDataUrl(
  pb: PocketBase,
  record: RecordModel,
  fieldName: string
): Promise<string> {
  const filename = record[fieldName] as string | undefined;
  if (!filename) throw new Error(`Record is missing ${fieldName}`);
  const url = pb.files.getURL(record, filename);
  const res = await fetch(url);
  if (!res.ok) throw new Error("Could not load stored file");
  const buf = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type") ?? "application/octet-stream";
  return `data:${contentType};base64,${buf.toString("base64")}`;
}

function authRecordId(pb: PocketBase): string {
  const id = pb.authStore.record?.id;
  if (!id) throw new Error("Not authenticated");
  return id;
}