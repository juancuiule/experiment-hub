import { afterEach, describe, expect, it, vi } from "vitest";
import { startExperiment, traverse } from "@/lib/flow";
import { ExperimentFlow } from "@/lib/types";
import { makeScreen, seq } from "../test-helpers";

describe("loop (static values)", () => {
  const flow: ExperimentFlow = {
    nodes: [
      { id: "start", type: "start" },
      {
        id: "loop-sports",
        type: "loop",
        props: { type: "static", values: ["football", "basketball", "tennis"] },
      },
      makeScreen("screen-sport", "sport-screen"),
      makeScreen("screen-end", "end"),
    ],
    edges: [
      seq("start", "loop-sports"),
      { type: "loop-template", from: "loop-sports", to: "screen-sport" },
      seq("loop-sports", "screen-end"),
    ],
  };

  it("starts on the template screen with loopData set for the first value", async () => {
    const step = await startExperiment(flow, "start");
    expect(step.state.type).toBe("in-loop");
    expect((step.state as any).index).toBe(0);
    expect(step.context.loopData?.["loop-sports"]).toEqual({
      value: "football",
      index: 0,
    });
  });

  it("advances loopData on each iteration", async () => {
    let step = await startExperiment(flow, "start"); // index 0: football
    step = await traverse(step, { liked: true }); // advance to index 1: basketball
    expect((step.state as any).index).toBe(1);
    expect(step.context.loopData?.["loop-sports"]).toEqual({
      value: "basketball",
      index: 1,
    });
  });

  it("exits the loop after the last iteration and moves to the next node", async () => {
    let step = await startExperiment(flow, "start");
    step = await traverse(step, {}); // football → basketball
    step = await traverse(step, {}); // basketball → tennis
    step = await traverse(step, {}); // tennis → exit loop
    expect((step.state as any).node.id).toBe("screen-end");
  });

  it("iterates through all values in order", async () => {
    let step = await startExperiment(flow, "start");
    const seen: string[] = [];
    for (let i = 0; i < 3; i++) {
      seen.push(step.context.loopData?.["loop-sports"]?.value ?? "");
      step = await traverse(step, { liked: i % 2 === 0 });
    }
    expect(seen).toEqual(["football", "basketball", "tennis"]);
  });

  it("stores per-iteration data nested under loop id, value, and template slug", async () => {
    let step = await startExperiment(flow, "start");
    step = await traverse(step, { liked: true }); // football
    step = await traverse(step, { liked: false }); // basketball
    step = await traverse(step, { liked: true }); // tennis → exit
    // Data is keyed as context.data[loopId][value][screenSlug]
    expect(
      step.context.data?.["loop-sports"]?.["football"]?.["sport-screen"],
    ).toEqual({ liked: true });
    expect(
      step.context.data?.["loop-sports"]?.["basketball"]?.["sport-screen"],
    ).toEqual({ liked: false });
    expect(
      step.context.data?.["loop-sports"]?.["tennis"]?.["sport-screen"],
    ).toEqual({ liked: true });
  });
});

describe("loop (dynamic values from context)", () => {
  const flow: ExperimentFlow = {
    nodes: [
      { id: "start", type: "start" },
      makeScreen("screen-setup", "setup"),
      {
        id: "loop-dynamic",
        type: "loop",
        props: { type: "dynamic", dataKey: "$$setup.sports" },
      },
      makeScreen("screen-sport", "sport-screen"),
      makeScreen("screen-end", "end"),
    ],
    edges: [
      seq("start", "screen-setup"),
      seq("screen-setup", "loop-dynamic"),
      { type: "loop-template", from: "loop-dynamic", to: "screen-sport" },
      seq("loop-dynamic", "screen-end"),
    ],
  };

  it("reads loop values from context.data via the dataKey", async () => {
    let step = await startExperiment(flow, "start");
    step = await traverse(step, { sports: ["football", "tennis"] });
    expect(step.state.type).toBe("in-loop");
    expect(step.context.loopData?.["loop-dynamic"]?.value).toBe("football");
  });

  it("iterates through all dynamic values in order", async () => {
    let step = await startExperiment(flow, "start");
    step = await traverse(step, { sports: ["alpha", "beta", "gamma"] });
    const seen: string[] = [];
    while (step.state.type === "in-loop") {
      seen.push(step.context.loopData?.["loop-dynamic"]?.value);
      step = await traverse(step, { rated: true });
    }
    expect(seen).toEqual(["alpha", "beta", "gamma"]);
  });

  it("exits to the next node after the loop completes", async () => {
    let step = await startExperiment(flow, "start");
    step = await traverse(step, { sports: ["only-one"] });
    step = await traverse(step, { rated: true }); // exit loop
    expect((step.state as any).node.id).toBe("screen-end");
  });

  it("skips the loop entirely when the dynamic values array is empty", async () => {
    let step = await startExperiment(flow, "start");
    step = await traverse(step, {}); // setup with no sports field → empty array → loop skipped
    expect(step.state.type).toBe("in-node");
    expect((step.state as any).node.id).toBe("screen-end");
    expect(step.context.loopData?.["loop-dynamic"]).toBeUndefined();
    expect(step.context.loops?.["loop-dynamic"]?.order).toEqual([]);
  });
});

