# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS v4, Vercel AI SDK (`ai` + `@ai-sdk/google`), `zod` for structured output. Deployment target: Vercel (assumed; not yet configured).

## Users

Broad consumer audience, explicitly not narrowed: students and renters furnishing on a budget, homeowners redecorating a specific room, and design-curious beginners who want a starting point. Common job: turn a photo of a real room plus its dimensions into a concrete, achievable interior plan (layout, furniture sizes, budget) without design expertise or expensive consultations.

## Product Purpose

FortnAI turns a photo and room dimensions into a complete interior design workflow in seconds: a furniture layout sized to the real room, a blueprint-style spec sheet, an interactive budget plan, and a photorealistic before/after render. Success means a non-designer walks away with a plan they trust and can act on.

## Positioning

The meaningfully different mechanism: precise, dimension-aware furniture recommendations (max W×D×H sized to the actual room with circulation space) tied to a budget, plus an image-to-image redesign that keeps the user's real room. A generic chat wrapper or a text-only design assistant cannot truthfully claim to size furniture to a measured room and show the result in that same room.

## Operating Context

Web app used on desktop and mobile. User uploads a photo of the room, enters width/length/height in feet, picks a style preset, and receives a structured design spec followed by an optional photorealistic render. Primary inputs are Google Gemini (vision analysis via `gemini-3.6-flash`, image generation via `gemini-2.5-flash-image`).

## Capabilities and Constraints

- Room photo upload (image → base64, client-side), dimensions input (W×L×H in feet), and six style presets (Minimalist, Japandi, Maximalist, Industrial, Scandinavian, Coastal).
- Structured JSON output via `generateObject` + zod schema: design theme, spatial strategy, furniture items with max dimensions/placement/cost, total budget, lighting advice, color palette.
- Interactive budget calculator (toggle pieces, edit prices, live total) and blueprint spec sheet.
- Photorealistic before/after via image-to-image generation, shown with a draggable comparison slider.
- API routes: `POST /api/design` (analysis) and `POST /api/design/render` (image gen).
- Provider locked to Google Gemini; stack locked to Next.js.
- No database or user accounts yet; no persisted design history. Image model id overridable via `GEMINI_IMAGE_MODEL` env var. Costs/latency of image generation are inherent constraints.
- Undecided: monetization model (affiliate retail links are a candidate), deployment specifics, persistence/accounts.

## Brand Commitments

- Name: FortnAI.
- Design commitment (binding, set during the first build): Aeonik as the sole typeface, max font weight `font-medium` (500) everywhere, warm editorial interior-studio aesthetic — light paper ground (`#f6f4f0`), hairline rules, one restrained pine-green accent (`#334f3e`).
- Positioning as an "AI Interior Design Studio."

## Evidence on Hand

- Working implementation: `app/page.tsx` (full flow), `app/api/design/route.ts` (analysis), `app/api/design/render/route.ts` (image gen), `lib/schema.ts` (schema + presets), `components/before-after-slider.tsx`.
- Font asset: `public/fonts/Aeonik-Regular.woff2` (Regular weight only; bold/medium are browser-synthesized).
- No real user testimonials, pricing, or case studies — must not be fabricated.

## Product Principles

1. Measurements and budget come from structured AI output; images are illustrative renders, never a source of numbers.
2. The plan must be actionable for a non-designer: realistic furniture, real price ranges, placement rationale.
3. The design world stays minimal and editorial — restraint over decoration, weight capped at `font-medium`.
4. Cost and latency of generative calls are product constraints, not afterthoughts; bound expensive work behind explicit user action.
5. Product truth (photo + dimensions + style) flows through every step without loss or drift.

## Accessibility & Inclusion

No product-specific requirements established. Web target implies keyboard focus, readable contrast, and responsive layout as baseline.