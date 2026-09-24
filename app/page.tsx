"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { STYLE_PRESETS, type DesignResult, type Obstacle, type StylePresetId } from "@/lib/schema";
import { fileToBase64 } from "@/lib/client";
import { containsUnsafeContent, unsafeContentMessage } from "@/lib/safety";
import { BeforeAfterSlider } from "@/components/before-after-slider";
import { Room3DViewer } from "@/components/room-3d-viewer";
import { ObstacleEditor } from "@/components/obstacle-editor";
import { DesignSummary } from "@/components/design-summary";
import { BlueprintSpec } from "@/components/blueprint-spec";
import { BudgetCalculator } from "@/components/budget-calculator";
import { ShopList } from "@/components/shop-list";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Phase = "input" | "analyzing" | "design" | "rendering" | "error";

const ANALYSIS_STEPS = [
  "Reading your room geometry",
  "Planning furniture layout",
  "Calculating budget",
];

export default function Home() {
  const [phase, setPhase] = useState<Phase>("input");
  const [error, setError] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [dims, setDims] = useState({ width: "3.7", length: "4.3", height: "2.7" });
  const [style, setStyle] = useState<StylePresetId | null>(null);
  const [styleOpen, setStyleOpen] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [design, setDesign] = useState<DesignResult | null>(null);
  const [renderImage, setRenderImage] = useState<string | null>(null);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [renderProgress, setRenderProgress] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [shopLoading, setShopLoading] = useState(false);
  const [historyRecord, setHistoryRecord] = useState<{ projectId: string; versionId: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setPhase("input");
    setError(null);
    setDesign(null);
    setRenderImage(null);
    setImagePreview(null);
    setImageBase64(null);
    setObstacles([]);
    setAnalysisStep(0);
    setHistoryRecord(null);
  }, []);

  const onFile = useCallback(async (file: File | undefined | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file.");
      return;
    }
    const base64 = await fileToBase64(file);
    setImageBase64(base64);
    setImagePreview(base64);
    setError(null);
  }, []);

  const runAnalysis = useCallback(async () => {
    if (!imageBase64) {
      setError("Upload a photo of your room first.");
      return;
    }
    if (containsUnsafeContent(customPrompt)) {
      setError(unsafeContentMessage());
      return;
    }
    setError(null);
    setDesign(null);
    setRenderImage(null);
    setPhase("analyzing");
    setAnalysisStep(0);
    const stepTimer = setInterval(
      () => setAnalysisStep((s) => Math.min(s + 1, ANALYSIS_STEPS.length - 1)),
      1400
    );
    try {
      const res = await fetch("/api/design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64,
          width: parseFloat(dims.width),
          length: parseFloat(dims.length),
          height: parseFloat(dims.height),
          stylePreset: style ?? undefined,
          customPrompt,
          obstacles,
          budgetRange:
            parseFloat(budgetMin) > 0 && parseFloat(budgetMax) >= parseFloat(budgetMin)
              ? { minUSD: parseFloat(budgetMin), maxUSD: parseFloat(budgetMax) }
              : undefined,
          projectId: historyRecord?.projectId ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed");
      setDesign(data as DesignResult);
      setHistoryRecord({ projectId: data.projectId, versionId: data.versionId });
      setPhase("design");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
      setPhase("error");
    } finally {
      clearInterval(stepTimer);
    }
}, [imageBase64, dims, style, customPrompt, obstacles, budgetMin, budgetMax, historyRecord]);

  const runShop = useCallback(async () => {
    if (!design || !historyRecord) return;
    const minUSD = parseFloat(budgetMin);
    const maxUSD = parseFloat(budgetMax);
    if (!(minUSD > 0) || !(maxUSD >= minUSD)) {
      setError("Set a valid budget range before shopping.");
      return;
    }
    setShopLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/design/shop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: historyRecord.projectId,
          versionId: historyRecord.versionId,
          budgetRange: { minUSD, maxUSD },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Product search failed");
      setDesign((current) =>
        current
          ? {
              ...current,
              layout: data.layout,
              layoutWarnings: data.layoutWarnings,
              shopping: data.shopping,
            }
          : current
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Product search failed");
    } finally {
      setShopLoading(false);
    }
  }, [design, historyRecord, budgetMin, budgetMax]);

  const runRender = useCallback(async () => {
    if (!design || !historyRecord) return;
    setPhase("rendering");
    setRenderProgress("Rendering your redesign…");
    try {
      const res = await fetch("/api/design/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: historyRecord.projectId,
          versionId: historyRecord.versionId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Render failed");
      setRenderImage(data.image as string);
      setPhase("design");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Render failed");
      setPhase("design");
    } finally {
      setRenderProgress(null);
    }
  }, [design, historyRecord]);

  const dimensionValid =
    Number(dims.width) > 0 && Number(dims.length) > 0 && Number(dims.height) > 0;

  return (
    <main className="min-h-screen bg-paper text-ink">
      <div className="mx-auto max-w-5xl px-6 py-8 sm:px-10 sm:py-12">
        {/* Header */}
        <header className="mb-14 flex items-center justify-between border-b border-hair pb-6">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="-ml-2 text-mute hover:text-ink md:hidden" />
            <div>
              <p className="text-sm font-medium text-ink">Design Studio</p>
              <p className="mt-0.5 text-xs text-mute">AI Interior Design Studio</p>
            </div>
          </div>
          <span className="hidden text-xs text-mute sm:block">New room analysis</span>
        </header>

        {/* Hero */}
        <section className="mb-14 max-w-2xl">
          <h1 className="text-4xl font-medium leading-[1.05] tracking-tight sm:text-5xl">
            Design your amazing room.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-mute">
            Upload the photo of your space, tell us its size, and get a full furniture
            layout, a budget plan, and a photorealistic vision of the result.
          </p>
        </section>

        {error && (
          <div className="mb-8 flex items-center justify-between gap-4 rounded-lg border border-ink/20 bg-surface px-5 py-4 text-sm">
            <span className="text-ink">{error}</span>
            <button
              onClick={reset}
              className="shrink-0 font-medium text-pine underline underline-offset-4"
            >
              Try again
            </button>
          </div>
        )}

        {/* ===== INPUT ===== */}
        {phase === "input" && (
          <section className="grid gap-10 lg:grid-cols-12">
            {/* Image */}
            <div className="lg:col-span-7">
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="text-sm font-medium text-ink">Room photo</h2>
                <p className="text-xs text-mute">A clear, straight-on shot works best</p>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  onFile(e.dataTransfer.files?.[0]);
                }}
                className={`group relative block aspect-[4/3] w-full overflow-hidden rounded-xl border bg-surface transition-colors hover:border-ink/40 ${
                  isDragging && !imagePreview
                    ? "border-pine ring-2 ring-pine/30"
                    : "border-hair"
                }`}
              >
                {imagePreview ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imagePreview}
                      alt="Your room"
                      className="h-full w-full object-cover"
                    />
                    <span className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/60 to-transparent px-5 pb-4 pt-12 text-xs font-medium text-white">
                      Click to replace
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M12 5v14" />
                        <path d="M5 12h14" />
                      </svg>
                    </span>
                  </>
                ) : (
                  <span className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-mute">
                    <span className="flex h-14 w-14 items-center justify-center rounded-full border border-hair bg-paper transition-transform group-hover:scale-105">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="3" />
                        <circle cx="9" cy="9" r="2" />
                        <path d="M21 15l-4.5-4.5L7 20" />
                      </svg>
                    </span>
                    <span className="text-sm font-medium text-ink">Drag & drop or upload a photo</span>
                    <span className="text-xs">PNG, JPG, or WEBP</span>
                  </span>
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onFile(e.target.files?.[0])}
              />

              <div className="mt-6">
                <div className="mb-3 flex items-baseline justify-between">
                  <h2 className="text-sm font-medium text-ink">Extra direction</h2>
                  <p className="text-xs text-mute">Optional</p>
                </div>
                <div className="rounded-lg border border-hair bg-surface focus-within:border-ink/60">
                  <textarea
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    maxLength={600}
                    rows={3}
                    placeholder="Colors, priorities, must-haves — anything you want. Leave blank and we'll lead."
                    className="w-full resize-none bg-transparent px-3 py-2.5 text-sm leading-relaxed text-ink outline-none"
                  />
                  <div className="flex justify-end px-3 pb-2">
                    <span className="text-[11px] text-mute">{customPrompt.length}/600</span>
                  </div>
                </div>
                <p className="mt-1.5 text-xs text-mute">
                  {style
                    ? `Your direction is added on top of the ${STYLE_PRESETS.find((p) => p.id === style)?.label} style`
                    : "No style selected — your direction is used as your sole design guide"}
                </p>
              </div>
            </div>

            {/* Config */}
            <div className="flex flex-col gap-10 lg:col-span-5">
              <div>
                <h2 className="mb-3 text-sm font-medium text-ink">Room dimensions</h2>
                <div className="grid grid-cols-3 gap-3">
                  {(
                    [
                      ["width", "Width"],
                      ["length", "Length"],
                      ["height", "Height"],
                    ] as const
                  ).map(([key, label]) => (
                    <div key={key}>
                      <label className="mb-1.5 block text-[11px] text-mute">{label}</label>
                      <div className="flex items-center rounded-lg border border-hair bg-surface focus-within:border-ink/60">
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0.5"
                          step="0.1"
                          value={dims[key]}
                          onChange={(e) => setDims((d) => ({ ...d, [key]: e.target.value }))}
                          className="w-full bg-transparent px-3 py-2.5 text-sm text-ink outline-none"
                        />
                        <span className="pr-3 text-xs text-mute">m</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h2 className="mb-3 text-sm font-medium text-ink">Design style</h2>
                <button
                  type="button"
                  onClick={() => setStyleOpen(true)}
                  className="flex w-full items-center justify-between gap-4 rounded-lg border border-hair bg-surface px-3.5 py-3 text-left transition-colors hover:border-ink/40"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    {style ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={STYLE_PRESETS.find((p) => p.id === style)?.image}
                          alt=""
                          className="h-9 w-12 shrink-0 rounded-md border border-hair object-cover"
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-ink">
                            {STYLE_PRESETS.find((p) => p.id === style)?.label}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-mute">
                            {STYLE_PRESETS.find((p) => p.id === style)?.description}
                          </span>
                        </span>
                      </>
                    ) : (
                      <span className="text-sm text-mute">Choose a style</span>
                    )}
                  </span>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="shrink-0 text-mute">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                <Dialog open={styleOpen} onOpenChange={setStyleOpen}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Choose a design style</DialogTitle>
                      <DialogDescription>
                        Pick a look for your room — or leave it unset and let the AI lead.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogBody>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {STYLE_PRESETS.map((preset) => {
                          const selected = style === preset.id;
                          return (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() => {
                                setStyle(selected ? null : preset.id);
                                setStyleOpen(false);
                              }}
                              className={`group overflow-hidden rounded-lg border text-left transition-colors ${
                                selected
                                  ? "border-pine ring-2 ring-pine/30"
                                  : "border-hair hover:border-ink/40"
                              }`}
                            >
                              <div className="relative aspect-[4/3] w-full overflow-hidden bg-surface">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={preset.image}
                                  alt={preset.label}
                                  className="h-full w-full object-cover"
                                />
                                {selected && (
                                  <span className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-pine text-paper">
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                      <path d="M20 6L9 17l-5-5" />
                                    </svg>
                                  </span>
                                )}
                              </div>
                              <div className="p-3">
                                <p className="text-sm font-medium text-ink">{preset.label}</p>
                                <p className="mt-0.5 text-xs text-mute">{preset.description}</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      {style && (
                        <button
                          type="button"
                          onClick={() => {
                            setStyle(null);
                            setStyleOpen(false);
                          }}
                          className="mt-3 text-xs font-medium text-pine underline underline-offset-4"
                        >
                          Clear style selection
                        </button>
                      )}
                    </DialogBody>
                  </DialogContent>
                </Dialog>
              </div>

              <div>
                <h2 className="mb-3 text-sm font-medium text-ink">Budget range</h2>
                <div className="grid grid-cols-2 gap-3">
                  {(
                    [
                      ["min", "Min", budgetMin, setBudgetMin],
                      ["max", "Max", budgetMax, setBudgetMax],
                    ] as const
                  ).map(([key, label, value, setValue]) => (
                    <div key={key}>
                      <label className="mb-1.5 block text-[11px] text-mute">{label}</label>
                      <div className="flex items-center rounded-lg border border-hair bg-surface focus-within:border-ink/60">
                        <span className="pl-3 text-xs text-mute">$</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="50"
                          value={value}
                          onChange={(e) => setValue(e.target.value)}
                          className="w-full bg-transparent px-2 py-2.5 text-sm text-ink outline-none"
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-mute">
                  {budgetMin && budgetMax && !(parseFloat(budgetMax) >= parseFloat(budgetMin))
                    ? "Max must be at least the min."
                    : "Total target for the whole plan (USD)."}
                </p>
              </div>

              <div>
                <h2 className="mb-3 text-sm font-medium text-ink">Doors & windows</h2>
                <p className="mb-3 text-xs text-mute">
                  Optional — marks fixed obstacles so the plan keeps them clear.
                </p>
                <ObstacleEditor
                  widthM={parseFloat(dims.width) || 0}
                  lengthM={parseFloat(dims.length) || 0}
                  obstacles={obstacles}
                  onChange={setObstacles}
                />
              </div>

              <button
                type="button"
                onClick={runAnalysis}
                disabled={!imageBase64 || !dimensionValid}
                className="flex h-13 items-center justify-center gap-2 rounded-lg bg-ink px-6 py-3.5 text-sm font-medium text-paper transition-colors hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-ink"
              >
                Design my room
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14" />
                  <path d="M13 6l6 6-6 6" />
                </svg>
              </button>
            </div>
          </section>
        )}

        {/* ===== ANALYZING ===== */}
        {phase === "analyzing" && (
          <section className="mx-auto max-w-md py-20 text-center">
            <div className="mx-auto mb-10 h-9 w-9 animate-spin rounded-full border border-hair border-t-ink" />
            <h2 className="mb-6 text-2xl font-medium tracking-tight text-ink">
              Designing your room…
            </h2>
            <div className="flex flex-col items-center gap-3">
              {ANALYSIS_STEPS.map((step, i) => (
                <div
                  key={step}
                  className={`flex items-center gap-2.5 text-sm transition-colors ${
                    i < analysisStep ? "text-pine" : i === analysisStep ? "text-ink" : "text-mute"
                  }`}
                >
                  {i < analysisStep ? (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  ) : (
                    <span className="h-1 w-1 rounded-full bg-current" />
                  )}
                  {step}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ===== RESULT ===== */}
        {(phase === "design" || phase === "rendering") && design && (
          <div className="space-y-14">
            {/* Visualization — photoreal render */}
            <section>
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-base font-medium">Visualization — photoreal render</h3>
                {renderImage && (
                  <span className="text-xs text-mute">
                    Closely matched to the exact plan — not pixel-identical
                  </span>
                )}
              </div>
              <div className="max-w-lg">
                {renderImage ? (
                  <div className="space-y-3">
                    <BeforeAfterSlider before={imagePreview!} after={renderImage} />
                    <button
                      type="button"
                      onClick={() => {
                        const ext =
                          renderImage.match(/^data:image\/(\w+)/)?.[1] === "jpeg"
                            ? "jpg"
                            : renderImage.match(/^data:image\/(\w+)/)?.[1] ?? "png";
                        const a = document.createElement("a");
                        a.href = renderImage;
                        a.download = `fortnai-redesign.${ext}`;
                        a.click();
                      }}
                      className="flex w-full items-center justify-center gap-2 rounded-lg border border-ink px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-ink hover:text-paper"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 3v12" />
                        <path d="M7 10l5 5 5-5" />
                        <path d="M5 21h14" />
                      </svg>
                      Download
                    </button>
                  </div>
                ) : (
                  <div className="relative flex aspect-square w-full flex-col items-center justify-center overflow-hidden rounded-xl border border-hair bg-surface">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imagePreview!}
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
                        onClick={runRender}
                        disabled={phase === "rendering"}
                        className="mt-3 flex items-center gap-2 rounded-lg bg-ink px-6 py-3 text-sm font-medium text-paper transition-colors hover:bg-ink/90 disabled:opacity-60"
                      >
                        {phase === "rendering" ? (
                          <>
                            <span className="h-4 w-4 animate-spin rounded-full border border-paper/40 border-t-paper" />
                            {renderProgress ?? "Rendering…"}
                          </>
                        ) : (
                          <>
                            Generate redesign
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                              <path d="M4 12a8 8 0 0 1 14.9-3M20 12a8 8 0 0 1-14.9 3" />
                              <path d="M19 3v6h-6" />
                              <path d="M5 21v-6h6" />
                            </svg>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Exact plan — 3D view */}
            {design.layout && design.layout.length > 0 && (
              <section>
                <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-base font-medium">Exact plan — 3D view</h3>
                  <span className="text-xs text-mute">
                    Sized to your {dims.width} m × {dims.length} m × {dims.height} m room
                  </span>
                </div>
                <Room3DViewer
                  widthM={parseFloat(dims.width)}
                  lengthM={parseFloat(dims.length)}
                  heightM={parseFloat(dims.height)}
                  items={design.layout}
                  obstacles={obstacles}
                />
                {design.layoutWarnings && design.layoutWarnings.length > 0 && (
                  <ul className="mt-3 space-y-1 text-xs text-mute">
                    {design.layoutWarnings.map((w) => (
                      <li key={w}>· {w}</li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {/* Where to buy — real products */}
            <section>
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-base font-medium">Where to buy — real products</h3>
                {design.shopping && (
                  <span className="text-xs text-mute">
                    {design.shopping.inRange
                      ? `Within your $${design.shopping.minUSD.toLocaleString()}–$${design.shopping.maxUSD.toLocaleString()} budget`
                      : `Outside your $${design.shopping.minUSD.toLocaleString()}–$${design.shopping.maxUSD.toLocaleString()} budget`}
                  </span>
                )}
              </div>
              {design.shopping ? (
                <ShopList shopping={design.shopping} />
              ) : (
                <div className="rounded-xl border border-hair bg-surface px-6 py-8 text-center">
                  <p className="text-base font-medium text-ink">Find real furniture for this plan</p>
                  <p className="mx-auto mt-2 max-w-[46ch] text-sm leading-relaxed text-mute">
                    Match each piece to a real product on Amazon with its real price and link — and
                    resize the layout to the product&apos;s actual dimensions.
                  </p>
                  {!(parseFloat(budgetMax) >= parseFloat(budgetMin) && parseFloat(budgetMin) > 0) && (
                    <p className="mt-3 text-xs text-mute">Set a budget range in your inputs first.</p>
                  )}
                  <button
                    type="button"
                    onClick={runShop}
                    disabled={shopLoading || !(parseFloat(budgetMax) >= parseFloat(budgetMin) && parseFloat(budgetMin) > 0)}
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
                </div>
              )}
            </section>

            {/* Design summary */}
            <DesignSummary design={design} />

            {/* Blueprint spec sheet */}
            <BlueprintSpec design={design} />

            {/* Budget calculator */}
            <BudgetCalculator design={design} />

            <div className="flex flex-wrap items-center justify-center gap-4 pb-6">
              <button
                type="button"
                onClick={() => setDesign(null)}
                className="rounded-lg border border-hair px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:border-ink/40"
              >
                Change inputs
              </button>
              {renderImage && (
                <button
                  type="button"
                  onClick={runRender}
                  className="rounded-lg border border-ink px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-ink hover:text-paper"
                >
                  Re-render
                </button>
              )}
              {historyRecord && (
                <Link
                  href={`/history/${historyRecord.projectId}`}
                  className="rounded-lg bg-ink px-5 py-2.5 text-sm font-medium text-paper transition-colors hover:bg-ink/90"
                >
                  View in history
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
