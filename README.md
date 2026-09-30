# FortnAI — AI Interior Design Studio

Turn a photo of a room plus its dimensions into a complete interior design plan in seconds: a furniture layout sized to the real room, a blueprint-style spec sheet, an interactive budget plan, a 3D viewer, and a photorealistic before/after render.

**Stack:** Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind CSS v4 · Vercel AI SDK (`ai` + `@ai-sdk/google`) · zod · react-three-fiber (3D viewer) · PocketBase (auth + design history)

## Features

- **Room photo + dimensions → structured design** (`POST /api/design`): Gemini vision analysis returns furniture items (with max dimensions in cm), design theme, budget, and color palette — enforced by a zod schema.
- **Deterministic layout solver** (`lib/placement.ts`): converts relationship-based placement ("next to the bed", "center of north wall") into exact coordinates — items always fit the room, never overlap, never block doors/windows. This is **not** AI.
- **Blueprint spec + budget calculator + shopping links**: toggle items, edit prices, live total.
- **3D viewer**: renders the exact layout with GLTF furniture models.
- **Photoreal before/after render** (`POST /api/design/render`): Gemini image-to-image, shown with a draggable slider.
- **Safety guardrails**: a blocklist hard-rejects unsafe prompts (weapons/drugs) plus an AI refusal layer.
- **Auth + history**: PocketBase users, saved projects and design versions.

## Architecture

```
User ──► Next.js app (React)
            │
            ├─ POST /api/design          ──► Gemini vision (generateObject + zod schema)
            │                                  └─► Placement solver (deterministic) → layout
            ├─ POST /api/design/render   ──► Gemini image-to-image (generateImage)
            │
            └─ PocketBase (auth, projects, design versions, render images)
```

Full diagram and data flow: [`docs/architecture.md`](docs/architecture.md).

## Prerequisites

- Node.js 20+ and npm
- A Google Gemini API key ([AI Studio](https://aistudio.google.com/apikey))
- [PocketBase](https://pocketbase.io) binary (included in this repo under `backend/`)

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment** — copy the template and fill in your API key:

   ```bash
   cp .env.example .env
   # edit .env → set GOOGLE_GENERATIVE_AI_API_KEY
   ```

3. **Run PocketBase** (serves auth + data on `http://127.0.0.1:8090`):

   ```bash
   ./backend/pocketbase serve
   ```

   First run creates `pb_data/`. The app auto-creates the `users`, `projects`, and `designVersions` collections from `pb_schema.json` on first contact (see PocketBase docs), or apply the schema with the PocketBase admin UI at `http://127.0.0.1:8090/_/`.

4. **Start the app:**

   ```bash
   npm run dev
   ```

   Open http://localhost:3000, sign up, upload a room photo, enter dimensions, pick a style, and generate.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint |
| `npm test` | Vitest unit tests (safety, schema, placement, model mapping) |
| `npm run typegen` | Regenerate PocketBase types from the server |

## Testing & evaluation

- **Unit tests** (`npm test`, 41 tests): safety blocklist, input validation, layout solver, furniture-model mapping — all deterministic, no model calls.
- **AI evaluation**: `docs/EVALUATION.md` documents success criteria, expected-vs-actual results, metrics (model-resolution match/fallback rate, geometry-compliance, AI checklist pass rate) and known failure cases.

## Known limitations

- Model keyword gaps: some item names fall back to a generic model (e.g. `wardrobe` → bookcase) — see `docs/EVALUATION.md`.
- The photoreal render is illustrative, not pixel-locked to the 3D plan.
- Large phone photos sent as full-res data URLs can exceed serverless body limits (HTTP 413).
- No rate limiting on the API routes.
- Unsafe *photo* content is guarded by prompt instruction only.

## Deployment

- `Dockerfile` builds a standalone Next.js image; a GitHub Actions workflow (`docker-build-push.yml`) is included.
- Environment: set the same env vars as `.env.example`. PocketBase must be reachable at `NEXT_PUBLIC_POCKETBASE_URL`.