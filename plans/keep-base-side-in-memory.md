# Keep The Base Side In Memory Between Edits

Status: Active. On branch `conductor/perf-6-keep-the-base-side-in-memory-between-edits`,
no pull request yet. The pull request that completes the work deletes this
plan, as the `plans` skill says. The plan waits for the user's answers to the
open decisions below.

Serve's Changes compares the working tree, the head, with the merge base of
`HEAD` and `review.base`. Each classification prepares the base side again.
It loads the base configuration and discovers the base sources. It bundles
and describes the base entries in the sidecar pool, prepares the base render
graph, and captures every base document. After an edit the merge base stays
the same, so this work repeats for the same commit. On 2026-10-30 on this
machine, the base side took 9.7 s of the 15.4 s classification after an edit.
Edit to the end of the second classification took 22.1 s. The task's
baseline machine measured 5.0 s and 11.5 s. The evidence is in
`.context/keep-base-side-in-memory/baseline.md`.

Serve keeps the last prepared base side in memory: the captured base
generation with its render graph, its source-failure record, and its leases.
A classification reuses it while the key and the freshness checks of
decision 1 hold. The key is the merge-base commit, the working configuration,
and the effective install-scripts setting. A reuse runs no base configuration
load, discovery, validation, graph preparation, or capture. Build keeps
nothing. The plan does not cover a disk copy of the capture or the bundle
disk cache of perf 7. It also does not cover a separate base render pool or
the per-head merge-base cache.

User decision, recorded on 2026-10-30 from the task message: option A of
finding 2 of the 2026-10-27 performance profile. Keep the prepared base
generation in the Serve process, and reuse it while the merge base and its
inputs stay equal. Rejected: option B, which also persists the capture to
disk for the next start. A persisted capture needs a new versioned format,
and perf 7 caches the bundle on disk separately.

Design calls, my calls on 2026-10-30:

