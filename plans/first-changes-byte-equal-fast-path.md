# First Changes byte-equal fast path

Status: Active. On branch `calummoore/mokly-first-changes-2-byte-equal-fast-10j4`, no pull request yet. The completion pull request deletes this plan.

Mokly compares rendered base and head documents to classify Changes. The
first classification currently repeats work for documents with equal bytes.
This step skips only work whose result cannot differ. All view states,
evidence, published bytes, and freshness checks stay equal to the full path.

On 2026-11-19, the user chose option D for first Changes performance:
five separate stacked pull requests. They cover miss-first capture, this
fast path, shared base stylesheets, busier usage sidecars, and restart reuse.
The alternatives were to keep the delay or limit the work to fewer stages.
The user put speed and reliability first and authorized equivalent changes
that keep memory in check. The user holds all merges into `main`.

This branch starts from `origin/main` at `6ae96ed08`. Before the pull request,
merge step 1 if its branch is available. Use that branch as the pull request
base. Otherwise target `main`, then retarget when step 1 is supplied.

Contract owners:

- [Comparison](../docs/protocol/mokly-comparison.md).
- [Component attribution](../docs/protocol/mokly-component-changes.md#unchanged-view-decision).
- [Base lifetime](../docs/protocol/mokly-base-preparation.md#serve-base-lifetime).
- [Comparison crate](../crates/mokly-compare/README.md).
- [Review timings](../docs/protocol/mokly-review-timings.md).
- [Large catalogue fixtures](../tests/fixtures/large/README.md).

## Design

The performance orchestrator made these calls on 2026-11-19:

- Compare content identities of exact document bytes. Document keys are
  insufficient because an evicted render can produce different bytes.
- Keep both closure reads with each side's tree and policy. Keep resource
  byte checks and proof reads with their recording. Keep ordered memo calls.
- Exclude moved entries because their comparisons normalize paths.
- Also exclude a view when the catalogue relocation map can change its base
  projection. Start with an empty-map guard because other moves can affect
  unmoved consumers too.
- Require equal comparison metadata as well as equal bytes before sharing
  document work. Derive nothing that the bytes do not carry. This replaces
  the performance orchestrator's original call to derive all fields from
  one byte-equal document.
- Comparison metadata includes every annotated tree field and every field
  retained by the lossless codec. Hash that complete codec input with the
  exact bytes. Equal digests prove both. Preserve conservative input signals
  for usage that is not ready.
- Retain a fixed digest per captured view. Charge its storage to the existing
  bounded capture budget. Keep the render cache bound and memory admission.
- Add the requested differential coverage. Compare the shortcut and full
  path across CSS misses, changed resources, ignores, moves, and missing sides.
  Include equal bytes with different comparison metadata.
  Check complete records and published bytes. Check basic and large catalogues.

### 1. Avoid duplicate equal-document work

- **Severity:** Medium. **Effort:** Medium.
- **Source:** Design.
- **Category:** performance.
- **Location:** `crates/mokly-compare/src/comparison_preparation.rs`,
  `capture_collection.rs`, and `crates/mokly-graph/src/document_codec.rs`.
- **Terms:**
  - **Capture:** A bounded encoded copy of a comparison document and its closure.
  - **Closure:** The resources, warnings, policy results, and ownership reached by a view.
- **Background:** Mokly compares each paired view for the first Changes result.
  Most base views reuse the same rendered document as head.
- **Problem:** Equal documents still need decoding, duplicate tree work, and
  canonical comparisons before the current path proves equality.
- **Impact if no action:** The first Changes result keeps about 0.9 seconds
  of comparison work on the measured `mokly-cloud` catalogue.
- **Root question:** How can first Changes skip work for equal complete
  comparison inputs while preserving every result and published byte?
- **Options:**
  - **A.** Retain an exact-byte digest during capture. Read the checked head
    once and compare metadata through a separate guard. Tree annotations need
    decoding or an additional retained guard record. The guard must list
    every relevant field. Effort: Medium.
  - **B.** Decode both documents, then hash their complete codec inputs during
    comparison. This avoids retained digests but keeps base decoding. Effort: Medium.
  - **C.** Hash exact bytes, annotated tree records, and all uncompressed codec
    metadata through one graph function. Hash during base capture and once
    for the checked head. Retain one charged 32-byte identity per view.
    Head hashing still needs a tree walk. Effort: Medium.
  - **D.** Memoize C's identity on each render artifact and retain it across
    both cache tiers. This changes the public artifact type and many callers.
    Charge the added cache storage. Effort: Large.
  - **E.** Retain a charged weak artifact reference and prove equality through
    allocation identity. Restores and new renders miss this shortcut. The
    weak reference retains the allocation header after eviction. Effort: Medium.
  - **F.** Stream the base's inflated codec payload against the head's codec
    stream and compare uncompressed metadata. Retain no digest. This keeps
    zlib inflation, so the time goal is less certain. Effort: Medium.
- **Left out:** Document keys fail the exact-byte requirement. Skipping
  closure or resource checks fails evidence and freshness requirements.
  Keeping the current path fails the requested performance goal.
- **Wider fix:** C. Hash the lossless codec input so that new stored
  annotations enter the proof without another guard field list.
- **Previous examples:** PR #94, commit `20e55ca02`, skips proven unchanged
  component views with differential coverage.
- **Recommendation:** C, changed from A after the options check. It proves
  every retained annotation and removes base decoding with one fixed digest.
- **Action:** fix now, apply C.

Shared assumptions: exact output equality, retained freshness checks, and the
2% whole-tree memory limit come from the task. The captured-document
representation comes from the current code. No new setting or process is
permitted. These requirements apply to every option. E drops retained digest
proof but has narrower admission. D changes where the identity lives.

This is the workspace orchestrator's call of 2026-11-19. The performance
orchestrator's calls above set its correctness and memory limits.
The metadata guard is also the workspace orchestrator's call of that date.
HTML bytes omit comparison annotations, so byte equality cannot prove their
equality. The performance orchestrator accepted this correction on 2026-11-19.
The regression uses equal bytes with different metadata. Measurements also
report the number of the 1,508 `mokly-cloud` views admitted by this guard.
The workspace orchestrator chose C after the independent options check on
2026-11-19. It avoids a field list that can miss private annotations.
The empty-relocation-map guard is also this orchestrator's call of that date.
It preserves normalization for consumers of other moved entries.

## Milestone 1: Documentation alignment

Depends on: none

Confirm that the unchanged-view and comparison contracts cover the shortcut.
Keep requirements unchanged because the observable output stays equal.

- [ ] Delegate a protocol and README audit to the docs implementor.
- [ ] Update the comparison crate's entry-point notes only if they become stale.
- [ ] Record any required design correction before implementation.

## Milestone 2: Exact document identity and safe preparation

Depends on: 1

Delegate the bounded digest and comparison shortcut to the non-ui implementor.
Keep the complete path for ineligible, moved, and one-sided views.

- [ ] Add exact-byte identity for retained documents and charge its resident bytes.
- [ ] Add red-first behavioural coverage for new shortcut admission and its safety.
- [ ] Reject equal-byte inputs with different usage or tree annotations,
      including new ignore regions and changed style ownership.
- [ ] Avoid base decoding and duplicate preparation only after safe admission.
- [ ] Derive only results proved equal by admission from one document. Compute
      conservative material input signals when usage is not ready.
- [ ] Keep both closure policies, all resource byte checks, proof reads and recording,
      fallback behaviour, cancellation, and memo order.
- [ ] Add differential corpus coverage for results and published bytes.
- [ ] Run targeted tests and record test cost and red evidence.

## Milestone 3: Measurement and acceptance

Depends on: 2

Use separate release checkouts and target directories for merged main and
this branch. Run Cargo builds one at a time with incremental and dev debug
output disabled. Check disk and available memory before each large build.

- [ ] Check `examples/basic` and generated large catalogues from `scripts/large/`.
- [ ] Measure at least six interleaved baseline and branch rounds, warm and cold.
- [ ] Compare first Changes, comparison stages, and exact output.
- [ ] Measure whole-tree anonymous memory plus swap at startup and for ten edits.
- [ ] Send the implementation SHA and dist build commit to the performance orchestrator.
- [ ] Obtain `mokly-cloud` evidence for at least 0.3 seconds less comparison time
      and at least 0.3 seconds earlier first Changes, mean of six interleaved runs.
- [ ] Report admitted byte-and-metadata-equal view counts on `mokly-cloud`.
- [ ] Confirm memory within 2% of main for startup and ten edits.

Evidence and the short continuation ledger live under
`.context/first-changes-byte-equal-fast-path/`.
The independent options check is in `plan-options-check.md` in that folder.

## Milestone 4: Verification, review, and pull request

Depends on: 1, 2, 3

The workspace orchestrator owns verification, commits, review, and the pull request.

- [ ] Put Git 2.45 or later first on PATH, install git-lfs, and use pinned Bun.
- [ ] Run targeted checks, `cargo xtask check --suite repository`, and `cargo xtask check`.
      Report each blocked suite if the complete gate cannot run here.
- [ ] Commit with Conventional Commits and push the implementation.
- [ ] Review the complete diff against `origin/main`, or the supplied step-1 base,
      with the implementation-review skill. Check findings and apply up to two fix rounds.
- [ ] Merge the supplied step-1 branch with the git-merge skill when available.
      Audit the merge and verify the combined tree.
- [ ] Delete this plan after every other required TODO is complete and review is done.
- [ ] Open the stacked pull request. Preserve dated calls and the plan permalink
      in its description. Wait for CI with the finish-work skill's `scripts/ci-wait.sh`.
      Send the final report to the performance orchestrator. Do not merge.
