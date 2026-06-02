import { describe, it, expect, vi } from "vitest";
import { startExperiment, traverse } from "@experiment-hub/engine/flow";
import { ExperimentFlow, FlowHandlers } from "@experiment-hub/engine/types";
import { makeScreen, seq } from "../test-helpers";

const flow: ExperimentFlow = {
  nodes: [
    { id: "start", type: "start" },
    { id: "cp1", type: "checkpoint", props: { name: "my-checkpoint" } },
    makeScreen("screen-q1", "q1"),
    { id: "cp2", type: "checkpoint", props: { name: "end-checkpoint" } },
    makeScreen("screen-q2", "q2"),
  ],
  edges: [
    seq("start", "cp1"),
    seq("cp1", "screen-q1"),
    seq("screen-q1", "cp2"),
    seq("cp2", "screen-q2"),
  ],
};

describe("FlowHandlers: onCheckpoint", () => {
  it("calls onCheckpoint with context and name when traversing a checkpoint", async () => {
    const onCheckpoint = vi.fn().mockResolvedValue(undefined);
    const handlers: FlowHandlers = { onCheckpoint };

    // startExperiment auto-traverses: start → cp1 → screen-q1
    await startExperiment(flow, undefined, handlers);

    expect(onCheckpoint).toHaveBeenCalledOnce();
    expect(onCheckpoint).toHaveBeenCalledWith(
      expect.any(Object),
      "my-checkpoint",
    );
  });

  it("calls onCheckpoint each time a checkpoint is traversed", async () => {
    const onCheckpoint = vi.fn().mockResolvedValue(undefined);

    const step = await startExperiment(flow, undefined, { onCheckpoint });
    // screen-q1 → cp2 → screen-q2
    await traverse(step, { q1: "answer" });

    expect(onCheckpoint).toHaveBeenCalledTimes(2);
    expect(onCheckpoint).toHaveBeenNthCalledWith(1, expect.any(Object), "my-checkpoint");
    expect(onCheckpoint).toHaveBeenNthCalledWith(2, expect.any(Object), "end-checkpoint");
  });

  it("does not throw when no onCheckpoint handler is provided", async () => {
    await expect(startExperiment(flow)).resolves.toBeDefined();
  });

  it("passes context accumulated before the checkpoint to onCheckpoint", async () => {
    const onCheckpoint = vi.fn().mockResolvedValue(undefined);

    await startExperiment(flow, undefined, { onCheckpoint });

    // Context should have start.group set before the checkpoint fires
    const [ctx] = onCheckpoint.mock.calls[0];
    expect(ctx.start?.group).toBeDefined();
  });
});
