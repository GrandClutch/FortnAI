# FortnAI — Project Summary

## What is FortnAI?

FortnAI ("AI Interior Design Studio") is a single-page web app that turns a photo of a real room plus its dimensions into a complete, actionable interior design plan in seconds. A non-designer uploads a photo, enters the room's width × length × height in feet, optionally picks a style direction and adds their own words, and receives:

- A **furniture layout** sized to the actual room (with circulation space),
- A **blueprint-style spec sheet** (piece, max W×D×H, placement, estimated cost),
- An interactive **budget calculator** (toggle pieces, edit prices, live total),
- An **exact 3D plan** of the room with the furniture placed deterministically,
- An optional **photorealistic before/after render** with a draggable comparison slider.

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind CSS v4 · Vercel AI SDK v7 (`ai` + `@ai-sdk/google`) · zod v4 · three.js / @react-three/fiber / @react-three/drei.

- Analysis model: `gemini-3.6-flash` (structured output via `generateObject`)
- Image model: `gemini-2.5-flash-image` (image-to-image via `generateImage`), overridable with `GEMINI_IMAGE_MODEL`
- Credentials: `GEMINI_API_KEY` (not yet in the repo's `.env`)

## Core features

### 1. Room input & style selection
- Photo upload (click or drag & drop), W×L×H input in feet.
- Six style presets (Minimalist, Japandi, Maximalist Dorm, Industrial Loft, Scandinavian, Coastal) — **togglable, and can be deselected** so the AI (or the user's own direction) takes the lead.
- Optional **custom design prompt** textarea: additive on top of the selected style, or the sole design guide when no style is chosen. Capped client-side (600 chars) and server-side (2000).

### 2. Enriched per-preset style briefs
- Each preset now has a detailed, multi-part design brief (philosophy, color palette, materials, furniture form, lighting, textiles, plus "avoid" guardrails) in `lib/prompts.ts`.
- Both the analysis and render prompts share the same briefs — one edit updates both, keeping outputs on-style and consistent.

### 3. Exact 3D placement (deterministic, not AI)
- The model emits **wall-relationship placements** (wallRef / align / offsetFt / optional adjacentTo), never raw coordinates.
- `lib/placement.ts` — a deterministic solver — converts those relationships into exact x/z positions, validates collisions, keeps door/window obstacles clear (including door swing arcs), auto-nudges along walls, and flags anything it can't place (`layoutWarnings`).
- `components/room-3d-viewer.tsx` renders the result in 3D (Kenney Furniture Kit GLB models, CC0), sized to the user's room — exact by construction.
- **Doors & windows:** `components/obstacle-editor.tsx` lets the user tap-to-place them on a top-down room outline; they're fed into the prompt, the solver, and the viewer.

### 4. Budget calculator & blueprint
- Budget section toggles pieces on/off and edits prices with a live total and a "saved vs original" readout.
- Blueprint table lists each piece with max size (inches), placement rationale, and estimated cost.

### 5. Photoreal render
- Explicit "Generate redesign" button (cost-bound, never automatic).
- Gemini image-to-image keeps the real room's shell/walls/windows and applies the generated layout + palette + lighting.
- Shown in a draggable before/after slider; labeled illustrative (not pixel-locked to the 3D plan).

### 6. Safety guardrails
- **Blocklist** (`lib/safety.ts`): weapons/explosives/drugs terms rejected with a 400 "can't be fulfilled" message before any model call — checked client-side on submit and server-side in both routes.
- **AI refusal** baked into the system + user prompts: never include dangerous/illegal items, refuse if requested in text or visible in the photo.
- Word-boundary matching avoids false positives (e.g. "gunmetal", "knife block" are fine).

## Project structure

```
app/
  page.tsx                     single-page UI (input → analyzing → results)
  api/design/route.ts          POST /api/design  — analyze + solve layout
  api/design/render/route.ts   POST /api/design/render — image-to-image render
components/
  before-after-slider.tsx      draggable before/after comparison
  room-3d-viewer.tsx           react-three-fiber 3D plan viewer
  obstacle-editor.tsx          tap-to-place doors/windows
lib/
  schema.ts                    zod schemas + STYLE_PRESETS + prompt sanitize helpers
  prompts.ts                   preset briefs, system prompt, analysis prompt builder
  safety.ts                    unsafe-content blocklist
  placement.ts                 deterministic layout solver
  scene.ts                     room geometry + coordinate transforms for the viewer
  furnitureModels.ts           category → GLB map + fit-to-size scaling
  client.ts                    file → base64 helper
public/models/                 Kenney Furniture Kit GLBs (CC0) + CREDITS.txt
scripts/generate-models.mjs    procedural GLB regeneration tool
spec/                          SPEC.md, promptand3d.md, summary.md
```

## What was done across this session

1. **Custom design prompt feature** — optional textarea wired into both API routes; sanitize + length caps server-side; additive prompt composition.
2. **Enriched per-preset prompts** — replaced placeholder one-liners with detailed style briefs centralized in `lib/prompts.ts`; both routes consume the same briefs.
3. **Style deselect bug fix** — preset selection became nullable/togglable (starts unticked); no preset → user prompt guides, or AI picks the fitting direction; render anchors on the design theme when no preset.
4. **Safety guardrails** — blocklist (client + server) + AI-refusal instructions in system/user/render prompts.
5. **3D viewer integration** — merged the exact-placement feature (solver, obstacles, react-three-fiber viewer) with the prompt features: placement rule added to the system prompt, `buildAnalysisUserPrompt` now takes `obstacles`, analysis route orchestrates validate → safety → generateObject → solveLayout, page sends `stylePreset` + `customPrompt` + `obstacles` together, results show the "Exact plan — 3D view" section with warnings.
6. **Docs** — `spec/SPEC.md` (implementation spec), `spec/promptand3d.md` (integration spec), `spec/summary.md` (this file).

## Design system

- Aeonik as the sole typeface (max weight `font-medium`), warm editorial interior-studio aesthetic: light paper ground (`#f6f4f0`), hairline rules, restrained pine-green accent (`#334f3e`).
- Branding: FortnAI — "AI Interior Design Studio."

## Verification status

- `npm run lint` — passes (2 pre-existing warnings: unused Geist fonts in `app/layout.tsx`).
- `npx tsc --noEmit` — clean.
- `npm run build` — succeeds (routes: `/`, `/api/design`, `/api/design/render`).
- Blocklist sanity tests — 10/10 pass.
- **Not yet done:** live end-to-end run (needs `GEMINI_API_KEY`), and a visual check of 3D furniture orientations (`MODEL_ROTATION_DEG` is empty).

## Known / deferred items

- Unused Geist font imports in `app/layout.tsx`.
- Upload size: photos sent as full-res data URLs; large phone photos may exceed the Vercel serverless body limit (~4.5 MB) — needs client-side resize/compression.
- `totalEstimatedBudget` from the AI isn't shown (UI recomputes its own total).
- Duplicate furniture `item` names could collide React keys in the budget/blueprint rows.
- No rate limiting / auth on the API routes (deployment concern).
- No persistence or accounts yet (designs are not saved).
- Monetization (affiliate links via the schema's `shoppingLink`) and deployment (Vercel) not configured.