import { describe, it, expect } from "vitest";
import { startExperiment, traverse } from "@/lib/flow";
import { ExperimentFlow } from "@/lib/types";
import { seq } from "../test-helpers";

const OPTIONS = [
  { label: "A", value: "a" },
  { label: "B", value: "b" },
  { label: "C", value: "c" },
];

function makeFlow(components: any[], values?: string[]): ExperimentFlow {
  const nodes: ExperimentFlow["nodes"] = values
    ? [
        { id: "start", type: "start" },
        { id: "loop-1", type: "loop", props: { type: "static", values } },
        { id: "s1", type: "screen", props: { slug: "test" } },
      ]
    : [
        { id: "start", type: "start" },
        { id: "s1", type: "screen", props: { slug: "test" } },
      ];

  const edges: ExperimentFlow["edges"] = values
    ? [seq("start", "loop-1"), { type: "loop-template", from: "loop-1", to: "s1" }]
    : [seq("start", "s1")];

  return {
    nodes,
    edges,
    screens: [{ slug: "test", components }],
  };
}

describe("shuffled options injected by enterStep", () => {
  it("injects a shuffled permutation for randomize:true radio", async () => {
    const flow = makeFlow([
      {
        componentFamily: "response",
        template: "radio",
        props: { dataKey: "choice", label: "Choice", options: OPTIONS, randomize: true },
      },
    ]);
    const step = await startExperiment(flow, "start");
    const shuffled = step.context.screenData?.shuffledOptions?.["choice"];
    expect(shuffled).toHaveLength(3);
    expect(shuffled.map((o: any) => o.value)).toEqual(expect.arrayContaining(["a", "b", "c"]));
  });

  it("injects shuffled options for dropdown and checkboxes", async () => {
    const flow = makeFlow([
      {
        componentFamily: "response",
        template: "dropdown",
        props: { dataKey: "dd", label: "DD", options: OPTIONS.slice(0, 2), randomize: true },
      },
      {
        componentFamily: "response",
        template: "checkboxes",
        props: { dataKey: "cb", label: "CB", options: OPTIONS.slice(0, 2), randomize: true },
      },
    ]);
    const step = await startExperiment(flow, "start");
    expect(step.context.screenData?.shuffledOptions?.["dd"]).toHaveLength(2);
    expect(step.context.screenData?.shuffledOptions?.["cb"]).toHaveLength(2);
  });

  it("does not inject shuffledOptions when no components have randomize:true", async () => {
    const flow = makeFlow([
      {
        componentFamily: "response",
        template: "radio",
        props: { dataKey: "choice", label: "Choice", options: OPTIONS },
      },
    ]);
    const step = await startExperiment(flow, "start");
    expect(step.context.screenData?.shuffledOptions).toBeUndefined();
  });

  it("does not inject shuffledOptions when screens is undefined", async () => {
    const flow = makeFlow([]);
    flow.screens = undefined;
    const step = await startExperiment(flow, "start");
    expect(step.context.screenData?.shuffledOptions).toBeUndefined();
  });

  it("preserves order in loops when reshuffleInLoop:false", async () => {
    const flow = makeFlow(
      [
        {
          componentFamily: "response",
          template: "radio",
          props: {
            dataKey: "choice",
            label: "Choice",
            options: OPTIONS,
            randomize: true,
            reshuffleInLoop: false,
          },
        },
      ],
      ["first", "second"],
    );

    const step1 = await startExperiment(flow, "start");
    const order1 = step1.context.screenData?.shuffledOptions?.["choice"];

    const step2 = await traverse(step1, { choice: "a" });
    const order2 = step2.context.screenData?.shuffledOptions?.["choice"];

    expect(order2).toBe(order1);
  });

  it("preserves order across loop iterations by default (reshuffleInLoop not set)", async () => {
    const flow = makeFlow(
      [
        {
          componentFamily: "response",
          template: "radio",
          props: {
            dataKey: "choice",
            label: "Choice",
            options: OPTIONS,
            randomize: true,
          },
        },
      ],
      ["first", "second"],
    );

    const step1 = await startExperiment(flow, "start");
    const order1 = step1.context.screenData?.shuffledOptions?.["choice"];

    const step2 = await traverse(step1, { choice: "a" });
    const order2 = step2.context.screenData?.shuffledOptions?.["choice"];

    expect(order2).toBe(order1);
  });

  it("reshuffles across loop iterations when reshuffleInLoop:true", async () => {
    const flow = makeFlow(
      [
        {
          componentFamily: "response",
          template: "radio",
          props: {
            dataKey: "choice",
            label: "Choice",
            options: OPTIONS,
            randomize: true,
            reshuffleInLoop: true,
          },
        },
      ],
      ["first", "second"],
    );

    const step1 = await startExperiment(flow, "start");
    const order1 = step1.context.screenData?.shuffledOptions?.["choice"];

    const step2 = await traverse(step1, { choice: "a" });
    const order2 = step2.context.screenData?.shuffledOptions?.["choice"];

    expect(order2).not.toBe(order1);
  });
});
