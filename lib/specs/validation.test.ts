import { describe, expect, it } from "vitest";
import { buildSchema } from "@/lib/validation";
import { FrameworkScreen } from "@/lib/screen";

function screen(components: FrameworkScreen["components"]): FrameworkScreen {
  return { slug: "test", components };
}

// ---------------------------------------------------------------------------
// text-input
// ---------------------------------------------------------------------------

describe("text-input", () => {
  it("passes a non-empty string when required", () => {
    const schema = buildSchema(
      screen([
        { componentFamily: "response", template: "text-input", props: { dataKey: "name", label: "Name", required: true } },
      ])
    );
    expect(schema.safeParse({ name: "Alice" }).success).toBe(true);
  });

  it("fails an empty string when required", () => {
    const schema = buildSchema(
      screen([
        { componentFamily: "response", template: "text-input", props: { dataKey: "name", label: "Name", required: true } },
      ])
    );
    expect(schema.safeParse({ name: "" }).success).toBe(false);
  });

  it("passes an empty string when not required", () => {
    const schema = buildSchema(
      screen([
        { componentFamily: "response", template: "text-input", props: { dataKey: "name", label: "Name", required: false } },
      ])
    );
    expect(schema.safeParse({ name: "" }).success).toBe(true);
  });

  it("uses custom errorMessage", () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: "response",
          template: "text-input",
          props: { dataKey: "name", label: "Name", required: true, errorMessage: "Please enter your name" },
        },
      ])
    );
    const result = schema.safeParse({ name: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.name).toContain("Please enter your name");
    }
  });
});

// ---------------------------------------------------------------------------
// dropdown / radio
// ---------------------------------------------------------------------------

describe("dropdown", () => {
  it("passes a selected option when required", () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: "response",
          template: "dropdown",
          props: { dataKey: "color", label: "Color", options: [{ label: "Red", value: "red" }], required: true },
        },
      ])
    );
    expect(schema.safeParse({ color: "red" }).success).toBe(true);
  });

  it("fails an empty string when required", () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: "response",
          template: "dropdown",
          props: { dataKey: "color", label: "Color", options: [], required: true },
        },
      ])
    );
    expect(schema.safeParse({ color: "" }).success).toBe(false);
  });
});