describe("loop (object values with itemKey)", () => {
  const stimuli = [
    { id: "cat", label: "Cat", correct: "meow" },
    { id: "dog", label: "Dog", correct: "woof" },
  ];

  const flow: ExperimentFlow = {
    nodes: [
      { id: "start", type: "start" },
      {
        id: "stimuli-loop",
        type: "loop",
        props: { type: "static", values: stimuli, itemKey: "id" },
      },
      makeScreen("screen-stimulus", "stimulus"),
      makeScreen("screen-end", "end"),
    ],
    edges: [
      seq("start", "stimuli-loop"),
      { type: "loop-template", from: "stimuli-loop", to: "screen-stimulus" },
      seq("stimuli-loop", "screen-end"),
    ],
  };

  it("writes per-iteration data keyed by the itemKey property, not the index", async () => {
    let step = await startExperiment(flow, "start");
    step = await traverse(step, { answer: "meow" }); // cat
    step = await traverse(step, { answer: "bark" }); // dog → exit
    expect(
      step.context.data?.["stimuli-loop"]?.["cat"]?.["stimulus"],
    ).toEqual({ answer: "meow" });
    expect(
      step.context.data?.["stimuli-loop"]?.["dog"]?.["stimulus"],
    ).toEqual({ answer: "bark" });
    // No 1-based index keys should be present
    expect(step.context.data?.["stimuli-loop"]?.["1"]).toBeUndefined();
    expect(step.context.data?.["stimuli-loop"]?.["2"]).toBeUndefined();
  });

  it("stores resolved key strings in context.loops.<id>.order", async () => {
    const step = await startExperiment(flow, "start");
    expect(step.context.loops?.["stimuli-loop"]?.order).toEqual(["cat", "dog"]);
  });

  it("exposes the full object as @loopId.value inside the loop", async () => {
    let step = await startExperiment(flow, "start");
    expect(step.context.loopData?.["stimuli-loop"]).toEqual({
      value: stimuli[0],
      index: 0,
    });
    step = await traverse(step, { answer: "meow" });
    expect(step.context.loopData?.["stimuli-loop"]).toEqual({
      value: stimuli[1],
      index: 1,
    });
  });
});

