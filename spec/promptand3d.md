# SDD: Prompt & Safety Features × 3D Viewer Integration

> Spec of the **code** integration that makes FortnAI's prompt/safety feature set (custom design prompt, enriched per-preset prompts, safety guardrails, style deselect) work together with the 3D viewer feature set (exact placement solver, obstacles, react-three-fiber viewer).

## 1. Purpose

FortnAI previously existed as two divergent feature sets:

- **Prompt feature set** (single-page product work): custom design prompt, enriched per-preset style briefs centralized in `lib/prompts.ts`, safety blocklist + AI refusal, togglable style presets.
- **3D viewer feature set** (from the "Exact Furniture Placement" SDD): wall-relationship placement schema, deterministic placement solver (`lib/placement.ts`), door/window obstacles, react-three-fiber 3D viewer with Kenney GLTF furniture models.

This document records the **code outcome** of integrating both sets into one coherent analysis pipeline. It describes what the code does now, not how the branches were combined.

---

## 2. Data flow (post-integration)

```
[Front page]
  photo + dims (W×L×H ft) + style preset (optional) + custom prompt (optional)
  + obstacles (doors/windows, tap-to-place)
        │
        ▼
POST /api/design
  1. validate dims (zod)               → 400 if invalid
  2. validate image present            → 400 if missing
  3. resolve style preset              → StylePresetId | null (null = user/AI direction)
  4. sanitize + blocklist customPrompt → 400 if unsafe content
  5. parse obstacles (zod)             → 400 if malformed doors/windows
  6. generateObject (Gemini) with:
       system  = ANALYSIS_SYSTEM_PROMPT (persona + rules + placement + safety)
       user    = buildAnalysisUserPrompt({ dims, styleId, customPrompt, obstacles })
       image   = photo
     → DesignResult (furniture with wall-RELATIONSHIP placement)
  7. solveLayout(furniture, room, obstacles)   ← deterministic, no LLM
     → exact {x, z, rotationDeg} per item + warnings
  8. respond { ...DesignResult, layout, layoutWarnings }
        │
        ▼
[Front page results]
  Design spec (theme / spatial / budget) ──┬── Blueprint table
                                           ├── Budget calculator
                                           ├── "Exact plan — 3D view" (Room3DViewer)
                                           └── layoutWarnings list (unplaceable items)

[Later, on demand] POST /api/design/render — Gemini image-to-image (illustrative only)
```

---

## 3. `lib/schema.ts` — combined schema surface

Both feature sets' types now coexist as one module:

**From the prompt set:**
- `MAX_CUSTOM_PROMPT_LENGTH = 2000`
- `sanitizeCustomPrompt(value: unknown): string` — non-string → `""`; else trim + cap.

**From the 3D viewer set:**
- `placementSchema` → `FurniturePlacement` — `wallRef` (north/south/east/west), `align` (left/center/right), `offsetFt`, optional `adjacentTo`, optional `rotationDeg`.
- `obstacleSchema` → `Obstacle` — `type` (door/window), `wallRef`, `offsetFt`, `widthFt`, optional `swingClearanceFt`.
- `layoutItemSchema` → `LayoutItem` — solved coordinates `x`, `z` (ft, origin at west/north walls), `rotationDeg`, `widthFt`/`depthFt`/`heightFt`, `estimatedCostUSD`, `placementNotes`, optional `status` (`"ok"` | `"overlap"`).

**Furniture item schema:** each `FurnitureItem` gains optional `placement: placementSchema` ("relationship-based placement relative to a wall. Never raw coordinates."). The solver falls back to a deterministic default placement (wall cycling + center align) when the model omits it.

**Design result type:**
```ts
export type DesignResult = z.infer<typeof designSchema> & {
  layout: LayoutItem[];
  layoutWarnings?: string[];
};
```

---

## 4. `lib/prompts.ts` — one coherent analysis prompt

The analysis prompt is built from a single shared module, consumed by `/api/design`.

### 4.1 `ANALYSIS_SYSTEM_PROMPT`

Persona + rules + two additions that bind the feature sets together:

- **Placement rule (from the 3D set):**
  > For every furniture piece, describe its placement as a RELATIONSHIP to a wall: wallRef (north/south/east/west), align (left/center/right), and offsetFt (distance in feet along that wall from the align anchor). Optionally set adjacentTo to another item's name. Never emit raw x/z coordinates.
- **Safety section (from the prompt set):** never include weapons/explosives/illegal items; refuse if requested in text or visible in the photo; still emit schema JSON for a safe design.

### 4.2 `buildAnalysisUserPrompt({ width, length, height, styleId, customPrompt, obstacles })`

Now accepts `obstacles: Obstacle[]`. Output lines (empty lines filtered):

1. `Room dimensions: … ft × … ft × … ft`
2. **`Fixed obstacles:`** — only when obstacles exist — `"door on north wall, 4 ft from the wall's left/north end, 3 ft wide; …"` + "Keep furniture clear of these."
3. Style line, driven by nullable `styleId`:
   - preset → `Design style: <enriched brief>`
   - no preset + customPrompt → "No style preset selected — your design direction below is the sole guide."
   - no preset, no prompt → "No style preset selected — choose the most fitting design direction for this room based on the photo."
4. **Custom prompt line** (prompt set): "Additional user direction — honor this while keeping the measurements, circulation, and budget rules: …"
5. **Safety line** (prompt set): never include weapons/explosives/dangerous objects; don't comply if requested or present in the photo.
6. Final instruction to produce the full specification.

