import { describe, expect, it } from "vitest";
import {
  budgetRangeSchema,
  MAX_CUSTOM_PROMPT_LENGTH,
  roomDimensionsSchema,
  sanitizeCustomPrompt,
} from "./schema";

describe("sanitizeCustomPrompt", () => {
  it("returns an empty string for non-string input", () => {
    expect(sanitizeCustomPrompt(undefined)).toBe("");
    expect(sanitizeCustomPrompt(null)).toBe("");
    expect(sanitizeCustomPrompt(42)).toBe("");
    expect(sanitizeCustomPrompt({})).toBe("");
  });

  it("trims surrounding whitespace", () => {
    expect(sanitizeCustomPrompt("  warm cozy  ")).toBe("warm cozy");
  });

  it("caps input at MAX_CUSTOM_PROMPT_LENGTH", () => {
    const long = "a".repeat(MAX_CUSTOM_PROMPT_LENGTH + 50);
    expect(sanitizeCustomPrompt(long)).toHaveLength(MAX_CUSTOM_PROMPT_LENGTH);
  });

  it("keeps text under the cap unchanged", () => {
    expect(sanitizeCustomPrompt("warm cozy lighting")).toBe("warm cozy lighting");
  });
});

describe("roomDimensionsSchema", () => {
  it("accepts positive numeric dimensions", () => {
    expect(roomDimensionsSchema.parse({ width: 3.7, length: 4.3, height: 2.7 })).toBeTruthy();
  });

  it("coerces numeric strings", () => {
    const dims = roomDimensionsSchema.parse({ width: "3", length: "4", height: "2.5" });
    expect(dims.width).toBe(3);
    expect(dims.height).toBe(2.5);
  });

  it("rejects zero and negative dimensions", () => {
    expect(() => roomDimensionsSchema.parse({ width: 0, length: 4, height: 2 })).toThrow();
    expect(() => roomDimensionsSchema.parse({ width: -1, length: 4, height: 2 })).toThrow();
  });

  it("rejects missing fields", () => {
    expect(() => roomDimensionsSchema.parse({ width: 3 })).toThrow();
  });
});

describe("budgetRangeSchema", () => {
  it("accepts min <= max", () => {
    expect(budgetRangeSchema.parse({ minUSD: 300, maxUSD: 500 })).toBeTruthy();
  });

  it("rejects max < min", () => {
    expect(() => budgetRangeSchema.parse({ minUSD: 500, maxUSD: 300 })).toThrow();
  });

  it("rejects negative values", () => {
    expect(() => budgetRangeSchema.parse({ minUSD: -1, maxUSD: 500 })).toThrow();
  });
});