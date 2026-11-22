# Shorten the watch candidate step of each edit

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Closed experiment record.
- **Added:** 2026-11-21, from the bounded experiment C of the Serve edit
  experiments, which ran diagnostics on `main` at `e331ad64b`, PR #449.
- **Location:**
  - `crates/mokly-cli/src/serve_watch.rs:119`: `WatchInputs::candidate` of
    `WatchedInputs`, which the diagnostic span `watch.candidate` timed.
    Line 128 collects the plan inputs, and line 129 compares them. Line 133
    builds the plan record. Lines 134 to 141 clone the prior plan. Lines 151
    to 153 clone the new plan, extend it, and replace the native
    registrations.
  - `crates/mokly-cli/src/serve_watch.rs:101`, lines 142 to 150, and line
    157: the replay of files that changed since the preparation began, the
    unobserved targets, and the recheck.
  - `crates/mokly-cli/src/serve_watch_plan.rs:42`, `:104`, `:129`, and
    `:147`: `PlanInputs::of`, `PlanRecord::new`, `PlanRecord::matches`, and
    `PlanRecord::unobserved`.
  - `crates/mokly-watch/src/plan.rs:172` and `:279`: `Plan::extend_required`
    and `Plan::targets`.
  - `crates/mokly-watch/src/native.rs:172`: the native `replace`.
  - `crates/mokly-cli/src/serve_rebuild_action.rs:75` and
    `crates/mokly-cli/src/serve_preparation.rs:44`: the callers of the
    candidate step.
  - `crates/mokly-server/src/replacement.rs:70` and
    `crates/mokly-server/src/snapshot.rs:140`: the detail encode and the
    index projection of a publication.
- **Reason:** The bounded stop of 2026-11-21 found that safe work in this step
  cannot save 30 ms for each edit, so no work follows.

- **Source:** Implementation.
- **Category:** Performance.
- **Terms:**
  - **Watch candidate:** the watch plan and observer that Serve prepares for a
    new generation, in `WatchInputs::candidate`.
  - **Plan record:** `PlanRecord`, a watch plan with its plan inputs and its
    targets. A candidate with equal plan inputs reuses the adopted record and
    observer without an attachment.
  - **Native registration:** the targets and the active directories that the
    native file watcher observes. The native `replace` swaps them for those of
    a new plan.
  - **Attachment:** the new plan after `Plan::extend_required` adds the
    required paths of the active plan, which stay attached until adoption.
  - **Integrated corpus:** a local copy of mokly-cloud that is newer than the
    official corpus: 174 entry modules, 402 flat entries, and 1,592 distinct
    visual documents. It is not the official corpus of 1,508 views.
- **Background:**
  - Experiment C was one of three bounded experiments of 2026-11-21 for faster
    Serve edits. Experiment D is in
    [serve-head-generation-preload.md](./serve-head-generation-preload.md).
    Experiment H is in
    [serve-postcompile-import-proof-cost.md](./serve-postcompile-import-proof-cost.md).
    The letters name experiments. Experiment C is not option C of the preload
    record.
  - The stop bar was a safe saving of at least 30 ms for each edit.
  - The baseline was `main` at `e331ad64bb684b0c6049ef6b0a7ec92af44f4dde`, PR
    #449, as a release build with diagnostic spans only.
  - The runs used the integrated corpus on 4 vCPU, with two sidecars and Node
    24.22.1. Five warm pairs of an edit and its restore ran.
  - Each of the 10 actions moved 44 document keys. Every source restore was
    exact.
  - The runs used an explicit missing base, so Changes was unavailable. The
    edit changed the `Save changes` label, not the official `TITLE` text.
  - No time in this record is an official Changes timing or a Changes-ready
    acceptance result.
  - The first mismatch of the plan inputs was in the resources. Later
    mismatches were in the membership of the resolution files.
  - A source-coverage proof failed. The symmetric differences of those inputs
    are not all inside the unchanged `model.sources`. So the input differences
    are legitimate.
  - A change must keep these inputs and every unobserved, modification-time,
    and recheck check.
  - The section "Measurements of experiment C" below gives the earlier
    attribution, the final native probe, and the final spans.
- **Problem:** When the plan inputs of an edit change, the watch candidate step
  builds a new plan record, extends it, and replaces the native
  registrations. This step took 41 to 51 ms for each edit in the local runs.
  The bounded stop found no safe way to save 30 ms of it.
- **Impact if no action:** Each such edit keeps this step, 41 to 51 ms in the
  local runs. This record holds no official timing of it.
- **Root question:** How can Serve take at least 30 ms from each edit in the
  watch candidate step, and keep every watch input and check?
