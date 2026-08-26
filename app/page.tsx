"use client";

import { useCallback, useRef, useState } from "react";
import { STYLE_PRESETS, type DesignResult, type StylePresetId } from "@/lib/schema";
import { fileToBase64 } from "@/lib/client";
import { BeforeAfterSlider } from "@/components/before-after-slider";

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
  const [dims, setDims] = useState({ width: "12", length: "14", height: "9" });
  const [style, setStyle] = useState<StylePresetId>("japandi");
  const [design, setDesign] = useState<DesignResult | null>(null);
  const [renderImage, setRenderImage] = useState<string | null>(null);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [renderProgress, setRenderProgress] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setPhase("input");
    setError(null);
    setDesign(null);
    setRenderImage(null);
    setImagePreview(null);
    setImageBase64(null);
    setAnalysisStep(0);
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
          stylePreset: style,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed");
      setDesign(data as DesignResult);
      setPhase("design");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
      setPhase("error");
    } finally {
      clearInterval(stepTimer);
    }
  }, [imageBase64, dims, style]);

  const runRender = useCallback(async () => {
    if (!design || !imageBase64) return;
    setPhase("rendering");
    setRenderProgress("Rendering your redesign…");
    try {
      const res = await fetch("/api/design/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64,
          design,
          width: parseFloat(dims.width),
          length: parseFloat(dims.length),
          stylePreset: style,
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
  }, [design, imageBase64, dims, style]);

  const dimensionValid =
    Number(dims.width) > 0 && Number(dims.length) > 0 && Number(dims.height) > 0;

  return (
    <main className="min-h-screen bg-paper text-ink">
      <div className="mx-auto max-w-5xl px-6 py-14 sm:px-10 sm:py-20">
        {/* Header */}
        <header className="mb-16 flex items-center justify-between border-b border-hair pb-8">
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-pine">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f6f4f0" strokeWidth="2">
                <path d="M4 3v13h13" />
                <path d="M4 16l6-6 4 4 6-8" />
              </svg>
            </span>
            <span className="text-lg font-medium tracking-tight">FortnAI</span>
          </div>
          <span className="hidden text-sm text-mute sm:block">AI Interior Design Studio</span>
        </header>

        {/* Hero */}
        <section className="mb-14 max-w-2xl">
          <h1 className="text-4xl font-medium leading-[1.05] tracking-tight sm:text-5xl">
            Design your amazing room.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-mute">
            Upload a photo of your space, tell us its size, and get a full furniture
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
                          min="1"
                          step="0.5"
                          value={dims[key]}
                          onChange={(e) => setDims((d) => ({ ...d, [key]: e.target.value }))}
                          className="w-full bg-transparent px-3 py-2.5 text-sm text-ink outline-none"
                        />
                        <span className="pr-3 text-xs text-mute">ft</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h2 className="mb-3 text-sm font-medium text-ink">Design style</h2>
                <div className="flex flex-col">
                  {STYLE_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setStyle(preset.id)}
                      className={`flex items-center justify-between gap-4 border-b border-hair py-3.5 text-left transition-colors last:border-b-0 ${
                        style === preset.id ? "text-ink" : "text-mute hover:text-ink"
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-inherit">
                          {preset.label}
                        </span>
                        <span className="mt-0.5 block text-xs text-mute">
                          {preset.description}
                        </span>
                      </span>
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                          style === preset.id
                            ? "border-pine bg-pine text-paper"
                            : "border-hair"
                        }`}
                      >
                        {style === preset.id && (
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        )}
                      </span>
                    </button>
                  ))}
                </div>
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
            {/* Before / after */}
            <section className="grid items-start gap-10 lg:grid-cols-2">
              <div>
                {renderImage ? (
                  <BeforeAfterSlider before={imagePreview!} after={renderImage} />
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

              {/* Summary */}
              <div className="space-y-8">
                <div>
                  <h3 className="mb-2 text-xs tracking-wide text-mute">Design direction</h3>
                  <p className="text-2xl font-medium leading-snug tracking-tight">
                    {design.designTheme}
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    {design.colorPalette.map((hex) => (
                      <span key={hex} className="flex items-center gap-2">
                        <span
                          className="h-6 w-6 rounded-full border border-hair"
                          style={{ backgroundColor: hex }}
                        />
                        <span className="font-mono text-xs text-mute">{hex}</span>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="border-t border-hair pt-6">
                  <h3 className="mb-2 text-xs tracking-wide text-mute">Spatial strategy</h3>
                  <p className="text-[15px] leading-relaxed text-ink/90">
                    {design.spatialStrategy}
                  </p>
                </div>

                <div className="border-t border-hair pt-6">
                  <h3 className="mb-2 text-xs tracking-wide text-mute">Lighting</h3>
                  <p className="text-[15px] leading-relaxed text-ink/90">
                    {design.lightingAdvice}
                  </p>
                </div>
              </div>
            </section>

            {/* Blueprint spec sheet */}
            <section className="overflow-hidden rounded-xl border border-hair bg-surface">
              <div className="flex items-baseline justify-between border-b border-hair px-6 py-5">
                <h3 className="text-base font-medium">Blueprint spec sheet</h3>
                <span className="text-xs text-mute">
                  {design.furnitureRecommendations.length} pieces · sized to your{" "}
                  {dims.width}′ × {dims.length}′ × {dims.height}′ room
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-hair text-[11px] tracking-wide text-mute">
                      <th className="px-6 py-3 font-medium">Piece</th>
                      <th className="px-4 py-3 font-medium">Max size (W×D×H)</th>
                      <th className="px-4 py-3 font-medium">Placement</th>
                      <th className="px-6 py-3 text-right font-medium">Est. cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {design.furnitureRecommendations.map((f) => (
                      <tr key={f.item} className="border-b border-hair/70 last:border-0">
                        <td className="px-6 py-4 font-medium text-ink">{f.item}</td>
                        <td className="px-4 py-4 font-mono text-xs text-mute">
                          {f.width}″ × {f.depth}″ × {f.height}″
                        </td>
                        <td className="max-w-xs px-4 py-4 text-xs leading-5 text-mute">
                          {f.placementNotes}
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-ink">
                          ${f.estimatedCostUSD.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Budget calculator */}
            <BudgetSection design={design} />

            <div className="flex items-center justify-center gap-4 pb-6">
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
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function BudgetSection({ design }: { design: DesignResult }) {
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [prices, setPrices] = useState<Record<number, number>>({});

  const items = design.furnitureRecommendations.map((f, i) => ({
    ...f,
    index: i,
    included: selected[i] !== false,
    price: prices[i] ?? f.estimatedCostUSD,
  }));

  const total = items.filter((i) => i.included).reduce((sum, i) => sum + i.price, 0);
  const originalTotal = items
    .filter((i) => i.included)
    .reduce((s, i) => s + i.estimatedCostUSD, 0);

  return (
    <section className="overflow-hidden rounded-xl border border-hair bg-surface">
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-hair px-6 py-5">
        <div>
          <h3 className="text-base font-medium">Budget calculator</h3>
          <p className="mt-0.5 text-xs text-mute">Toggle pieces and adjust prices to plan your spend</p>
        </div>
        <div className="text-right">
          <span className="block text-[11px] tracking-wide text-mute">Total</span>
          <span className="text-2xl font-medium tracking-tight text-ink">
            ${total.toLocaleString()}
          </span>
        </div>
      </div>
      <div className="divide-y divide-hair/70">
        {items.map((f) => (
          <div
            key={f.item}
            className={`flex items-center gap-4 px-6 py-3.5 transition-opacity ${
              f.included ? "opacity-100" : "opacity-40"
            }`}
          >
            <input
              type="checkbox"
              checked={f.included}
              onChange={() => setSelected((s) => ({ ...s, [f.index]: !(s[f.index] !== false) }))}
              className="h-4 w-4 accent-pine"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{f.item}</p>
              <p className="text-[11px] text-mute">{f.category}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-mute">$</span>
              <input
                type="number"
                min="0"
                value={f.price}
                onChange={(e) => setPrices((p) => ({ ...p, [f.index]: Number(e.target.value) || 0 }))}
                className="w-24 rounded-lg border border-hair bg-paper px-2.5 py-1.5 text-right text-sm font-medium text-ink outline-none focus:border-ink/60"
              />
            </div>
          </div>
        ))}
      </div>
      {originalTotal !== total && (
        <div className="flex justify-end border-t border-hair px-6 py-3 text-xs text-mute">
          Saved {(originalTotal - total).toLocaleString()} vs original estimate
        </div>
      )}
    </section>
  );
}