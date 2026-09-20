import { describe, expect, it } from "vitest";
import { extractJsonObject } from "@/lib/utils/json-parser";

describe("extractJsonObject", () => {
  it("returns clean JSON unchanged", () => {
    expect(extractJsonObject('{"a":1}')).toBe('{"a":1}');
  });
  it("strips Markdown fences", () => {
    expect(extractJsonObject('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });
  it("ignores leading and trailing prose", () => {
    expect(extractJsonObject('Sure! {"a":1} Anything else?')).toBe('{"a":1}');
  });
  it("handles nested objects and braces inside strings", () => {
    const json = '{"a":{"b":"}{"},"c":"say \\"hi\\" }"}';
    expect(extractJsonObject(`x ${json} y`)).toBe(json);
  });
  it("returns null for truncated output instead of guessing", () => {
    expect(extractJsonObject('{"a":"unfinished')).toBeNull();
  });
  it("returns null when there is no object", () => {
    expect(extractJsonObject("I could not read this card.")).toBeNull();
  });
});
