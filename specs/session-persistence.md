# Session Persistence & Experiment Resume

> **Status:** Draft
> **Author:** —
> **Created:** 2026-03-12
> **Last updated:** 2026-03-12
> **Linked issue:** —

---

## 1. Summary

Re-enable client-side session persistence using Zustand's `persist` middleware (already present but commented out) and extend the flow engine to support resuming from a saved state, so participants who close or refresh their browser do not lose all progress.

---

## 2. Problem Statement

**Current state:** The Zustand `persist` middleware is imported but entirely commented out in `src/data/store.ts:43-49`. The store is 100% in-memory. `send()` in `lib/utils.ts:18-24` is a 1ms `setTimeout` stub that never delivers data anywhere. Refreshing the page resets everything to `step: null`.

**Desired state:** Experiment progress survives a browser refresh within the same session. For longer studies, a durable session ID enables cross-device or post-expiry resume via a URL link.

**Impact:** Any accidental refresh, network hiccup, or browser crash destroys all collected data and forces the participant to restart. For sensitive studies (e.g. clinical surveys), restarting from scratch is distressing and damages data quality through fatigue and repetition effects.

---

## 3. User Story

> As a **participant taking an experiment**,
> I want **my progress to be saved automatically**,
> so that **if I accidentally close the tab or my browser crashes, I can pick up where I left off**.

### Scenario A – Accidental refresh

A participant is on screen 6 of 12, refreshes by mistake. The page reloads, detects a saved session, and drops them back at screen 6 with all prior answers intact.

### Scenario B – Returning via a resume link

A participant bookmarks their experiment URL (which includes a `?session=abc123` parameter). They return the next day on the same device. The app detects the session ID, loads the saved state from storage, and continues from where they stopped.

### Scenario C – Clean session on a new device

A participant opens the experiment URL on a different device with no `?session` parameter. A fresh session starts normally.

---

## 4. Acceptance Criteria

- [ ] A unique `sessionId` (UUID v4) is generated at `startExperiment()` time and stored in `Context`.
- [ ] The Zustand `persist` middleware is re-enabled, scoped to `{ step }` via `partialize` — the `experiment` graph is **not** persisted (too large; re-loaded from the static import).
- [ ] Default storage is `sessionStorage`; when `ExperimentFlow.persistence.storage === "local"`, `localStorage` is used instead.
- [ ] `ExperimentFlow` has an optional `version?: string` field. When the saved session's version does not match the current experiment's version, the session is discarded and a clean start is triggered with a warning message.
- [ ] The persisted `step` stores only the minimal resume payload: `{ context, state }` without the `experiment` field.
- [ ] On page load, if a persisted `step` is found in `sessionStorage`, the app offers to resume rather than starting fresh.
- [ ] `startExperiment()` in `lib/flow.ts` accepts an optional `resume?: { context: Context; state: State }` parameter. When provided, it returns a `FlowStep` at the saved state instead of `initial`.
- [ ] `send()` in `lib/utils.ts` is replaced with a real `fetch` call (POST) that sends the current `Context` to a configurable endpoint. The endpoint URL is set via an environment variable (`NEXT_PUBLIC_SUBMIT_URL`). If the env var is unset, `send()` is a no-op (dev/test mode).
- [ ] The `sessionId` is included in every `send()` payload.
- [ ] Resuming correctly handles randomized paths and forks — because the shuffled order is stored in the state, it is restored exactly.
- [ ] All new behavior is covered by unit tests.

---

## 5. UI / UX

### 5.1 Entry Point

On page load, if a saved session exists in `sessionStorage`, a resume prompt is shown before the experiment start button.

### 5.2 Interaction Flow

**Normal start:**
1. Participant opens experiment URL.
2. No saved session found.
3. Start button shown as normal. Participant clicks it; a new `sessionId` is generated and persisted.

**Resume flow:**
1. Participant opens experiment URL after a prior partial session.
2. Saved session detected in `sessionStorage`.
3. A prompt is shown: "It looks like you started this experiment before. Would you like to continue where you left off?"
4. Two options: "Continue" (resumes) and "Start over" (clears storage, starts fresh).
5. Participant chooses "Continue" → dropped back at their last screen.

### 5.3 States

| State | Description |
|---|---|
| No saved session | Normal start screen shown. |
| Saved session found | Resume prompt shown with continue/restart options. |
| Resuming | App transitions directly to the last saved screen; no start animation. |
| Session expired (future) | If the session is older than a configurable TTL, show "Your session has expired" and offer a fresh start. |

### 5.4 Copy

| Location | String |
|---|---|
| Resume prompt heading | `"Welcome back"` |
| Resume prompt body | `"It looks like you started this experiment before. Would you like to continue where you left off?"` |
| Resume button | `"Continue"` |
| Restart button | `"Start over"` |

### 5.5 Figma Reference

- [ ] Figma link: Not yet designed.
- [ ] The resume prompt should appear in place of the normal start button, in the same visual container.

