# History

Working notes from dev sessions with opencode. Re-read this before starting new work to pick up context.

## Session 1 — 3D Viewer Phase 1 (and smaller fixes)

### Project state

- Next.js 16.3.2 (App Router, Turbopack by default), React 19.2, Tailwind v4, Vercel AI SDK (`ai` + `@ai-sdk/google`), zod v4.
- Deps added this session: `three`, `@react-three/fiber` (v9), `@react-three/drei` (v10), `@types/three`.
- `next lint` is REMOVED in Next 16 — run `npm run lint` (eslint) directly. `tsc --noEmit` for typecheck. `npm run build` verified OK.
- Per `AGENTS.md`: Next 16 differs from training data — read `node_modules/next/dist/docs/` before writing code.
- Provider locked to Google Gemini (per `PRODUCT.md`); branding: Aeonik font, max weight `font-medium`, paper/pine/hair palette.

### Done this session

1. **Before/after slider fix** (`components/before-after-slider.tsx:20`)
   - Changed clamp from `Math.min(96, Math.max(4, pct))` to `Math.min(100, Math.max(0, pct))` so the slider travels edge-to-edge.
   - Note: round handle gets half-clipped at 0%/100% by `overflow-hidden` — accepted tradeoff, user declined a nudge fix.

2. **Download generated photo** (`app/page.tsx`)
   - Added a "Download" button under the BeforeAfterSlider, shown when `renderImage` exists.
   - Creates a temp `<a href={dataUrl} download="fortnai-redesign.{ext}">`, derives ext from `data:image/{mime}` (jpeg→jpg, fallback png). Typecheck clean.

3. **Gemini design criteria question** — answered: no hard "must include a bed/chair" rules; schema enforces only 4–10 items + category enum. User declined adding a room-type/required-furniture feature. Don't re-propose unless asked.

4. **3D viewer feature — Phase 1 of `3dviewerFeat.md` (built)**
   - `lib/schema.ts`: added `placementSchema` (wallRef north/south/east/west, align left/center/right, offsetFt, optional adjacentTo/rotationDeg) on each furniture item (optional), `obstacleSchema` (door/window, wallRef, offsetFt, widthFt, optional swingClearanceFt), `layoutItemSchema` (itemId, item, category, x, z, rotationDeg, widthFt/depthFt/heightFt, cost, notes, status). `DesignResult` = design schema + `layout: LayoutItem[]` + optional `layoutWarnings`.
   - `lib/placement.ts`: deterministic solver, no LLM. Resolves wall-relative placement → exact x/z in feet; AABB collision checks furniture-vs-furniture + obstacles; door swing arc via circle-rect test; auto-nudges along wall up to 24 × 0.5 ft; unresolved overlaps flagged `status: "overlap"` + warning. Consts: `IN_TO_FT`, `WALL_GAP_FT 0.25`, `ITEM_GAP_FT 0.5`, `OBSTACLE_DEPTH_FT 1.0`. Default placement rotates walls north→south→east→west when Gemini omits `placement`.
   - `app/api/design/route.ts`: reads optional `obstacles` (validated with `obstacleSchema.array()`), prompt instructs Gemini to emit wall-relative placement and avoid obstacles; runs `solveLayout`; returns `{...object, layout, layoutWarnings}`.
   - `components/obstacle-editor.tsx`: tap-to-place doors/windows UI. Click on SVG room outline (aspect W:L) perimeter → adds door/window at nearest wall; toggle Door/Window mode; click a marker to remove; Clear button. Defaults: door width 3 ft (swing 3 ft), window width 5 ft.
   - `components/room-3d-viewer.tsx`: react-three-fiber Canvas, room sized W×L×H (centered on origin, north wall at +z), floor plane, 4 wall boxes, gridHelper, furniture boxes color-coded by category, door/window markers on walls, hover tooltips (drei `<Html>`) with name/size/cost, OrbitControls. Used on results page as "Exact plan — 3D view" section (renders when `design.layout` exists), plus a `layoutWarnings` list.

### Verified

- `tsc --noEmit`: clean.
- `npm run lint`: 0 errors, 2 pre-existing warnings in `app/layout.tsx` (unused geistSans/geistMono) — leave alone.
- `npm run build`: passes.

### Open / next steps (from `3dviewerFeat.md`)

- Phase 2: depth-map extraction from the Three.js scene (render z-buffer to grayscale).
- Phase 3: ControlNet-depth photoreal render — new provider (Replicate/Stability) with photo + depth map + style prompt, low denoise 0.2–0.4; behind a feature flag; compares vs Gemini `gemini-2.5-flash-image` for cost/latency/quality. This intentionally breaks the "Gemini-only" constraint for the render step only.
- Phase 4: "Exact Plan" (3D viewer) vs "Visualization" (render) labeling in UI.
- Optional (10.3): GLTF furniture models per category in `public/models/` (Poly Pizza/Kenney.nl), tooltip polish.
- Risk noted: at low denoise renders may look CG-clean; tune per style preset.