1. A reuse publishes no `preparing` status and no second `pending` status.
   The [Changes contract](../docs/protocol/mokly-changes.md#changes-in-serve)
   gives `preparing` only while base sources extract and dependencies
   install. Each publication took about 1 s here.
2. The configuration part of the key is a digest of the serialized `Config`
   with the file, the roots, and the authored inputs. Any adopted
   configuration change prepares the base again.
3. Serve keeps one base. A classification with another key releases it
   before it prepares a new one, so the peak stays at one base.
4. Serve keeps no base after a base error or a source failure. It keeps no
   base with a `base-conversion` warning, because the
   [base cache contract](../docs/protocol/mokly-base-cache.md) runs the
   filters again in a later preparation. It keeps no tier-3 base that fell
   back for a retryable reason. These reasons are a failed install, the time
   limit, a cache failure, and the cache size limit.
5. Serve keeps a tier-3 base that fell back for a lasting reason, such as an
   unsupported manager. A manager that the user installs during the session
   takes effect when Serve prepares the base again.
6. A kept base keeps the checkout conversion of its preparation. A change of
   the effective Git attributes takes effect at the next preparation.
7. A reuse captures nothing again. It hands the kept capture to the
   comparison through a per-classification reader. That reader follows the
   wrapper rule of `RenderGeneration::comparison_capture`.
8. A reuse that meets a changed frozen resource, or a bundle reload that
   fails, releases the kept base. The classification then prepares once more.
9. Serve also reuses a base whose capture did not fit. Its uncaptured views
   render through the kept graph, as the comparison does today.
10. A failed reference lookup keeps the base until the next successful
    classification or Serve's stop.
11. `review.base-tree` carries `action`, `reuse` or `prepare`. A reuse
    emits no `review.base-extraction`, `review.base-dependencies`, or
    `review.capture-side` span.
12. The lifetime rule lives in the
    [base preparation contract](../docs/protocol/mokly-base-preparation.md).
    `mokly-runtime.md` has 249 lines against the cap of 250, so it changes
    sentences without net new lines.
13. Code that does not fit the 300-line cap of a scoped file goes to a new
    module beside that file.

### Corrections to the task text

The task text came from a reading of `main` at `f93afcea`. These points
differ from the code:

1. The base side has no pool of its own. A base request switches one pool
   worker to the base source root. The pool stops a head worker and spawns
   one there. The trace shows `sidecar.recycle` with `reason: "root-switch"`.
2. The provider does not capture. `Changes::classify` captures the base
   after the provider returns (`crates/mokly-compare/src/base_render.rs:191`).
3. `review.base-tree` also holds two status publications and the extraction
   lease. `PreparingDependencies` publishes `preparing`
   (`crates/mokly-cli/src/serve_changes_base.rs:78`), and `AttemptBase`
   publishes `pending` again (line 113). Each rebuilds the index and 240
   entry details. `review.base-extraction` takes 0.3 s here.
4. Tier 1 is not the only working-tree input. An HTML-only base reads package
   stylesheets through the working dependency tree. Its `base-dependencies`
   warning compares working manifests (`crates/mokly-cli/src/changes_base.rs:202`).
5. This machine is 1.6 to 1.9 times slower than the baseline machine. Here
   the classification after the edit takes as long as the first one.
6. `docs/protocol/mokly-runtime.md` has 249 lines against the cap of 250.

### Scope additions

- `crates/mokly-cli/src/serve_delivery.rs` constructs `ServeChanges`, which
  gets the kept-base slot. One line.
- New modules beside the scoped files, under design call 13.
- The pages that milestone 1 names.
- Only under some options:
  - `crates/mokly-render`, for decision 1, option F.
  - The watch code, for decision 1, option D.
  - `crates/mokly-compare/src/git_failures.rs`, for decision 2, options C
    and D.
  - `entry_serve.rs` and `serve_lifecycle.rs`, for decision 4, option B.

Contract owners:

- [Base preparation](../docs/protocol/mokly-base-preparation.md),
  [runtime](../docs/protocol/mokly-runtime.md),
  [comparison serving](../docs/protocol/mokly-comparison-serving.md),
  [selected comparisons](../docs/protocol/mokly-selected-comparisons.md),
  and [timings](../docs/protocol/mokly-timings.md).
- The [CLI README](../crates/mokly-cli/README.md) and the
  [compare README](../crates/mokly-compare/README.md).

## Open decisions

The message to the user gives each decision in the `decisions-and-findings`
layout. Record each answer here with its date. The options check of
2026-10-30 is in `.context/keep-base-side-in-memory/options-check.md`.

Each decision stays open until the user answers it. Silence is not approval.
Apply no option of an open decision, and start no milestone that depends on
it.

1. When does a kept base still give the result of a fresh preparation, when
   it reads files of the working install? Severity High. Recommended: C.
   - A. Check the dependency selection again before each reuse. Medium.
   - B. A, and compare the install records of the working `node_modules`
     roots. Medium.
   - C. B, and compare the base bundle's installed-module digests with the
     current head bundle's. Medium.
   - D. A, and release on a head watch event below a used dependency
     directory. Medium, outside the scope.
   - E. C, and digest again every file that the base read through the
     working dependency reader. Large.
   - F. B, and re-check the bundle and stylesheet input stamps of the base
     runtime in `mokly-render`. Large, outside the scope.
2. How do a replaced classification and a cancelled selected capture stop
   promptly on one kept base, and leave it usable? Severity High.
   Recommended: B.
   - A. Release the kept base after any cancelled read. Small.
   - B. Detach at keep, with a reader that checks each call. Large.
   - C. B, and a cancelled Git read records no source failure, so one
     capture scope can stop a read in flight. Large, outside the scope.
   - D. A shared reader scope over the kept base. Large, outside the scope.
3. What must Serve keep so that a reuse needs no preparation and no capture?
   Severity Medium. Recommended: A.
   - A. The captured generation with its graph, sources, leases, and bundle
     generation. Small.
   - B. The capture and the catalogue only. Large, outside the scope.
4. When must Serve give up the kept base? Severity Medium. Recommended: A.
   - A. On the base events, and at stop when the last Serve state drops.
     Small.
   - B. A, and in the release step of the shutdown order. Medium, outside
     the scope.
5. What changes for a background ref refresh and the render pool follow-up?
   Severity Low. Recommended: B.
   - A. Change nothing in `plans/follow-ups/background-base-render-pool.md`.
     Small.
   - B. Update its text. Small.
   - C. Do the follow-up in this branch. Large, outside the scope.

The base events are these:

- a merge-base move or another key change,
- a failed freshness check,
- a base error or a source failure,
- a fallback that design call 4 does not keep.

## Milestone 1: Documentation and protocol

Depends on: the answers to the open decisions

The docs implementor writes the contract. Each changed page gets the status
line of the repository rules until milestone 6.

- [ ] `docs/protocol/mokly-base-preparation.md`: add a Serve base lifetime
      section. It states what Serve keeps, the key, and the freshness
      checks. It also states the cancellation rule, the release events, and
      the memory bound. It gives the decisions in force with their rejected
      options.
- [ ] `docs/protocol/mokly-runtime.md`: Serve keeps the base capture between
      classifications. Free two lines for the status line.
- [ ] `docs/protocol/mokly-comparison-serving.md` and
      `mokly-selected-comparisons.md`: one kept capture instead of one for
      each classification, and the stop rule of decision 2.
- [ ] `docs/protocol/mokly-timings.md`: the spans of design call 11. Perf 7
      also edits this page.
- [ ] Align `docs/protocol/mokly-changes.md`, `mokly-watch-runtime.md`,
      `docs/architecture/rust-core.md`, `crates/mokly-cli/README.md`, and
      `crates/mokly-compare/README.md`.
- [ ] Update `plans/follow-ups/background-base-render-pool.md` under
      decision 5.
- [ ] Run `npm run format:check`, the Markdown link test, and the protocol
      length check.

## Milestone 2: Reuse contract in mokly-compare

Depends on: 1

The `non-ui implementor` adds the reuse path to `Changes::classify`. The new
provider methods keep nothing by default, so Build does not change.

- [ ] `BaseProvider` gets three default methods. They find a kept base for
      the pinned commit, keep a captured base with its source-failure
      record, and release it.
- [ ] `Changes::classify` asks for a kept base before it creates sources. A
      reuse skips sources, preparation, and capture, and compares at once.
- [ ] A fresh preparation keeps the base after its capture succeeds. The
      base events of design call 4 release it.
- [ ] `review.base-tree` records `action`.
- [ ] Update the strict provider mocks of the existing tests.
- [ ] Test: two classifications through one provider prepare and capture the
      base once.
- [ ] Test: a source failure on a reused base releases it.

## Milestone 3: Working-tree dependency freshness

Depends on: 2

The `non-ui implementor` records the working-install inputs of a prepared
base and checks them before a reuse, under decision 1. Nothing reuses a base
yet.

- [ ] Record the inputs of the chosen option at preparation.
- [ ] A check reads the current values and says whether the base is current.
      Measure its time on the example and the React fixture.
- [ ] Tests: equal inputs keep the base current. A changed working lockfile
      makes it stale. Add one case for each further input of the option.

## Milestone 4: Serve kept base

Depends on: 3

The `non-ui implementor` keeps the base in Serve and reuses it.

- [ ] Add one kept-base slot to `ServeChanges`, shared by every `Source`.
- [ ] Prepare the base internals under the cancellation rule of decision 2.
- [ ] Give each classification its own reader of the kept base.
- [ ] Reuse only for an equal key and a current freshness check.
- [ ] Release on the base events, and at stop under decision 4.
- [ ] Apply design calls 1 and 4 to 10.
- [ ] Test: a second classification with the same merge base prepares once.
- [ ] Test: a merge-base move prepares again and drops the old base.
- [ ] Test: cancel the preparing classification after the keep, and cancel a
      capture in a base read. Then a reuse reads a document and a resource.
- [ ] Test: after the last Serve state drops, a weak handle of the base is
      empty.
- [ ] See each new test fail once. Run the targeted tests of `mokly-compare`
      and `mokly-cli`.

## Milestone 5: Measurement and smoke test

Depends on: 4

- [ ] Interleave before and after runs of the Serve, edit, and React
      measurements with release binaries, three each. Save the medians
      under `.context/keep-base-side-in-memory/`.
- [ ] Confirm the acceptance. After the edit, the second classification runs
      no base `config.load`, `catalogue.discover`, `catalogue.validate`, or
      `graph.prepare` span. `review.base-tree` takes under 0.5 s. Edit to
      the end of the second classification falls by about the base side.
      The first classification is not slower.
- [ ] Smoke test: run Serve on the example, and change the visible text of
      one screen. The next classification lists that screen and prepares no
      base. Restore the text. The next classification lists nothing.
- [ ] Merge `origin/main` with the `git-merge` skill. When perf 7 merged
      first, measure again.

## Milestone 6: Verification, commit, review, and pull request

Depends on: every other milestone

- [ ] Remove the status lines of milestone 1.
- [ ] Run `cargo xtask check --suite repository`, then the complete gate
      `cargo xtask check`.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the review-fix rule: fix the `fix now` findings, record
      follow-up items under `plans/follow-ups/` for the rest, re-review
      once, and report.
- [ ] Delete this plan when the `plans` skill says, under "Deleting the
      plan".
- [ ] Open the pull request with `gh pr create --base main`. Its description
      gives the decisions and design calls with their dates, a permalink to
      this plan, the before and after table, and the follow-up items.
- [ ] Merge `origin/main`, wait for CI, and send the orchestrator the ready
      line.

## Post-merge follow-up (non-blocking)

- None.
