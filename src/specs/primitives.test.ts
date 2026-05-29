import { describe, it, expect } from "vitest";
import { resolveOptions } from "../../lib/resolve";

describe("resolveOptions", () => {
  it("returns shuffledOptions from context when dataKey matches", () => {
    const shuffled = [{ label: "B", value: "b" }, { label: "A", value: "a" }];
    const context = {
      screenData: { shuffledOptions: { choice: shuffled } },
    };
    const original = [{ label: "A", value: "a" }, { label: "B", value: "b" }];
    expect(resolveOptions(original, context, "choice")).toEqual(shuffled);
  });

  it("falls back to array options when dataKey not in shuffledOptions", () => {
    const options = [{ label: "A", value: "a" }, { label: "B", value: "b" }];
    const context = { screenData: { shuffledOptions: {} } };
    expect(resolveOptions(options, context, "other")).toEqual(options);
  });

  it("falls back to array options when no dataKey provided", () => {
    const options = [{ label: "A", value: "a" }];
    expect(resolveOptions(options, {})).toEqual(options);
  });

  it("falls back to array options when screenData is absent", () => {
    const options = [{ label: "X", value: "x" }];
    expect(resolveOptions(options, {}, "x")).toEqual(options);
  });
});