The prompt still has no LLM-invented coordinates: positions are relationships, and the deterministic solver converts them to numbers.

---

## 5. `app/api/design/route.ts` — orchestration

`POST /api/design` now performs (in order):

1. `roomDimensionsSchema.safeParse` → 400 `"Invalid room dimensions"`.
2. Require `imageBase64` string → 400 `"Room image is required"`.
3. Resolve `styleId: StylePresetId | null` — a missing/invalid preset resolves to `null` (no minimalist fallback; AI/user direction governs).
4. `sanitizeCustomPrompt(body.customPrompt)` → if `containsUnsafeContent(...)` → 400 with `unsafeContentMessage()` (no model call).
5. `obstacleSchema.array().safeParse(body.obstacles ?? [])` → 400 `"Invalid doors/windows data"` on failure.
6. `generateObject({ model: google("gemini-3.6-flash"), schema: designSchema, system: ANALYSIS_SYSTEM_PROMPT, messages: [text = buildAnalysisUserPrompt({...}), image] })`.
7. `solveLayout(result.object.furnitureRecommendations, { widthFt, lengthFt, heightFt, obstacles })`.
8. `Response.json({ ...result.object, layout: solved.items, layoutWarnings: solved.warnings })`.

Key property: **all numbers in the response** (`layout` x/z, sizes, statuses, warnings) come from the deterministic solver — never from the model.

---

## 6. `app/page.tsx` — front-page wiring

The front page now threads both feature sets through a single request:

- **State:** `style: StylePresetId | null` (default null — unticked), `customPrompt: string` (default `""`), `obstacles: Obstacle[]` (default `[]`).
- **Style presets:** toggling — clicking the selected preset deselects it; helper text under the textarea adapts to "sole design guide" when no preset.
- **Obstacle editor:** `ObstacleEditor` in the input step; tapping walls adds/removes doors & windows; `onChange={setObstacles}`; cleared on reset.
- **Analysis request body:**
  ```ts
  { imageBase64, width, length, height, stylePreset: style ?? undefined, customPrompt, obstacles }
  ```
- **Submit-time safety check:** `runAnalysis` runs `containsUnsafeContent(customPrompt)` before fetching → inline error, no request.
- **Results:** the "Exact plan — 3D view" section renders `Room3DViewer` from `design.layout` + `obstacles`, plus the `layoutWarnings` list when unplaceable items exist.
- **Render request** unchanged by the 3D set: `{ imageBase64, design, width, length, stylePreset, customPrompt }` → illustrative Gemini render.

---

## 7. Behavior guarantees (how the features reinforce each other)

- **Safety first:** the blocklist short-circuits before any model call; the system + user prompts add a second AI-refusal layer; both apply regardless of style/custom/obstacle inputs.
- **Exactness by construction:** the model only emits wall relationships; `lib/placement.ts` validates collisions (AABB + door swing arc), nudges along walls, and flags failures — so the 3D viewer is exact and the numbers are trustworthy.
- **User intent preserved end-to-end:** dims + style (or its absence) + custom prompt + obstacles all flow into one prompt and never get dropped between stages.
- **Cost/latency discipline:** analysis = one model call + a deterministic solve; render stays behind the explicit "Generate redesign" button.

---

## 8. Files and their final roles

| File | Role after integration |
|---|---|
| `lib/schema.ts` | Combined types: prompt sanitize helpers + placement/obstacle/layout schemas; `DesignResult` carries `layout` + `layoutWarnings` |
| `lib/prompts.ts` | Single source of analysis prompt: system prompt (persona + rules + placement + safety), preset briefs, `buildAnalysisUserPrompt` (dims, style, custom, obstacles) |
| `lib/safety.ts` | Blocklist + `containsUnsafeContent` + message; used client-side (submit) and server-side (both routes) |
| `lib/placement.ts` | Deterministic solver: relationships → exact x/z, collision/clearance/obstacle validation, nudge loop |
| `lib/scene.ts` | Room geometry + coordinate transforms for the viewer |
| `lib/furnitureModels.ts` | Category → GLB map + uniform fit-to-size scaling |
| `app/api/design/route.ts` | Orchestrator: validate → safety → generateObject → solveLayout → merged response |
| `app/api/design/render/route.ts` | Gemini image-to-image; safety blocklist on custom prompt; `designTheme` anchor when no preset |
| `app/page.tsx` | Front page: custom prompt textarea, togglable presets, obstacle editor, 3D viewer + warnings, budget |
| `components/obstacle-editor.tsx` | Tap-to-place doors/windows |
| `components/room-3d-viewer.tsx` | react-three-fiber viewer (GLB furniture, box fallback, hover tooltips, obstacles) |

---

## 9. Verification

- `npm install` — 55 packages added (`three`, `@react-three/fiber`, `@react-three/drei`, `@types/three`), 0 vulnerabilities.
- `npm run lint` — passes; only pre-existing warnings (unused Geist fonts in `app/layout.tsx`).
- `npx tsc --noEmit` — clean.
- `npm run build` — succeeds; routes `/`, `/api/design`, `/api/design/render` generated.

**Not yet verified (requires `GEMINI_API_KEY` + a browser):** live end-to-end run of analysis → layout → 3D viewer → render, and the 3D viewer's furniture orientations (`MODEL_ROTATION_DEG` is empty in `lib/furnitureModels.ts`).