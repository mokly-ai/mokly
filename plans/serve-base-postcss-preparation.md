# Serve Base Attempts Prepare Their PostCSS Context

Status: Active. On branch `calummoore/mokly-earlier-postcss-start-bdhv`, no pull request yet. The pull request that completes the work deletes this plan, as the `plans` skill says.

Since #470, a Serve head attempt can prepare its PostCSS context through its
`bundle` request: a startup attempt, and a later attempt that keeps a stale
PostCSS stylesheet bundle. The pool then sends `prepareContext` directly after
the head `hello`. The base side of a Changes classification prepares no
context. Its child forks only at the first base `processCss` request, and that
request waits for the child: about 340 to 540 ms of each first Changes in
warm sessions of `examples/basic`. This change makes each base graph
preparation of a Serve classification a base attempt. A base attempt with a
`bundle` request prepares its context, so the pool sends its `prepareContext`
request directly after the base `hello`, before the seed and the `bundle`
request. A CSS-only base sends no `bundle` request, so its child still starts
at its first `processCss` request. The eager pool path now binds a prepared
`bundle` request to its process too, so the first base stylesheet reaches the
prepared child. `build`, `publish`, and every head attempt keep their rules,
and a head attempt can never take the base rule. No output changes.

Decisions, all by the performance orchestrator under the delegation of the
user:

- 2026-11-22, item 12: B, a base-side preparation, first as a throwaway
  prototype. Alternatives: change nothing (A), and B only with one or two
  sidecars (C), the fallback if only the four-sidecar memory check failed.
  Left out: a start at the base `bundle` request, which gains less at the
  same protocol cost, and a start only after a base cache miss, which the pool
  cannot know before `prepareContext`. Reason: it removes the measured wait,
  and the projected memory peak does not rise.
- 2026-11-22, item 13: A, the protocol text as proposed, with the two removed
  sentences that repeat facts with a home elsewhere. Alternative: B, which
  also blocks a base preparation while an older used head context of the same
  Mokly configuration is live. Reason: A is the measured behaviour, and
  `main` already keeps the base child live beside the head child of each
  edit.
- 2026-11-22: the "seed hit only" variant, which sends the base
  `prepareContext` only after a bundle cache hit, is not needed.
- 2026-11-22: the official check of the prototype passed every speed and
  memory part, but its `serve.ready` guard failed three times at +30 ms with
  no mechanism found. Decision: implement B in its final form and check first
  that a Serve head attempt never takes the base rule, with a red test that a
  head attempt keeps today's preparation result. The final SHA gets a full
  official gate against an unpatched build of the same `main`, made the same
  way, with its rules written before the data:
  - `examples/basic`, 2 sidecars, 8 warm pairs: `serve.ready` within +30 ms,
    and first Changes at least 100 ms faster with at least 6 of 8 pairs
    faster.
  - `examples/basic`, 2 sidecars, 4 cold pairs: first Changes faster on the
    mean, and the whole-tree peak within +2%.
  - `examples/basic`, 4 sidecars, 4 cold pairs: the whole-tree peak within
    +2%.
  - mokly-cloud, 8 warm restarts: `serve.ready` within +30 ms.
  - If the gate fails, B closes with a closed experiment record that holds
    every number of both machines.

Design calls, my own:

- 2026-11-22: an explicit mark. `Runtime::for_base` records whether the
  runtime that makes the base runtime is a Serve head under the existing
  `serve_head` rule: stylesheet watching and no base markers. A base attempt
  needs that mark, base leases, and the base stylesheet marker. A head runtime
  has no base stylesheet marker, so it can never take the base rule, whatever
  its other fields hold. Rejected: the prototype's test of base leases and the
  document store, because a head runtime that held both would take the base
  rule.
- 2026-11-22: a base attempt skips the stale-bundle check and the
  older-head-context check, under the approved text. The head checks keep
  their order, because the stale-bundle check records a probe key.
- 2026-11-22: `build` and `publish` keep no preparation on both sides,
  because nobody measured them, and their head side prepares none.
- 2026-11-22: the tests are unit tests of `describe` over a mocked pool,
  because the rule decides only whether the `bundle` request carries a
  preparation. The pool tests already cover the order of `prepareContext`
  for each prepared `bundle` request.
- 2026-11-22: the byte proof covers Serve of `examples/basic` with Changes,
  the only PostCSS fixture. A catalogue without PostCSS, `build`, and
  `publish` prepare no context, so the change cannot reach their bytes.