### Workflow conventions

- User prefers plain-language explanations and "in simple word" summaries; answers should be short.
- When the user says "build it" / "go", implement directly (no plan re-approval).
- Never commit unless explicitly asked.

## Session 2 — 3D Viewer Phases 2–4 (depth map + Replicate render + labeling)

### Done this session

1. **Shared scene geometry** (`lib/scene.ts`, new) — extracted `wallSegments`, `furnitureTransform`, `obstacleTransform` (+ `WALL_THICKNESS`) so the 3D viewer and the depth renderer share one source of truth for geometry. `components/room-3d-viewer.tsx` refactored to import from it (no visual change).

2. **Depth-map extraction — Phase 2** (`lib/depthMap.ts`, new) — `renderDepthMap()` runs client-side: offscreen `WebGLRenderer` (1024×1024) + `PerspectiveCamera` matching the viewer's default view; custom depth `ShaderMaterial` (near=white → far=black); `readRenderTargetPixels` → flipped grayscale `ImageData` → PNG data URL. Reuses `lib/scene.ts`. Only called in the browser (guarded).

3. **Replicate depth-conditioned render — Phase 3** (`app/api/design/render/route.ts`):
   - New body field `depthMapBase64`. `page.tsx` generates it in `runRender` when `design.layout` exists (try/catch; omitted on failure).
   - Env: `RENDER_PROVIDER=replicate` + `REPLICATE_API_TOKEN` + `REPLICATE_DEPTH_MODEL` (default `sdxl-based/realvisxl-v3-multi-controlnet-lora`).
   - Replicate path: plain `fetch` → resolve latest model version → `POST /v1/predictions` → poll every 2s up to ~100s → last output URL → base64 data URL → `{ image, provider: "replicate" }`. Inputs: `image` = original photo, `controlnet_1 = "depth_leres"` + depth map (conditioning 0.9), `prompt_strength` 0.5, 1024×1024, 30 steps, `no_refiner`. Uses dedicated SDXL-style `buildReplicatePrompt` (step 1 — added later, see below). Gemini path keeps `buildRenderPrompt`.
   - Timeout: `export const maxDuration = 120` on the route (Next 16 route segment config). Client progress text: "Rendering your redesign — can take up to a minute…".
   - Fallback (step 6): any Replicate error/expired key/timeout → existing Gemini `generateImage` path → `{ image, provider: "gemini" }`. Unset `RENDER_PROVIDER` = today's behavior.

4. **Phase 4 — UI labeling + layout** (`app/page.tsx`): photoreal render moved to a full-width **"Visualization — photoreal render"** section at the **top** (with the BeforeAfterSlider + Download), summary/spec/budget below, and the **"Exact plan — 3D view"** section underneath — photo on top, 3D below. Added step-5 wording: "Closely matched to the exact plan — not pixel-identical."

5. **Docs** (`3dviewerFeat.md`): §5.5 + §11 pinned to Replicate `sdxl-based/realvisxl-v3-multi-controlnet-lora`; diagram provider name updated. `.env`: added `REPLICATE_API_TOKEN` (empty — user must fill), `RENDER_PROVIDER=replicate`, `REPLICATE_DEPTH_MODEL`.

6. **Step 1 added after review** (`app/api/design/render/route.ts`): new `buildReplicatePrompt()` — SDXL-style positive prompt (style preset + furniture names + palette + lighting + photoreal keywords) used only for the Replicate path; Gemini path keeps `buildRenderPrompt`. Lint + tsc clean.

### Verified

- `tsc --noEmit`: clean.
- `npm run lint`: 0 errors, 2 pre-existing warnings in `app/layout.tsx` (leave alone).
- `npm run build`: passes.

### Open / next steps

- Phase 3 is behind the flag but not yet live-tested end-to-end — needs a real `REPLICATE_API_TOKEN` in `.env`. Without one the app falls back to Gemini (safe default).
- A/B once live: compare Replicate vs Gemini render for cost/latency/quality; tune `prompt_strength` + `controlnet_1_conditioning_scale` per style preset (SDD §9 warns low-denoise renders can look CG-clean). Optional: a `RENDER_PROVIDER` UI hint showing which provider rendered.
- Known limitation (SDD §9): depth map uses the 3D viewer's camera angle, not the user's photo angle → "closely matched, not identical."

### Workflow conventions

