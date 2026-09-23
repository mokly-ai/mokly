# Local Verification Performance

Status: implementation delivered and reviewed; active until PR merge. Created
2026-09-23 at the user's request. This plan improves the local complete gate;
the existing [CI Performance](./ci-performance.md) plan owns the
already-delivered hosted fan-out. Plan creation changed no test or verification
behavior.

## Outcome And Boundaries

Reduce the wall time of a warm `cargo xtask check` on an eight-CPU development
machine while retaining its complete audit-first repository, package, unit, and
browser gates. Aim for 15 minutes or less; report the actual result even if the
target is missed. The unqualified command must verify the exact current working
tree, including staged, unstaged, and non-ignored untracked source files. Selected
`--suite`/`--shard` commands remain partial verification. The public npm test
commands and the two-runtime, four-shard CI aggregate retain their existing
coverage, bounded test deadlines, and fail-closed semantics.

No product UI, mockups, or test removals are in scope. Keep the present limit of
two simultaneous unit files _per test runner_, one Playwright worker _per browser
runner_, zero browser retries, and each test's independent assertions and
timeouts until isolation and measured stability justify a change. Never count
warm cache reuse, skipped cases, stale build output, or a CI result from a
different source revision as a speedup.

Contract owners: [CI verification](../docs/protocol/ci-verification.md),
[npm release](../docs/protocol/npm-release.md), the [xtask README](../xtask/README.md),
and the [developer README](../README.md#develop-mokly).

## Measured Starting Point

The successful local run at `8b7c5238` on 2026-09-22 took **39m01.054s**.
Its Node suite passed 2,236 tests in 419 files in **10m36.119s**; its browser
suite passed 686 tests in 108 specs in **25m16.450s**; the Rust suite passed
10 tests. The remaining **3m08.485s** includes preparation and other gates;
suite timings are nested inside the complete wall time, not additive overhead.
The ignored `.context/verification-reports/` artifacts retain per-file results.

The largest unit files were `tests/preview.test.ts` (293.918s, including two
real preview builds) and `tests/design_library_attribution.test.ts` (165.161s).
The largest browser specs were `react_shell_hydration_routes.spec.ts` (246.304s,
104 independent route tests) and `preview_preparation.spec.ts` (131.280s).
Applying today's native four-way shard assignments to the recorded durations
gives unit file-duration sums of 589/162/159/178 seconds and browser test-duration
sums of 219/629/89/154 seconds. These are **imbalance indicators, not predicted
shard wall times**: setup, teardown, test concurrency, and competing CPU work
are absent from those sums. The [historical hosted measurements](../docs/reviews/ci-performance.md)
used an older test inventory and must not be treated as a current local result.

## Milestone 1: Define The Local Verification Contract

Summary: specify the complete behavior and acceptance measurements before
changing tests or orchestration. The current gate remains functional.

- [x] Register this separate active plan in [the plan index](./README.md).
- [x] Update the CI verification protocol, splitting out a focused local-gate
      protocol if needed to keep protocol files short. Define audit-first
      sequencing, when independent gates may run concurrently, exact staged/
      unstaged/untracked source snapshots, Git history and `origin/main` access,
      isolated generated output and ports, source-drift detection, failure and
      cancellation cleanup, complete test-evidence aggregation, and how a
      fallback to sequential execution reports itself.
- [x] Specify how unit and browser shards retain dynamic one-time inventories,
      per-route hydration coverage, unchanged per-runner limits, and existing CI
      report identities; state what constitutes a complete local check versus a
      partial suite and how to fail closed on missing or stale evidence.
- [x] Update the protocol index, xtask README, and repository developer README
      with the supported workflow and its boundaries. Record repeatable warm
      and cold timing methods and the baseline in a focused performance record.
- [x] Validate Markdown and internal links, then review the documentation diff
      against the implemented contract before starting executable work.

## Milestone 2: Rebalance The Slow Test Files

Summary: redistribute genuine tests and remove only measured redundant fixture
work while preserving the behavior each expensive test proves. Every test still
runs and both unsharded suites stay usable after this milestone.

- [x] Add discovery/evidence regressions first: every current browser route
      must have its own test and timeout, each unit file and browser test must
      appear exactly once across four shards, and missing/duplicate reports
      must fail the existing aggregate.
- [x] Measure startup, per-test work, and teardown in the slow hydration,
      preview, and design-library files. Split the hydration route inventory
      into balanced independently discovered specs or another proven native
      partition; keep its real bundle preparation, clean-hydration assertions,
      and route-by-route error reporting. Benchmark any extra setup from splits.
- [x] Redistribute the two heavy unit files across shard assignments; split
      independent cases and reuse only proven immutable inputs. Keep both real
      preview builds if they independently prove repeatability. Do not hide
      work by changing assertions, fixture isolation, or test timeouts without
      isolated measurements that justify a bounded adjustment.
- [x] Give the real browser preview build a measured, finite deadline with
      enough margin for four-worker CPU contention; preserve the build and
      digest assertions and rerun it under the complete gate.
- [x] Stabilize the component-controls browser race exposed by the full gate:
      hold the actual first render response, release it after the new context
      renders, and verify obsolete results cannot replace the current preview.
- [x] Run focused tests before and after each change, then all four unit and
      browser shards. Check reported file/test unions and compare per-shard
      wall times rather than accepting similar-looking test counts alone.

## Milestone 3: Parallelize The Complete Local Gate Safely

Summary: retain the audit-first gate and run independent verified work in
isolated local snapshots; an ordinary dirty development checkout must be
checked as faithfully as a clean one. Keep `cargo xtask check` usable after
each change to the runner.

- [x] Write failure-first orchestration tests for audit-before-work, staged/
      unstaged/untracked source inclusion, Git baseline visibility, source
      mutation during verification, isolated outputs and ports, missing shard
      evidence, subprocess failure, abrupt cancellation, and cleanup that
      cannot delete another owner's files or processes.
- [x] Extend xtask's existing runner boundaries with a bounded local fan-out.
      Each worker gets its own complete source snapshot, generated output,
      `.context` artifacts, and browser port; compare snapshot content with the
      initiating checkout and reject drift. Preserve Git refs, original branch,
      and full history without changing the user's working tree.
- [x] Run the live audit before fan-out, retain all repository and package
      checks, and reuse existing unit/browser report validators to prove the
      complete discovered inventory. Stop admitting new work on failure,
      drain active workers, propagate the original error, and remove only
      verified owned temporary resources. Keep `--suite` and `--shard` semantics.
- [x] Register independently grouped verifier subprocesses with their owning
      ancestor, and test that cancellation drains them before snapshot removal.
- [x] Register Playwright's web server with the same owner before it listens;
      test its ancestor cancellation and verify no server survives a browser run.
- [x] Retain an incomplete failing shard report for diagnosis without counting
      it as successful evidence; cover retention with a regression test.
- [x] Smoke a clean and dirty working tree, an intentional failing shard, a
      conflicting port, and cancellation. Confirm no orphan server/process,
      changed tracked file, lost untracked file, or partial success report.

## Milestone 4: Measure, Verify, Deliver, And Review

Summary: prove a faster _complete_ gate on the same class of machine, document
the tradeoffs, and deliver the change for review without automatically fixing
review findings.

- [x] Run the relevant Rust and JavaScript tests, formatting, lint, typechecks,
      builds, package smokes, and browser smoke tests with a 100% pass rate.
      Run `cargo fmt --all -- --check`, workspace Clippy, and Rust tests after
      Rust changes; fix compile errors before continuing.
- [x] Run at least two successful warm `cargo xtask check` invocations on the
      same eight-CPU machine; capture wall time, per-suite/shard timings, all
      discovered and observed test counts, peak load, and cold setup cost
      separately. Compare against the 39m01s baseline, investigate instability,
      and record the measured result and any remaining bottleneck even if the
      15-minute goal is missed. Verify the existing CI shard inventory on both
      Node runtimes before declaring full CI compatibility.
- [x] Stabilize the merged-tree preview fixture's measured five-minute setup
      timeout without loosening other fixture or browser-assertion deadlines;
      rerun its real build and both complete warm gates after the adjustment.
- [x] Integrate the newer `origin/main` changes without losing its package,
      CLI, CI, or appearance features; verify the final merged test inventory,
      rerun all checks and two warm complete gates on the combined source, and
      record those results separately from the pre-integration measurements.
- [x] Update the protocol and READMEs for the actual implementation, review
      every touched doc and the complete diff against `origin/main`, and verify
      that no unrelated or generated files are staged.
- [x] After every check passes, run `git add -A`, commit all authored files
      with a Conventional Commit, and push the current branch.
- [x] **After the push only**, use
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main`. Report numbered
      findings with severity, plain-language context and impact of doing
      nothing, lettered solution options, and a recommended scope; make no
      automatic fixes.