describe("loop (itemKey edge cases)", () => {
  it("falls back to the 1-based index when an object lacks the itemKey at runtime", async () => {
    // Dynamic loop: missing property cannot be caught statically, so the engine
    // silently falls back to String(index + 1) for that iteration.
    const flow: ExperimentFlow = {
      nodes: [
        { id: "start", type: "start" },
        makeScreen("screen-setup", "setup"),
        {
          id: "loop-dyn",
          type: "loop",
          props: { type: "dynamic", dataKey: "$$setup.items", itemKey: "id" },
        },
        makeScreen("screen-item", "item"),
        makeScreen("screen-end", "end"),
      ],
      edges: [
        seq("start", "screen-setup"),
        seq("screen-setup", "loop-dyn"),
        { type: "loop-template", from: "loop-dyn", to: "screen-item" },
        seq("loop-dyn", "screen-end"),
      ],
    };

    let step = await startExperiment(flow, "start");
    step = await traverse(step, {
      items: [{ id: "x", v: 1 }, { v: 2 }], // second object has no `id`
    });
    step = await traverse(step, { picked: "a" }); // first item → keyed by "x"
    step = await traverse(step, { picked: "b" }); // second item → falls back to "2"
    expect(step.context.data?.["loop-dyn"]?.["x"]?.["item"]).toEqual({
      picked: "a",
    });
    expect(step.context.data?.["loop-dyn"]?.["2"]?.["item"]).toEqual({
      picked: "b",
    });
    expect(step.context.loops?.["loop-dyn"]?.order).toEqual(["x", "2"]);
  });

  it("is a no-op for string-valued loops — string value is used as the key", async () => {
    const flow: ExperimentFlow = {
      nodes: [
        { id: "start", type: "start" },
        {
          id: "loop-str",
          type: "loop",
          props: {
            type: "static",
            values: ["red", "blue"],
            itemKey: "id",
          },
        },
        makeScreen("screen-color", "color"),
        makeScreen("screen-end", "end"),
      ],
      edges: [
        seq("start", "loop-str"),
        { type: "loop-template", from: "loop-str", to: "screen-color" },
        seq("loop-str", "screen-end"),
      ],
    };

    let step = await startExperiment(flow, "start");
    step = await traverse(step, { liked: true }); // red
    step = await traverse(step, { liked: false }); // blue → exit
    expect(step.context.data?.["loop-str"]?.["red"]?.["color"]).toEqual({
      liked: true,
    });
    expect(step.context.data?.["loop-str"]?.["blue"]?.["color"]).toEqual({
      liked: false,
    });
    expect(step.context.loops?.["loop-str"]?.order).toEqual(["red", "blue"]);
  });

  it("falls back to the index when the itemKey resolves to a reserved key (no prototype pollution)", async () => {
    const flow: ExperimentFlow = {
      nodes: [
        { id: "start", type: "start" },
        makeScreen("screen-setup", "setup"),
        {
          id: "loop-proto",
          type: "loop",
          props: { type: "dynamic", dataKey: "$$setup.items", itemKey: "id" },
        },
        makeScreen("screen-item", "item"),
        makeScreen("screen-end", "end"),
      ],
      edges: [
        seq("start", "screen-setup"),
        seq("screen-setup", "loop-proto"),
        { type: "loop-template", from: "loop-proto", to: "screen-item" },
        seq("loop-proto", "screen-end"),
      ],
    };

    let step = await startExperiment(flow, "start");
    step = await traverse(step, { items: [{ id: "__proto__", v: 1 }] });
    step = await traverse(step, { picked: "a" }); // single item → exit

    // Keyed by the index fallback, not "__proto__"
    expect(step.context.data?.["loop-proto"]?.["1"]?.["item"]).toEqual({
      picked: "a",
    });
    expect(step.context.loops?.["loop-proto"]?.order).toEqual(["1"]);
    // The prototype was not polluted
    expect(({} as Record<string, unknown>).v).toBeUndefined();
  });

  it("skips a dynamic loop whose dataKey resolves to a non-array value", async () => {
    const flow: ExperimentFlow = {
      nodes: [
        { id: "start", type: "start" },
        makeScreen("screen-setup", "setup"),
        {
          id: "loop-bad",
          type: "loop",
          props: { type: "dynamic", dataKey: "$$setup.items" },
        },
        makeScreen("screen-item", "item"),
        makeScreen("screen-end", "end"),
      ],
      edges: [
        seq("start", "screen-setup"),
        seq("screen-setup", "loop-bad"),
        { type: "loop-template", from: "loop-bad", to: "screen-item" },
        seq("loop-bad", "screen-end"),
      ],
    };

    let step = await startExperiment(flow, "start");
    // items is an object, not an array — must not crash, loop is skipped
    step = await traverse(step, { items: { not: "an array" } });
    expect(step.state.type).toBe("in-node");
    expect((step.state as any).node.id).toBe("screen-end");
    expect(step.context.loops?.["loop-bad"]?.order).toEqual([]);
  });
});

describe("loop tracking (context.loops)", () => {
  const flow: ExperimentFlow = {
    nodes: [
      { id: "start", type: "start" },
      {
        id: "loop-colors",
        type: "loop",
        props: { type: "static", values: ["red", "blue", "green"] },
      },
      makeScreen("screen-color", "color"),
      makeScreen("screen-end", "end"),
    ],
    edges: [
      seq("start", "loop-colors"),
      { type: "loop-template", from: "loop-colors", to: "screen-color" },
      seq("loop-colors", "screen-end"),
    ],
  };

  it("sets full order upfront when the loop is entered", async () => {
    let step = await startExperiment(flow, "start"); // index 0: red
    expect(step.context.loops?.["loop-colors"]?.order).toEqual([
      "red",
      "blue",
      "green",
    ]);
    step = await traverse(step, { rated: 1 }); // red done → advance to blue
    expect(step.context.loops?.["loop-colors"]?.order).toEqual([
      "red",
      "blue",
      "green",
    ]);
  });

  it("populates context.loops with all values after the loop exits", async () => {
    let step = await startExperiment(flow, "start");
    step = await traverse(step, { rated: 1 });
    step = await traverse(step, { rated: 2 });
    step = await traverse(step, { rated: 3 }); // green done → exit
    expect(step.context.loops?.["loop-colors"]?.order).toEqual([
      "red",
      "blue",
      "green",
    ]);
  });

  it("loop tracking is preserved after exiting to the next screen", async () => {
    let step = await startExperiment(flow, "start");
    step = await traverse(step, {});
    step = await traverse(step, {});
    step = await traverse(step, {}); // exit loop → screen-end
    expect((step.state as any).node.id).toBe("screen-end");
    expect(step.context.loops?.["loop-colors"]?.order).toEqual([
      "red",
      "blue",
      "green",
    ]);
  });
});

