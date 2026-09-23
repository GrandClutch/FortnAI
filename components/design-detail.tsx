"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import type { ProjectDetail, VersionSummary } from "@/lib/history";
import { Room3DViewer } from "@/components/room-3d-viewer";
import { DesignSummary } from "@/components/design-summary";
import { BlueprintSpec } from "@/components/blueprint-spec";
import { BudgetCalculator } from "@/components/budget-calculator";
import { RenderViewer } from "@/components/render-viewer";

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function DesignDetailView({ detail }: { detail: ProjectDetail }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(detail.title);
  const [versions, setVersions] = useState<VersionSummary[] | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/history/${detail.id}/versions`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data?.items) setVersions(data.items);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [detail.id]);

  const toggleArchive = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/history/${detail.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: !detail.archived }),
      });
      if (res.ok) router.refresh();
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }, [detail.archived, detail.id, router]);

  const saveRename = useCallback(async () => {
    setRenaming(false);
    const title = nameDraft.trim();
    if (!title || title === detail.title) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/history/${detail.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (res.ok) router.refresh();
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }, [detail.id, detail.title, nameDraft, router]);

  const remove = useCallback(async () => {
    if (!window.confirm("Delete this design and all its versions? This can't be undone.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/history/${detail.id}`, { method: "DELETE" });
      if (res.ok) router.push("/history");
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }, [detail.id, router]);

  const design = detail.design;
  const hasCurrent = Boolean(design && detail.currentVersionId);

  return (
    <div className="space-y-14">
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-hair pb-6">
        <div className="min-w-0">
          {renaming ? (
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void saveRename();
              }}
            >
              <input
                autoFocus
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={() => setRenaming(false)}
                className="w-full max-w-md rounded-lg border border-ink/40 bg-surface px-3 py-1.5 text-xl font-medium text-ink outline-none"
              />
            </form>
          ) : (
            <h1
              className="cursor-pointer text-2xl font-medium tracking-tight text-ink"
              title="Rename design"
              onClick={() => {
                setNameDraft(detail.title);
                setRenaming(true);
              }}
            >
              {detail.title}
            </h1>
          )}
          <p className="mt-1 text-xs text-mute">
            {detail.width}′ × {detail.length}′ × {detail.height}′ · created{" "}
            {formatDate(detail.createdAt)} · updated {formatDate(detail.updatedAt)}
            {detail.archived ? " · archived" : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setNameDraft(detail.title);
              setRenaming(true);
            }}
            disabled={busy || renaming}
            className="rounded-lg border border-hair px-4 py-2 text-xs font-medium text-ink transition-colors hover:border-ink/40 disabled:opacity-50"
          >
            Rename
          </button>
          <button
            type="button"
            onClick={toggleArchive}
            disabled={busy}
            className="rounded-lg border border-hair px-4 py-2 text-xs font-medium text-ink transition-colors hover:border-ink/40 disabled:opacity-50"
          >
            {detail.archived ? "Unarchive" : "Archive"}
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="rounded-lg border border-hair px-4 py-2 text-xs font-medium text-mute transition-colors hover:border-red-400 hover:text-red-500 disabled:opacity-50"
          >
            Delete
          </button>
          <Link
            href="/history"
            className="rounded-lg bg-ink px-4 py-2 text-xs font-medium text-paper transition-colors hover:bg-ink/90"
          >
            All designs
          </Link>
        </div>
      </header>

      {/* Visualization */}
      <section>
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-base font-medium">Visualization — photoreal render</h3>
          {detail.renderImageUrl && (
            <span className="text-xs text-mute">Closely matched to the exact plan — not pixel-identical</span>
          )}
        </div>
        <div className="max-w-lg">
          <RenderViewer
            projectId={detail.id}
            versionId={detail.currentVersionId}
            beforeUrl={detail.roomImageUrl}
            afterUrl={detail.renderImageUrl}
          />
        </div>
      </section>

      {/* Exact plan — 3D view */}
      {hasCurrent && design!.layout && design!.layout.length > 0 && (
        <section>
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-base font-medium">Exact plan — 3D view</h3>
            <span className="text-xs text-mute">
              Sized to your {detail.width}′ × {detail.length}′ × {detail.height}′ room
            </span>
          </div>
          <Room3DViewer
            widthFt={detail.width}
            lengthFt={detail.length}
            heightFt={detail.height}
            items={design!.layout}
            obstacles={detail.obstacles}
          />
          {design!.layoutWarnings && design!.layoutWarnings.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs text-mute">
              {design!.layoutWarnings.map((w) => (
                <li key={w}>· {w}</li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Design summary */}
      {hasCurrent && <DesignSummary design={design!} />}

      {/* Blueprint spec sheet */}
      {hasCurrent && <BlueprintSpec design={design!} />}

      {/* Budget calculator */}
      {hasCurrent && <BudgetCalculator design={design!} />}

      {/* Versions */}
      <section className="overflow-hidden rounded-xl border border-hair bg-surface">
        <div className="flex items-baseline justify-between border-b border-hair px-6 py-5">
          <h3 className="text-base font-medium">Version history</h3>
          <span className="text-xs text-mute">Each analysis run creates a new version</span>
        </div>
        {versions === null ? (
          <div className="px-6 py-8 text-sm text-mute">Loading versions…</div>
        ) : versions.length === 0 ? (
          <div className="px-6 py-8 text-sm text-mute">No versions.</div>
        ) : (
          <div className="divide-y divide-hair/70">
            {versions.map((v) => (
              <div key={v.id} className="flex flex-wrap items-center gap-3 px-6 py-4">
                <span className="rounded-full border border-hair px-2.5 py-1 text-[11px] font-medium tracking-wide text-mute">
                  v{v.versionNumber}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{v.title}</p>
                  <p className="text-[11px] text-mute">
                    {formatDate(v.createdAt)}
                    {v.model ? ` · ${v.model}` : ""}
                  </p>
                </div>
                {v.status === "completed" ? (
                  <span className="text-[11px] font-medium tracking-wide text-pine">Completed</span>
                ) : v.status === "processing" ? (
                  <span className="text-[11px] font-medium tracking-wide text-ink/70">Processing</span>
                ) : (
                  <span className="text-[11px] font-medium tracking-wide text-red-500">
                    Failed{v.errorMessage ? " · see console" : ""}
                  </span>
                )}
                {v.errorMessage && (
                  <p className="w-full text-[11px] leading-5 text-mute" title={v.errorMessage}>
                    {v.errorMessage}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}