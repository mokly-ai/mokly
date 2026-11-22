# Serve Base Attempts Prepare Their PostCSS Context

Status: Active. On branch `calummoore/mokly-earlier-postcss-start-bdhv`, no pull request yet. The pull request that completes the work deletes this plan, as the `plans` skill says.

Since #470, Serve prepares the PostCSS context of each head attempt, so the
pool sends `prepareContext` directly after the head `hello`. The base side of
a Changes classification prepares no context. Its child forks only at the
first base `processCss` request, and that request waits for the child: about
340 to 540 ms of each first Changes in warm sessions of `examples/basic`.
This change makes each base graph preparation of a Serve classification a
base attempt that prepares its context. The pool then sends its
`prepareContext` request directly after the base `hello`, before the seed and
the `bundle` request, with no pool or sidecar change. `build`, `publish`, and
every head attempt keep their rules, and a head attempt can never take the
base rule. No output changes.

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

Contract owners:

- [Prepared contexts](../docs/protocol/mokly-sidecar-postcss.md#prepared-contexts).
- The [render crate README](../crates/mokly-render/README.md).

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

- [ ] Run the targeted tests and the complete gate named in `AGENTS.md`.
- [ ] Prove equal served bytes of `examples/basic` with Changes against
      `main`.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the fix rule: fix the `fix now` findings, record
      follow-up items under `plans/follow-ups/` for the rest, re-review
      once, and report.
- [ ] Send the final product SHA to the performance orchestrator for its
      official gate.
- [ ] Delete this plan when the `plans` skill says, under "Deleting the
      plan".
- [ ] Open the pull request. Its description gives the decisions and the
      design calls of this plan with their dates, a permalink to this plan,
      and the follow-up items that the change adds.
