# SDD: Exact Furniture Placement — 3D Viewer + Depth-Conditioned Photoreal Render

> **Status:** Phases 1, 4, obstacles + GLTF furniture models are built. Phase 2 (depth map) was built then removed; Phase 3 (Replicate depth-conditioned render) was implemented then reverted — the photoreal render is Gemini-only again.

## 1. Problem

The current pipeline generates furniture layout data and a photorealistic render as two independent Gemini calls (`/api/design` and `/api/design/render`). They share the same input photo/dimensions/style but nothing forces their outputs to agree. There is no way to guarantee that furniture positions shown in the photorealistic render match the positions used anywhere else in the product, because Gemini's image model has no concept of coordinates — it generates plausible pixels, not measured geometry.

Goal: make furniture placement exact and reproducible, and make the photorealistic render reflect that exact placement — not just approximate it.

## 2. Non-Goals

- Not attempting to make Gemini's image model spatially exact. It cannot accept depth/structural conditioning today.
- Not claiming the resulting layout is aesthetically "correct" — only that it is geometrically valid (no overlaps, respects clearances, fits the room) and reproducible.
- Not solving monetization, accounts, or persistence — out of scope for this doc.

## 3. Current Architecture (baseline)

```
photo + dimensions + style
        │
        ├──► /api/design (Gemini generateObject) ──► furniture list, budget, spec
        │
        └──► /api/design/render (Gemini image-to-image) ──► photoreal before/after
```

Both branches run independently. No shared placement data structure exists today; `lib/schema.ts` only carries max item dimensions, not position.

## 4. Constraint Being Broken (historical)

`PRODUCT.md` states: *"Provider locked to Google Gemini."*

