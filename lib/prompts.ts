import { designSchema, type StylePresetId } from "@/lib/schema";

export const PRESET_PROMPTS: Record<StylePresetId, string> = {
  minimalist: `Modern minimalist: calm, uncluttered, and deliberate. Use a restrained palette of warm neutrals — cream, greige, soft taupe — with charcoal accents and muted oak. Materials are natural and matte: oak, limewash plaster, stone, matte ceramics, linen. Furniture follows crisp geometric profiles with low horizontal lines and generous negative space; every piece must earn its place, and at most one sculptural statement piece is allowed. Light softly and diffusely with warm 2700K pools and, if possible, hidden cove lighting. Textiles stay solid — plain linen and wool felt only. Avoid clutter, pattern overload, more than two accent colors, ornamental trim, and any glossy or plastic-looking finish.`,
  japandi: `Japandi: Japanese wabi-sabi meets Scandinavian hygge — serene, warm, and restrained. Use light oak, off-white, warm greige, and ink charcoal, with only small hints of deep green or rust. Materials are natural and grounded: light oak wood grain, bamboo, rice paper, linen, wool, matte ceramic, and stone. Furniture is low-profile with soft rounded corners, craftsman joinery, and a quiet platform feel. Light with warm, diffused pools and paper-lantern or rice-paper glow, dimming toward evening. Textiles are linen, wool, and natural cotton weaves with subtle organic texture. Avoid harsh chrome, glossy plastics, busy patterns, cold blues, clutter, and symmetry that feels stiff.`,
  maximalist: `Maximalist: bold, personal, energetic, and layered — personality-first, cozy-cluttered done well. Use saturated color with high-energy contrast: rust, burnt orange, cobalt, mustard, emerald, and blush. Materials are tactile and mixed: velvet, boucle, brass, rattan, mixed woods, patterned rugs, and tapestries. Furniture mixes eras with confident statement pieces, layered seating, a gallery wall, and shelving styled with intent rather than emptiness. Light warmly with Edison filaments, a neon accent, string lights, or a sculptural floor lamp. Textiles are patterned, textured, and layered with throws and cushions. Avoid dull flat walls, empty corners, monochrome everything, cheap plastic shine, and visual chaos without a focal arrangement.`,
  industrial: `Industrial loft: raw, urban, and honest — refined rawness built on exposed materials. Use charcoal, concrete grey, black steel, leather brown, rust, pale plaster, and deep green accents. Materials are utilitarian: exposed brick, concrete, black steel, aged leather, reclaimed wood, glass, and Edison bulbs. Furniture is linear and workbench-like — metal frames, factory carts used as tables, utilitarian seating, and surfaces that look built to last. Light with Edison filament pendants, track lights, or metal cage fixtures, letting warm glow sit against cool materials. Textiles are leather, canvas, and wool. Avoid anything fussy or ornate, pastel colors, glossy lacquer, traditional carved furniture, and sterile all-white rooms.`,
  scandinavian: `Scandinavian: bright, functional, and cozy hygge — light and airy with real warmth. Use bright white, pale birch wood, soft greys, dusty blues, and butter-yellow accents over warm neutrals. Materials are pale and soft: pale wood, wool, sheepskin, cotton, matte ceramics, and light stone. Furniture has clean tapered legs, simple functional forms, airy proportions, and multi-use pieces with generous negative space. Light with abundant soft daylight and simple modern pendants, then warm lamps and candlelight in the evening. Textiles are chunky knits, wool throws, sheepskin, and cotton weaves. Avoid heavy dark furniture, cold stark white without warmth, cluttered shelves, and any room that feels dark or closed in.`,
  coastal: `Coastal retreat: breezy, bright, and relaxed — a beach-inspired calm without kitsch. Use soft blues, sand, driftwood beige, warm white, seafoam, and washed-coral accents. Materials are light and woven: pale wood, linen, rattan, cane, rope, seagrass, and glass with weathered finishes. Furniture is airy with light frames, relaxed silhouettes, natural woven textures, and low casual seating. Light with bright airy daylight, lanterns, and woven pendant shades that glow softly in the evening. Textiles are linen, cotton, and subtle woven or fine-stripe textures. Avoid literal nautical kitsch such as anchors and ships' wheels, dark heavy furniture, cold bright white with no warmth, and plastic-looking decor.`,
};

