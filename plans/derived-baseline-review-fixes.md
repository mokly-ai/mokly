# Derived Baseline Review Fixes

Status: Completed. [PR #70](https://github.com/mokly-ai/mokly/pull/70)
merged on 2026-09-15. [Review Fix Follow-ups](./review-fix-followups.md)
fixes the four findings of its review.

## Summary

Address three findings from the
[derived baselines](./derived-baselines.md) review chosen by the user:

1. A derived rebuild can run inside the HTTP server child through the
   unselected comparison route, because `runReview` and two sibling entry
   points construct a build-capable repository when none is injected.
2. A completed rebuild is deleted by the builder's own error path when
   cleanup fails or cancellation lands after the completion marker is written.
3. The README quick start opts consumers into derived mode before the trust
   statement.

Findings 3 to 11 of that review remain recorded for later decisions and are
out of scope here. The fixes are backend and documentation only; no mockup or
UI work is involved.

Protocol owner: [derived baselines](../docs/protocol/mokly-derived-baselines.md).

## Milestone 1: Build capability as a type — completed

Make "may rebuild a baseline" a capability that HTTP-side code cannot obtain,
and restore the unselected comparison route in derived watched Serve by
handing the child a read-only repository from the parent.

- [x] Split the repository type in `src/review/repository.ts`:
      `PreparedReviewRepository` carries the pinned commit, evidence, reader
      and completion marker and is constructible only by the CLI composition
      root and the Serve parent; `ReadOnlyReviewRepository` carries evidence
      and a reader only. Every function reachable from the HTTP child accepts
      the read-only type.
- [x] Delete the `??= prepareReviewRepository(...)` fallbacks in
      `src/review/run.ts`, `src/server/changed.ts` and
      `src/server/component_changes.ts`; callers inject a repository. Keep
      committed-mode construction of a Git-blob reader available to the child
      through a read-only factory.
- [x] Parent-to-child handoff: after a rebuild completes and on every merge
      base move, the parent sends the pinned commit to the child over the
      existing generation message. The child builds a read-only repository
      over the cache through `baselineReaderForCommit` and passes it to
      `configuredServedReview`. Before the first completion the child has none
      and the unselected route returns a typed `review-invalid` error whose
      message says the comparison is not prepared; no command is spawned.
- [x] Tests: the child serves `/__mokly/diffs/review.json` without `route`
      in derived mode with `CachedBaselineBuilder.prototype.build` mocked to
      throw; the child swaps readers when the merge base moves; the child
      factory module has no import path to the builder; committed-mode
      behavior is byte-identical.
- [x] Update `docs/protocol/mokly-derived-baselines.md` (Serve And Watch)
      and `src/review/README.md` / `src/server/README.md` to describe the
      typed capability and the IPC handoff.
- [x] Run format, lint, typecheck, `npm test`, `npm run example:check`,
      browser tests, `cargo xtask check`; commit and push.

## Milestone 2: Publish before cleanup — completed

Make adoption a committed step that cleanup and cancellation cannot undo.

- [x] In `src/baseline/rebuild.ts`, restructure `prepare` so writing the
      completion marker is the commit point: set the adopted state immediately
      after the marker write and return the result from that step. Cleanup and
      lock release become separate post-steps that cannot fail the build.
- [x] Make `cleanupBaselines` tolerate per-entry failures: catch errors from
      stat, lock, rename and remove for each victim, record them, continue,
      and report them through the progress observer or stderr without
      throwing.
- [x] Move the post-adoption `assertBaselineActive` check: cancellation after
      the marker is written completes the build with the cached result and
      skips cleanup.
- [x] Tests in `tests/baseline_rebuild.test.ts` and `tests/baseline_cleanup.test.ts`
      using the existing fake
      filesystem: cleanup rename failure keeps the marker and output; abort
      signalled between marker write and cleanup returns a completed baseline;
      concurrent removal of a victim entry during cleanup does not fail the
      build.
- [x] Also cover root listing, victim stat/lock/remove, and active lock-release
      failures; preserve successful progress and prove cleanup continues.
- [x] Update the Rebuild Procedure and Cache Layout sections of the protocol
      to state the commit point and best-effort cleanup.
- [x] Run gates, commit and push.

## Milestone 3: README quick start shows the default — completed

- [x] Remove `generatedOutput: "derived"` from the first `defineConfig`
      example in `README.md`; keep the derived example only in its dedicated
      section with the trust statement and ignore rules.
- [x] Validate Markdown, commit and push.

## Milestone 4: Review — completed

- [x] After the final push, review the complete local diff against
      `origin/main` using `docs/implementation-review-prompt.md`. Report
      numbered findings with severity, context, impact, lettered options and a
      recommendation. Do not change the implementation.

Review outcome: four findings were reported to the user without changes (one
medium, three low). The medium finding is that the committed-mode Serve paths
no longer reach the check that `repoRoot` is the Git top level, and the test
named for that check now passes for an unrelated reason. Each finding is
awaiting the user's decision.