This SDD proposed breaking that constraint **only for the photoreal render step** (Gemini's image API does not expose depth/canny/structural conditioning, which is required to lock a generated image to exact geometry). The exception was implemented for Replicate and then **reverted (Session 4)** — the constraint is currently intact: all rendering uses Gemini.

## 5. Architecture (current)

```
photo + dimensions + style
        │
        ▼
/api/design (Gemini generateObject) ──► furniture list + RELATIONSHIPS (wall, align, adjacency)
        │                    NOT raw x/z — Gemini does not emit coordinates
        ▼
Placement Solver (server, deterministic, no LLM)
        │  - resolves relationships → exact x/z per room dimensions
        │  - runs collision/clearance validation (no overlaps, doors/windows unblocked)
        │  - rejects/auto-nudges invalid placements
        ▼
Validated Layout (single source of truth)
        │
        ├──► 3D Viewer (react-three-fiber + Kenney GLTF furniture models) — exact by construction
        │
        └──► /api/design/render (Gemini image-to-image) ──► photoreal before/after (illustrative only)
```

The depth-map branch and the Replicate ControlNet-depth render were implemented (Sessions 2–3) and then reverted (Session 4); the photoreal render is Gemini-only again.

### 5.1 Schema changes (`lib/schema.ts`) — built

Replace raw coordinate fields (if any) with relationship-based placement so the LLM never has to "measure":

```ts
placement: z.object({
  wallRef: z.enum(["north", "south", "east", "west"]),
  align: z.enum(["left", "center", "right"]),
  offsetFt: z.number(),          // distance along the wall from the align anchor
  adjacentTo: z.string().optional(), // e.g. "rug", "sofa"
  rotationDeg: z.number().optional(),
})
```

### 5.2 Placement Solver (server-side, deterministic) — built (`lib/placement.ts`)

- Input: room W×L×H, furniture list with footprints, relationship data from Gemini.
- Output: exact `{x, z, rotationDeg}` per item.
- Validation: no bounding-box overlap, minimum clearance around walkways, doors/windows not blocked, all items within room bounds.
- On failure: auto-nudge along the wall axis, or drop/flag the item — never emit an invalid layout.
- Implementation options: hand-rolled rectangle-packing/collision check in TS, or OR-Tools CP-SAT via a small service if constraints grow complex.
- This step has zero dependency on Gemini and is fully reproducible given the same inputs.

### 5.3 3D Viewer — built (`components/room-3d-viewer.tsx`, `lib/scene.ts`, `lib/furnitureModels.ts`)

- `react-three-fiber` scene, room walls sized to user's W×L×H input, furniture as Kenney Furniture Kit GLTF models (CC0, `public/models/furniture/`) sized to each item's max W×D×H, positioned per the solver's output.
- Exact by construction — same layout data drives the viewer every time.
- Hover tooltips per piece; per-category Y-rotation offsets via `MODEL_ROTATION_DEG` for normalization.

### 5.4 Depth Map Extraction — built (Session 2), removed (Session 4)

- Rendered the Three.js scene to a depth buffer (distance-from-camera per pixel) as a grayscale image, intended for the ControlNet-depth render.
- Deleted along with the Replicate render revert — no current consumer.

### 5.5 Depth-Conditioned Photoreal Render (Replicate) — implemented (Sessions 2–3), reverted (Session 4)

- The photoreal render is back to Gemini-only (`gemini-2.5-flash-image`). The depth map, `REPLICATE_*` env vars, per-preset render knobs, and provider A/B switch were removed from the codebase. Retained: the exact 3D layout ("Exact plan") and GLTF furniture models.
- Historical design (for reference): the render would call Replicate's `sdxl-based/realvisxl-v3-multi-controlnet-lora` (RealVisXL, img2img + ControlNet `depth_leres`) with the original photo + depth map + style prompt at low `prompt_strength`, behind a `RENDER_PROVIDER` flag, auto-falling back to Gemini on failure.

## 6. API Changes

| Route | Change |
|---|---|
| `POST /api/design` | Emits relationship-based placement, not raw coordinates. Solver runs server-side within this route; response includes `{...design, layout, layoutWarnings}`. **Built.** |
| `POST /api/design/render` | Gemini image-to-image (`gemini-2.5-flash-image`). The depth-map + ControlNet-depth provider path was implemented (Sessions 2–3) then reverted (Session 4). **Built — Gemini-only.** |
| 3D viewer component | Client-side `react-three-fiber` component (`components/room-3d-viewer.tsx`) consuming the validated layout from `/api/design`, rendering Kenney GLTF furniture models. **Built.** |

## 7. Product Principles — Compliance Check

- **Principle #1** (measurements/budget from structured output, images illustrative only) — upheld. Solver output is the numeric source of truth; the photoreal render is labeled illustrative.
- **Principle #4** (expensive generative calls bound behind explicit user action) — upheld. The render call stays behind the explicit "Generate redesign" button; no automatic triggering.
- **Brand Commitments** (Aeonik, `font-medium` cap, paper/pine-green palette) — applies to all new UI (3D viewer controls, loading states) unchanged.

## 8. Accuracy Expectations

- **3D viewer placement**: exact and reproducible — deterministic solver, not generative.
- **Photoreal render**: Gemini image-to-image, illustrative only — not geometry-locked to the 3D plan. Described in-product as "closely matched to the exact plan — not pixel-identical." (The depth-conditioned path that would have locked geometry was reverted.)
- **Aesthetic quality of the layout itself**: no accuracy ceiling exists; remains an LLM/heuristic judgment call, independent of the geometric guarantees above.

## 9. Risks / Open Questions

- Solver failure/edge cases (room too small for requested furniture set) need a defined UX fallback, not just a rejected layout. **Not yet addressed.**
- (Resolved/removed by the Phase 3 revert: Replicate provider cost/key, CG-clean low-denoise renders, GLTF depth-map fidelity.)

## 10. Fix Plan: Doors/Windows & Furniture Shape Accuracy

Two gaps identified in review directly affect placement correctness (not just render quality or cost) and should be addressed before the solver is considered complete.

### 10.1 Doors and windows are not tracked as obstacles — **built**

**Problem:** the solver's stated validation rule ("doors/windows unblocked") cannot run today — `PRODUCT.md`'s only room input is W×L×H, with no door/window location data anywhere in the schema. A furniture item could be placed directly in front of a door and pass validation, because the solver has no data telling it a door exists there.

**Plan:**
1. Add a tap-to-place UI step after room photo upload: show the user a simple top-down room outline and let them mark door and window positions along the walls (preferred over vision-based guessing — no extra model call, no ambiguity, exact by construction).
2. Extend `lib/schema.ts` with a door/window schema, reusing the same relationship pattern as furniture placement:
   ```ts
   obstacle: z.object({
     type: z.enum(["door", "window"]),
     wallRef: z.enum(["north", "south", "east", "west"]),
     offsetFt: z.number(),
     widthFt: z.number(),
     swingClearanceFt: z.number().optional(), // for doors
   })
   ```
3. Extend the placement solver's validation pass to treat each door/window as a fixed obstacle with its own footprint (including door swing arc), and reject/nudge any furniture placement that overlaps one — same collision-check mechanism already used for furniture-vs-furniture.
4. Optional fallback for a fully automatic flow later: Gemini vision estimates door/window wall + offset from the photo, output in the same schema shape — lower priority than the tap-to-place UI, since it trades exactness for convenience.

### 10.2 Furniture proxies are boxes; some real furniture isn't box-shaped — **not started (optional)**

**Problem:** the solver's overlap/clearance checks use axis-aligned bounding boxes (AABBs) for every item. This is correct for most furniture (sofas, dressers, rectangular tables) but produces wrong-shaped footprints for non-rectangular items — an L-shaped sectional's box either leaves an unaccounted gap or overclaims floor space, and a round table's box wastes corner space the solver might mistakenly flag as insufficient clearance.

**Plan:**
1. Ship with AABB proxies for all items initially — correct for the large majority of furniture types, no schema change required to launch.
2. Add an optional `shape: z.enum(["rect", "circle", "l-shape"]).default("rect")` field to each furniture item in `lib/schema.ts`, populated only for known problem categories (round dining/coffee tables, sectional sofas).
3. Extend the solver's collision math with shape-specific checks: circle-vs-box/circle overlap test for `"circle"`, two-rectangle union for `"l-shape"` — both are cheap, well-known geometry formulas, no new dependency required.
4. Treat this as phase-2 work: ship boxes-only first, add shape variants only for furniture categories that show real placement complaints in practice, rather than building every shape type up front.

### 10.3 Related, non-blocking additions noted during review

- **3D viewer hover/tap interaction:** attach `onPointerOver`/`onClick` handlers per furniture mesh to show a name/price/dimensions tooltip (via `@react-three/drei`'s `<Html>` component); tap-based on mobile. Independent of the solver — pure UI addition once the viewer exists. **Status: built.**
- **Furniture model sourcing:** generic GLTF models per furniture category (sofa, armchair, table, etc.), sourced once from a free/open asset library (e.g., Poly Pizza, Kenney.nl) and bundled in `public/models/`, mapped by category in code. One-time asset cost, not a per-request model call — keeps to the existing cost/latency constraint. AABB proxies remain the collision math regardless of which visual model is shown. **Status: built — 8 real Kenney Furniture Kit GLBs (CC0) in `public/models/furniture/` mapped by category (`lib/furnitureModels.ts`), with per-category Y-rotation offsets for normalization; `public/models/CREDITS.txt` for attribution. The old procedural stand-ins were superseded (Session 5).**

## 11. Phasing Suggestion

1. Ship relationship-based schema + deterministic solver + 3D viewer, independent of the render pipeline. This alone delivers "exact placement" and can ship without touching the Gemini image route. **Status: done (Session 1).**
2. Prototype depth-map extraction from the Three.js scene. **Status: done (Session 2), removed (Session 4).**
3. Integrate the Replicate depth-conditioned render (`sdxl-based/realvisxl-v3-multi-controlnet-lora`) behind a feature flag (`RENDER_PROVIDER`); compare against current Gemini render for cost/latency/quality before committing. **Status: implemented (Sessions 2–3), reverted (Session 4) — render is Gemini-only; feature-flag code removed.**
4. Roll out with explicit "Exact Plan" (3D viewer) vs. "Visualization" (photoreal render) labeling in UI. **Status: done (Session 2).**