- 2026-11-22: no options check ran over the decisions, because the user
  answered each of them before this plan existed.
- 2026-11-22, review finding 14: both admission paths of the pool bind the
  PostCSS context of a call to its slot when they select the slot, through
  one helper, and the eager claim reads the context through
  `Call::postcss_context`. Before, the eager path bound only a `processCss`
  context. So a prepared `bundle` request on the eager path left its context
  without a process, and the first base stylesheet could reach another idle
  process of the base root and start a second child. Rejected: one record at
  execution, because a second request of a context must wait for the slot of
  the first one from the selection on. The scheduling test "a render uses an
  idle slot while an earlier affine call waits" checks that, and it failed
  with the record at execution.
- 2026-11-22, review finding 15: the base decision line of the protocol names
  a base attempt with a `bundle` request, and the plan texts say the same.
  The words restate the unchanged rule that only a `bundle` request carries
  the preparation, so no requirement and no decision changes. A CSS-only base
  keeps its start at its first `processCss` request.
- 2026-11-22, review finding 16: the decision sentence about an unused child
  now says that a prepared child ends unused when no stylesheet of its
  startup or base attempt needs a `processCss` request. An attempt without a
  `bundle` request starts no child, so the old words were wrong for it. The
  new words restate the unchanged rule, so no requirement and no decision
  changes.

Contract owners:

- [Prepared contexts](../docs/protocol/mokly-sidecar-postcss.md#prepared-contexts).
- [Source root workers](../docs/protocol/mokly-sidecar-modules.md#source-root-workers),
  which places a prepared context in the process of its `bundle` request.
- The [render crate README](../crates/mokly-render/README.md) and the
  [sidecar crate README](../crates/mokly-sidecar/README.md).

## Milestone 1: Documentation and protocol

Depends on: none

The approved text defines base attempts and their rule.

- [x] Apply the approved text of "Prepared Contexts" in
      `docs/protocol/mokly-sidecar-postcss.md`, with the two removed
      sentences. The page stays at 250 lines.
- [x] Update the sentence of `crates/mokly-render/README.md` that names only
      the Serve head.

## Milestone 2: Red tests

Depends on: 1

- [x] A base graph preparation that a Serve head makes sends a `bundle`
      request with a preparation for its base context.
- [x] A base graph preparation that a static runtime makes sends none.
- [x] A head runtime that also holds base leases and the Serve document store
      keeps today's preparation result.
- [x] Record that the first test fails on `main` and the third test fails on
      the prototype. Evidence:
      `.context/serve-base-postcss-preparation/red-main.txt` and
      `.context/serve-base-postcss-preparation/red-prototype.txt`.

## Milestone 3: Base attempts

Depends on: 2

- [x] Add the Serve base mark to the runtime and the base rule to
      `describe`.
- [x] Run the red tests and the render crate tests green. Evidence:
      `.context/serve-base-postcss-preparation/green-final.txt` and
      `.context/serve-base-postcss-preparation/render-tests.txt`.

## Milestone 4: Verification, commit, review, and pull request

Depends on: every other milestone

- [x] Run the targeted tests and the complete gate named in `AGENTS.md`.
      The Repository, viewer, browser, and `cloud-fixtures` suites ran
      here. The other cloud suites and the native suite run in the CI of
      the pull request, because the change touches no cloud or native code.
      Evidence: the `gate-*.txt` files in
      `.context/serve-base-postcss-preparation/`.
- [x] Prove equal served bytes of `examples/basic` with Changes against
      `main`. Evidence:
      `.context/serve-base-postcss-preparation/serveproof-summary.md`.
- [x] Commit with Conventional Commits and push the branch.
- [x] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the fix rule: fix the `fix now` findings, record
      follow-up items under `plans/follow-ups/` for the rest, re-review
      once, and report. Two rounds ran. Findings 14, 15, and 16 are fixed
      in `bd098d8d3` and `0d0cc3650`, and none is open.
- [x] Send the final product SHA to the performance orchestrator for its
      official gate. Sent: `408eb5571`, which merges `main` `c699b35d3`.
- [ ] Delete this plan when the `plans` skill says, under "Deleting the
      plan".
- [ ] Open the pull request. Its description gives the decisions and the
      design calls of this plan with their dates, a permalink to this plan,
      and the follow-up items that the change adds.
