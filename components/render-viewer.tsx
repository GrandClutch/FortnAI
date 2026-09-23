"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

import { BeforeAfterSlider } from "@/components/before-after-slider";

export function RenderViewer({
  projectId,
  versionId,
  beforeUrl,
  afterUrl,
}: {
  projectId: string;
  versionId: string | null;
  beforeUrl: string | null;
  afterUrl: string | null;
}) {
  const router = useRouter();
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const render = useCallback(async () => {
    if (!versionId || rendering) return;
    setRendering(true);
    setError(null);
    try {
      const res = await fetch("/api/design/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, versionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Render failed");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Render failed");
      setRendering(false);
    }
  }, [projectId, versionId, rendering, router]);

  if (!afterUrl && !rendering) {
    return (
      <div className="relative flex aspect-square w-full flex-col items-center justify-center overflow-hidden rounded-xl border border-hair bg-surface">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={beforeUrl ?? ""}
          alt="Your room"
          className="absolute inset-0 h-full w-full object-cover opacity-40"
        />
        <div className="relative flex flex-col items-center gap-3 px-8 text-center">
          <p className="text-base font-medium text-ink">See your redesign</p>
          <p className="max-w-[24ch] text-sm leading-relaxed text-mute">
            Generate a photorealistic before and after of this room.
          </p>
          <button
            type="button"
            onClick={render}
            disabled={!versionId}
            className="mt-3 flex items-center gap-2 rounded-lg bg-ink px-6 py-3 text-sm font-medium text-paper transition-colors hover:bg-ink/90 disabled:opacity-60"
          >
            Generate redesign
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rendering ? (
        <div className="flex aspect-square w-full flex-col items-center justify-center gap-4 rounded-xl border border-hair bg-surface">
          <span className="h-9 w-9 animate-spin rounded-full border border-hair border-t-ink" />
          <p className="text-sm text-mute">Rendering your redesign…</p>
        </div>
      ) : (
        <>
          {beforeUrl && afterUrl ? (
            <BeforeAfterSlider before={beforeUrl} after={afterUrl} />
          ) : (
            <div className="flex aspect-square w-full items-center justify-center rounded-xl border border-hair bg-surface text-sm text-mute">
              Unable to preview
            </div>
          )}
          {afterUrl && (
            <a
              href={afterUrl}
              download={`fortnai-redesign.jpg`}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-ink px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-ink hover:text-paper"
            >
              Download image
            </a>
          )}
        </>
      )}
      {error && (
        <div className="rounded-lg border border-ink/20 bg-surface px-5 py-4 text-sm text-ink">
          {error}
        </div>
      )}
      <button
        type="button"
        onClick={render}
        disabled={!versionId || rendering}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-ink px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-ink hover:text-paper disabled:opacity-60"
      >
        Re-render design
      </button>
    </div>
  );
}