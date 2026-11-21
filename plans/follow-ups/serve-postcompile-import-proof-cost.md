# Shorten the guarded import proof after each compile

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Closed experiment record.
- **Added:** 2026-11-21, from the bounded experiment H of the Serve edit
  experiments, which ran diagnostics on `main` at `e331ad64b`, PR #449.
- **Location:**
  - `packages/mokly/src/sidecar/planned-relative.ts:75`:
    `PlannedRelative.verify`, the proof. Line 104 classifies the targets.
    Lines 122 to 124 read and check the metadata. Lines 125 to 128 record the
    observations.
  - `packages/mokly/src/sidecar/bundle.ts:258`: the call of the proof after a
    planned compile, and the fallback to the complete planned compile.
  - `packages/mokly/src/sidecar/native-plan.ts:146`: `classifyNativeTarget`.
  - `packages/mokly/src/sidecar/metadata-proof.ts:32` and `:49`:
    `MetadataProof.use` and `MetadataProof.current`.
  - `packages/mokly/src/sidecar/module-paths.ts:219`: `ModulePaths.observe`.
  - `packages/mokly/src/sidecar/dependency-usage.ts:35`:
    `DependencyUsage.resolved`.
  - `packages/mokly/src/sidecar/native-resolution.ts:49`: `importCallbackKey`.
- **Reason:** The bounded stop of 2026-11-21 found no safe cut of 30 ms or
  more in this proof, so no work follows.

- **Source:** Implementation.
- **Category:** Performance.
- **Terms:**
  - **Planned compile:** a Serve edit compile that resolves imports from the
    saved import plan of an earlier compile.
    `docs/protocol/mokly-sidecar-plans.md` holds its rules.
  - **Guarded import proof:** `PlannedRelative.verify`. After a planned
    compile in which esbuild resolved safe relative imports itself, it checks
    the import edges of the new metafile before the result stands.
  - **Fallback:** when the proof fails, the edit runs the complete planned
    compile in place of the guarded result.
  - **Integrated corpus:** a local copy of mokly-cloud that is newer than the
    official corpus: 174 entry modules, 402 flat entries, and 1,592 distinct
    visual documents. It is not the official corpus of 1,508 views.
- **Background:**
  - Experiment H was one of three bounded experiments of 2026-11-21 for faster
    Serve edits. Experiment D is in
    [serve-head-generation-preload.md](./serve-head-generation-preload.md).
    Experiment C is in
    [serve-watch-candidate-plan-cost.md](./serve-watch-candidate-plan-cost.md).
    The letters name experiments, not options of those records.
  - The stop bar was a safe saving of at least 30 ms for each edit.
  - This proof checks imports after a compile. It is not a comparison proof,
    and it is not a byte proof of published output.
  - The baseline was `main` at `e331ad64bb684b0c6049ef6b0a7ec92af44f4dde`, PR
    #449. Experiment H added diagnostic spans only.
  - The scope was `PlannedRelative.verify` and its direct proof helpers. A
    change had to keep the boolean result, the fallback, the identity, the
    captures, and the result bytes.
  - A change could not touch the create step, the compile callbacks, the
    reuse of PR #449, the digests, or resolution.
  - The existing per-target Promise memo of the proof stays.
  - The diagnostic spans split the proof into these phases:
    - Total: the whole proof.
    - Classify: the awaited `classifyNativeTarget` checks of new targets.
    - Metadata: the package metadata reads of the target directories, with
      `MetadataProof.use`.
    - Current: the synchronous age and path check, `MetadataProof.current`.
    - Observe: the `ModulePaths.observe` and `DependencyUsage.resolved` calls
      for each accepted edge.
  - Each measured edit had one compile and a successful proof. Nobody
    measured a false result or the fallback path.
  - Each restore reused its recipe, with no compile and no proof.
  - The first proof had no special penalty against later proofs. The first
    edit had a slower tail outside the proof, which H does not cover.
  - The section "Measurements of experiment H" below gives every phase time
    and the findings.
- **Problem:** After each planned edit compile, the guarded import proof runs
  before the result stands. It took 13.569 to 25.583 ms for each edit in the
  local runs. The bounded stop found no safe cut of 30 ms or more.
- **Impact if no action:** Each planned edit keeps its proof time. The
  official proof time after PR #449 is not known.
- **Root question:** How can Serve take at least 30 ms from each edit in the
  guarded import proof, with identical results?
- **Options:**
  - **A.** Change nothing. This is the settled outcome of the stop of
    2026-11-21. Effort: Small.
  - **B.** Apply the three cuts that the stop check estimated from the source.
    They give 5 to 12 ms together, below the bar. Nobody implemented or
    measured them, and the stop does not start them. Effort: Medium.