- **Options:**
  - **A.** Change nothing. This is the settled outcome of the stop of
    2026-11-21. Effort: Small.
  - **B.** Cut the safe local parts: the plan clones, the extension, the
    detail work, and the index projection. These parts measured about 1 to
    10 ms each, and safe work on them does not support 30 ms for each edit.
    The stop does not start this weaker work. Effort: Medium.
  - **C.** Build broader plan or native registration algorithms. A 30 ms
    saving needs such work. It lies outside the bounded candidate, and nobody
    authorized it. Effort: Large.
- **Left out:**
  - Simple reuse of the effective sources. The input differences are
    legitimate, and the source-coverage proof failed.
  - A native no-op shortcut. No edit has identical native registrations, and
    the target sets still differ on each restore.
  - Removal or weakening of an unobserved, modification-time, or recheck
    check. Each check must stay.
- **Wider fix:** None. This is a speed opportunity, not a class of defect.
- **Previous examples:** Commit `10487c8cc` holds the reuse of the adopted
  watch plan when the plan inputs are equal.
- **Related:**
  - [serve-head-generation-preload.md](./serve-head-generation-preload.md) and
    [serve-postcompile-import-proof-cost.md](./serve-postcompile-import-proof-cost.md)
    record experiments D and H of the same day.
  - [watch-plan-clone-reads.md](./watch-plan-clone-reads.md) owns a different
    small cost: four callers clone the whole live watch plan to read only the
    repository path or the debounce. This record does not cover it.
  - [serve-plan-record-start-cost.md](./serve-plan-record-start-cost.md) owns
    a different cost: the start cost of the compiled import plan record of
    the sidecar and its encoding. That plan is not the watch plan. This record
    does not cover it.
- **Recommendation:** A. Safe work in this step cannot save 30 ms for each
  edit, and a 30 ms saving needs broader algorithms that nobody authorized.
- **Action:** No action. The stop of 2026-11-21 is settled, and no current
  decision waits for the user. A later proposal that differs materially needs
  new evidence and its own scope approval.

## Measurements of experiment C

All times are in milliseconds. They are local attributions, not official
Changes timings.

### Earlier attribution

- `watch.candidate` took 49 to 51.
- In later edits, the gap between graph and index took 62, 63, 69, and 66.
- In later edits, the detail encode took about 4, the detail reuse 3 to 10,
  and the index projection 1 to 3.

### Final native probe

| Action       | Cached                                | Attachment    | Directory changes  |
| ------------ | ------------------------------------- | ------------- | ------------------ |
| Each edit    | 5,201 targets, 295 active directories | 5,204 targets | 1 added, 0 removed |
| Each restore | 5,204 targets, 296 active directories | 5,202 targets | 0 added, 0 removed |

- Cached gives the cached targets and the active directories before the
  action.
- The target sets still differ on each restore.
- No edit has identical native registrations.
- So a simple reuse of the effective sources and a native no-op shortcut are
  invalid for edits.

### Final spans

On the first edit, `watch.candidate` took 47 and the native replacement 28.

| Span                                            | Later edits, in order |
| ----------------------------------------------- | --------------------- |
| `watch.candidate`                               | 41, 51, 45, 47        |
| `PlanRecord::new`                               | 10, 12, 11, 15        |
| Clones of the prior plan and the candidate plan | about 1 to 2 in total |
| `extend_required`                               | 3, 5, 5, 4            |
| Native `replace`                                | 24, 31, 25, 25        |

- Input collection and equality took less than the 1 ms span resolution.
- Safe clone, extension, detail, and projection work does not support 30 ms
  for each edit.
- A 30 ms saving needs broader plan or native algorithms. That work is
  outside the bounded candidate, and nobody authorized it.
- No such optimization and no new production plan follows. The stop starts no
  weaker-target follow-up.

## Checks of experiment C

- A focused trace assertion failed first: 0 passed, 1 failed, and 176
  filtered. Then it passed: 1 passed, 0 failed, and 176 filtered.
- The release CLI build and five npm builds passed.
- The format, diff, and cap checks passed. The largest changed Rust file had
  297 lines.
- A reverse apply of the archived patch passed. The source was restored clean
  at `e331ad64b`.
- The stop fetched PR #450 but did not merge it.
- These did not happen: an optimization, a candidate SHA, a pull request, a
  merge, the repository suite, the complete gate, Clippy, a four-fixture
  equality proof, a review, CI, and an official latency, readiness, first
  Changes, or memory run. This record makes no acceptance claim.
- The workspace of the stop keeps the diagnostic patch and the raw evidence,
  outside the repository. The diagnostic code is not for merging.
- The SHA-256 of the full diagnostic patch is
  `e919ee84feb416fa9331022a2da4cce0847f9302260d69568083fbe8148aa70f`. This
  record holds every fact that it needs from the patch and the evidence.
