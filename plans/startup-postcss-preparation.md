# Overlap startup PostCSS preparation with bundling

Status: Active. On branch `calummoore/mokly-stylesheet-store-across-restarts-jffu`, no pull request yet. The pull request that completes this work deletes this plan.

Mokly Serve processes every stylesheet root again in each new process. In
`examples/basic`, the first PostCSS request of a warm start waits about 0.5 s
while a fresh child loads the PostCSS configuration and its plugins. Merged
PR #459 starts that child during the JavaScript `bundle` request of a Serve
edit. This change starts it in the same way for the startup attempt of Serve.
It stores no stylesheet processing result. Every start still processes every
stylesheet root that it needs from fresh inputs, with fresh plugin state.

This change builds no stylesheet store. The parked store design, its test
plan, its input classes, and its census are in the
[stylesheet restart item](follow-ups/stylesheet-cache-across-restarts.md).
Certified core-only records are a separate parked item, the
[certified core record item](follow-ups/certified-core-stylesheet-records.md).
The performance orchestrator owns the official measurements and every merge.
This workspace opens one pull request into `main` and does not merge it.

## Decisions and history

- 2026-11-21: The performance orchestrator chose option B of the stylesheet
  restart item. The store was to start after the bundle disk cache merged, as
  a second stored kind of the existing cache. This plan was
  `plans/persistent-stylesheet-records.md`, first committed at `2ca9ef6da`.
- 2026-11-21, decision 1: the performance orchestrator approved layout C, one
  self-contained snapshot for each side and set of stylesheet settings. It set
  a provisional 256 MiB namespace bound and a 64 MiB entry ceiling. It amended
  admission to complete and stable evidence only. The restart item keeps the
  whole decision and every approved detail.
- 2026-11-21: PR #459 merged at `793d0c77d`. This branch merged `main` at
  `d5f53f82c` without conflicts. The preservation audit is
  `.context/persistent-stylesheet-records/main-merge-audit.log`.
- 2026-11-21: The census found no certified record: Basic 0 of 39, the current
  monorepo cloud configuration 0 of 161, and the isolated `mokly-cloud`
  consumer 0 of 60. The approved stop condition applied. Commit `5bd37cc77`
  recorded the strict store protocol and decision 2 below.
- 2026-11-21, decision 2: the performance orchestrator chose F. It parked the
  store as option C, rejected D and E for reliability, and replaced the
  acceptance with the list below. Its answer authorizes the F product work.
- 2026-11-21: The orchestrator gave workspace 223 the Browserslist
  correctness fix of `plans/follow-ups/stylesheet-observed-plugin-config-reads.md`.
  Never fix it here. F work continues meanwhile. Merge `main` when that pull
  request merges, before the final verification.
- PR #461 changes the base startup order. This change must work with that
  order too. Later integration follows the repository merge rules.

Contract owners:

