# Cheaper proofs of reused Serve comparisons

Status: Active. On branch `calummoore/mokly-comparison-proof-cost-mcnn`, no pull request yet. The completing pull request deletes this plan.

Mokly Serve retains proven view comparisons between edits. Each reused view
still reads its current document through the checked head reader. Repeated
link checks make that read costly on a large catalogue.

This change shares link checks within one head generation. It keeps the
checked head reader as the only proof path. Published bytes, current usage,
head validation, retained-only base reads, and existing cache bounds stay equal.
The performance orchestrator merges the pull request. This workspace does not.

Contract owners:

- [Changes serving](../docs/protocol/mokly-changes-serving.md#proven-view-reuse).
- [Comparison serving](../docs/protocol/mokly-comparison-serving.md#view-comparison-reuse).
- [Logical link validation](../docs/protocol/mokly-link-validation.md).
- [On-demand reads](../docs/protocol/mokly-on-demand.md).
- [Runtime cache](../docs/protocol/mokly-runtime.md#render-graph-and-cache).
- [Graph crate](../crates/mokly-graph/README.md).
- [Comparison crate](../crates/mokly-compare/README.md).
- [Large fixture](../tests/fixtures/large/README.md).

## Authority and measured choice

The performance orchestrator made these calls on 2026-11-18. The user asked
on 2026-11-16 for faster, reliable Changes, without memory exhaustion.
The user gave design decisions to that orchestrator. These calls resolve
the decision in `plans/follow-ups/serve-comparison-proof-cost.md`.

1. Measure the proof parts and the other comparison phases first. Keep the
   probe and evidence under `.context/`. Add no test for the probe.
2. Apply option E when repeated link checks dominate. Index document plans
   by entry path. Share each target-view and fragment result within a
   generation. Seed results from the anchors of complete validation. Avoid
   weight computation for the same artifact already in the full cache tier.
3. Run the options check again when the split does not support E. Ask the
   performance orchestrator before starting Large options C, D, or F.
4. Keep every current-generation check, the first error, its text, and all
   published bytes. Use the existing byte oracle unchanged.
5. Keep the complete immutable entry-path index outside the pair-store
   ceiling. It holds positions or references into existing plans, never
   copies of plans or documents. Build it once per generation. Its lifetime
   is the generation's lifetime. Charge compact pair records under 2 MiB.
   The index has the same growth class as existing generation metadata.
   This is the performance orchestrator's call of 2026-11-18 after the
   options check. Report the index size beside the pair-store charge.

On 2026-11-18, the performance orchestrator asked for the final product
source before the complete gate ends. Its `mokly-cloud` A/B takes about
25 minutes and can run beside verification. Commit `2c46ed670` is that
product source. A later product change requires a new cloud measurement.

On 2026-11-18, the performance orchestrator accepted the `mokly-cloud`
measurement of `2c46ed670`. The edit comparison mean stayed at 246 ms.
It accepted this neutral React result with the large HTML improvement.
This supersedes the initial requirement for a shorter cloud comparison.
It requested a separate follow-up to split the remaining cloud proof work
before choosing a fix. That optimization stays outside this branch.

Main later added the sidecar-return change at `24b238ca4`. The workspace
merged it without conflicts at `c0a72c7ae`. The performance orchestrator's
call of 2026-11-18 requires no new cloud measurement for that merge.
The graph source is unchanged. The accepted cloud table remains bound to
`2c46ed670` against `bc4f4cc40`. Final CI checks the combined head.

The split used current `main` at `bc4f4cc40`, with release builds. Link checks
took 88.1% of summed checked-head work on the default 5,850-view HTML fixture.
On `examples/basic`, full-tier insertion weight was the largest measured
part of that read. Option E targets both costs. Worker sums are not wall time.
The uninstrumented three-sample baselines determine the performance threshold.

Evidence: `.context/serve-comparison-proof-cost/timing-split.md` and its raw reports.
Options check: `.context/serve-comparison-proof-cost/options-check.md`.
The pristine large-fixture comparison median is 1,907 ms. Its target is
953.5 ms or less, measured by `review.compare-views`.

## Decisions and design calls

### 1. Repeated proof work delays edit comparisons

- **Severity:** Medium. **Effort:** Medium.
- **Source:** Design.
- **Category:** Performance.
- **Location:** `crates/mokly-graph/src/validation.rs`, `cache.rs`, and `session.rs`.
- **Terms:**
  - **Checked head read:** The current document read through the generation checks and the frozen byte digest check.
  - **Link check:** The check that each view of a logical destination contains a requested fragment anchor.
- **Background:** Serve proves all recorded inputs before reusing a view comparison. Its complete head validation already finds destination anchors.
- **Problem:** Later checked head reads repeat target reads, anchor walks, plan scans, and cache weight computation.
- **Impact if no action:** Large catalogues keep unnecessary work after an edit, although nearly every view comparison is reused.
- **Root question:** How can Serve prove reused views faster while preserving all current checks and output?
- **Options:**
  - **B.** Group an entry's views on one worker. Share its repeated work, with a changed schedule. Effort: Medium.
  - **E.** Share link results in one generation and index target plans. Seed from complete validation and avoid repeated full-tier weight computation. Effort: Medium.
  - **G.** Keep one complete-validation verdict. Plan-document reads skip later link checks, while early and temporary reads keep them. This trusts immutable plan links after validation. Effort: Medium.
  - **C.** Share one checked head read between complete validation and proofs. It also needs a bounded usage source without restoration. Effort: Large.
  - **D.** Record link-check dependencies as proof inputs. Missed dependencies can accept stale output. Effort: Large.
  - **F.** Read cached digest, usage, and links without restoring the tree. Change shared cache entries and audit every checking wrapper. Effort: Large.
- **Left out:**
  - **A.** Change nothing. It cannot meet the required reduction.
  - Watcher events, recipe keys alone, unchecked head reuse, base source reads, larger caches, and persistent proof records break requirements that stay.
  - More workers and an earlier proof start do not remove the measured repeated work.
  - Shared resource identities already exist in the comparison proof table.
  - An index alone keeps every target read. Its estimated saving misses the target.
  - A faster digest targets less than one percent of measured checked-head work.
- **Assumptions:**
  - Byte equality, current usage, current head validation, retained-only base reads, and fixed bounds stay. Source: the task and contract owners.
  - A separate checked read per reused view is a mechanism. C can replace it, with the same checks.
  - Usage needs tree restoration today. This comes from the code. F drops this assumption, and C needs that solution.
  - E targets the main large-fixture cost and the largest basic-fixture read part. Source: the timing split.
  - Later reads still look up their links. This is a mechanism, not a requirement. G drops it.
- **Wider fix:** C prevents repeated checked reads by construction, but needs the usage solution and a Large change.
- **Previous examples:** The reuse change shared proof identities and moved proof work to workers. It kept the current usage from the checked head read.
- **Recommendation:** E. The measured costs support the performance orchestrator's choice. C gives wider protection at greater effort.
- **Action:** fix now, apply E. Performance orchestrator's call of 2026-11-18, under the user's delegated design authority.

### 2. Sharing must retain a fixed memory bound

- **Severity:** Medium. **Effort:** Medium.
- **Source:** Design.
- **Category:** Performance.
- **Location:** The generation-owned link-check store and target-plan index.
- **Background:** Distinct targets and fragment strings can grow with authored input. Sharing must not retain an unbounded table.
- **Problem:** A cache of all requested pairs can exhaust memory on an arbitrary catalogue.
- **Impact if no action:** A speed improvement could violate the user's memory requirement.
- **Root question:** How can shared checks stay bounded without changing validation results or restoring the measured scans at scale?
- **Options:**
  - **A.** Give the generation's result store and index one charged 2 MiB ceiling. Fall back to ordinary checks when a record does not fit. Effort: Medium.
  - **B.** Charge generation records to the shared render cache. This can displace documents and couples generation lifetimes to artifact eviction. Effort: Medium.
  - **C.** Keep no persistent results. Group checks in bounded worker batches, with a new schedule and less sharing. Effort: Medium.
  - **D.** Keep a complete immutable index as generation metadata. It holds positions or references into existing plans. Charge compact pairs under 2 MiB. Effort: Medium.
  - **E.** Apply D and the complete-validation verdict of item 1 option G. Proof reads need no stored pair, but trust plan links after validation. Effort: Medium.
- **Left out:** An unbounded table violates the task. Dropping a check on overflow changes validation. Keeping every anchor tree retains unnecessary data.
- **Assumptions:**
  - Overflow must preserve output and diagnostics. Source: the task and comparison serving contract.
  - Existing render and 32 MiB comparison bounds stay unchanged. Source: the task.
  - A separate bounded generation store is permitted. Source: the performance orchestrator's explicit instruction to bound and charge it.
  - Index capacity need not share the pair ceiling. Source: the performance orchestrator's call of 2026-11-18. D drops this assumption of A.
  - Stored pairs after validation are a mechanism. E drops this assumption, with the trust rule of item 1 option G.
- **Wider fix:** E removes stored pairs from the proof path. D keeps charged admission at the pair-store boundary.
- **Previous examples:** The render cache and retained comparison store use charged bounded admission with correctness-preserving misses.
- **Recommendation:** D, changed from A after the options check. It keeps indexed lookup on large catalogues without copying plans or documents.
- **Action:** fix now, apply D. Performance orchestrator's call of 2026-11-18, under the user's delegated design authority. Verify and report index size and pair-store charge on both fixtures.

## Design

The generation owns a complete immutable index into its existing plans.
The index holds positions or references, never copied plans or documents.
Build it once and retain it only with its generation. Remove the full plan
scan. Keep the existing target lookup and route order.

The workspace orchestrator's call of 2026-11-18 uses the existing
route-ordered plan map for each destination's view list. The index keeps
entry positions and view offsets only. The artifact-path layout puts all
views under `{path}/index.`. The path grammar excludes a dot in each entry
segment, so no other entry can match that prefix. Keep the entry-path
filter on the range. This avoids a public route type change and keeps the
existing oracle and comparison test files unchanged. The read-only options
check selected this approach over shared route handles, copied route keys,
and a Large plan-interface redesign.

Evidence: `.context/serve-comparison-proof-cost/ownership-options-check.md`.

The compact pair-result store has a charged 2 MiB ceiling. Charge retained
strings, record storage, and collection capacity. Do not allocate an
oversized record before checking admission. A result miss runs the existing
target check. Capacity affects speed only.

Store anchor presence by target view and fragment. Do not store a caller's
error. Construct the existing diagnostic from the current caller and target.
Keep reference order, target-view order, use-case destination resolution,
unknown-target errors, and cancellation behaviour.

Seed results from the anchors that complete validation already reads. Keep
complete validation exhaustive. Recheck a miss after taking the existing
target-flight lock. A new generation starts with an empty result store.

The cache fast path applies only to the same immutable artifact handle in
the full tier. Preserve access order, operation counts, replacement,
compaction, and all recorded charges. A different artifact still replaces it.

## Milestone 1: Documentation and protocol — completed

Depends on: none

- [x] Delegate a contract audit to the `docs implementor`. Confirm that this
      internal change needs no new public requirement or protocol behaviour.
- [x] Confirm the graph and comparison README context for implementation.

Evidence: `.context/serve-comparison-proof-cost/docs-audit.md`.

## Milestone 1a: Record preparation follow-up — completed

Depends on: none

- [x] Delegate the measured `graph.prepare` follow-up to the `docs implementor`.
      Keep its measurement and open question outside this implementation.

Follow-up: `plans/follow-ups/head-graph-preparation-cost.md`.

## Milestone 2: Shared generation checks — completed

Depends on: 1

- [x] Delegate the implementation to the `non-ui implementor`.
- [x] Add red-first tests for result sharing and bounded overflow. Cover
      present anchors, absent anchors, missing targets, and changed generations.
- [x] Cover the first error and exact text, including a different caller
      after a cached negative result. Preserve concurrent request cleanup.
- [x] Keep the existing cache-only read-count assertions on a zero-capacity
      pair store. Add separate assertions for the new sharing behaviour.
- [x] Implement the complete plan index and charged pair store. Seed it from complete
      validation. Keep the checked head proof path and base reads unchanged.
- [x] Check the indexed route range against real document planning for
      screen, page, document, and use-case destinations. Cover present and
      missing fragments without a full-scan fallback.
- [x] Avoid weight computation for the same full-tier artifact. Preserve
      cache replacement, access order, and charge semantics.
- [x] Check the delegate's result against these TODOs and repository rules.
- [x] Delegate the graph README update to the `docs implementor`. State the
      current generation sharing and its bounded fallback after implementation.

Evidence: `.context/serve-comparison-proof-cost/implementation-report.md`
and `.context/serve-comparison-proof-cost/readme-report.md`.

## Milestone 2a: Push source for cloud measurement — completed

Depends on: 2

- [x] Commit and push the final product source with the preservation audit.
- [x] Send its SHA immediately so the performance orchestrator can measure
      `mokly-cloud` while this workspace finishes the complete gate.

Evidence: `.context/serve-comparison-proof-cost/implementation-audit-after.log`.

## Milestone 3: Verification and release measurements — completed

Depends on: 2

- [x] Run targeted graph, comparison, and server tests. Keep the existing
      reuse byte oracle and comparison tests unchanged.
- [x] Run the early repository suite with Git 2.45 or later, git-lfs, and
      pinned Bun. Run the complete repository gate. Name any blocker.
- [x] Build and smoke-test the example catalogue under the repository rules.
- [x] Measure three edit and exact-restore samples on `examples/basic` and
      the default HTML fixture. Use separate release checkouts and targets.
- [x] Require the large-fixture edit `review.compare-views` median to be at
      most 953.5 ms, half its 1,907 ms baseline. Keep reuse and retention equal.
- [x] Measure and report immutable index size and charged pair-store usage
      on both fixtures. Check the 2 MiB pair ceiling without permanent telemetry.
- [x] Record the unrelated manager-fixture PATH failure and its verified
      environment workaround as a standalone follow-up item.

Evidence: `.context/serve-comparison-proof-cost/` holds checks and measurements.
Cloud acceptance: `.context/serve-comparison-proof-cost/cloud-acceptance.md`.

## Milestone 3a: Verify main integration — completed

Depends on: 3

- [x] Merge main's nearby sidecar-return change without dropping either
      implementation. Audit both parents and preserve all 44 main paths.
- [x] Run the repository suite on the merged head.
- [x] Delegate the release A/B on the latest main and merged branch. Keep
      their checkouts, targets, and editable fixtures separate from review.
- [x] Record the performance orchestrator's cloud remeasurement waiver.

Evidence: `.context/serve-comparison-proof-cost/merge-audit.log` and
`.context/serve-comparison-proof-cost/integrated/report.md`.
The integrated A/B meets the half-current-main comparison target. Reuse,
proof-read counts, and retained proof charges stay equal between its sides.

## Milestone 4: Commit, review, and pull request

Depends on: 1, 1a, 2, 2a, 3, 3a

- [x] Obtain the performance orchestrator's `mokly-cloud` comparison
      measurement. Send any changed product SHA for a new measurement.
- [x] Delegate the requested cloud comparison profiling follow-up to the
      `docs implementor`. Do not start that optimization in this branch.

- [x] Review against `origin/main` with `implementation-review`. Check each
      finding, apply the fix rule, and complete its two allowed fix rounds.
      Record deferred work as follow-up items. Preserve merged nearby changes.
- [ ] Delete this plan and the resolved proof-cost follow-up. Delegate live
      reference cleanup to the `docs implementor`. Preserve the dated record
      and plan permalink in the pull request description.
- [ ] Open the pull request into `main`. Watch its final CI with the shared
      `scripts/ci-wait.sh`. Fix branch failures. Send the complete report to
      the performance orchestrator. Do not merge the pull request.

Follow-ups: `plans/follow-ups/manager-fixture-path-drops-git.md` and
`plans/follow-ups/mokly-cloud-edit-comparison-cost.md`.

Review summary: Two fresh read-only passes at `4f7f51b57` against
`24b238ca4` found no findings or new outside-scope problem. No fix was needed.
Evidence: `.context/reviews/calummoore/mokly-comparison-proof-cost-mcnn/`.
