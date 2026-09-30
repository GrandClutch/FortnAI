import { describe, expect, it } from "vitest";
import { containsUnsafeContent, unsafeContentMessage } from "./safety";

describe("containsUnsafeContent", () => {
  it.each([
    "place a bomb in the room",
    "hide a pistol on the shelf",
    "an ak-47 rifle in the corner",
    "dynamite and a detonator",
    "stash some heroin under the bed",
    "cocaine on the table",
    "a machete behind the door",
    "brass knuckles on the desk",
    "a pipe bomb under the sink",
    "an assault rifle display",
  ])("flags unsafe input: %s", (text) => {
    expect(containsUnsafeContent(text)).toBe(true);
  });

  it.each([
    "gunmetal paint on the walls",
    "a knife block on the counter",
    "this room should not assault the senses",
    "soft cushions and warm lighting",
    "a wooden bookshelf",
    "a seaside coastal theme",
    "",
  ])("does not flag safe input: %s", (text) => {
    expect(containsUnsafeContent(text)).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(containsUnsafeContent("Place A GUN Here")).toBe(true);
    expect(containsUnsafeContent("PIPE BOMB")).toBe(true);
  });

  it("matches multi-word phrases as whole phrases", () => {
    expect(containsUnsafeContent("hand me the pipe bomb")).toBe(true);
    expect(containsUnsafeContent("assault rifles are not allowed")).toBe(true);
  });
});

describe("unsafeContentMessage", () => {
  it("returns a clear refusal message", () => {
    expect(unsafeContentMessage()).toMatch(/can't be fulfilled/);
  });
});