# FortnAI — Implementation Spec

## 1. Overview

Documentation of the implementation work done on FortnAI V1, covering:

1. **Feature 1 — Custom design prompt** (optional, additive to the selected style preset)
2. **Feature 2 — Enriched per-preset style prompts**, centralized into a shared prompt module
3. **Feature 3 — Safety & input guardrails** (blocklist + AI refusal) and **style-preset deselect** (bug fix)

Stack: Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS v4, Vercel AI SDK v7 (`ai` + `@ai-sdk/google`), zod v4.

---

## 2. Architecture (post-change)

```
app/
  page.tsx                     UI flow (input → analyzing → design → rendering)
  api/design/route.ts          POST /api/design        — vision analysis (generateObject)
  api/design/render/route.ts   POST /api/design/render — image-to-image render (generateImage)
lib/
  schema.ts                    zod schemas, STYLE_PRESETS (id/label/description), sanitizeCustomPrompt
  prompts.ts                   PRESET_PROMPTS, getStylePrompt, ANALYSIS_SYSTEM_PROMPT,
                               buildAnalysisUserPrompt, buildRenderPrompt
  safety.ts                    UNSAFE_TERMS, containsUnsafeContent, unsafeContentMessage
  client.ts                    fileToBase64
components/
  before-after-slider.tsx      draggable before/after comparison
```

**Data flow (analysis):** client validates → `POST /api/design` → blocklist check → `generateObject` with `ANALYSIS_SYSTEM_PROMPT` + `buildAnalysisUserPrompt(...)` + photo → zod-validated `DesignResult` → client renders spec/budget.

**Data flow (render):** client → `POST /api/design/render` → blocklist check → `buildRenderPrompt(...)` → `generateImage` → data URL → before/after slider.

---

## 3. Feature 1 — Custom design prompt

**Purpose:** let a non-designer steer the design with their own words (colors, priorities, must-haves), additive to the chosen style preset.

**Client (`app/page.tsx`)**
- State: `customPrompt: string`, default `""`. Persists across "Change inputs"/reset (like dims & style).
- UI: textarea below the image upload (left column, `lg:col-span-7`), label "Extra direction", `maxLength=600`, live `n/600` counter.
- Sent in both request bodies as `customPrompt`.
- Helper line: with a preset → "Your direction is added on top of the {label} style"; without → "No style selected — your direction is used as your sole design guide".

**Server (`lib/schema.ts`)**
- `MAX_CUSTOM_PROMPT_LENGTH = 2000`.
- `sanitizeCustomPrompt(value: unknown): string` — non-string → `""`; else trim + cap at 2000.

**Prompt composition (both routes)**
- Analysis: `Additional user direction — honor this while keeping the measurements, circulation, and budget rules: <prompt>`.
- Render: `User's additional direction — honor it while keeping this layout and palette: <prompt>.`

---

## 4. Feature 2 — Enriched per-preset prompts + shared module

**Purpose:** replace the placeholder one-line style prompts with detailed design briefs (the "extra security") and make both routes consume identical style direction.

**`lib/schema.ts`**
- `prompt` field **removed** from `STYLE_PRESETS` entries (kept `id`, `label`, `description`).

**`lib/prompts.ts` (new)**
- `PRESET_PROMPTS: Record<StylePresetId, string>` — 6 detailed briefs for minimalist, japandi, maximalist, industrial, scandinavian, coastal. Each covers: philosophy, color palette, materials, furniture form language, lighting character, textiles, and an explicit "avoid" guardrail clause.
- `getStylePrompt(styleId): string` — resolves a brief (falls back to minimalist).
- `ANALYSIS_SYSTEM_PROMPT` — the analysis persona + rules (dimensions in feet, 24″ walkways, max sizes in inches, realistic USD, schema-only output) plus a **Safety** section (see §6).
- `buildAnalysisUserPrompt({ width, length, height, styleId, customPrompt })` — see §5 for nullable logic.
- `buildRenderPrompt({ design, styleId, width, length, customPrompt })` — parses `design` via `designSchema.safeParse`, builds furniture list, and composes the render instruction.