describe("radio", () => {
  it("passes when optional and empty", () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: "response",
          template: "radio",
          props: { dataKey: "choice", label: "Pick", options: [], required: false },
        },
      ])
    );
    expect(schema.safeParse({ choice: "" }).success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// checkboxes
// ---------------------------------------------------------------------------

describe("checkboxes", () => {
  it("passes when at least one selected and required", () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: "response",
          template: "checkboxes",
          props: { dataKey: "hobbies", label: "Hobbies", options: [], required: true },
        },
      ])
    );
    expect(schema.safeParse({ hobbies: ["reading"] }).success).toBe(true);
  });

  it("fails an empty array when required", () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: "response",
          template: "checkboxes",
          props: { dataKey: "hobbies", label: "Hobbies", options: [], required: true },
        },
      ])
    );
    expect(schema.safeParse({ hobbies: [] }).success).toBe(false);
  });

  it("enforces min selection count", () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: "response",
          template: "checkboxes",
          props: { dataKey: "hobbies", label: "Hobbies", options: [], min: 2 },
        },
      ])
    );
    expect(schema.safeParse({ hobbies: ["a"] }).success).toBe(false);
    expect(schema.safeParse({ hobbies: ["a", "b"] }).success).toBe(true);
  });

  it("enforces max selection count", () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: "response",
          template: "checkboxes",
          props: { dataKey: "hobbies", label: "Hobbies", options: [], max: 2 },
        },
      ])
    );
    expect(schema.safeParse({ hobbies: ["a", "b", "c"] }).success).toBe(false);
    expect(schema.safeParse({ hobbies: ["a", "b"] }).success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// likert-scale
// ---------------------------------------------------------------------------

const likertOptions = [
  { label: "Strongly disagree", value: "1" },
  { label: "Disagree", value: "2" },
  { label: "Neutral", value: "3" },
  { label: "Agree", value: "4" },
  { label: "Strongly agree", value: "5" },
];

describe("likert-scale", () => {
  it("passes when an option is selected and required", () => {
    const schema = buildSchema(
      screen([
        { componentFamily: "response", template: "likert-scale", props: { dataKey: "score", label: "Rate", options: likertOptions, required: true } },
      ])
    );
    expect(schema.safeParse({ score: "3" }).success).toBe(true);
  });

  it("fails when empty and required", () => {
    const schema = buildSchema(
      screen([
        { componentFamily: "response", template: "likert-scale", props: { dataKey: "score", label: "Rate", options: likertOptions, required: true } },
      ])
    );
    expect(schema.safeParse({ score: "" }).success).toBe(false);
  });

  it("passes when empty and not required", () => {
    const schema = buildSchema(
      screen([
        { componentFamily: "response", template: "likert-scale", props: { dataKey: "score", label: "Rate", options: likertOptions, required: false } },
      ])
    );
    expect(schema.safeParse({}).success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// slider
// ---------------------------------------------------------------------------

describe("slider", () => {
  it("passes a value within range", () => {
    const schema = buildSchema(
      screen([
        { componentFamily: "response", template: "slider", props: { dataKey: "vol", label: "Volume", min: 0, max: 100 } },
      ])
    );
    expect(schema.safeParse({ vol: 50 }).success).toBe(true);
  });

  it("fails a value above max", () => {
    const schema = buildSchema(
      screen([
        { componentFamily: "response", template: "slider", props: { dataKey: "vol", label: "Volume", min: 0, max: 100 } },
      ])
    );
    expect(schema.safeParse({ vol: 101 }).success).toBe(false);
  });

  it("fails a value below min", () => {
    const schema = buildSchema(
      screen([
        { componentFamily: "response", template: "slider", props: { dataKey: "vol", label: "Volume", min: 0, max: 100 } },
      ])
    );
    expect(schema.safeParse({ vol: -1 }).success).toBe(false);
  });

  it("passes value exactly at min boundary", () => {
    const schema = buildSchema(
      screen([
        { componentFamily: "response", template: "slider", props: { dataKey: "vol", label: "Volume", min: 0, max: 100 } },
      ])
    );
    expect(schema.safeParse({ vol: 0 }).success).toBe(true);
  });

  it("passes value exactly at max boundary", () => {
    const schema = buildSchema(
      screen([
        { componentFamily: "response", template: "slider", props: { dataKey: "vol", label: "Volume", min: 0, max: 100 } },
      ])
    );
    expect(schema.safeParse({ vol: 100 }).success).toBe(true);
  });

  it("coerces string to number", () => {
    const schema = buildSchema(
      screen([
        { componentFamily: "response", template: "slider", props: { dataKey: "vol", label: "Volume", min: 0, max: 100 } },
      ])
    );
    expect(schema.safeParse({ vol: "75" }).success).toBe(true);
  });

  it("fails when requiresInteraction is set and value is absent", () => {
    const schema = buildSchema(
      screen([
        { componentFamily: "response", template: "slider", props: { dataKey: "vol", label: "Volume", requiresInteraction: {} } },
      ])
    );
    expect(schema.safeParse({}).success).toBe(false);
  });

  it("passes when requiresInteraction is set and a value is provided", () => {
    const schema = buildSchema(
      screen([
        { componentFamily: "response", template: "slider", props: { dataKey: "vol", label: "Volume", requiresInteraction: {} } },
      ])
    );
    expect(schema.safeParse({ vol: 50 }).success).toBe(true);
  });

  it("passes when requiresInteraction is set and value is 0", () => {
    const schema = buildSchema(
      screen([
        { componentFamily: "response", template: "slider", props: { dataKey: "vol", label: "Volume", requiresInteraction: {} } },
      ])
    );
    expect(schema.safeParse({ vol: 0 }).success).toBe(true);
  });

  it("fails when requiresInteraction is set and form value is null (slider not touched)", () => {
    const schema = buildSchema(
      screen([
        { componentFamily: "response", template: "slider", props: { dataKey: "vol", label: "Volume", requiresInteraction: {} } },
      ])
    );
    expect(schema.safeParse({ vol: null }).success).toBe(false);
  });

  it("uses custom requiresInteraction errorMessage", () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: "response",
          template: "slider",
          props: { dataKey: "vol", label: "Volume", requiresInteraction: { errorMessage: "Please move the slider" } },
        },
      ])
    );
    const result = schema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.vol).toContain("Please move the slider");
    }
  });

  it("enforces minValue constraint", () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: "response",
          template: "slider",
          props: { dataKey: "vol", label: "Volume", min: 0, max: 100, minValue: { value: 20 } },
        },
      ])
    );
    expect(schema.safeParse({ vol: 10 }).success).toBe(false);
    expect(schema.safeParse({ vol: 20 }).success).toBe(true);
  });

  it("enforces maxValue constraint", () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: "response",
          template: "slider",
          props: { dataKey: "vol", label: "Volume", min: 0, max: 100, maxValue: { value: 80 } },
        },
      ])
    );
    expect(schema.safeParse({ vol: 81 }).success).toBe(false);
    expect(schema.safeParse({ vol: 80 }).success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// single-checkbox
// ---------------------------------------------------------------------------

describe("single-checkbox", () => {
  it("passes true when required", () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: "response",
          template: "single-checkbox",
          props: { dataKey: "agree", label: "Agree", defaultValue: false, required: true },
        },
      ])
    );
    expect(schema.safeParse({ agree: true }).success).toBe(true);
  });

  it("fails false when required", () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: "response",
          template: "single-checkbox",
          props: { dataKey: "agree", label: "Agree", defaultValue: false, required: true },
        },
      ])
    );
    expect(schema.safeParse({ agree: false }).success).toBe(false);
  });

  it("passes false when not required", () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: "response",
          template: "single-checkbox",
          props: { dataKey: "agree", label: "Agree", defaultValue: false, required: false },
        },
      ])
    );
    expect(schema.safeParse({ agree: false }).success).toBe(true);
  });

  it("enforces shouldBe: true constraint", () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: "response",
          template: "single-checkbox",
          props: { dataKey: "tos", label: "Accept", defaultValue: false, shouldBe: true },
        },
      ])
    );
    expect(schema.safeParse({ tos: false }).success).toBe(false);
    expect(schema.safeParse({ tos: true }).success).toBe(true);
  });

  it("enforces shouldBe: false constraint", () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: "response",
          template: "single-checkbox",
          props: { dataKey: "opt-out", label: "Opt out", defaultValue: true, shouldBe: false },
        },
      ])
    );
    expect(schema.safeParse({ "opt-out": true }).success).toBe(false);
    expect(schema.safeParse({ "opt-out": false }).success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// multi-field screen
// ---------------------------------------------------------------------------

describe("multi-field screen", () => {
  it("validates all fields together", () => {
    const schema = buildSchema(
      screen([
        { componentFamily: "response", template: "text-input", props: { dataKey: "name", label: "Name", required: true } },
        { componentFamily: "response", template: "likert-scale", props: { dataKey: "score", label: "Rate", options: likertOptions, required: true } },
        { componentFamily: "layout", template: "button", props: { text: "Next" } },
      ])
    );
    expect(schema.safeParse({ name: "Alice", score: "3" }).success).toBe(true);
    expect(schema.safeParse({ name: "", score: "3" }).success).toBe(false);
  });

  it("ignores non-response components", () => {
    const schema = buildSchema(
      screen([
        { componentFamily: "content", template: "rich-text", props: { content: "## Hello" } },
        { componentFamily: "layout", template: "button", props: { text: "Go" } },
      ])
    );
    // No fields — any object passes
    expect(schema.safeParse({}).success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// text-input — advanced constraints
// ---------------------------------------------------------------------------

describe("text-input advanced constraints", () => {
  it("enforces minLength", () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: "response",
          template: "text-input",
          props: { dataKey: "bio", label: "Bio", minLength: { value: 10 } },
        },
      ])
    );
    expect(schema.safeParse({ bio: "short" }).success).toBe(false);
    expect(schema.safeParse({ bio: "long enough bio" }).success).toBe(true);
  });

  it("enforces maxLength", () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: "response",
          template: "text-input",
          props: { dataKey: "code", label: "Code", maxLength: { value: 5 } },
        },
      ])
    );
    expect(schema.safeParse({ code: "toolong" }).success).toBe(false);
    expect(schema.safeParse({ code: "ok" }).success).toBe(true);
  });

  it("enforces regex pattern", () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: "response",
          template: "text-input",
          props: { dataKey: "zip", label: "ZIP", pattern: { value: "^\\d{5}$" } },
        },
      ])
    );
    expect(schema.safeParse({ zip: "abc" }).success).toBe(false);
    expect(schema.safeParse({ zip: "12345" }).success).toBe(true);
  });

  it("uses custom minLength errorMessage", () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: "response",
          template: "text-input",
          props: {
            dataKey: "bio",
            label: "Bio",
            minLength: { value: 10, errorMessage: "Too short" },
          },
        },
      ])
    );
    const result = schema.safeParse({ bio: "hi" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.bio).toContain("Too short");
    }
  });
});

