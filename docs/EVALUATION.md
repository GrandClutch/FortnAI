# AI Evaluation — FortnAI

Last updated: **2026-09-30** · Two layers: **deterministic code tests** (no model calls, `npm test`) + **manual AI checklist** (real Gemini runs).

## 1. Success criteria

| Criterion | Target | Method |
|---|---|---|
| Furniture name → 3D model mapping is correct | ≥ 90% match, gaps documented | `lib/furnitureKit.test.ts` |
| No silent fallback to the wrong generic model | fallbacks counted & listed | fallback-rate metric |
| Layout fits the room (inside walls, no overlaps, doors/windows clear) | 100% | `lib/placement.test.ts` |
| Room-fitting items are not shrunk unnecessarily | 100% | `lib/placement.test.ts` |
| Unsafe prompts rejected | 100% | `lib/safety.test.ts` + AI checklist |
| AI produces complete, fitting designs (manual runs) | documented pass rate | AI checklist §3 |

## 2. Deterministic code tests (`npm test`, 41 tests, all passing)

### 2.1 Furniture-model mapping — `lib/furnitureKit.test.ts`

`resolveModel(item, category)` matches an AI-returned item name to a 3D GLTF model (longest-keyword match, else category default). 44 representative item names tested.

**Result:**

| Metric | Value |
|---|---|
| Model-resolution **match rate** | **88.6%** (39/44) |
| Model-resolution **fallback rate** (failed to match → generic default) | **11.4%** (5/44) |

**Documented failure cases (known gaps — no keyword exists, so item falls back to a wrong-but-valid default):**

| Item name | Category | Actual model (fallback) | Should be |
|---|---|---|---|
| wardrobe | Storage | bookcaseOpen | a wardrobe/closet model |
| console | Storage | bookcaseOpen | a media console |
| closet | Storage | bookcaseOpen | a wardrobe/closet model |
| curtains | Storage | bookcaseOpen | window treatment |
| bench | Seating | loungeSofa | a bench |

These are pinned by tests so if the keywords are fixed later the test must be updated. Candidates for `lib/furnitureKit.ts` keyword additions.

### 2.2 Layout fit — `lib/placement.test.ts`

Deterministic solver checks (`solveLayout`):

| Check | Result |
|---|---|
| All items placed inside the room, no overlaps | ✅ |
| Furniture never placed over a door obstacle (nudged or dropped) | ✅ |
| Missing reference falls back to wall placement with a warning | ✅ |
| Oversized furniture trimmed to fit a tiny room | ✅ |
| Room-fitting items kept at recommended size (not trimmed) | ✅ |
| Cyclic references handled without crashing (regression for the fixed 500) | ✅ |

**Geometry-compliance / fit = 100%.**

### 2.3 Input validation & safety

| Suite | Checks | Result |
|---|---|---|
| `lib/schema.test.ts` | prompt sanitization (trim/cap/non-string), room-dimension validation, budget-range validation | ✅ 11 |
| `lib/safety.test.ts` | blocklist true positives (weapons/drugs), false positives ("gunmetal", "knife block"), case-insensitivity, multi-word phrases | ✅ 20 |

## 3. AI checklist — manual evaluation of the actual model (real Gemini runs)

Method: run the app with 5 fixed inputs, answer each check **yes/no**, score **pass rate % = yes ÷ total checks**. Any "no" is recorded with what the AI actually returned.

| Check | #1 bedroom (Japandi) | #2 tiny 2.0×2.0 | #3 budget $300–500 | #4 unsafe prompt | #5 repeat #1 |
|---|---|---|---|---|---|
| Complete design (furniture, sizes, budget) | ✅ | ✅ | ✅ | — | ✅ |
| Furniture count 4–10 | ✅ | ✅ | ✅ | — | ✅ |
| Furniture fits room (no oversized) | ✅ | ✅ | ✅ | — | ✅ |
| Budget within ±20% of range | — | — | ✅ | — | — |
| Unsafe prompt refused (no design) | — | — | — | ✅ | — |
| Consistent with first run | — | — | — | — | ❌ |

**AI pass rate: 11/12 = 91.7%**

**Documented AI failure case:**

- **Q12 — Run 5 differed from Run 1.** Feeding the same photo/dimensions/style twice produced a different design on the second run. Root cause: Gemini is non-deterministic — identical inputs can yield different (but each valid) outputs. Effect: the design direction/set varied between runs; not a crash or invalid output. Mitigation: treat AI output as a starting draft; exact reproducibility is not promised for the generative layer (deterministic parts — solver, mapping — remain reproducible).

## 4. How to run

```bash
npm test          # deterministic suites (41 tests, no model calls)
npm run lint      # eslint
npx tsc --noEmit  # typecheck
```

The AI checklist (§3) is manual: run the 5 inputs in the app (needs Gemini key + PocketBase), record yes/no, update the table.

## 5. Known limitations

- Model mapping corpus is 44 common names, not exhaustive.
- The AI checklist is a small (5-run) qualitative sample; Gemini is non-deterministic (see §3 Q12), so exact outputs vary run to run.
- Aesthetic/design quality is not scored (no rubric for "looks nice").
- No rate limiting on the API routes.
- Unsafe *photo* content is guarded by prompt instruction only (no separate vision-screening call).
- Timeouts are explicit (60s analysis / 120s render → HTTP 504 with a friendly message), but a slow-but-successful Gemini call can still be aborted by the cap.