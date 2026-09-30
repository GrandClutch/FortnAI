# FortnAI — System & AI Architecture

## 1. System overview

FortnAI is a Next.js web app. The **AI layer** (Google Gemini) is responsible for *deciding* what to design; everything about *placing and validating* that design in the real room is **deterministic code** (no model calls). This split is deliberate: decisions are probabilistic, geometry is reproducible.

```
                  ┌────────────────────────────  USER  ────────────────────────────┐
                  │  upload room photo · enter W×L×H (ft) · pick style · direction │
                  └──────────────┬───────────────────────────────────────────────┘
                                 ▼
                  ┌────────────────────────────  APPLICATION (Next.js)  ────────────────────────┐
                  │  app/page.tsx  (input → analyzing → design → rendering → before/after)      │
                  │  validation + safety blocklist before any call (400s on bad/unsafe input)   │
                  └──────┬──────────────────────────────────────────────┬────────────────────────┘
                         ▼                                              ▼
              ┌─────────────────────┐                     ┌──────────────────────┐
              │  AI LAYER           │                     │  AI LAYER            │
              │  POST /api/design   │                     │  POST /api/design/   │
              │  gemini-3.6-flash   │                     │  render              │
              │  generateObject +   │                     │  gemini-2.5-flash-   │
              │  zod schema         │                     │  image               │
              │  ── photo + dims +  │                     │  generateImage       │
              │     style + prompt  │                     │  ── photo + design   │
              └─────────┬───────────┘                     └──────────┬───────────┘
                        ▼                                           ▼
              ┌─────────────────────┐                     ┌──────────────────────┐
              │ DETERMINISTIC CODE  │                     │ DETERMINISTIC CODE   │
              │ lib/placement.ts    │                     │ lib/history.ts       │
              │ (solveLayout)       │                     │ (store render image) │
              │  relationships →    │                     └──────────┬───────────┘
              │  exact x/z, no      │                                ▼
              │  overlaps, no       │                     ┌──────────────────────┐
              │  blocked openings   │                     │ DETERMINISTIC CODE   │
              └─────────┬───────────┘                     │ 3D viewer + before/  │
                        ▼                                 │ after slider         │
              ┌───────────────────────────────────────────────────────────┐
              │  Client UI: blueprint spec · budget calc · 3D viewer ·    │
              │  before/after slider                                      │
              └───────────────────────────────────────────────────────────┘
                        │
                        ▼
              ┌───────────────────────────────────────────────────────────┐
              │ EXTERNAL SERVICES                                         │
              │  Google Gemini API      (analysis + image generation)     │
              │  PocketBase             (auth, projects, designVersions,  │
              │                          render image storage)            │
              │  RapidAPI Amazon search (optional shopping links)         │
              └───────────────────────────────────────────────────────────┘
```

## 2. What is AI vs. deterministic

| Concern | Who does it | Why |
|---|---|---|
| "What furniture, what size, what style for this room?" | **AI** (Gemini vision) | Needs visual understanding of the photo + design judgment |
| "What does the redesign look like?" | **AI** (Gemini image) | Generative image task |
| "Does it physically fit (coordinates, overlaps, doors)?" | **Deterministic** (`lib/placement.ts`) | Geometry must be exact and reproducible — never left to a model |
| "Which 3D model file represents this item?" | **Deterministic** (`lib/furnitureKit.ts`) | Fixed asset lookup |
| "Is the prompt unsafe?" | **Deterministic** (blocklist) + **AI refusal layer** | Hard block first, prompt-level guard second |
| "Is the input valid?" | **Deterministic** (zod) | Schema enforcement |

## 3. Data flow — analysis

1. Client validates input, checks the unsafe blocklist, sends `{ imageBase64, width, length, height, stylePreset?, customPrompt?, obstacles?, budgetRange? }` to `POST /api/design`.
2. Route validates dims/image/obstacles/budget via zod, sanitizes the prompt, re-checks the blocklist → 400 on failure (no model call).
3. `generateObject` (Gemini, zod schema) returns the design: theme, spatial strategy, furniture items (name, category, recommended W×D×H cm, cost, *relationship* placement), budget, palette.
4. `solveLayout` converts relationships → exact `x/z` per item, sized to the room, collision/nudge-validated.
5. Response includes the design + `layout` + `layoutWarnings`; project/version persisted to PocketBase (version marked `failed` on error).

## 4. Data flow — render

1. Client sends `{ projectId, versionId }` to `POST /api/design/render`.
2. Route verifies ownership + a completed design, re-checks the blocklist.
3. `buildRenderPrompt` composes the instruction from the saved design; `generateImage` runs image-to-image on the original photo.
4. Render image is stored in PocketBase and returned as a data URL for the before/after slider.

## 5. Reliability, security, responsible AI

- **Validation:** zod on every input; blocklist hard-rejects unsafe prompts before any model call; AI refusal layer in the system prompt.
- **Failure handling:** timeouts (60s analysis / 120s render → HTTP 504 with a friendly message), retries on transient provider errors, versions marked `failed`, client error banner with the message.
- **Data sent to the model:** the room photo (base64) and the text prompt/dimensions/style. No credentials are ever sent to the model. Auth tokens live in an httpOnly cookie.
- **Risk & mitigation:** an unsafe photo could evade the text blocklist — mitigated by the prompt-level refusal; a dedicated vision-screening call is a documented future option. No rate limiting (documented limitation).
- **Non-determinism:** generative outputs vary run-to-run (see `docs/EVALUATION.md` §3 Q12); deterministic layers remain reproducible.