// ---------------------------------------------------------------------------
// date-input / time-input
// ---------------------------------------------------------------------------

describe("date-input", () => {
  it("fails empty string when required", () => {
    const schema = buildSchema(
      screen([
        { componentFamily: "response", template: "date-input", props: { dataKey: "dob", label: "DOB", required: true } },
      ])
    );
    expect(schema.safeParse({ dob: "" }).success).toBe(false);
  });

  it("passes a non-empty string when required", () => {
    const schema = buildSchema(
      screen([
        { componentFamily: "response", template: "date-input", props: { dataKey: "dob", label: "DOB", required: true } },
      ])
    );
    expect(schema.safeParse({ dob: "2024-01-15" }).success).toBe(true);
  });

  it("passes empty when not required", () => {
    const schema = buildSchema(
      screen([
        { componentFamily: "response", template: "date-input", props: { dataKey: "dob", label: "DOB", required: false } },
      ])
    );
    expect(schema.safeParse({}).success).toBe(true);
  });
});

describe("time-input", () => {
  it("fails empty string when required", () => {
    const schema = buildSchema(
      screen([
        { componentFamily: "response", template: "time-input", props: { dataKey: "alarm", label: "Alarm", required: true } },
      ])
    );
    expect(schema.safeParse({ alarm: "" }).success).toBe(false);
  });

  it("passes a non-empty string when required", () => {
    const schema = buildSchema(
      screen([
        { componentFamily: "response", template: "time-input", props: { dataKey: "alarm", label: "Alarm", required: true } },
      ])
    );
    expect(schema.safeParse({ alarm: "08:30" }).success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// numeric-input
// ---------------------------------------------------------------------------

describe("numeric-input", () => {
  it("passes a number within range", () => {
    const schema = buildSchema(
      screen([
        { componentFamily: "response", template: "numeric-input", props: { dataKey: "age", label: "Age", min: 0, max: 120 } },
      ])
    );
    expect(schema.safeParse({ age: 30 }).success).toBe(true);
  });

  it("fails below min", () => {
    const schema = buildSchema(
      screen([
        { componentFamily: "response", template: "numeric-input", props: { dataKey: "age", label: "Age", min: 0, max: 120 } },
      ])
    );
    expect(schema.safeParse({ age: -1 }).success).toBe(false);
  });

  it("fails above max", () => {
    const schema = buildSchema(
      screen([
        { componentFamily: "response", template: "numeric-input", props: { dataKey: "age", label: "Age", min: 0, max: 120 } },
      ])
    );
    expect(schema.safeParse({ age: 121 }).success).toBe(false);
  });

  it("coerces string to number", () => {
    const schema = buildSchema(
      screen([
        { componentFamily: "response", template: "numeric-input", props: { dataKey: "age", label: "Age", min: 0, max: 120 } },
      ])
    );
    expect(schema.safeParse({ age: "42" }).success).toBe(true);
  });

  it("passes when optional and absent", () => {
    const schema = buildSchema(
      screen([
        { componentFamily: "response", template: "numeric-input", props: { dataKey: "age", label: "Age", required: false } },
      ])
    );
    expect(schema.safeParse({}).success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// nested components — group
// ---------------------------------------------------------------------------

describe("group — nested fields included in schema", () => {
  it("includes a required text-input nested inside a group", () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: "layout",
          template: "group",
          props: {
            name: "personal",
            components: [
              { componentFamily: "response", template: "text-input", props: { dataKey: "fname", label: "First name", required: true } },
            ],
          },
        },
      ])
    );
    expect(schema.safeParse({ fname: "Alice" }).success).toBe(true);
    expect(schema.safeParse({ fname: "" }).success).toBe(false);
  });

  it("includes multiple response fields from a group", () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: "layout",
          template: "group",
          props: {
            name: "survey",
            components: [
              { componentFamily: "response", template: "text-input", props: { dataKey: "q1", label: "Q1", required: true } },
              { componentFamily: "response", template: "text-input", props: { dataKey: "q2", label: "Q2", required: true } },
            ],
          },
        },
      ])
    );
    expect(schema.safeParse({ q1: "a", q2: "b" }).success).toBe(true);
    expect(schema.safeParse({ q1: "", q2: "b" }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// nested components — conditional
// ---------------------------------------------------------------------------

describe("conditional — nested field included as optional in base schema", () => {
  it("conditional field is optional in the base schema (missing value passes)", () => {
    const schema = buildSchema(
      screen([
        { componentFamily: "response", template: "radio", props: { dataKey: "answer", label: "Answer", options: [], required: true } },
        {
          componentFamily: "control",
          template: "conditional",
          props: {
            if: { type: "simple", operator: "eq", dataKey: "$answer", value: "yes" },
            component: {
              componentFamily: "response",
              template: "text-input",
              props: { dataKey: "details", label: "Details", required: true },
            },
          },
        },
      ])
    );
    // The conditional field is absent — base schema is optional, so it passes
    expect(schema.safeParse({ answer: "no" }).success).toBe(true);
  });

  it("superRefine enforces required on conditional field when condition is true", () => {
    const schema = buildSchema(
      screen([
        { componentFamily: "response", template: "radio", props: { dataKey: "answer", label: "Answer", options: [], required: true } },
        {
          componentFamily: "control",
          template: "conditional",
          props: {
            if: { type: "simple", operator: "eq", dataKey: "$answer", value: "yes" },
            component: {
              componentFamily: "response",
              template: "text-input",
              props: { dataKey: "details", label: "Details", required: true },
            },
          },
        },
      ])
    );
    // condition is true, details is empty — should fail
    expect(schema.safeParse({ answer: "yes", details: "" }).success).toBe(false);
  });

  it("superRefine passes when condition is true and required conditional field is filled", () => {
    const schema = buildSchema(
      screen([
        { componentFamily: "response", template: "radio", props: { dataKey: "answer", label: "Answer", options: [], required: true } },
        {
          componentFamily: "control",
          template: "conditional",
          props: {
            if: { type: "simple", operator: "eq", dataKey: "$answer", value: "yes" },
            component: {
              componentFamily: "response",
              template: "text-input",
              props: { dataKey: "details", label: "Details", required: true },
            },
          },
        },
      ])
    );
    expect(schema.safeParse({ answer: "yes", details: "some detail" }).success).toBe(true);
  });

  it("superRefine skips required check when conditional field is not required", () => {
    const schema = buildSchema(
      screen([
        { componentFamily: "response", template: "radio", props: { dataKey: "answer", label: "Answer", options: [], required: true } },
        {
          componentFamily: "control",
          template: "conditional",
          props: {
            if: { type: "simple", operator: "eq", dataKey: "$answer", value: "yes" },
            component: {
              componentFamily: "response",
              template: "text-input",
              props: { dataKey: "details", label: "Details", required: false },
            },
          },
        },
      ])
    );
    // condition true but not required — should pass even when empty
    expect(schema.safeParse({ answer: "yes", details: "" }).success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// nested components — static for-each
// ---------------------------------------------------------------------------

describe("static for-each — generates N schema entries", () => {
  it("creates one entry per static value with @index resolved", () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: "control",
          template: "for-each",
          props: {
            type: "static",
            id: "sports",
            values: ["football", "tennis", "swimming"],
            component: {
              componentFamily: "response",
              template: "text-input",
              props: { dataKey: "sport_@index", label: "Sport", required: true },
            },
          },
        },
      ])
    );
    expect(schema.safeParse({ sport_0: "a", sport_1: "b", sport_2: "c" }).success).toBe(true);
    expect(schema.safeParse({ sport_0: "", sport_1: "b", sport_2: "c" }).success).toBe(false);
  });

  it("generates exactly N keys matching values length", () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: "control",
          template: "for-each",
          props: {
            type: "static",
            id: "items",
            values: ["a", "b"],
            component: {
              componentFamily: "response",
              template: "text-input",
              props: { dataKey: "item_@index", label: "Item", required: true },
            },
          },
        },
      ])
    );
    // only 2 values → keys item_0 and item_1
    expect(schema.safeParse({ item_0: "x", item_1: "y" }).success).toBe(true);
    // extra key item_2 is irrelevant (zod strips or passes unknowns)
    expect(schema.safeParse({ item_0: "", item_1: "y" }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// nested components — dynamic for-each (skipped)
// ---------------------------------------------------------------------------

describe("dynamic for-each — gracefully skipped", () => {
  it("produces no entries for dynamic for-each", () => {
    const schema = buildSchema(
      screen([
        {
          componentFamily: "control",
          template: "for-each",
          props: {
            type: "dynamic",
            id: "items",
            dataKey: "$$items",
            component: {
              componentFamily: "response",
              template: "text-input",
              props: { dataKey: "item_@index", label: "Item", required: true },
            },
          },
        },
      ])
    );
    // No fields registered — empty object passes
    expect(schema.safeParse({}).success).toBe(true);
  });
});
