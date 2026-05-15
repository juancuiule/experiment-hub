# Back Navigation

> **Status:** Draft
> **Author:** —
> **Created:** 2026-03-12
> **Last updated:** 2026-03-12
> **Linked issue:** —

---

## 1. Summary

Add the ability for participants to navigate back to a previously visited screen by maintaining a history stack in the Zustand store, with a back button rendered whenever history is available.

---

## 2. Problem Statement

**Current state:** The store (`src/data/store.ts`) exposes only `start()` and `next()`. The `FlowStep` type (`lib/types.ts:53`) carries no history. `traverse()` in `lib/flow.ts` is strictly forward-only. Once a participant clicks "Continue", there is no way to return to the previous screen.

**Desired state:** A back button appears whenever there is a previous screen to return to. Clicking it restores the prior `FlowStep` from a history stack, including previously entered form values and the correct randomized child order for path and loop nodes.

**Impact:** Any accidental tap of the continue button on a long-form screen is currently irreversible without a full page refresh — which destroys all progress (session persistence is also disabled). This is a critical usability gap for any survey with more than a handful of questions.

---

## 3. User Story

> As a **participant taking an experiment**,
> I want to **go back to the previous screen if I made a mistake**,
> so that **I can correct my answer without losing all my progress**.

### Scenario A – Correcting a wrong answer

A participant on screen 3 of 8 realizes they misread a question on screen 2 and tapped the wrong option. They click the back button, are returned to screen 2 with their previous answer still selected, change it, and continue.

### Scenario B – Blocked at a checkpoint

A participant tries to go back past a checkpoint. The back button is absent or disabled past that boundary because the checkpoint data has already been submitted to the server.

### Scenario C – Inside a randomized path

A participant is on step 3 of a randomized path. They go back to step 2. The options on that screen appear in exactly the same order they did originally — the randomized child sequence is preserved.

---

## 4. Acceptance Criteria

- [ ] The Zustand store has a `history: FlowStep[]` array, initially empty.
- [ ] `next()` pushes the current `step` onto `history` before overwriting it.
- [ ] A new `back()` action pops the last item from `history` and sets it as `step`.
- [ ] The back button is rendered in `Experiment.tsx` when `history.length > 0`.
- [ ] Auto-traversed steps (`start`, `checkpoint`, `branch`, `fork`) are never pushed onto history — participants should only land on `screen` nodes when going back.
- [ ] Going back does not re-submit data or trigger `send()` side effects.
- [ ] The back button is not shown when the participant is at the first screen (empty history).
- [ ] The back button is hidden or disabled when the most recent history entry is at or behind a `checkpoint` node boundary.
- [ ] Restoring a `FlowStep` restores the exact `InPathState.children` order, so randomized paths remain stable.
- [ ] Previously entered form values are restored when returning to a screen (see Technical Notes).
- [ ] An optional `allowBack: false` prop on `PathNode` and `ScreenNode` prevents back navigation past that node; the back button is hidden once the participant has passed such a node.
- [ ] An optional `backButton?: { label?: string }` field on `ExperimentFlow` configures the back button label; defaults to `"Back"`.
- [ ] Unit tests cover: back from a simple screen, back skipping auto-traverse nodes, back blocked at checkpoint boundary, back blocked by `allowBack: false`.

---

## 5. UI / UX

### 5.1 Entry Point

A back button rendered inside `src/Experiment.tsx`, above or below the `<Screen>` component. Its position should be distinct from the screen's own `<Button>` (the continue button), which lives inside the screen form.

### 5.2 Interaction Flow

1. Participant is on any screen that has at least one previous screen in history.
2. A "Back" link or button is visible near the top of the screen container.
3. Participant clicks it.
4. The previous `FlowStep` is restored; the screen unmounts and the previous screen mounts.
5. The form re-renders with the participant's previously entered values populated.
6. The participant edits and clicks Continue normally.

### 5.3 States

| State | Description |
|---|---|
| No history | Back button is not rendered. |
| History available | Back button is rendered and active. |
| Checkpoint boundary | Back button is hidden past the checkpoint; participants cannot go back past a submitted checkpoint. |
| Loading | Back button is disabled while `isLoading` is true (same as the continue button). |

### 5.4 Copy

| Location | String |
|---|---|
| Back button label | `"Back"` |
| (Optional) Tooltip | `"Return to the previous question"` |

### 5.5 Figma Reference

- [ ] Figma link: Not yet designed.
- [ ] The back button should use a secondary/ghost style to not compete visually with the primary continue button.

---

## 6. Technical Notes

