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
import { ShopList } from "@/components/shop-list";

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
  const [budgetMin, setBudgetMin] = useState(
    detail.design?.budgetRange ? String(detail.design.budgetRange.minUSD) : ""
  );
  const [budgetMax, setBudgetMax] = useState(
    detail.design?.budgetRange ? String(detail.design.budgetRange.maxUSD) : ""
  );
  const [shopLoading, setShopLoading] = useState(false);
  const [shopError, setShopError] = useState<string | null>(null);

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

  const shopPlan = useCallback(async () => {
    const minUSD = parseFloat(budgetMin);
    const maxUSD = parseFloat(budgetMax);
    if (!(minUSD > 0) || !(maxUSD >= minUSD)) {
      setShopError("Set a valid budget range.");
      return;
    }
    if (!detail.currentVersionId) return;
    setShopLoading(true);
    setShopError(null);
    try {
      const res = await fetch("/api/design/shop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: detail.id,
          versionId: detail.currentVersionId,
          budgetRange: { minUSD, maxUSD },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Product search failed");
      router.refresh();
    } catch (e) {
      setShopError(e instanceof Error ? e.message : "Product search failed");
    } finally {
      setShopLoading(false);
    }
  }, [budgetMin, budgetMax, detail.id, detail.currentVersionId, router]);

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
            {detail.width} m × {detail.length} m × {detail.height} m · created{" "}
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

      {/* Where to buy — real products */}
      {hasCurrent && (
        <section>
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-base font-medium">Where to buy — real products</h3>
            {design!.shopping && (
              <span className="text-xs text-mute">
                {design!.shopping.inRange
                  ? `Within your $${design!.shopping.minUSD.toLocaleString()}–$${design!.shopping.maxUSD.toLocaleString()} budget`
                  : `Outside your $${design!.shopping.minUSD.toLocaleString()}–$${design!.shopping.maxUSD.toLocaleString()} budget`}
              </span>
            )}
          </div>
          {design!.shopping ? (
            <ShopList shopping={design!.shopping} />
          ) : (
            <div className="rounded-xl border border-hair bg-surface px-6 py-8 text-center">
              <p className="text-base font-medium text-ink">Find real furniture for this plan</p>
              <p className="mx-auto mt-2 max-w-[46ch] text-sm leading-relaxed text-mute">
                Match each piece to a real product on Amazon with its real price and link — and
                resize the layout to the product&apos;s actual dimensions.
              </p>
              <div className="mx-auto mt-4 flex max-w-xs items-center justify-center gap-3">
                {(
                  [
                    ["min", "Min", budgetMin, setBudgetMin],
                    ["max", "Max", budgetMax, setBudgetMax],
                  ] as const
                ).map(([key, label, value, setValue]) => (
                  <div key={key} className="flex-1">
                    <label className="mb-1 block text-[11px] text-mute">{label}</label>
                    <div className="flex items-center rounded-lg border border-hair bg-paper focus-within:border-ink/60">
                      <span className="pl-2.5 text-xs text-mute">$</span>
                      <input
                        type="number"
                        min="0"
                        step="50"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        className="w-full bg-transparent px-2 py-2 text-sm text-ink outline-none"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={shopPlan}
                disabled={
                  shopLoading ||
                  !(parseFloat(budgetMax) >= parseFloat(budgetMin) && parseFloat(budgetMin) > 0)
                }
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-ink px-6 py-3 text-sm font-medium text-paper transition-colors hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {shopLoading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border border-paper/40 border-t-paper" />
                    Searching Amazon…
                  </>
                ) : (
                  "Shop this plan"
                )}
              </button>
              {shopError && <p className="mt-3 text-xs text-red-500">{shopError}</p>}
            </div>
          )}
        </section>
      )}

      {/* Exact plan — 3D view */}
      {hasCurrent && design!.layout && design!.layout.length > 0 && (
        <section>
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-base font-medium">Exact plan — 3D view</h3>
            <span className="text-xs text-mute">
              Sized to your {detail.width} m × {detail.length} m × {detail.height} m room
            </span>
          </div>
          <Room3DViewer
            widthM={detail.width}
            lengthM={detail.length}
            heightM={detail.height}
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