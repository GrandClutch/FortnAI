import type { BudgetRange, FurnitureItem, Product } from "@/lib/schema";
import {
  fitsRoom,
  parseDimensions,
  type DetailEntry,
  type ParsedDimensions,
  type RoomSize,
} from "@/lib/dimensions";

const DEFAULT_HOST = "real-time-amazon-data.p.rapidapi.com";
const MAX_CANDIDATES = Number(process.env.SHOPPING_MAX_CANDIDATES ?? 6);
const MAX_FITTING_PER_ITEM = 3;
const MAX_NON_DIMENSIONAL_PER_ITEM = 2;

export function shoppingEnabled(): boolean {
  return Boolean(process.env.RAPIDAPI_KEY);
}

export interface Candidate {
  asin: string;
  title: string;
  retailer: string;
  url: string;
  imageUrl?: string;
  priceUSD: number;
  originalPriceUSD?: number;
  rating?: number;
  reviews?: number;
  dimensions?: ParsedDimensions;
  hasDimensions: boolean;
  fitsRoom: boolean;
}

export interface Option {
  product: Candidate | null;
  priceUSD: number;
  dimensionsSource: "product" | "ai";
  matchQuality: "exact" | "fallback";
}

export interface ItemOptions {
  index: number;
  item: string;
  options: Option[];
}

export interface Selection {
  chosen: Option[];
  totalUSD: number;
  inRange: boolean;
  warnings: string[];
}

function host(): string {
  return process.env.RAPIDAPI_HOST ?? DEFAULT_HOST;
}

function country(): string {
  return process.env.RAPIDAPI_COUNTRY ?? "US";
}

function headers(): Record<string, string> {
  return {
    "X-RapidAPI-Key": process.env.RAPIDAPI_KEY ?? "",
    "X-RapidAPI-Host": host(),
  };
}

function parsePrice(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;
  const cleaned = value.replace(/[^0-9.]/g, "");
  if (!cleaned) return undefined;
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function parseRating(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function mapProduct(raw: Record<string, unknown>): Candidate | null {
  const asin = typeof raw.asin === "string" ? raw.asin : "";
  const url = typeof raw.product_url === "string" ? raw.product_url : "";
  const title = typeof raw.product_title === "string" ? raw.product_title : "";
  const priceUSD =
    parsePrice(raw.product_price) ?? parsePrice(raw.product_minimum_offer_price);
  if (!asin || !url || !title || priceUSD === undefined) return null;

  return {
    asin,
    title,
    retailer: "Amazon",
    url,
    imageUrl: typeof raw.product_photo === "string" ? raw.product_photo : undefined,
    priceUSD,
    originalPriceUSD: parsePrice(raw.product_original_price),
    rating: parseRating(raw.product_star_rating),
    reviews:
      typeof raw.product_num_ratings === "number" ? raw.product_num_ratings : undefined,
    hasDimensions: false,
    fitsRoom: false,
  };
}

async function fetchJson(url: URL): Promise<Record<string, unknown>> {
  const res = await fetch(url, { headers: headers(), cache: "no-store" });
  if (!res.ok) {
    throw new Error(`RapidAPI request failed (${res.status})`);
  }
  return (await res.json()) as Record<string, unknown>;
}

async function searchProducts(query: string): Promise<Candidate[]> {
  const url = new URL(`https://${host()}/search`);
  url.searchParams.set("query", query);
  url.searchParams.set("country", country());
  url.searchParams.set("sort_by", "RELEVANCE");
  url.searchParams.set("page", "1");

  const json = await fetchJson(url);
  const data = json.data as Record<string, unknown> | undefined;
  const products = Array.isArray(data?.products) ? (data?.products as unknown[]) : [];
  return products
    .map((p) => mapProduct((p ?? {}) as Record<string, unknown>))
    .filter((c): c is Candidate => c !== null)
    .slice(0, MAX_CANDIDATES);
}

function toDetailEntries(value: unknown): DetailEntry[] {
  if (Array.isArray(value)) {
    return value
      .filter((e): e is Record<string, unknown> => typeof e === "object" && e !== null)
      .map((e) => ({ name: String(e.name ?? ""), value: String(e.value ?? "") }))
      .filter((e) => e.name.length > 0);
  }
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).map(([name, v]) => ({
      name,
      value: String(v ?? ""),
    }));
  }
  return [];
}

async function fetchDetails(asin: string): Promise<ParsedDimensions | null> {
  const url = new URL(`https://${host()}/product-details`);
  url.searchParams.set("asin", asin);
  url.searchParams.set("country", country());

  const json = await fetchJson(url);
  const data = (json.data ?? {}) as Record<string, unknown>;
  const entries: DetailEntry[] = [
    ...toDetailEntries(data.product_details),
    ...toDetailEntries(data.product_information),
  ];
  if (typeof data.product_dimensions === "string") {
    entries.push({ name: "Product Dimensions", value: data.product_dimensions });
  }
  return parseDimensions(entries);
}

