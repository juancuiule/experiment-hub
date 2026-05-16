import { describe, expect, it } from "vitest";
import { startExperiment, traverse } from "@/lib/flow";
import { ExperimentFlow } from "@/lib/types";
import { makeScreen, seq } from "../test-helpers";

describe("screen traversal", () => {
  const flow: ExperimentFlow = {
    nodes: [
      { id: "start", type: "start" },
      makeScreen("screen-a", "slug-a"),
      makeScreen("screen-b", "slug-b"),
    ],
    edges: [seq("start", "screen-a"), seq("screen-a", "screen-b")],
  };

  it("stores data into context.data keyed by screen slug and advances", async () => {
    const step = await startExperiment(flow, "start"); // on screen-a
    const next = await traverse(step, { age: 25 }); // store + advance to screen-b
    expect(next.context.data?.["slug-a"]).toEqual({ age: 25 });
    expect((next.state as any).node.id).toBe("screen-b");
  });

  it("accumulates data across multiple screens", async () => {
    const step1 = await startExperiment(flow, "start");
    const step2 = await traverse(step1, { age: 25 }); // screen-a → screen-b
    const step3 = await traverse(step2, { name: "juan" }); // store on screen-b (end of flow)
    expect(step3.context.data?.["slug-a"]).toEqual({ age: 25 });
    expect(step3.context.data?.["slug-b"]).toEqual({ name: "juan" });
  });

  it("transitions to end state when there is no sequential edge out of the last screen", async () => {
    const step1 = await startExperiment(flow, "start");
    const step2 = await traverse(step1, { age: 25 }); // → screen-b
    const step3 = await traverse(step2, { name: "juan" }); // screen-b has no outgoing edge → end
    expect(step3.state.type).toBe("end");
    const step4 = await traverse(step3, {}); // already at end → no-op
    expect(step4).toBe(step3);
  });
});

describe("checkpoint", () => {
  const flow: ExperimentFlow = {
    nodes: [
      { id: "start", type: "start" },
      makeScreen("screen-before", "before"),
      { id: "cp", type: "checkpoint", props: { name: "mid-point" } },
      makeScreen("screen-after", "after"),
    ],
    edges: [
      seq("start", "screen-before"),
      seq("screen-before", "cp"),
      seq("cp", "screen-after"),
    ],
  };

  it("auto-advances through the checkpoint and records a timestamp", async () => {
    const before = Date.now();
    const step1 = await startExperiment(flow, "start");
    const step2 = await traverse(step1, {}); // store {} + advance → cp → screen-after
    const after = Date.now();

    expect((step2.state as any).node.id).toBe("screen-after");
    const ts = step2.context.checkpoints?.["mid-point"];
    expect(ts).toBeDefined();
    expect(new Date(ts!).getTime()).toBeGreaterThanOrEqual(before);
    expect(new Date(ts!).getTime()).toBeLessThanOrEqual(after);
  });
});

describe("checkpoint at end of flow", () => {
  it("transitions to end state and records the timestamp", async () => {
    const flow: ExperimentFlow = {
      nodes: [
        { id: "start", type: "start" },
        makeScreen("s1", "s1"),
        { id: "cp-final", type: "checkpoint", props: { name: "final" } },
      ],
      edges: [seq("start", "s1"), seq("s1", "cp-final")],
    };
    const before = Date.now();
    let step = await startExperiment(flow, "start"); // on s1
    step = await traverse(step, {}); // s1 → cp-final (auto-traverses) → end
    const after = Date.now();

    expect(step.state.type).toBe("end");
    const ts = step.context.checkpoints?.["final"];
    expect(ts).toBeDefined();
    expect(new Date(ts!).getTime()).toBeGreaterThanOrEqual(before);
    expect(new Date(ts!).getTime()).toBeLessThanOrEqual(after);
  });
});
