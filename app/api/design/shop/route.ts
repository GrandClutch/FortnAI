import { z } from "zod";

import {
  budgetRangeSchema,
  STYLE_PRESETS,
  type DesignResult,
  type FurnitureItem,
  type ShoppingItem,
  type ShoppingResult,
} from "@/lib/schema";
import { getAuthenticatedClient } from "@/lib/pocketbase/server";
import { getOwnedProject, updateVersionDesign } from "@/lib/history";
import { solveLayout } from "@/lib/placement";
import {
  buildOptions,
  candidateToProduct,
  candidatesForItem,
  selectWithinBudget,
  shoppingEnabled,
} from "@/lib/shopping";

export const runtime = "nodejs";
export const maxDuration = 120;

const bodySchema = z.object({
  projectId: z.string().min(1),
  versionId: z.string().min(1),
  budgetRange: budgetRangeSchema.optional(),
});

async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function POST(req: Request) {
  try {
    const pb = await getAuthenticatedClient();
    if (!pb) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!shoppingEnabled()) {
      return Response.json(
        { error: "Product search is not configured (missing RAPIDAPI_KEY)." },
        { status: 503 }
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "projectId and versionId are required" },
        { status: 400 }
      );
    }

    const { projectId, versionId } = parsed.data;

    const project = await getOwnedProject(pb, projectId);
    if (!project) {
      return Response.json({ error: "Design not found" }, { status: 404 });
    }

    let version;
    try {
      version = await pb.collection("designVersions").getOne(versionId);
    } catch {
      return Response.json({ error: "Design not found" }, { status: 404 });
    }
    if (version.project !== projectId || version.owner !== project.owner) {
      return Response.json({ error: "Design not found" }, { status: 404 });
    }
    if (version.status !== "completed" || !version.designResult) {
      return Response.json({ error: "No completed design to shop" }, { status: 400 });
    }

    const design = version.designResult as DesignResult;
    const budget = parsed.data.budgetRange ?? design.budgetRange;
    if (!budget) {
      return Response.json({ error: "Set a budget range first" }, { status: 400 });
    }

    const items: FurnitureItem[] = design.furnitureRecommendations;
    const room = {
      widthM: project.width as number,
      lengthM: project.length as number,
      heightM: project.height as number,
    };

    const preset = STYLE_PRESETS.find((p) => p.id === version.stylePreset);
    const styleLabel = preset?.label ?? design.designTheme;

    const candidateSets = await mapPool(items, 3, (item) =>
      candidatesForItem(item, styleLabel, room)
    );

    const options = items.map((item, index) =>
      buildOptions(index, item.item, candidateSets[index], item.estimatedCostUSD)
    );

    const selection = selectWithinBudget(options, budget);

    const updatedFurniture: FurnitureItem[] = items.map((item, index) => {
      const option = selection.chosen[index];
      const dims = option.product?.dimensions;
      if (dims && option.dimensionsSource === "product") {
        return { ...item, width: dims.widthCm, depth: dims.depthCm, height: dims.heightCm };
      }
      return item;
    });

    const solved = solveLayout(updatedFurniture, room);

    const warnings = [...selection.warnings];
    const shoppingItems: ShoppingItem[] = items.map((item, index) => {
      const option = selection.chosen[index];
      if (option.matchQuality === "fallback") {
        warnings.push(`No live product match for "${item.item}" — using the AI estimate.`);
      }
      return {
        itemIndex: index,
        item: item.item,
        product: option.product ? candidateToProduct(option.product) : null,
        priceUSD: Math.round(option.priceUSD),
        dimensionsSource: option.dimensionsSource,
        matchQuality: option.matchQuality,
      };
    });

    const shopping: ShoppingResult = {
      minUSD: budget.minUSD,
      maxUSD: budget.maxUSD,
      totalUSD: selection.totalUSD,
      inRange: selection.inRange,
      provider: "rapidapi-amazon",
      fetchedAt: new Date().toISOString(),
      items: shoppingItems,
      warnings,
    };

    const updatedDesign: DesignResult = {
      ...design,
      budgetRange: budget,
      layout: solved.items,
      layoutWarnings: solved.warnings,
      shopping,
    };

    await updateVersionDesign(pb, versionId, updatedDesign);

    return Response.json({
      shopping,
      layout: solved.items,
      layoutWarnings: solved.warnings,
    });
  } catch (err) {
    console.error("Product shopping failed:", err);
    const message = err instanceof Error ? err.message : "Product shopping failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
