"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import type { ProjectListResult, ProjectSummary } from "@/lib/history";

const STATUS_STYLES: Record<string, { className: string; label: string }> = {
  completed: { className: "text-pine", label: "Completed" },
  processing: { className: "text-ink/70", label: "Processing" },
  failed: { className: "text-red-500", label: "Failed" },
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function ProjectCard({
  project,
  busy,
  renaming,
  nameDraft,
  onNameDraftChange,
  onStartRename,
  onSaveRename,
  onCancelRename,
  onArchive,
  onDelete,
}: {
  project: ProjectSummary;
  busy: boolean;
  renaming: boolean;
  nameDraft: string;
  onNameDraftChange: (value: string) => void;
  onStartRename: (project: ProjectSummary) => void;
  onSaveRename: (project: ProjectSummary) => void;
  onCancelRename: () => void;
  onArchive: (project: ProjectSummary) => void;
  onDelete: (project: ProjectSummary) => void;
}) {
  const status = project.latestVersion?.status;
  const statusStyle = (status && STATUS_STYLES[status]) ?? STATUS_STYLES.completed;

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-hair bg-surface transition-colors hover:border-ink/30">
      <Link
        href={`/history/${project.id}`}
        className="relative block aspect-[16/10] overflow-hidden bg-paper"
      >
        {project.roomImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={project.roomImageUrl}
            alt="Room thumbnail"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-xs text-mute">
            No photo
          </span>
        )}
        {status && (
          <span
            className={`absolute top-3 left-3 z-10 rounded-full bg-paper/90 px-2.5 py-1 text-[11px] font-medium tracking-wide ${statusStyle.className}`}
          >
            {statusStyle.label}
          </span>
        )}
        {project.archived && (
          <span className="absolute top-3 right-3 z-10 rounded-full bg-ink/80 px-2.5 py-1 text-[11px] font-medium tracking-wide text-paper">
            Archived
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-5">
        <div className="min-w-0">
          {renaming ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onSaveRename(project);
              }}
              className="flex items-center gap-2"
            >
              <input
                autoFocus
                value={nameDraft}
                onChange={(e) => onNameDraftChange(e.target.value)}
                onBlur={onCancelRename}
                className="w-full rounded-lg border border-ink/40 bg-paper px-2 py-1 text-sm font-medium text-ink outline-none"
              />
            </form>
          ) : (
            <Link
              href={`/history/${project.id}`}
              className="block truncate text-[15px] font-medium text-ink transition-colors hover:text-pine"
              title={project.title}
            >
              {project.title}
            </Link>
          )}
          <p className="mt-0.5 text-xs text-mute">
            {project.width} m × {project.length} m · updated {formatDate(project.updatedAt)}
          </p>
        </div>

        {project.latestVersion && (
          <p className="line-clamp-2 text-[13px] leading-relaxed text-ink/80">
            {project.latestVersion.designTheme ?? "—"}
          </p>
        )}

        <div className="mt-auto pt-2">
          {project.latestVersion &&
            (project.latestVersion.budget !== null ? (
              <div className="flex items-baseline justify-between">
                <p className="text-sm font-medium text-ink">
                  ${project.latestVersion.budget.toLocaleString()}
                </p>
                <p className="text-xs text-mute">v{project.latestVersion.versionNumber}</p>
              </div>
            ) : (
              <p className="text-xs text-mute">
                {project.latestVersion.status === "processing"
                  ? "Still being designed…"
                  : "No completed design"}
              </p>
            ))}
        </div>
      </div>

      <div className="flex items-center gap-4 border-t border-hair/70 px-5 py-3">
        <button
          type="button"
          onClick={() => onStartRename(project)}
          disabled={busy}
          className="text-xs font-medium text-mute transition-colors hover:text-ink disabled:opacity-50"
        >
          Rename
        </button>
        <button
          type="button"
          onClick={() => onArchive(project)}
          disabled={busy}
          className="text-xs font-medium text-mute transition-colors hover:text-ink disabled:opacity-50"
        >
          {project.archived ? "Unarchive" : "Archive"}
        </button>
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => onDelete(project)}
          disabled={busy}
          className="text-xs font-medium text-mute transition-colors hover:text-red-500 disabled:opacity-50"
        >
          Delete
        </button>
      </div>
    </article>
  );
}

export function HistoryListView({ initial }: { initial: ProjectListResult }) {
  const router = useRouter();
  const [items, setItems] = useState(initial.items);
  const [page, setPage] = useState(initial.page);
  const [totalPages, setTotalPages] = useState(initial.totalPages);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");

  const refresh = useCallback(() => router.refresh(), [router]);

  const loadMore = useCallback(async () => {
    if (page >= totalPages || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/history?page=${page + 1}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load more");
      setItems((cur) => [...cur, ...data.items]);
      setPage(data.page);
      setTotalPages(data.totalPages);
    } catch (err) {
      console.error("Load more failed:", err);
    } finally {
      setLoadingMore(false);
    }
  }, [page, totalPages, loadingMore]);

  const startRename = useCallback((project: ProjectSummary) => {
    setRenamingId(project.id);
    setNameDraft(project.title);
  }, []);

  const saveRename = useCallback(
    async (project: ProjectSummary) => {
      setRenamingId(null);
      const title = nameDraft.trim();
      if (!title || title === project.title) return;
      setBusyId(project.id);
      try {
        const res = await fetch(`/api/history/${project.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title }),
        });
        if (res.ok) refresh();
      } catch {
        /* ignore */
      } finally {
        setBusyId(null);
        refresh();
      }
    },
    [nameDraft, refresh]
  );

  const cancelRename = useCallback(() => setRenamingId(null), []);
  const onNameDraftChange = useCallback((value: string) => setNameDraft(value), []);

  const toggleArchive = useCallback(
    async (project: ProjectSummary) => {
      setBusyId(project.id);
      try {
        const res = await fetch(`/api/history/${project.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ archived: !project.archived }),
        });
        if (res.ok) refresh();
      } catch {
        /* ignore */
      } finally {
        setBusyId(null);
      }
    },
    [refresh]
  );

  const remove = useCallback(
    async (project: ProjectSummary) => {
      if (!window.confirm("Delete this design and all its versions? This can't be undone.")) return;
      setBusyId(project.id);
      try {
        const res = await fetch(`/api/history/${project.id}`, { method: "DELETE" });
        if (res.ok) {
          router.push("/history");
          refresh();
        }
      } catch {
        /* ignore */
      } finally {
        setBusyId(null);
      }
    },
    [refresh, router]
  );

  if (items.length === 0) {
    return (
      <section className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-hair bg-surface px-6 py-20 text-center">
        <p className="text-base font-medium text-ink">No designs yet</p>
        <p className="max-w-[36ch] text-sm leading-relaxed text-mute">
          Run a room analysis in the Design Studio and it will show up here, ready to revisit,
          re-render, or delete.
        </p>
        <Link
          href="/"
          className="mt-2 rounded-lg bg-ink px-5 py-2.5 text-sm font-medium text-paper transition-colors hover:bg-ink/90"
        >
          Open Design Studio
        </Link>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-5 sm:grid-cols-2">
        {items.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            busy={busyId === project.id}
            renaming={renamingId === project.id}
            nameDraft={nameDraft}
            onNameDraftChange={onNameDraftChange}
            onStartRename={startRename}
            onSaveRename={saveRename}
            onCancelRename={cancelRename}
            onArchive={toggleArchive}
            onDelete={remove}
          />
        ))}
      </div>
      {page < totalPages && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="rounded-lg border border-ink px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-ink hover:text-paper disabled:opacity-50"
          >
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}