export async function candidatesForItem(
  item: FurnitureItem,
  styleLabel: string,
  room: RoomSize
): Promise<Candidate[]> {
  const query = [styleLabel, item.category, item.item]
    .filter((part) => part && part.trim().length > 0)
    .join(" ")
    .trim();

  let searched: Candidate[];
  try {
    searched = await searchProducts(query);
  } catch {
    return [];
  }

  const results: Candidate[] = [];
  let fitting = 0;
  let nonDimensional = 0;

  for (const candidate of searched) {
    if (fitting >= MAX_FITTING_PER_ITEM) break;

    let dims: ParsedDimensions | null = null;
    try {
      dims = await fetchDetails(candidate.asin);
    } catch {
      dims = null;
    }

    if (dims) {
      if (!fitsRoom(dims, room)) continue;
      results.push({ ...candidate, dimensions: dims, hasDimensions: true, fitsRoom: true });
      fitting++;
    } else if (nonDimensional < MAX_NON_DIMENSIONAL_PER_ITEM) {
      results.push({ ...candidate, hasDimensions: false, fitsRoom: false });
      nonDimensional++;
    }
  }

  return results;
}

export function buildOptions(
  index: number,
  item: string,
  candidates: Candidate[],
  fallbackPriceUSD: number
): ItemOptions {
  const options: Option[] = candidates.map((candidate) => ({
    product: candidate,
    priceUSD: candidate.priceUSD,
    dimensionsSource: candidate.hasDimensions ? "product" : "ai",
    matchQuality: "exact",
  }));

  options.push({
    product: null,
    priceUSD: Math.max(0, Math.round(fallbackPriceUSD)),
    dimensionsSource: "ai",
    matchQuality: "fallback",
  });

  return { index, item, options };
}

export function selectWithinBudget(sets: ItemOptions[], budget: BudgetRange): Selection {
  const warnings: string[] = [];
  const cap = Math.max(0, Math.floor(budget.maxUSD));
  const n = sets.length;

  const allOptions = sets.map((set) => set.options);
  let prev = new Int32Array(cap + 1).fill(-1);
  prev[0] = 0;
  const parents: Int32Array[] = [];

  for (let i = 0; i < n; i++) {
    const cur = new Int32Array(cap + 1).fill(-1);
    const parent = new Int32Array(cap + 1).fill(-1);
    const options = allOptions[i];
    for (let sum = 0; sum <= cap; sum++) {
      if (prev[sum] < 0) continue;
      for (let j = 0; j < options.length; j++) {
        const next = sum + Math.max(0, Math.round(options[j].priceUSD));
        if (next > cap) continue;
        const exact = prev[sum] + (options[j].matchQuality === "exact" ? 1 : 0);
        if (exact > cur[next]) {
          cur[next] = exact;
          parent[next] = j;
        }
      }
    }
    parents.push(parent);
    prev = cur;
  }

  let bestSum = -1;
  for (let sum = cap; sum >= 0; sum--) {
    if (prev[sum] >= 0) {
      bestSum = sum;
      break;
    }
  }

  if (bestSum < 0) {
    const chosen = sets.map(
      (set) =>
        set.options.reduce((cheapest, option) =>
          option.priceUSD < cheapest.priceUSD ? option : cheapest
        )
    );
    const totalUSD = chosen.reduce((sum, option) => sum + option.priceUSD, 0);
    warnings.push(
      `Even the most affordable matching set ($${Math.round(totalUSD).toLocaleString()}) exceeds your $${Math.round(budget.maxUSD).toLocaleString()} maximum.`
    );
    return { chosen, totalUSD, inRange: false, warnings };
  }

  const chosen: Option[] = new Array(n);
  let cursor = bestSum;
  for (let i = n - 1; i >= 0; i--) {
    const j = parents[i][cursor];
    const option = allOptions[i][j];
    chosen[i] = option;
    cursor -= Math.max(0, Math.round(option.priceUSD));
  }

  const totalUSD = bestSum;
  const inRange = totalUSD >= budget.minUSD;
  if (!inRange) {
    warnings.push(
      `Closest achievable under your $${Math.round(budget.maxUSD).toLocaleString()} cap is $${Math.round(totalUSD).toLocaleString()} — below your $${Math.round(budget.minUSD).toLocaleString()} minimum.`
    );
  }

  return { chosen, totalUSD, inRange, warnings };
}

export function candidateToProduct(candidate: Candidate): Product {
  return {
    asin: candidate.asin,
    title: candidate.title,
    retailer: candidate.retailer,
    url: candidate.url,
    imageUrl: candidate.imageUrl,
    priceUSD: candidate.priceUSD,
    originalPriceUSD: candidate.originalPriceUSD,
    rating: candidate.rating,
    reviews: candidate.reviews,
  };
}