**Routes** now import the shared builders; all local prompt code removed.

---

## 5. Style-preset deselect (bug fix)

**Bug:** the preset list always had exactly one selection (`style` defaulted to `"japandi"`, clicking again couldn't unselect).

**Client (`app/page.tsx`)**
- `style` state → `StylePresetId | null`, default `null` (unticked on load).
- Click toggles: `setStyle(style === preset.id ? null : preset.id)`.
- Checkmark logic unchanged (`style === preset.id`, null never matches).
- Both requests send `stylePreset: style ?? undefined`.

**Server (`lib/prompts.ts`, both routes)**
- `styleId: StylePresetId | null`; invalid/missing → `null` (minimalist fallback **removed**).
- **No preset + custom prompt:** analysis says "No style preset selected — your design direction below is the sole guide."; render omits the style line but keeps user direction.
- **No preset + no prompt:** analysis says "choose the most fitting design direction for this room based on the photo"; render anchors on `Style theme: {design.designTheme}.` (keeps render faithful to the analyzed design).

---

## 6. Feature 3 — Safety guardrails

**Threat:** user asked "place a bomb in the room" and the model complied.

**Strategy: two layers — hard blocklist + AI refusal.**

### 6.1 Blocklist (`lib/safety.ts`, shared client/server)
- `UNSAFE_TERMS`: explosives (bomb, pipe bomb, dynamite, grenade, molotov, c-4, semtex, detonator), firearms (gun(s), pistol(s), rifle(s), shotgun(s), submachine/machine gun, uzi, ak-47, ar-15, assault rifle), weapons (weapon(s), switchblade, butterfly knife, throwing star, shuriken, brass knuckles, machete, bayonet), drugs (narcotics, heroin, cocaine, meth, fentanyl, mdma, ecstasy, lsd, opium, illegal/illicit drugs, drug paraphernalia).
- `containsUnsafeContent(text): boolean` — case-insensitive regex; single words wrapped in `\b…\b` (avoids false positives: "gunmetal", "knife block", "assault the senses" all pass); multi-word phrases matched literally (escaped).
- `unsafeContentMessage(): string` — `"This request can't be fulfilled — it includes content we can't support."`
- Verified: 10/10 test cases (true positives for weapons/drugs, no false positives on normal decor).

### 6.2 Hard block (both API routes)
- After `sanitizeCustomPrompt`, `if (containsUnsafeContent(customPrompt)) return 400 { error: unsafeContentMessage() }`. No model call made.

### 6.3 Client-side (on submit only, per requirement)
- `runAnalysis` checks `containsUnsafeContent(customPrompt)` before fetching → sets error banner and aborts. No live typing warnings, no disabled button.

### 6.4 AI refusal (catches subtle/implied phrasing + unsafe photo content)
- `ANALYSIS_SYSTEM_PROMPT` "Safety (non-negotiable)" section: never include weapons/explosives/illegal items; if requested in text or visible in the photo, do not comply; if detected, still output schema JSON for a safe design, never describing/enhancing the unsafe content.
- Reinforcement lines appended in both `buildAnalysisUserPrompt` and `buildRenderPrompt` (never depict weapons/explosives/dangerous objects; exclude if the photo or direction implies them).
- Note: photo content is guarded by prompt instruction only — no separate vision screening call (cost/latency). Future option.

---

## 7. API contract changes

`POST /api/projects`
- Request: `multipart/form-data` with `photo`, `width`, `length`, `height`, `stylePreset?`, `customPrompt?`, and `obstacles` JSON.
- Creates an owned PocketBase `projects` record and protected room-photo `assets` record.
- The client compresses the image before upload; the API does not accept arbitrary base64 JSON.

`POST /api/design`
- Request: `{ projectId, assetId, idempotencyKey? }`.
- The server loads the owned project and image asset, creates a `designRuns` record, calls Gemini, solves the layout, and saves a `designVersions` record.
- Responses: `401` unauthenticated, `400` invalid/unsafe input, `409` duplicate active run, `200` persisted `DesignResult` plus `projectId`, `versionId`, and `runId`, or `500` safe model error.

`POST /api/design/render`
- Request: `{ projectId, versionId, idempotencyKey? }`.
- The server loads the owned project, protected room photo, and persisted design version.
- The generated image is saved as an `assets` record and linked to the `designVersions` and `designRuns` records.
- Responses: `401` unauthenticated, `400` invalid/unsafe input, `409` duplicate active run, `200 { image: dataUrl, assetId, versionId, runId }`, or `500` safe model error.

---

## 8. Environment

- `GEMINI_API_KEY` — required for both routes (empty `.env` currently).
- `GEMINI_IMAGE_MODEL` — optional override of the render model (default `gemini-2.5-flash-image`).
- `POCKETBASE_URL` — optional server-only PocketBase URL (local default `http://127.0.0.1:8090`).
- `AUTH_OAUTH_SECRET` — recommended production secret for signing the Google OAuth challenge cookie.
- Models: analysis `gemini-3.6-flash`, render `gemini-2.5-flash-image` (confirmed working).

---

## 9. Files changed

| File | Status | Change |
|---|---|---|
| `lib/safety.ts` | new | blocklist, `containsUnsafeContent`, `unsafeContentMessage` |
| `lib/prompts.ts` | new | `PRESET_PROMPTS`, `getStylePrompt`, `ANALYSIS_SYSTEM_PROMPT`, `buildAnalysisUserPrompt`, `buildRenderPrompt` |
| `lib/schema.ts` | edited | removed preset `prompt`; added `MAX_CUSTOM_PROMPT_LENGTH` + `sanitizeCustomPrompt` |
| `app/api/design/route.ts` | edited | shared builders; nullable `styleId`; blocklist 400; customPrompt |
| `app/api/design/render/route.ts` | edited | shared builders; nullable `styleId`; blocklist 400; customPrompt; designTheme anchor |
| `app/page.tsx` | edited | `customPrompt` textarea; togglable `style` (nullable, default null); submit-time unsafe check; adaptive helper text |
| `app/api/projects/route.ts` | new | authenticated project and protected room-photo upload |
| `app/api/auth/*` | new | email/password and Google authentication routes |
| `lib/pocketbase/*` | new | request-scoped client, cookie sessions, protected asset handling |
| `lib/auth/*` | new | user, permission, and authorization helpers |
| `lib/persistence/*` | new | project and persisted design input schemas |

---

## 10. Deferred / known issues (from the initial code review)

Not part of this implementation; candidates for future work:

1. **Unused Geist fonts** — `app/layout.tsx` loads `Geist`/`Geist_Mono` from Google Fonts but never applies them (2 lint warnings); `font-mono` renders Aeonik, not a real mono face.
2. **Upload size limits** — photos are sent as full-res data URLs; large phone photos will exceed Vercel's serverless body limit (~4.5 MB) → 413. Needs client-side resize/compression and/or a file-size guard.
3. **`totalEstimatedBudget` ignored** — the UI recomputes its own total; it can contradict the AI's stated budget.
4. **Duplicate furniture names** — `key={f.item}` in blueprint/budget rows collides if the model returns two pieces with the same name.
5. **Rate limiting / auth** — neither API route has protection against API-credit abuse when deployed.
6. **Budget "Saved X vs original" copy** — goes negative ("Saved -300") when a price is edited upward.
7. **Optional future safety** — a dedicated vision-screening call on uploaded photos to hard-block unsafe image content (currently prompt-level only).

---

## 11. Verification

- `npm run lint` — passes (2 pre-existing warnings: unused Geist fonts in `app/layout.tsx`).
- `npx tsc --noEmit` — clean.
- Blocklist unit sanity check — 10/10 pass.
- Runtime E2E (analysis + render + refusal behavior) — pending; requires `GEMINI_API_KEY`.