- **Left out:**
  - Removal of the whole proof. The largest local proof took 25.583 ms, so
    even removal cannot save 30 ms locally. Removal also breaks the required
    boolean result and fallback.
  - Reuse of proof work across requests, a worker thread, or a parallel
    recipe. Each request has new `ModulePaths`, so the observations repeat.
    The recipe reads the proof records. Within the scope, none of these gives
    a valid 30 ms cut.
  - Changes to the create step, the compile callbacks, the reuse of PR #449,
    the digests, or resolution. They are outside the scope that keeps
    identical results.
- **Wider fix:** None. This is a speed opportunity, not a class of defect.
- **Previous examples:** PR #448, commit `e69db4ce8`, let esbuild resolve safe
  relative imports during planned edit compiles. This proof guards those
  compiles. PR #449, commit `e331ad64b`, reduced the bundle reuse read
  overhead.
- **Related:**
  - [serve-head-generation-preload.md](./serve-head-generation-preload.md) and
    [serve-watch-candidate-plan-cost.md](./serve-watch-candidate-plan-cost.md)
    record experiments D and C of the same day.
  - [serve-plan-record-start-cost.md](./serve-plan-record-start-cost.md) owns
    a different cost: the start cost of the compiled import plan record and
    its encoding. This record does not cover it.
- **Recommendation:** A. The stop found no safe cut of 30 ms or more, and the
  three known cuts give only 5 to 12 ms together.
- **Action:** No action. The stop of 2026-11-21 is settled, and no current
  decision waits for the user. A later proposal that differs materially needs
  new evidence and its own scope approval.

## Measurements of experiment H

All times are in milliseconds. Each restore matched the authored source
exactly.

`examples/basic`, three edits, with a real base and Changes ready:

| Phase    | Edit 1 | Edit 2 | Edit 3 |
| -------- | ------ | ------ | ------ |
| Total    | 16.441 | 18.382 | 21.977 |
| Classify | 6.431  | 8.913  | 12.819 |
| Metadata | 0.241  | 0.217  | 0.162  |
| Current  | 0.439  | 0.298  | 0.350  |
| Observe  | 8.795  | 8.785  | 8.452  |

The default full large React fixture of `scripts/large/` has 30 areas, 40
screens, 12 rows, 4 stylesheets, a share of 0.5, 1,620 entries, and 5,850
documents. One shared component edit and its restore ran, with Changes ready.
The proof took 13.569: classify 8.379, metadata 0.305, current 0.752, and
observe 3.826.

The integrated corpus, three edits, on 4 vCPU with two sidecars and
Node 24.22.1:

- The runs used an explicit missing base, so Changes was unavailable.
- The edit changed the `Save changes` label, not the official `TITLE` text.
- These times are not a Changes-ready acceptance result.

| Phase    | Edit 1 | Edit 2 | Edit 3 |
| -------- | ------ | ------ | ------ |
| Total    | 21.977 | 22.438 | 25.583 |
| Classify | 9.321  | 9.776  | 11.352 |
| Metadata | 0.625  | 0.349  | 0.367  |
| Current  | 2.221  | 1.808  | 2.114  |
| Observe  | 9.552  | 10.353 | 11.596 |

Findings:

- Classify and observe are 86% to 90% of the integrated proof. Metadata and
  current together take 2.157 to 2.846 ms.
- The largest local proof took 25.583 ms. So even removal of the whole proof
  cannot save 30 ms locally.
- The official proof time after PR #449 is not known. The local data do not
  prove that a 30 ms saving is impossible on the official corpus.
- A fresh read-only stop check by Claude Opus 5.5 at max effort supported the
  stop. It found no missed structural cut of 30 ms or more.
- The edge scan must inspect each new metafile. Each request has new
  `ModulePaths`, so the observations repeat.
- A change must keep the per-target memo and every false and fallback path.

The stop check estimated three cuts from the source. Nobody implemented or
measured them. Together they give 5 to 12 ms:

| Cut                                                                  | Source estimate |
| -------------------------------------------------------------------- | --------------- |
| Skip the dependency-usage call that does nothing for a relative name | 3 to 6 ms       |
| Deduplicate repeated `observe(file)` calls                           | 1 to 3 ms       |
| Build the edge keys of each importer from one same-byte prefix       | 1 to 3 ms       |

## Checks of experiment H

- 15 focused timing, planned-relative, and metadata tests passed.
- The package `tsc`, targeted ESLint, the npm build, and a locked release
  build passed.
- The stop then restored the source without the diagnostics, rebuilt
  `@mokly/mokly` from clean source, and left a clean tree at `e331ad64b`.
- These did not happen: an optimization, an active plan, a commit, a push, a
  pull request, the gate, an official timing or memory run, and a
  four-fixture byte proof of a candidate.