describe("loop (randomized iteration order)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const staticFlow: ExperimentFlow = {
    nodes: [
      { id: "start", type: "start" },
      {
        id: "loop-stim",
        type: "loop",
        props: {
          type: "static",
          values: ["cat", "dog", "bird"],
          randomized: true,
        },
      },
      makeScreen("screen-stim", "stim"),
      makeScreen("screen-end", "end"),
    ],
    edges: [
      seq("start", "loop-stim"),
      { type: "loop-template", from: "loop-stim", to: "screen-stim" },
      seq("loop-stim", "screen-end"),
    ],
  };

  it("shuffles the static values once on entry (deterministic with mocked Math.random)", async () => {
    // Fisher-Yates in shuffle() with Math.random()===0 reverses-then-rotates
    // ["cat","dog","bird"] -> ["dog","bird","cat"].
    vi.spyOn(Math, "random").mockReturnValue(0);
    const step = await startExperiment(staticFlow, "start");
    expect(step.context.loops?.["loop-stim"]?.order).toEqual([
      "dog",
      "bird",
      "cat",
    ]);
    expect(step.context.loopData?.["loop-stim"]?.value).toBe("dog");
  });

  it("produces an iteration order that is a permutation of the input", async () => {
    let step = await startExperiment(staticFlow, "start");
    const seen: string[] = [];
    while (step.state.type === "in-loop") {
      seen.push(step.context.loopData?.["loop-stim"]?.value);
      step = await traverse(step, {});
    }
    expect(seen.slice().sort()).toEqual(["bird", "cat", "dog"]);
  });

  it("keeps the shuffled order stable across all iterations", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    let step = await startExperiment(staticFlow, "start");
    const order = step.context.loops?.["loop-stim"]?.order;
    const seen: string[] = [];
    while (step.state.type === "in-loop") {
      seen.push(step.context.loopData?.["loop-stim"]?.value);
      // order must not change as iterations advance
      expect(step.context.loops?.["loop-stim"]?.order).toEqual(order);
      step = await traverse(step, {});
    }
    // The values are presented in exactly the recorded order.
    expect(seen).toEqual(order);
  });

  it("resolves dynamic values from context first, then shuffles", async () => {
    const dynamicFlow: ExperimentFlow = {
      nodes: [
        { id: "start", type: "start" },
        makeScreen("screen-setup", "setup"),
        {
          id: "loop-dyn",
          type: "loop",
          props: { type: "dynamic", dataKey: "$$setup.items", randomized: true },
        },
        makeScreen("screen-item", "item"),
        makeScreen("screen-end", "end"),
      ],
      edges: [
        seq("start", "screen-setup"),
        seq("screen-setup", "loop-dyn"),
        { type: "loop-template", from: "loop-dyn", to: "screen-item" },
        seq("loop-dyn", "screen-end"),
      ],
    };

    let step = await startExperiment(dynamicFlow, "start");
    step = await traverse(step, { items: ["alpha", "beta", "gamma"] });
    const order = step.context.loops?.["loop-dyn"]?.order ?? [];
    // Shuffled order is still a permutation of the resolved context values.
    expect(order.slice().sort()).toEqual(["alpha", "beta", "gamma"]);

    const seen: string[] = [];
    while (step.state.type === "in-loop") {
      seen.push(step.context.loopData?.["loop-dyn"]?.value);
      step = await traverse(step, {});
    }
    expect(seen).toEqual(order);
  });

  it("exposes the shuffled order to a downstream node via context.loops", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    let step = await startExperiment(staticFlow, "start");
    step = await traverse(step, {});
    step = await traverse(step, {});
    step = await traverse(step, {}); // exit loop → screen-end
    expect((step.state as any).node.id).toBe("screen-end");
    // The shuffled order is preserved in context.loops for downstream steps.
    expect(step.context.loops?.["loop-stim"]?.order).toEqual([
      "dog",
      "bird",
      "cat",
    ]);
  });

  it("leaves iteration order unchanged when randomized is false", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const flow: ExperimentFlow = {
      nodes: [
        { id: "start", type: "start" },
        {
          id: "loop-stim",
          type: "loop",
          props: {
            type: "static",
            values: ["cat", "dog", "bird"],
            randomized: false,
          },
        },
        makeScreen("screen-stim", "stim"),
        makeScreen("screen-end", "end"),
      ],
      edges: [
        seq("start", "loop-stim"),
        { type: "loop-template", from: "loop-stim", to: "screen-stim" },
        seq("loop-stim", "screen-end"),
      ],
    };
    const step = await startExperiment(flow, "start");
    expect(step.context.loops?.["loop-stim"]?.order).toEqual([
      "cat",
      "dog",
      "bird",
    ]);
  });
});
