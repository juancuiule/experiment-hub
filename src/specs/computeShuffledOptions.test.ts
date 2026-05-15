import { describe, it, expect } from "vitest";
import { computeShuffledOptions } from "../data/store";
import { FlowStep } from "@/lib/types";

function makeScreenStep(slug: string, components: any[]): FlowStep {
  return {
    state: {
      type: "in-node",
      node: { type: "screen", id: "s1", props: { slug } },
    },
    experiment: {
      nodes: [{ type: "screen", id: "s1", props: { slug } }],
      edges: [],
      screens: [{ slug, components }],
    },
    context: {},
  };
}

describe("computeShuffledOptions", () => {
  it("returns a permutation of options for a randomize:true radio", () => {
    const options = [
      { label: "A", value: "a" },
      { label: "B", value: "b" },
      { label: "C", value: "c" },
    ];
    const step = makeScreenStep("test", [
      {
        componentFamily: "response",
        template: "radio",
        props: { dataKey: "choice", label: "Choice", options, randomize: true },
      },
    ]);
    const result = computeShuffledOptions(step);
    expect(result.choice).toHaveLength(3);
    expect(result.choice.map((o: any) => o.value)).toEqual(
      expect.arrayContaining(["a", "b", "c"]),
    );
  });

  it("returns {} for a non-screen state (end)", () => {
    const step: FlowStep = {
      state: { type: "end" },
      experiment: { nodes: [], edges: [] },
      context: {},
    };
    expect(computeShuffledOptions(step)).toEqual({});
  });

  it("returns {} when no components have randomize:true", () => {
    const step = makeScreenStep("test", [
      {
        componentFamily: "response",
        template: "radio",
        props: {
          dataKey: "choice",
          label: "Choice",
          options: [{ label: "A", value: "a" }],
        },
      },
    ]);
    expect(computeShuffledOptions(step)).toEqual({});
  });

  it("handles randomize:true for dropdown and checkboxes", () => {
    const step = makeScreenStep("test", [
      {
        componentFamily: "response",
        template: "dropdown",
        props: {
          dataKey: "dd",
          label: "DD",
          options: [{ label: "X", value: "x" }, { label: "Y", value: "y" }],
          randomize: true,
        },
      },
      {
        componentFamily: "response",
        template: "checkboxes",
        props: {
          dataKey: "cb",
          label: "CB",
          options: [{ label: "P", value: "p" }, { label: "Q", value: "q" }],
          randomize: true,
        },
      },
    ]);
    const result = computeShuffledOptions(step);
    expect(result.dd).toHaveLength(2);
    expect(result.cb).toHaveLength(2);
  });

  it("returns {} when experiment.screens is undefined", () => {
    const step = makeScreenStep("test", []);
    step.experiment.screens = undefined;
    expect(computeShuffledOptions(step)).toEqual({});
  });
});