- User prefers plain-language explanations and "in simple word" summaries; answers should be short.
- When the user says "build it" / "go", implement directly (no plan re-approval).
- Never commit unless explicitly asked.

## Session 3 — Phase 3 live A/B tooling + GLTF furniture models

### Done this session

1. **Per-preset render knobs** (`lib/schema.ts`): each `STYLE_PRESET` now has `render: { promptStrength, conditioningScale, steps }` (starting guesses; Maximalist 0.6/0.85/32, Scandinavian 0.45/0.9/30, coastal 0.55/0.85/30, rest 0.5/0.9/30). Tuning = one-line constant edit per style. Route falls back to 0.5/0.9/30.

2. **One-tap A/B** (`app/api/design/render/route.ts`): optional `body.provider: "replicate" | "gemini"` overrides `RENDER_PROVIDER` env. Route reads the active preset's knobs and feeds them into `runReplicate`.

3. **Provider caption** (`app/page.tsx`): captures `data.provider`; the "Closely matched…" line now appends " · Rendered with Replicate (RealVisXL)" or " · Rendered with Gemini" so cost/latency/quality comparison is visible. `renderDepthMap` is now awaited (async).

4. **GLTF furniture models — Part 2** (`public/models/furniture/*.glb`): 8 procedural low-poly GLBs generated by `scripts/generate-models.mjs` (three `GLTFExporter`, `FileReader` shim for Node). NOTE: substituted for the planned Kenney CC0 pack — itch/kenney direct download wasn't reliable in-session; models are hand-built to match the category color palette and unit convention, and swapping in Kenney GLBs later is a drop-in (same `category → file` map). Generated models: seating (sofa), table, storage (bookcase), bed, lighting (lamp), decor (plant), rug, other (armchair).

5. **`lib/furnitureModels.ts`** (new): `CATEGORY_MODELS` map (`category → /models/furniture/*.glb`), `modelPathFor()`, and `fitFurnitureModel()` (clone → uniform-scale to item W×D×H AABB → recenter on x/z, base at y=0).

6. **Viewer uses models** (`components/room-3d-viewer.tsx`): new `FurnitureModel` component (drei `useGLTF` + `<primitive>` + `fitFurnitureModel`, wrapped in `<Suspense>`); existing `FurnitureMesh` stays as the box fallback for unmapped categories/load errors. Obstacles unchanged.

7. **Depth map uses the same models** (`lib/depthMap.ts`): `renderDepthMap` is now `async`; preloads needed GLBs via `GLTFLoader` (module-cached) and renders fitted model silhouettes (better Phase 3 fidelity — fixes the "boxy sofa" depth-map risk from SDD §9); box fallback. `page.tsx` awaits it.

### Verified

- `tsc --noEmit`: clean.
- `npm run lint`: 0 errors, 2 pre-existing warnings in `app/layout.tsx` (leave alone).
- `npm run build`: passes.

### Open / next steps

- **Live A/B (user + dev):** paste `REPLICATE_API_TOKEN` into `.env`, then run the same room through both providers (toggle `provider` in the request body or `RENDER_PROVIDER` env) and compare cost/latency/quality. Adjust the per-preset `render` knobs from results.
- **Model tuning:** eyeball the procedural GLB normalization in `npm run dev`; optionally swap in Kenney's CC0 GLBs (drop into `public/models/furniture/`) if the low-poly look isn't wanted.
- Known limitation (SDD §9): depth map uses the 3D viewer's camera angle, not the user's photo angle → "closely matched, not identical."

### Workflow conventions

- User prefers plain-language explanations and "in simple word" summaries; answers should be short.
- When the user says "build it" / "go", implement directly (no plan re-approval).
- Never commit unless explicitly asked.

## Session 4 — Phase 3 (Replicate render) reverted; photoreal render back to Gemini-only

### Done this session (option 2 — full removal)

1. **`app/api/design/render/route.ts`** — reverted to the original Gemini-only `generateImage` handler. Removed: `runReplicate`, `resolveDepthModelVersion`, `fetchBase64`, `pickOutputUrl`, `sleep`, `buildReplicatePrompt`, `NEGATIVE_PROMPT`, `maxDuration`, `USE_REPLICATE`/`DEPTH_MODEL`/`REPLICATE_API_TOKEN` consts, `depthMapBase64`, `body.provider`, and preset-knob logic.
2. **`app/page.tsx`** — removed depth-map generation + `depthMapBase64`, `renderProvider` state, and the provider caption. `runRender` body back to the original. "Rendering your redesign…" progress text restored.
3. **`lib/schema.ts`** — removed the per-preset `render` knobs and `StyleRenderKnobs`.
4. **`.env`** — removed `REPLICATE_API_TOKEN`, `RENDER_PROVIDER`, `REPLICATE_DEPTH_MODEL` (kept the real Google key).
5. **`lib/depthMap.ts`** — deleted (only used by the Replicate path).
6. **Kept untouched (still working):** the 3D viewer, GLTF furniture models (`public/models/furniture/`), `lib/furnitureModels.ts`, `lib/scene.ts`, `scripts/generate-models.mjs`, obstacles, budget, spec sheet. The photoreal render is Gemini-only again.