- [Prepared contexts](../docs/protocol/mokly-sidecar-postcss.md#prepared-contexts).
- [Capture modes](../docs/protocol/mokly-sidecar-recipes.md#capture-modes),
  unchanged: a startup attempt keeps `full`.
- The [render README](../crates/mokly-render/README.md).

## Acceptance

These criteria come from the answer of 2026-11-21 to decision 2:

- Basic warm unchanged restarts reach `serve.ready` at least 0.3 s sooner on
  average than `main`, in interleaved pairs.
- Each report gives the mean `catalogue.bundle` hit duration of both arms
  beside the readiness gain. The PostCSS module load competes with the input
  proof of that hit.
- Basic first Changes and edits are no slower than `main`.
- All raw output bytes are equal on Basic, the current monorepo cloud
  configuration, large HTML, and large React.
- The whole-tree kernel `memory.peak` stays within 2% of `main` for cold
  sessions with 5 edits and 5 restores, and for warm restarts.
- The isolated `mokly-cloud` consumer at
  `194fdb789b243ca649a592c6488e8d56b0a32be5` is unchanged beyond noise.
- The local complete gate and measurements pass first. The parent then runs
  the official gate and measurements. A reviewed pull request into `main`
  passes Required CI. This workspace does not merge it.

## Design

### Requirements in force

The answer of 2026-11-21 sets these requirements. The
[prepared context rules](../docs/protocol/mokly-sidecar-postcss.md#prepared-contexts)
state them.

- A startup attempt is a Serve head graph preparation that starts before the
  first published state: the first preparation and its optional recheck. It
  sends `full`. Add no capture mode. A preparation changes no capture value
  and no recorded reuse evidence.
- A startup attempt prepares its fresh context with no stale-record
  condition. It prepares when the configuration names a PostCSS module, no
  `processCss` request of the context came first, and no older used head
  context of the configuration is live.
- A later attempt, after the first published state, keeps the #459 rule
  unchanged. Only a stale kept PostCSS bundle permits its preparation. A
  hit-only edit starts no child.
- The overlap starts when the Node sidecar receives the `bundle` request,
  before its reuse check. The native bundle cache read, the restore, and the
  transport come before it. Add no wire capture mode and no pool change.
- No stylesheet processing result persists across processes. Every start
  processes every stylesheet root that it needs from fresh inputs. The bundle
  cache and the render store keep their own current checks.
- Every #459 rule stays: no second head context beside an older used one, a
  fresh context for each attempt, no stylesheet before the first `processCss`
  request, no `bundle` wait, request-only preparation identity, deferred child
  failures, first failure delivery, the retry and new-child rules, cleanup,
  and used and unused ownership.

### Code facts

These facts come from merged `main` at `793d0c77d`:

- `crates/mokly-cli/src/serve_services.rs` gives the Serve head runtime
  `Runtime::with_serve_edit_plans`, so `edit_plans` is `Some` in the head and
  in each attempt copy. `AttemptPreparation::prepare` sets
  `BundleCapture::Full` until `ServeServices::head_published` runs, and then
  `BundleCapture::ServeEdit`.
- `serve_preparation::initial` in `crates/mokly-cli/src/serve_preparation.rs`
  runs the startup preparation and, when the watch candidate asks, one
  recheck. Both run before the first publication. A failed startup ends the
  process.
- `crates/mokly-render/src/bundle.rs` adds a `PostcssPreparation` only in
  `ServeEdit`, only for an original head with `base` and `head_styles` set to
  `None`, only for an unused lease, only when
  `Runtime::older_used_head_context` finds none, and only when
  `stale_postcss` is true. The second request of an evaluation change carries
  none.
- `stale_postcss` in `crates/mokly-render/src/stylesheet_preparation.rs` scans
  the kept PostCSS keys of the attempt's settings, stops at the first stamp
  mismatch, and records that key as the probe. An empty store gives `false`,
  so a startup attempt never prepares today.
- Build and publish runtimes have no `edit_plans`. `Runtime::for_base` sets
  `base`. The stylesheet roots come from the module graph of the `bundle`
  result.
- `packages/mokly/src/sidecar/session.ts` calls `PostcssWorkers.prepare` for
  every `capture` value, before the reuse check.
- On a warm restart, `seed_bundle` in
  `crates/mokly-sidecar/src/pool_bundle_cache.rs` reads the bundle cache and
  sends `restoreGeneration` before the pool sends the `bundle` call. So the
  child starts at that call. It overlaps the Node reuse check and the core
  work up to the first `processCss` request. It does not overlap the sidecar
  spawn, the cache read, or the restore.
- In one merged warm Basic start, `catalogue.bundle` took 509 ms with a hit,
  including a 168 ms `sidecar.spawn`. The Node `sidecar.bundle` took 212 ms.
  The first `css.postcss` took 511 ms and started 3 ms after the bundle. The
  log is `.context/persistent-stylesheet-records/merged-main-startup/01.stderr.log`.

### Proposed change

The read-only check of the non-ui implementor on 2026-11-21 confirmed this
scope. The minimum code change stays in `crates/mokly-render/src/bundle.rs`.

- Let the positive Serve opt-in, a `Full` attempt of an original head runtime
  with `edit_plans`, prepare its fresh context without `stale_postcss`.
- Keep the `ServeEdit` predicate unchanged, `stale_postcss` included. Keep
  `crates/mokly-render/src/stylesheet_preparation.rs` and the
  `StylesheetPreparation` trait unchanged. Keep the unused-lease,
  older-used-head, original-head, and one-request conditions in both modes.
- Add no wire value, capture mode, pool change, bundle setting, span,
  timeout, retry, sleep, or skip.
- Update `crates/mokly-render/README.md` in the same change. Its PostCSS
  paragraph and its `src/bundle.rs` entry describe the edit-only rule.

### Design calls

My calls of 2026-11-21:

- A startup attempt is every Serve head graph preparation before the first
  publication, the recheck included. Both send `full` before readiness, and
  both use the positive Serve opt-in.
- A startup attempt whose stylesheets need no `processCss` request starts a
  child that ends unused with the attempt. This covers a PostCSS module that
  processes no root, and a rare recheck whose kept bundles all stay reusable.
  The roots come with the `bundle` result, so no earlier check can know them.
- The protocol says that the sidecar starts the preparation when the
  `bundle` request reaches it, before its reuse check. That wording names the
  approved overlap boundary without naming code.
- The rule that stylesheet results stay inside their process lives in the
  PostCSS protocol page. The cache pages return to their `main` text, because
  no store exists.
- The measurements add no span. They use `catalogue.bundle`, `css.postcss`,
  `sidecar.bundle`, `sidecar.process-css`, and the `postcss-start` count.

### Risks

- The module load of the child competes for CPU with the Node reuse check of
  a warm hit and with the core class-map work. It can lengthen the hit and
  reduce the gain.
- At a cold start, the child loads during an esbuild compile. The whole-tree
  peak can rise.
- A plugin that writes files while it loads now writes during the `full`
  capture. A write into a consumed directory can make the capture unstable, so
  the bundle cache skips the store. The output stays equal.
- When the gain misses 0.3 s or a peak passes 2%, stop and send the parent the
  measured split. Do not widen the scope. A start before the native cache
  read is outside the approved scope.

## Decision 2: Tailwind evidence cannot enter the store

- **Severity:** High. **Effort:** Medium.
- **Source:** Implementation.
- **Category:** Performance.
- **Location:** `packages/mokly/src/sidecar/postcss-evidence.ts` and
  `crates/mokly-source-interface/src/read_evidence.rs`.
- **Terms:**
  - **Coverage:** Whether the capture proves that it observed every input.
  - **Stable capture:** Proof that captured input identities and change stamps
    stayed valid through compilation.
  - **Bounded admission:** Reuse that trusts unobserved inputs only under an
    explicit age or refresh rule. It is not complete evidence.
- **Background:** The orchestrator requires complete and stable disk evidence.
  Current stylesheet records have consistency checks but no durable certificate.
  Known plugin modules and reported source files already have late content
  digests, including the native Tailwind and Lightning CSS bindings.
- **Problem:** Those digests cannot prove the full input boundary.
  Scanner controls, native resolution probes, external inputs, and context
  state can escape the existing record. A strict store cannot admit those
  results. A separate main red test also confirmed a dropped observed
  Browserslist configuration read. Workspace 223 owns that correctness fix.
- **Impact if no action:** The approved strict store cannot provide the
  required Basic gain with the current evidence producer.
- **Root question:** Which restart improvement should this task pursue while
  preserving correctness or explicitly bounding any new trust?
- **Options:**
  - **A.** First establish a complete input boundary and deterministic replay
    for the PostCSS process. A feasibility study must name the mechanism,
    supported platforms, native-plugin behavior, and fallback. No complete
    implementation or startup cost is known. Effort: Large. The study alone
    is Medium.
  - **B.** Add positive complete-and-stable certificates for core-only records.
    Keep opaque PostCSS results memory-only. Classification is per record,
    including roots that run no PostCSS under a configured module. This helps
    cloud but requires a smaller Basic goal. Effort: Large.
  - **C.** Park the store work. Keep the protocol and test design as a handoff.
    This preserves current restart refresh behavior and provides no gain.
    Effort: Small.
  - **D.** Amend strict admission to allow a checked PostCSS snapshot under an
    explicit age bound. First cover every mandatory file, directory, control,
    configuration, native module, environment, and version input. Stamp a
    conservative directory superset without changing plugin selection or
    public membership. Capture a full startup and reuse a side's PostCSS
    records together or compile them again. Unknown native inputs and ambient
    state remain trusted. The parent must choose the bound and its risk.
    Effort: Large.
  - **E.** Load checked stored results for readiness, then compile PostCSS again
    before first Changes. This refreshes unknown inputs each session but can
    serve stale output until the fresh generation publishes. It changes the
    zero-compile acceptance rule and can delay first Changes. Effort: Large.
  - **F.** Extend merged PostCSS preparation to startup so that context setup
    overlaps JavaScript bundling. Store no PostCSS results. This keeps the
    restart freshness rule but changes this task's approach and Basic goal.
    CPU and memory overlap still need measurement. Effort: Medium.
- **Left out:**
  - Unlimited opaque persistence remains rejected.
  - Dependency paths, late hashes, or equal glob lists do not prove complete
    capture. Stable capture can close provenance gaps only for known inputs.
  - Tailwind-only exclusion is insufficient. Other processed roots use the
    same consumer configuration and module context.
  - A scanner-only adapter closes neither other native reads nor plugin state.
    It can also change the consumer plugin's discovery behavior.
  - Two concurrent head PostCSS contexts break the merged context contract
    and add another process against the memory acceptance limit.
- **Wider fix:** B. A positive admission certificate prevents unsupported
  records from entering the strict store. It does not make Tailwind complete.
- **Previous examples:** The bundle cache has a separate durable recipe type.
  `plans/follow-ups/confined-postcss-inputs.md` already records the broader
  input-domain design. The observed configuration bug is a separate
  correctness record in `plans/follow-ups/stylesheet-observed-plugin-config-reads.md`.
- **Assumptions:** The original Basic goal is at least 0.5 seconds.
  Strict complete-and-stable admission remains approved. A late digest is
  not a consumed-read witness. The store remains Serve-only. In-process reuse
  already trusts deterministic plugin behavior. B and F need a changed Basic
  goal. D and E need an explicit exception to strict restart admission.
- **Recommendation:** F, replacing A after the options check. It offers a
  smaller measurable Basic improvement without extending opaque reuse across
  restarts. It needs approval for the changed goal and approach. If those
  must stay, choose C rather than claim a complete boundary that does not exist.
- **Outcome:** F approved on 2026-11-21 by the performance orchestrator. The
  store is parked as C in the stylesheet restart item. D and E were rejected,
  because stale styles or wrong Changes could survive a restart. The Basic
  goal became 0.3 s, and the acceptance above replaced the original list.
- **Action:** fix now, apply F. Park C in the stylesheet restart item, and
  park B in the certified core record item.

The read-only options check and its correction are
`.context/persistent-stylesheet-records/eligibility-options-check-after-main.md`.
The orchestrator's checked disposition, input-class matrix, estimated gains,
and validation-cost limits are
`.context/persistent-stylesheet-records/eligibility-options-disposition.md`.
No measured candidate speed gain or complete validator exists yet.

For D, the age bound controls admission at restart only. Unless a forced
refresh is added, an admitted record can remain in memory throughout that
Serve session. A hit or snapshot save must never renew its original compile
age. Unknown inputs can therefore affect stale styles and Changes for the
admission window plus the session lifetime. A wall-clock rollback can extend
that window unless it is detected. No age or refresh rule is approved.

The census and direct diagnostic live under `.context/` as evidence only.
The diagnostic is not a full core-record capture or a complete inventory.

## Test plan

Write each red test before the core change. See it fail on a behavioural
assertion. A compile error, a setup panic, or zero matched tests is not red.
A guard test that passes before the change proves itself by a temporary break
of its guard. Record each red failure and each break under
`.context/startup-postcss-preparation/`.

- Eligibility, at the unit level. Extend
  `css_before_bundle_and_second_evaluation_never_add_another_preparation` in
  `crates/mokly-render/src/_tests_/bundle_preparation_tests.rs` with
  Serve-head `Full` rows that have edit plans:
  - an empty head store prepares one context, red before the change;
  - a base runtime, an older used head context, CSS before the bundle, and
    the second request of an evaluation change prepare none;
  - a `ServeEdit` attempt whose head keeps no PostCSS record prepares none,
    and the existing `ServeEdit` rows keep their expected values.

  The existing `Full` row without edit plans stays as the Build case. The
  breaks caught are no startup gain, a child in a Build or base `full`
  attempt, a child beside an older used context, and a startup rule that
  leaks into the unchanged `ServeEdit` predicate.

- Startup evidence, at the unit level. In the same file, a prepared startup
  request still sends `capture: Full`, and its `full` result still adds its
  plan record. The break caught is a preparation that changes the capture
  mode or drops the plan record that later edits use.
- Real startup, at the integration level. Add Serve-head startup cases to
  `crates/mokly-render/tests/integration/postcss_preparation_tests.rs`. Give
  the fixture runtime `Runtime::with_serve_edit_plans`.
  - The first `bundle` request carries one preparation. Every `processCss`
    request of the attempt uses that context. The stylesheet bytes equal
    those of a Build runtime over the same files. After a successful startup
    that kept every record, no PostCSS child stays live. Red before the change.
  - A startup with a PostCSS module and no PostCSS root releases its unused
    context when the attempt ends. Red before the change.
- Sidecar boundary, at the Node level. Add no Node test. The session
  behaviour does not change, and its preparation call does not depend on the
  capture value. The existing failure and disposal cases of
  `tests/sidecar_bundle_preparation.test.ts` already send the default `full`.
  Rerun the existing Node preparation tests:
  `tests/sidecar_bundle_preparation.test.ts`,
  `tests/sidecar_postcss_preparation.test.ts`, and
  `tests/sidecar_postcss_prepared_inputs.test.ts`.
- Keep every #459 test. Change an expected value only where F changes that
  behaviour on purpose, and name each such test in the report.
- Add no sleep, retry, timeout, elapsed-time assertion, or skip. Run each new
  asynchronous test ten times.

## Milestone 1: Documentation and protocol

Depends on: none

- [x] Confirm the baseline split with a release native build and built packages.
- [x] Run the fresh read-only options check with the requested second-pass agent.
- [x] Record the answer to decision 1 and its evidence amendment.
- [x] Count eligible roots on basic and cloud before product code.
      Identify Tailwind's unobserved inputs. If it does not qualify, stop
      and send the performance orchestrator the evidence and safe options.
- [x] Write the detailed test plan without writing red tests.
- [x] Extend cache, PostCSS reuse, budget, and cache-output requirements.
      Add a linked stylesheet-cache companion page if needed to keep page limits.
- [x] State only the required behavior in protocol pages. Keep mechanics in
      the area READMEs and code comments. Use a status line until implemented.
- [x] Record the resolution of the restart follow-up. Delete its file when
      this branch implements the work. Keep its other linked items in scope only
      when this change causes or fixes their problem.
      On 2026-11-21 the answer to decision 2 parked the store, so the item
      stays and holds the parked design.

Evidence lives under `.context/stylesheet-cache-across-restarts/`.
The merged census is
`.context/persistent-stylesheet-records/merged-root-eligibility-census.json`.
The checked protocol draft is
`.context/persistent-stylesheet-records/docs-report-after-main.md`.

## Milestone 2: Red tests and reusable storage

Depends on: 1 and the #459 merge signal

On 2026-11-21 the answer to decision 2 parked the store TODOs of this
milestone and of the former Milestone 3, Serve integration, in the
stylesheet restart item. The merge after workspace 223 moved to Milestone 5.

- [x] Merge `origin/main` after the signal. Save the preservation audit.
- [x] Record the orchestrator's evidence option before any store implementation.

## Milestone 3: Startup preparation protocol

Depends on: 2

The docs implementor states the F requirements, retires the store protocol,
and parks the store work in stand-alone follow-up items.

- [x] Rename this plan from `plans/persistent-stylesheet-records.md`. Record
      F with its date, acceptance, design, test plan, and milestones.
- [x] Update the prepared context rules of
      `docs/protocol/mokly-sidecar-postcss.md` for startup attempts and for
      results that stay inside their process. Add the status line that links
      Milestone 4.
- [x] Restore `docs/protocol/mokly-base-cache.md`,
      `docs/protocol/mokly-imported-styles-postcss.md`,
      `docs/protocol/mokly-terminal-cache.md`, and
      `docs/protocol/mokly-timings.md` to their `main` text. Retire
      `docs/protocol/mokly-stylesheet-cache.md`.
- [x] Park the store proposal, its test plan, the input classes, the census,
      and the rejected options in
      `plans/follow-ups/stylesheet-cache-across-restarts.md`.
- [x] Add `plans/follow-ups/certified-core-stylesheet-records.md`.
- [x] Run Prettier and the Markdown link check on the changed files. Run the
      deletion audit.

Documentation and link evidence: `.context/startup-postcss-preparation/markdown-links.log`.
Preservation audit: `.context/startup-postcss-preparation/docs-deletion-audit.log`.

## Milestone 4: Startup preparation tests and core change

Depends on: 3

The non-ui implementor writes the red tests of the test plan first, then the
smallest core change. The product works at the end of the milestone.

- [x] Confirm the code facts of the design on the current branch. Name each
      existing test whose expected value F changes on purpose.
- [x] Write the red eligibility rows and the startup evidence test. Save each
      behavioural failure.
- [x] Write the red real-startup integration cases. Save each failure.
- [x] Make the smallest core change in `crates/mokly-render/src/bundle.rs`.
      Keep `crates/mokly-render/src/stylesheet_preparation.rs`, its
      `stale_postcss` predicate, and the `StylesheetPreparation` trait
      unchanged.
- [x] Run the targeted Rust tests until they pass, and rerun the existing
      Node preparation tests. Save the commands, the counts, and the cost of
      each new test.
- [x] Update `crates/mokly-render/README.md` for startup preparation.
- [x] Remove the status line of `docs/protocol/mokly-sidecar-postcss.md` in
      the commit that completes this milestone.

Implementation and test evidence: `.context/startup-postcss-preparation/implementation-report.md`.

## Milestone 5: Local verification and measurement

Depends on: 4, and the merge of the workspace 223 correctness pull request
into `main`.

- [ ] Merge `origin/main` after workspace 223 fixes observed configuration
      reuse. Keep that product fix and its regression test in the correctness
      branch. Run every check below on the merged tree.
- [ ] Run each new asynchronous test ten times. Record the pass counts.
- [ ] Run `cargo xtask check --suite repository`, then the complete gate
      `cargo xtask check`.
- [ ] Run the strict example build and a Serve smoke test of a startup with
      PostCSS, with the commands of `AGENTS.md`.
- [ ] Prove all raw output bytes equal between `main` and this branch.
  - [ ] Static Build with `--strict --no-changes --sidecars 2` on Basic, the
        current monorepo cloud configuration, large HTML, and large React.
        Generate both large fixtures with 30 areas, 40 screens per area,
        12 rows, 4 shared stylesheets, and share 0.5.
  - [ ] Basic Serve over HTTP: a cold start, a warm restart, a label edit, a
        class add, a class removal, and a restore. Fetch every document,
        stylesheet, and asset body at each step, unlinked roots included. Use
        a fresh static CSS inventory. Preserve exact indexes and live dist.
  - [ ] Adapt the verified WS206 helper transport under
        `.context/postcss-reuse-across-edits/` to the commits and scopes of
        this branch. Keep every manifest and raw comparison under
        `.context/`. Make no Publish claim from the Build proof.
- [ ] Measure interleaved `main` and branch pairs on Basic with the release
      native core and built dist: warm `serve.ready`, the `catalogue.bundle`
      hit duration, the first `css.postcss`, the CSS span union, first
      Changes, the label edit, and the restore.
- [ ] Measure the isolated `mokly-cloud` consumer at `194fdb78` in the same
      way. Confirm that it prepares nothing and changes nothing beyond noise.
- [ ] Measure the whole-tree kernel `memory.peak` of cold sessions with 5
      edits and 5 restores, and of warm restarts. Confirm the 2% limit.

Before each large Cargo build, check the disk and the memory. Require at
least 15 GiB of free disk. Use `CARGO_INCREMENTAL=0` and
`CARGO_PROFILE_DEV_DEBUG=0`. Run one heavy job at a time. Use the pinned
Node 24.21.0 for the proofs. Add no timeout, retry, sleep, skip, or weaker
assertion.

## Milestone 6: Official acceptance

Depends on: 5

- [ ] Commit with Conventional Commits and push the branch. Send the SHA, the
      local results, and the evidence paths to the performance orchestrator
      for the official gate and measurements.
- [ ] Receive the official result, and add a short summary here. Send the
      parent each failed criterion with its measured split. Do not widen the
      scope without a new decision.

## Milestone 7: Review and pull request

Depends on: 6

- [ ] Review the complete local diff against `origin/main` after the push,
      with the `implementation-review` skill. Run its finding checks and fix
      rounds. Record a follow-up item for each permitted deferred finding.
      After a product fix, rerun the targeted tests and the gate, and ask the
      parent whether the official measurement must run again.
- [ ] Check protocol alignment. Confirm that no status line links this plan.
      Commit and push the reviewed result.
- [ ] Delete this plan when the `plans` skill says, under "Deleting the
      plan".
- [ ] Open the pull request into `main`. Its description gives the dated
      decisions and design calls of this plan, a permalink to this plan, the
      updated restart item, and the new certified core record item. Watch
      Required CI with `scripts/ci-wait.sh`. Fix each branch-caused failure.
      Record Site Lighthouse as unrelated and do not rerun it. Send the parent
      the pull request link and the final SHA. Do not merge.
