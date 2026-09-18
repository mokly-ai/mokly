# CI Performance

## Status And Outcome

Status: implementation in progress. The implementation PR's merge is the completion boundary;
keep this plan in the active index until then.

Reduce the time to `Required CI` success while exercising the complete existing
verification contract. Start with independent jobs and four shards per large
suite, then reduce repeated preparation and enable npm download caching.
The initial target is 6–10 minutes with sufficient runner capacity; this is an
estimate to validate on the implementation PR, not a measured result.

This change covers repository verification, CI configuration, test fixtures,
and their documentation. It requires no product UI or mockup work. Release
publication and preview deployment behavior remain outside the change.

Contract owners:

- [CI and npm release](../docs/protocol/npm-release.md).
- [Dependency security](../docs/protocol/dependency-security.md).
- [Local verification](../xtask/README.md).
- [Developer setup and fixture isolation](../README.md#developer-setup).

## Measured Baseline

The [main run on 18 September 2026](https://github.com/mokly-ai/mokly/actions/runs/35364820627)
took 32m43s. Its slowest job, Node 22.14, spent:

| Phase                                                    | Elapsed time |
| -------------------------------------------------------- | ------------ |
| `npm test`, including preparation; 1,807 tests           | 13m06s       |
| `npm run test:browser`, including preparation; 452 tests | 14m54s       |
| Package checks and five packed-consumer smokes           | 2m18s        |
| Dependency and Chromium installation                     | 36s          |

A [successful PR run](https://github.com/mokly-ai/mokly/actions/runs/35360449325)
took 31m19s, with similar unit and browser phases on Node 24.
The test counts describe those runs; future coverage checks must use current
discovery rather than hardcoded counts.

`xtask/src/check.rs` invokes the suites sequentially. Node test-file concurrency
is two; Playwright uses one worker and file-level execution. These limits
protect subprocess-heavy fixtures. Browser logs also contain roughly 113–115s
gaps before the first tests in `design_library_export.spec.ts` and
`static_example.spec.ts`; measure their setup and teardown directly before
attributing the entire gap to a particular operation.

## Target Verification Layout

Use a shared repository gate followed by independent jobs in fresh checkouts.
Keep the complete local and release entrypoint as `cargo xtask check`.

| Gate             | Runtime / fan-out                | Responsibility                                                                                                      |
| ---------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Repository       | Node 24, one job                 | Live workspace audit first, formatting, lint, Rust formatting/Clippy/tests, Rust file-length audit                  |
| Package          | Node 22.14.0 and 24, two jobs    | Build, declarations/typecheck, derived example check, package inspection, real packing and all five consumer smokes |
| Unit/integration | Both Node runtimes × four shards | Prepare package/example, run every test file once per runtime with concurrency two                                  |
| Browser          | Both Node runtimes × four shards | Prepare package/example, install Chromium, run every browser test once per runtime with one worker                  |
| Native platforms | macOS and Windows, two jobs      | Existing export transaction, destination-race, CSS parser/diff and baseline/process-tree checks                     |
| Required CI      | One stable aggregate             | Require successful repository, package, every shard and both native platform jobs                                   |

All verification jobs depend on successful repository checks, including the
live audit. Each job owns its writable outputs; suites never share a live
checkout. Build inside each job initially: cross-job build artifact transfer is
unnecessary for the measured setup cost. This layout has up to twenty
verification jobs after the repository gate; record actual runner limits and
queue time when evaluating speed and cost.

Expose `cargo xtask check --suite repository|package|unit|browser`; omitting
`--suite` runs the complete gate sequentially in one checkout. Accept
`--shard INDEX/TOTAL` only with `unit` or `browser`. Explicit suite selection is
partial verification; only the default command or the complete CI aggregate
claims full verification.

Use [Node's `--test-shard`](https://nodejs.org/download/release/v22.14.0/docs/api/cli.html#--test-shard)
and [Playwright's `--shard`](https://playwright.dev/docs/test-sharding).
Keep `fullyParallel: false`, current worker limits, assertion deadlines, and
zero browser retries. Partition whole files and use measured durations to
identify imbalanced shards before considering a different partition strategy.

## Milestone 1: Specify verification ownership and acceptance — completed

Define the complete contract before changing executable verification.

- [x] Add a focused `docs/protocol/ci-verification.md` describing the gate table,
      suite/shard CLI, prerequisite ordering, test inventories, artifact ownership,
      cache behavior, failure semantics, and measurement procedure. Clearly mark
      the target as pending until the corresponding implementation lands.
- [x] Link it from `docs/protocol/README.md` and `npm-release.md`; update the
      security contract to assign the live workspace audit to the shared CI
      prerequisite while preserving audit-first local/release verification and
      the separate freshly resolved packed-consumer audit on both runtimes.
- [x] Map every command and side effect in `xtask/src/check.rs`,
      `xtask/src/cli.rs`, npm scripts and native-platform jobs to a target gate.
      Include the file-length auditor executed outside the command list.
- [x] Specify cold-build and cold-install coverage, prepared-output lifetime,
      cancellation, cleanup, and fail-closed handling of missing reports or
      failed, skipped, and cancelled jobs. Cache hits never replace an audit.
- [x] Record the baseline run links, phase timings, runner availability and
      cost measures to compare. Keep README and xtask guidance accurate as each
      later milestone lands; the root README already links to the plans index.
- [x] Validate changed Markdown, local links and the contract diff.

## Milestone 2: Add reusable verification suites and preparation — completed

Deliver independently callable suites while the existing CI and release
workflows continue to use the complete local command successfully.

- [x] Add failure-first regression coverage for suite selection, missing and
      invalid shard arguments, sharding an unsupported suite, subprocess error
      propagation, audit-first ordering, and complete-gate coverage. Use unimock
      at the Rust command-runner boundary and keep tests outside source files.
- [x] Implement the suite/shard CLI and common gate definitions in xtask.
      Derive both the complete command and suite commands from those definitions
      so CI cannot silently lose a check as local verification evolves.
- [x] Separate package/example preparation from commands that consume prepared
      output. Existing public npm test/typecheck/browser entrypoints must still
      work from a clean checkout. Suite invocations prepare their own outputs;
      internal prepared commands document prerequisites and fail when missing.
- [x] Reuse prepared output within a suite invocation to remove redundant
      top-level builds. Preserve builds intentionally exercised by prepack,
      historical reconstruction, clean installation and startup regressions.
- [x] Inspect and smoke-test the same CLI/viewer tarball pair within the package
      gate, using the existing artifact-input support where appropriate. Retain
      real prepack behavior, both package allowlists/licenses, all five consumers,
      their production audit, and the release workflow's exact-artifact checks.
- [x] Add test-file inventory and timing output for Node shards and browser test
      inventory/reports. Prove disjoint shard assignments and complete union per
      runtime against current unsharded discovery; reject empty/missing shards.
- [x] Run focused xtask and package regressions, clean-entrypoint smokes, all
      suite commands and the complete `cargo xtask check`. Update documentation
      for the now-implemented CLI and preparation behavior.

Local evidence: all 10 xtask tests, root TypeScript checking, focused workflow,
evidence, process, reporter and fixture regressions, package inspection, and all
five packed-consumer scenarios pass. The final complete gate also exercises the
repository, package, unit and browser suites successfully from one checkout.

## Milestone 3: Parallelize CI and enable dependency caching — completed

Deliver the target job graph with every existing verification boundary required.

- [x] Add workflow regressions before changing `.github/workflows/ci.yml`.
      Update `tests/release.test.ts` and `tests/deployment.test.ts` to check gate
      coverage and prerequisites rather than two monolithic job names. Cover
      both runtimes, every shard, native tests and stable `Required CI` naming.
- [x] Implement the repository gate and package, unit, browser and native jobs
      from the target table. Use npm 11.7.0, Rust 1.95.0, immutable action pins,
      read-only permissions and existing superseded-run cancellation. Every
      job requiring baselines or `origin/main` receives full Git history.
- [x] Configure four unit and four browser shards per Node runtime, with
      `fail-fast: false`. Install Chromium only for browser jobs. Keep Rust
      checks in the repository gate; suite jobs only need the xtask toolchain.
- [x] Enable explicit `cache: npm` in read-only CI jobs using the committed
      lockfile; include the resolved baseline lockfile where historical installs
      occur, following the existing PR-preview cache pattern. Run `npm ci`
      regardless of cache hits and preserve native optional packages.
- [x] Cache npm downloads only. Preserve intentionally isolated clean-cache
      consumer tests and release publishing's cache/permission boundary. Treat
      a missing cache as an ordinary install, never as permission to skip work.
- [x] Make the always-running `Required CI` aggregate reject every unsuccessful
      prerequisite. Verify failed, skipped, cancelled and missing-result cases,
      including incomplete shard evidence. Give artifacts unique runtime/shard
      names and retain browser failure traces plus test/timing reports.
- [x] Validate YAML and action expressions, run workflow regressions and every
      gate locally, and update protocol status and READMEs to match the workflow.

Local evidence: actionlint passes, and `cargo xtask check` exits successfully on
Node 24.14.1. Its complete unit report covers 351 files and 1,851 passing tests
in 414.45s; its complete browser report covers 86 specs and 454 passing tests in
673.39s. Both reports are complete with zero failures, skips, cancellations or
reporter errors. Hosted workflow acceptance remains in Milestone 5.

## Milestone 4: Reduce repeated read-only fixture preparation

Reduce setup work through reusable test fixtures while preserving independent
mutation, historical-build and publication lifecycle coverage.

- [x] Measure install, build, baseline and export preparation separately for
      the two slow export specs and `tests/browser/preview_fixture.ts`; record
      which operations are themselves the behavior being tested.
- [x] Add regression coverage for fixture isolation, cleanup on setup failure,
      repeated consumers and output freshness before introducing reuse.
- [x] Extract a worker-scoped ordinary-preview fixture for read-only navigation
      and design-link specs so they can consume one prepared artifact. Keep
      mutable state and writable outputs local to the worker/job and close all
      servers and child processes at teardown.
- [x] Preserve dedicated coverage that really runs preview preparation and
      checks generated-output stability. Historical rebuild, source mutation,
      missing-source export, clean-install and cache-invalidation tests retain
      independently prepared inputs; optimize only work outside those contracts.
- [ ] Run affected specs individually, together and on their assigned shards.
      Compare preparation timings and document the fixture ownership in the
      developer README and verification protocol.
- [x] Reproduce the hosted unit-shard preview publication race, identify the
      exact concurrent fingerprint mutation, add failure-first coverage, and
      isolate the static preview snapshot without reducing concurrency or cold
      build and publication coverage.
- [ ] Prevent Node test-runner loader and concurrency flags from reaching the
      compiled watched-child fixtures, retain the existing startup bound, and
      confirm both affected unit shards on the hosted runtimes.
- [x] Remove the browser preview fixture's port-selection race by letting
      Wrangler bind an operating-system-selected port, then verify the reported
      endpoint without retries or relaxed startup deadlines.

Local evidence: all five affected specs pass individually; the shared
navigation/design-link pair passes 13 tests in 43.2s; prepared browser shard 4
passes with one ordinary export (14.15s) and serve (1.25s). The dedicated cold
preview preparation takes 27.43s plus 1.25s to serve and preserves the generated
digest. Design/static historical fixtures record 6.8–7.1s installs, 14.8s
builds, about 23s baselines, and about 94s full exports; nested phases are not
additive. Hosted CI remains responsible for assigned shard 2 (design export)
and shard 3 (cold preparation and static export) evidence.

Follow-up local evidence: the nested Playwright harness was proven to write the
root `test-results/.last-run.json`, reproducing the publication failure with the
preview test alone at concurrency two. Explicit harness output ownership makes
that pair pass 3/3 on Node 22.14.0 and 24.14.1. The compiled-child regression
pair passes 4/4 on both runtimes with inherited execution flags absent. The
Wrangler fixture passes its injected readiness tests and a real port-zero smoke,
serving the expected catalogue over the reported endpoint before clean shutdown.
Hosted confirmation of the corrected shards remains pending.

## Milestone 5: Validate, measure, commit, push and review

Collect all acceptance evidence on the implementation branch before merge.
Mark completed milestones as work lands and keep this plan active until the
implementation PR merges; arrange the index transition as part of that merge.

- [ ] Run relevant regression suites with a 100% pass rate, Rust formatting,
      Clippy, file-length checks and `cargo xtask check`. Fix implementation
      failures and validate all updated Markdown and protocol links.
- [ ] After those checks pass, commit and push an implementation candidate to
      run the real PR workflow. Exercise both Node runtimes and native platforms,
      verify shard inventory completeness, audit gating, reports, cancellation
      and the `Required CI` result. All smoke tests run before merge.
- [ ] Compare at least two successful hosted runs of the same candidate SHA:
      one with fresh workflow npm caches and one with cache restoration. Record
      total elapsed time, queue time, slowest shard, suite/setup durations, test
      inventories and total runner minutes. Isolated clean-cache test cases
      remain cold in both runs.
- [ ] Evaluate the 6–10 minute target using that evidence. Address measured shard
      imbalance or avoidable preparation and repeat affected checks if needed;
      document runner-capacity limits and cost tradeoffs without reducing test
      coverage, relaxing assertions or adding retries to hide failures.
- [ ] Record the final evidence in this plan, align docs with the delivered
      behavior and inspect the complete diff and deletions against `origin/main`.
      Run `cargo xtask check` again if implementation changed after its last pass;
      validate Markdown and the diff for documentation-only evidence updates.
- [ ] After checks pass, run `git add -A`, commit all completed work with
      Conventional Commits and push the current branch, including every new
      source, test, documentation and report-support file in the review diff.
- [ ] Only after that push, use
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main`. Report numbered
      findings with severity, feature context, impact of doing nothing, lettered
      solution options and a recommended scope. Do not change the implementation
      or automatically fix review findings.
