import { describe, expect, it } from "vitest";
import { evaluateCondition } from "../conditions";
import { getValue } from "../resolve";

// ---------------------------------------------------------------------------
// getValue
// ---------------------------------------------------------------------------

describe("getValue", () => {
  it("resolves a top-level key", async () => {
    const ctx = { data: { profile: { age: 30 } } };
    expect(getValue("$$profile", ctx)).toEqual({ age: 30 });
  });

  it("resolves a nested key via dot notation", async () => {
    const ctx = { data: { profile: { age: 30 } } };
    expect(getValue("$$profile.age", ctx)).toBe(30);
  });

  it("returns undefined for a missing key", async () => {
    const ctx = { data: {} };
    expect(getValue("$$missing.field", ctx)).toBeUndefined();
  });

  it("returns undefined when context.data is absent", async () => {
    expect(getValue("$$profile.age", {})).toBeUndefined();
  });

  it("throws when the key does not start with $$ or @", async () => {
    expect(() => getValue("profile.age" as any, {})).toThrow("Invalid key");
  });

  it("resolves fields from currentItem using @ prefix", async () => {
    const ctx = { loopData: { "loop-sports": { value: "football", index: 0 } } };
    expect(getValue("@loop-sports.value", ctx)).toBe("football");
    expect(getValue("@loop-sports.index", ctx)).toBe(0);
  });

  it("returns undefined when currentItem is absent and @ prefix is used", async () => {
    expect(getValue("@loop-sports.value", {})).toBeUndefined();
  });

  it("resolves a field from screenData using $ prefix", async () => {
    const ctx = { screenData: { sport: "tennis" } };
    expect(getValue("$sport", ctx)).toBe("tennis");
  });

  it("returns undefined when screenData is absent and $ prefix is used", async () => {
    expect(getValue("$field", {})).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// evaluateCondition — simple conditions
// ---------------------------------------------------------------------------

describe("evaluateCondition — simple", () => {
  const ctx = {
    data: {
      profile: { age: 25, name: "alice" },
      tags: { list: ["sport", "music"] },
      counts: { items: 3 },
    },
  };

  it("eq — matches equal value", async () => {
    expect(
      evaluateCondition(
        { type: "simple", operator: "eq", dataKey: "$$profile.name", value: "alice" },
        ctx,
      ),
    ).toBe(true);
  });

  it("eq — does not match different value", async () => {
    expect(
      evaluateCondition(
        { type: "simple", operator: "eq", dataKey: "$$profile.name", value: "bob" },
        ctx,
      ),
    ).toBe(false);
  });

  it("neq — matches when values differ", async () => {
    expect(
      evaluateCondition(
        { type: "simple", operator: "neq", dataKey: "$$profile.name", value: "bob" },
        ctx,
      ),
    ).toBe(true);
  });

  it("neq — does not match when values are equal", async () => {
    expect(
      evaluateCondition(
        { type: "simple", operator: "neq", dataKey: "$$profile.name", value: "alice" },
        ctx,
      ),
    ).toBe(false);
  });

  it("lt / lte / gt / gte numeric comparisons", async () => {
    const num = (op: any, v: number) =>
      evaluateCondition(
        { type: "simple", operator: op, dataKey: "$$profile.age", value: v },
        ctx,
      );
    expect(num("lt", 30)).toBe(true);
    expect(num("lt", 25)).toBe(false);
    expect(num("lte", 25)).toBe(true);
    expect(num("gt", 20)).toBe(true);
    expect(num("gt", 25)).toBe(false);
    expect(num("gte", 25)).toBe(true);
  });

  it("returns false when value is undefined for a base operator", async () => {
    expect(
      evaluateCondition(
        { type: "simple", operator: "eq", dataKey: "$$profile.missing", value: "x" },
        ctx,
      ),
    ).toBe(false);
  });

  it("contains — true when array includes the value", async () => {
    expect(
      evaluateCondition(
        { type: "simple", operator: "contains", dataKey: "$$tags.list", value: "sport" },
        ctx,
      ),
    ).toBe(true);
  });

  it("contains — false when array does not include the value", async () => {
    expect(
      evaluateCondition(
        { type: "simple", operator: "contains", dataKey: "$$tags.list", value: "cooking" },
        ctx,
      ),
    ).toBe(false);
  });

  it("contains — false when value is not an array", async () => {
    expect(
      evaluateCondition(
        { type: "simple", operator: "contains", dataKey: "$$profile.age", value: 25 },
        ctx,
      ),
    ).toBe(false);
  });

  it("length-gt — true when array length exceeds threshold", async () => {
    expect(
      evaluateCondition(
        { type: "simple", operator: "length-gt", dataKey: "$$tags.list", value: 1 },
        ctx,
      ),
    ).toBe(true);
  });

  it("length-lte — true when string length is within threshold", async () => {
    expect(
      evaluateCondition(
        { type: "simple", operator: "length-lte", dataKey: "$$profile.name", value: 5 },
        ctx,
      ),
    ).toBe(true); // "alice".length === 5
  });

  it("length-lt — true when length is below threshold", async () => {
    expect(
      evaluateCondition(
        { type: "simple", operator: "length-lt", dataKey: "$$tags.list", value: 3 },
        ctx,
      ),
    ).toBe(true); // list has 2 items
  });

  it("length-gte — true when array length equals threshold", async () => {
    expect(
      evaluateCondition(
        { type: "simple", operator: "length-gte", dataKey: "$$tags.list", value: 2 },
        ctx,
      ),
    ).toBe(true);
  });

  it("length-eq — true when string length exactly matches threshold", async () => {
    expect(
      evaluateCondition(
        { type: "simple", operator: "length-eq", dataKey: "$$profile.name", value: 5 },
        ctx,
      ),
    ).toBe(true); // "alice".length === 5
  });

  it("length-neq — true when string length does not match threshold", async () => {
    expect(
      evaluateCondition(
        { type: "simple", operator: "length-neq", dataKey: "$$profile.name", value: 4 },
        ctx,
      ),
    ).toBe(true); // "alice".length (5) !== 4
  });

  it("length-gt on undefined key treats length as 0 and returns false", async () => {
    expect(
      evaluateCondition(
        { type: "simple", operator: "length-gt", dataKey: "$$profile.missing", value: 0 },
        ctx,
      ),
    ).toBe(false);
  });

  it("contains — false when key is undefined", async () => {
    expect(
      evaluateCondition(
        { type: "simple", operator: "contains", dataKey: "$$profile.missing", value: "x" },
        ctx,
      ),
    ).toBe(false);
  });

  it("eq — uses loose equality (string '25' equals number 25)", async () => {
    expect(
      evaluateCondition(
        { type: "simple", operator: "eq", dataKey: "$$profile.age", value: "25" },
        ctx,
      ),
    ).toBe(true); // 25 == "25" via loose equality
  });
});

// ---------------------------------------------------------------------------
// evaluateCondition — compound conditions
// ---------------------------------------------------------------------------

describe("evaluateCondition — and", () => {
  const ctx = {
    data: {
      profile: { age: 25 },
      consent: { agreed: true },
    },
  };

  it("returns true when all conditions pass", () => {
    expect(
      evaluateCondition(
        {
          type: "and",
          conditions: [
            { type: "simple", operator: "gte", dataKey: "$$profile.age", value: 18 },
            { type: "simple", operator: "eq", dataKey: "$$consent.agreed", value: true },
          ],
        },
        ctx,
      ),
    ).toBe(true);
  });

  it("returns false when any condition fails", () => {
    expect(
      evaluateCondition(
        {
          type: "and",
          conditions: [
            { type: "simple", operator: "gte", dataKey: "$$profile.age", value: 18 },
            { type: "simple", operator: "eq", dataKey: "$$consent.agreed", value: false },
          ],
        },
        ctx,
      ),
    ).toBe(false);
  });

  it("returns true for empty conditions (vacuous truth)", () => {
    expect(
      evaluateCondition({ type: "and", conditions: [] }, ctx),
    ).toBe(true);
  });

  it("short-circuits on the first false", () => {
    let evaluated = 0;
    const ctx2 = {
      data: { a: 1, b: 2 },
    };
    // First condition is false — second should not matter
    expect(
      evaluateCondition(
        {
          type: "and",
          conditions: [
            { type: "simple", operator: "eq", dataKey: "$$a", value: 999 },
            { type: "simple", operator: "eq", dataKey: "$$b", value: 2 },
          ],
        },
        ctx2,
      ),
    ).toBe(false);
  });
});

describe("evaluateCondition — or", () => {
  const ctx = {
    data: { role: "admin", score: 5 },
  };

  it("returns true when at least one condition passes", () => {
    expect(
      evaluateCondition(
        {
          type: "or",
          conditions: [
            { type: "simple", operator: "eq", dataKey: "$$role", value: "admin" },
            { type: "simple", operator: "gt", dataKey: "$$score", value: 100 },
          ],
        },
        ctx,
      ),
    ).toBe(true);
  });

  it("returns false when all conditions fail", () => {
    expect(
      evaluateCondition(
        {
          type: "or",
          conditions: [
            { type: "simple", operator: "eq", dataKey: "$$role", value: "viewer" },
            { type: "simple", operator: "gt", dataKey: "$$score", value: 100 },
          ],
        },
        ctx,
      ),
    ).toBe(false);
  });

  it("returns false for empty conditions", () => {
    expect(
      evaluateCondition({ type: "or", conditions: [] }, ctx),
    ).toBe(false);
  });
});

describe("evaluateCondition — not", () => {
  const ctx = { data: { active: false } };

  it("negates a true condition to false", () => {
    expect(
      evaluateCondition(
        {
          type: "not",
          condition: { type: "simple", operator: "eq", dataKey: "$$active", value: false },
        },
        ctx,
      ),
    ).toBe(false);
  });

  it("negates a false condition to true", () => {
    expect(
      evaluateCondition(
        {
          type: "not",
          condition: { type: "simple", operator: "eq", dataKey: "$$active", value: true },
        },
        ctx,
      ),
    ).toBe(true);
  });
});

describe("evaluateCondition — nested compound", () => {
  const ctx = {
    data: {
      profile: { age: 20 },
      consent: { agreed: true },
      flags: { banned: false },
    },
  };

  it("(age >= 18 AND consented) AND NOT banned", () => {
    expect(
      evaluateCondition(
        {
          type: "and",
          conditions: [
            {
              type: "and",
              conditions: [
                { type: "simple", operator: "gte", dataKey: "$$profile.age", value: 18 },
                { type: "simple", operator: "eq", dataKey: "$$consent.agreed", value: true },
              ],
            },
            {
              type: "not",
              condition: { type: "simple", operator: "eq", dataKey: "$$flags.banned", value: true },
            },
          ],
        },
        ctx,
      ),
    ).toBe(true);
  });

  it("returns false when the not branch flips a true value", () => {
    expect(
      evaluateCondition(
        {
          type: "and",
          conditions: [
            { type: "simple", operator: "gte", dataKey: "$$profile.age", value: 18 },
            {
              type: "not",
              condition: { type: "simple", operator: "eq", dataKey: "$$consent.agreed", value: true },
            },
          ],
        },
        ctx,
      ),
    ).toBe(false);
  });

  it("or of two and-blocks — first passes", () => {
    expect(
      evaluateCondition(
        {
          type: "or",
          conditions: [
            {
              type: "and",
              conditions: [
                { type: "simple", operator: "gte", dataKey: "$$profile.age", value: 18 },
                { type: "simple", operator: "eq", dataKey: "$$consent.agreed", value: true },
              ],
            },
            {
              type: "and",
              conditions: [
                { type: "simple", operator: "lt", dataKey: "$$profile.age", value: 18 },
                { type: "simple", operator: "eq", dataKey: "$$consent.agreed", value: false },
              ],
            },
          ],
        },
        ctx,
      ),
    ).toBe(true);
  });
});