### Verified

- `tsc --noEmit`: clean.
- `npm run lint`: 0 errors, 2 pre-existing warnings in `app/layout.tsx` (leave alone).
- `npm run build`: passes.

### Open / next steps

- Photoreal render = Gemini (`gemini-2.5-flash-image`) only. No Replicate key needed.
- Remaining SDD items: solver-failure UX fallback (§9) and shape-aware collisions (§10.2) if wanted. GLTF models + tooltips + phases 1/2/4 are in place.

### Workflow conventions

- User prefers plain-language explanations and "in simple word" summaries; answers should be short.
- When the user says "build it" / "go", implement directly (no plan re-approval).
- Never commit unless explicitly asked.

## Session 5 — Real Kenney GLTF models replace the procedural stand-ins

### Done this session

1. **Sourced the real Kenney Furniture Kit (CC0)** — downloaded 8 GLBs from the `ETdoFresh/kenney.nl` GitHub mirror (stable `raw.githubusercontent.com` URLs; the kenney.nl/itch direct download was still not scriptable) into `public/models/furniture/`, keeping our category filenames:
   - seating ← `loungeSofa`, table ← `tableCoffee`, storage ← `bookcaseOpen`, bed ← `bedDouble`, lighting ← `lampRoundFloor`, decor ← `pottedPlant`, rug ← `rugRectangle`, other ← `loungeChair`.
   - All 8 verified as valid GLB (magic bytes `glTF`). Total ~86 KB — negligible bundle cost.
2. **`public/models/CREDITS.txt`** — Kenney CC0 attribution + source + the name mapping.
3. **`lib/furnitureModels.ts`** — added `MODEL_ROTATION_DEG` (per-category Y-rotation offset, currently empty) and `rotationDegFor()`; `fitFurnitureModel` now accepts an optional `rotationOffsetDeg` and applies it after centering. `room-3d-viewer.tsx` passes `rotationDegFor(item.category)`.
4. **Colors** — Kenney's own PBR materials kept (per user choice); the old category color-coding is gone for modeled furniture (box fallback still uses it).
5. **`scripts/generate-models.mjs`** — kept but now deprecated (procedural models superseded).

### Verified

- `tsc --noEmit`: clean.
- `npm run lint`: 0 errors, 2 pre-existing warnings in `app/layout.tsx` (leave alone).
- `npm run build`: passes.

### Open / next steps

- **Eyeball in `npm run dev`** (user): check Kenney model orientation/size in the 3D viewer; set any needed values in `MODEL_ROTATION_DEG` in `lib/furnitureModels.ts` (I can adjust from your feedback). Defaults are all 0.
- Models are only in the 3D viewer (render is Gemini-only after Session 4); no depth map anymore.

### Workflow conventions

- User prefers plain-language explanations and "in simple word" summaries; answers should be short.
- When the user says "build it" / "go", implement directly (no plan re-approval).
- Never commit unless explicitly asked.

## Session 6 — 3dviewerFeat.md brought up to date

### Done this session

1. **Refreshed `3dviewerFeat.md`** to reflect the current codebase (no code changes):
   - Added a top status line (phases 1/4 + obstacles + GLTF built; phase 2 built→removed; phase 3 built→reverted).
   - §5 diagram now shows the real architecture: solver → 3D viewer (Kenney GLTFs) → layout; render = Gemini image-to-image; depth-map/Replicate branch removed and noted as historical.
   - §5.1–5.3 marked built, §5.4 built→removed, §5.5 collapsed to a historical note.
   - §4 flagged historical (Gemini-only constraint is intact); §6 API table, §7 principles, §8 accuracy expectations corrected for the Gemini-only render; §9 risks trimmed to the one open item (solver-failure UX fallback).
   - §10.1 built, §10.2 not started (optional), §10.3 already current; §11 per-phase status.

### Open / next steps

- Remaining SDD items: solver-failure UX fallback (§9), shape-aware collisions (§10.2, optional).
- Eyeball Kenney models in `npm run dev`; set `MODEL_ROTATION_DEG` values if any face wrong.

### Workflow conventions

- User prefers plain-language explanations and "in simple word" summaries; answers should be short.
- When the user says "build it" / "go", implement directly (no plan re-approval).
- Never commit unless explicitly asked.