---

## 6. Technical Notes

### 6.1 Affected Areas

- `src/data/store.ts` — re-enable `persist` middleware with refined `partialize`; add `resume()` action
- `lib/flow.ts:307-315` — extend `startExperiment()` signature with optional `resume` parameter
- `lib/types.ts` — add `sessionId: string` to `Context`
- `lib/utils.ts:18-24` — replace `setTimeout` stub with real `fetch` POST; add env var check
- `app/page.tsx` — detect saved session and conditionally render resume prompt vs. start button
- `src/Experiment.tsx` — handle the resume screen state

### 6.2 Data / State

**Persisted shape (what goes into `sessionStorage`):**

```ts
type PersistedSession = {
  context: Context;         // all collected data + sessionId + checkpoints + branches/forks/paths/loops
  state: State;             // the current flow state (in-node, in-path, in-loop, etc.) — without the experiment graph
  persistedAt: string;      // ISO timestamp for TTL checks
};
```

The `experiment` field of `FlowStep` is **not** persisted. On resume, `startExperiment(experiment, undefined, { context, state })` reconstructs the full `FlowStep` by merging the saved state with the statically imported experiment config.

**Resuming randomized state:** `InPathState.children` and `InLoopState.values` contain the resolved (potentially shuffled) sequences from the original session. These are part of `state` and are restored exactly. No re-shuffling occurs on resume.

**`send()` replacement:**

```ts
async function send(context: Context): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUBMIT_URL;
  if (!url) return; // dev/test no-op
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId: context.sessionId, context }),
  });
}
```

### 6.3 Validation

No `validateExperiment` changes.

### 6.4 Constraints & Risks

- `sessionStorage` is tab-scoped. A participant opening a second tab starts a fresh session. If cross-tab continuity is needed, use `localStorage` with explicit expiry — this is a configuration choice.
- The full `Context` can be large for long experiments with many screens. Consider only persisting `context.data` + the minimal state cursor, and re-deriving `context.checkpoints`, `context.branches`, etc. from the traversal history. This is a follow-up optimization.
- Serializing `FlowStep` with the `experiment` field would exceed storage limits for complex configs. The `partialize` guard is essential.
- If the experiment definition changes between a participant's first visit and their resume (e.g. a node was removed), the restored state may reference a node that no longer exists. A version hash of the experiment config should be included in the persisted payload, and a mismatch should trigger a clean restart with a warning.

---

## 7. Test Plan

### 7.1 Unit Tests

- [ ] `startExperiment(experiment, nodeId, { context, state })` returns a `FlowStep` at the saved state, not at `initial`.
- [ ] `send()` calls `fetch` with the correct payload when `NEXT_PUBLIC_SUBMIT_URL` is set.
- [ ] `send()` is a no-op when `NEXT_PUBLIC_SUBMIT_URL` is unset.
- [ ] `partialize` returns only `{ step: { context, state } }` — no `experiment` field.

### 7.2 Integration / Flow Tests

- [ ] Complete screen 1, simulate a persist-then-restore cycle, verify screen 2 is shown with correct context.
- [ ] Resume after a randomized path — child order is identical to the original session.
- [ ] Config version mismatch — persisted session with a stale config hash triggers a fresh start.

### 7.3 Manual / QA Checks

- [ ] Fill in 3 screens, refresh the page, verify resume prompt appears and continuation is correct.
- [ ] Choose "Start over" from the resume prompt — verify a completely clean session begins.
- [ ] Complete a full experiment — verify no resume prompt on next visit (session is cleared on `end` state).

---

## 8. Out of Scope

- Cross-device resume via a backend session store (requires a real backend implementation).
- Resuming from a different browser or incognito session.
- Partial response recovery (restoring unsaved form values from the current screen at the time of closure).
- Data encryption at rest in `sessionStorage`.

---

## 9. Open Questions

| # | Question | Owner | Resolution |
|---|---|---|---|
| 1 | Should `sessionStorage` (tab-scoped) or `localStorage` (persistent across tab closes) be used? | — | **Resolved:** Default is `sessionStorage`; researchers can opt in to `localStorage` via a `persistence?: { storage: "session" \| "local" }` field in `ExperimentFlow`. |
| 2 | Should the experiment config be versioned? What constitutes a breaking change that invalidates a saved session? | — | **Resolved:** Add an explicit `version` field to `ExperimentFlow`. Tooling (a CLI command or helper) will be provided to bump the version when researchers make structural changes — researchers should not manually construct version strings. A mismatch between the saved version and the current config triggers a clean restart with a warning. |
| 3 | Should participants be able to disable persistence (e.g., privacy-conscious users on shared devices)? | — | Open |
| 4 | What is the session TTL? After how long should a saved session be considered stale? | — | Open — proposed: 24 hours. |

---

## 10. Changelog

| Date | Author | Change |
|---|---|---|
| 2026-03-12 | — | Initial draft |