export function getStylePrompt(styleId: StylePresetId): string {
  return PRESET_PROMPTS[styleId] ?? PRESET_PROMPTS.minimalist;
}

export const ANALYSIS_SYSTEM_PROMPT = `You are a world-class interior designer and spatial planner. You analyze a photograph of a room together with its physical dimensions (width × length × height) and produce a precise, buildable room design.

Rules:
- The provided dimensions are in feet. Use them to ensure every furniture piece fits comfortably with proper circulation space (at least 24" walkways).
- Recommend realistic, achievable pieces. For each, give a MAXIMUM dimension (in inches) that still leaves the room feeling open.
- Give realistic retail price estimates in USD for each piece.
- Output ONLY the JSON object matching the schema. No conversational text.

Safety (non-negotiable):
- Never include weapons, explosives, firearms, illegal drugs, or any dangerous or unlawful items in the design.
- If the user requests such items — in text or via the uploaded photo — do not comply. Exclude them and keep the design safe and legal.
- If an unsafe request is detected, still output the schema JSON for a safe design; never describe, include, or enhance the unsafe content.`;

interface AnalysisInput {
  width: number;
  length: number;
  height: number;
  styleId: StylePresetId | null;
  customPrompt: string;
}

export function buildAnalysisUserPrompt({
  width,
  length,
  height,
  styleId,
  customPrompt,
}: AnalysisInput): string {
  const styleLine = styleId
    ? `Design style: ${getStylePrompt(styleId)}`
    : customPrompt
      ? `No style preset selected — your design direction below is the sole guide.`
      : `No style preset selected — choose the most fitting design direction for this room based on the photo.`;

  return [
    `Room dimensions: ${width} ft (width) × ${length} ft (length) × ${height} ft (height).`,
    styleLine,
    customPrompt
      ? `Additional user direction — honor this while keeping the measurements, circulation, and budget rules: ${customPrompt}`
      : "",
    `Safety: never include weapons, explosives, or illegal or dangerous objects in the design. If the user requests such items in text, or they appear in the photo, do not comply — leave them out and keep the design safe and legal.`,
    `The room image is attached. Produce the full design specification: theme, spatial strategy, furniture list with max dimensions and cost, total budget, lighting advice, and color palette.`,
  ]
    .filter(Boolean)
    .join("\n");
}

interface RenderInput {
  design: unknown;
  styleId: StylePresetId | null;
  width: number;
  length: number;
  customPrompt: string;
}

export function buildRenderPrompt({
  design,
  styleId,
  width,
  length,
  customPrompt,
}: RenderInput): string {
  const parsed = designSchema.safeParse(design);
  const d = parsed.success ? parsed.data : null;

  const furniture = d
    ? d.furnitureRecommendations
        .map((f) => `${f.item} (${f.width}"W × ${f.depth}"D × ${f.height}"H)`)
        .join("; ")
    : "well-chosen furniture";

  const styleLine = styleId
    ? `Style: ${getStylePrompt(styleId)}.`
    : d?.designTheme
      ? `Style theme: ${d.designTheme}.`
      : "";

  return [
    `Redesign this exact room interior. Keep the same camera angle, room shell, walls, windows, door positions, and floor plan.`,
    `The room is ${width} ft wide by ${length} ft long.`,
    `Replace the current contents with this curated furniture layout: ${furniture}.`,
    styleLine,
    d ? `Follow this color palette: ${d.colorPalette.join(", ")}.` : "",
    `Lighting: ${d ? d.lightingAdvice : "warm, inviting lighting"}.`,
    customPrompt
      ? `User's additional direction — honor it while keeping this layout and palette: ${customPrompt}.`
      : "",
    `Safety: never depict weapons, explosives, or illegal or dangerous objects. If the photo or any direction implies them, exclude them.`,
    `Photorealistic interior rendering, natural lighting, high detail, magazine-quality, 4k.`,
  ]
    .filter(Boolean)
    .join(" ");
}