### 6.1 Affected Areas

- `src/data/store.ts` — add `history: FlowStep[]`, update `next()` to push before overwriting, add `back()` action
- `src/Experiment.tsx` — render back button when `history.length > 0`; conditionally hide at checkpoint boundaries
- `lib/flow.ts` — no changes needed; `traverse()` remains forward-only; history is a store concern
- `src/Screen.tsx` — needs to accept and populate `defaultValues` from the restored step (see 6.2)

### 6.2 Data / State

**Restoring form values:** When a screen node is restored from history, the previously submitted form data is in `step.state.context.data` at the path corresponding to that screen's `dataPath` + `slug`. `buildDefaultValues` in `Screen.tsx` should be extended to accept an optional `prefillValues` object. When the screen is being rendered after a `back()`, the store passes the relevant slice of `context.data` as `prefillValues`.

**Filtering auto-traverse nodes from history:** In `next()`, before pushing `currentStep` to history, check if the current `state` is `in-node` and the node is of type `screen`. Only push screen-level steps. All other transitions (branch, fork, checkpoint, start) are intermediate and should not appear in history from the participant's perspective.

**Checkpoint boundary detection:** A step is "behind a checkpoint" if any `FlowStep` in history after the most recent `screen` state contains a `checkpoint` node. The store can compute `canGoBack: boolean` as a derived selector: `history.length > 0 && !history.some(s => isCheckpointNode(getNodeFromStep(s)))`.

**History and persist:** If session persistence (separate feature) is enabled, `history` should also be persisted alongside `step`, so that back navigation survives a page refresh.

### 6.3 Validation

No `validateExperiment` changes.

### 6.4 Constraints & Risks

- A randomized path's child order is already stored in `InPathState.children` at the time the path is entered. Restoring the `FlowStep` naturally restores that order — no special handling required.
- Dynamic loops pose a similar concern: `InLoopState` stores `values` (the resolved iteration list) at entry time. This is also naturally preserved in the history entry.
- The `checkpoint` boundary rule means participants cannot undo a server-side submission. If a checkpoint is placed after every screen (an unusual but valid config), back navigation would be completely blocked everywhere. This is intentional and should be documented.

---

## 7. Test Plan

### 7.1 Unit Tests

- [ ] `store.next()` pushes current `step` onto `history` before updating.
- [ ] `store.back()` pops from `history` and sets it as `step`.
- [ ] `store.next()` does not push non-screen steps (checkpoint, branch) onto history.
- [ ] `canGoBack` is `false` when history is empty.
- [ ] `canGoBack` is `false` when a checkpoint node appears anywhere in history after the last screen.
- [ ] `canGoBack` is `true` when history has at least one screen step and no checkpoint.

### 7.2 Integration / Flow Tests

- [ ] Participant advances through 3 screens, goes back twice — lands on screen 1 with correct data.
- [ ] Participant advances past a checkpoint, back button is not shown.
- [ ] Randomized path: go forward 2 steps, go back 2 steps, go forward again — child order is identical.

### 7.3 Manual / QA Checks

- [ ] Fill in screen 1, advance to screen 2, click back — screen 1 shows previously entered values.
- [ ] Advance past a checkpoint — back button is gone.
- [ ] Multiple back/forward cycles do not corrupt form data.

---

## 8. Out of Scope

- Unlimited undo (rewinding before the very start of the experiment).
- Branching history (going back, taking a different branch, then being able to return to the original branch).
- Server-side session history — the history stack is in-memory/persisted client-side only.
- Animations/transitions for the back navigation direction (e.g., slide-right vs slide-left).

---

## 9. Open Questions

| # | Question | Owner | Resolution |
|---|---|---|---|
| 1 | Should researchers be able to disable back navigation per-screen or per-path (e.g. `allowBack: false` on a `PathNode`)? | — | **Resolved:** Yes — add an optional `allowBack: false` prop to `PathNode` and `ScreenNode` props to disable back navigation for that node. When any node in history has `allowBack: false`, the back button is hidden after the participant passes it. |
| 2 | Should going back past a fork re-run the fork selection (potentially landing the participant in a different arm) or always restore the original fork result? | — | **Resolved:** Always restore from history — back navigation must be deterministic. |
| 3 | Should the back button label be configurable in the experiment config? | — | **Resolved:** Yes — add a top-level `backButton?: { label?: string }` field to `ExperimentFlow`. Defaults to `"Back"`. |

---

## 10. Changelog

| Date | Author | Change |
|---|---|---|
| 2026-03-12 | — | Initial draft |
