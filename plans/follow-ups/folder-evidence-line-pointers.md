# Folder evidence branch moved follow-up line pointers

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-20, from the read-only line pointer check of the branch
  `calummoore/mokly-folder-export-evidence-7rox`. This item carries the open
  part of that record. `plans/follow-ups/follow-up-line-pointer-drift.md`
  held it until main deleted that item in #410. Widened on 2026-11-21 by the
  restored bundle reuse change (#465), whose review listed 7 more moved
  pointers into `crates/mokly-sidecar/src/pool_bundle_cache.rs`. Widened on
  2026-11-22 by the warm edit bundle change on branch
  `calummoore/mokly-edit-bundle-path-kv2o`, whose review listed 4 more stale
  pointers into `crates/mokly-sidecar/src/pool.rs`.
- **Location:** `plans/follow-ups/sequential-evidence-capture-cost.md:10`,
  lines 11, 12, 13, 14, 54, 59, 69, 78, 81, 83, 87, and 218,
  `plans/follow-ups/ancestor-churn-disables-durable-capture.md:8`, lines 9,
  10, 70, 72, 74, and 76,
  `plans/follow-ups/bundle-recipe-query-suffix.md:7`, line 8, and line 28,
  `plans/follow-ups/css-bundling-global-pool.md:9` and line 73,
  `plans/follow-ups/fallback-keys-checkout-folder.md:10`, line 72, and line
  74,
  `plans/follow-ups/jsconfig-resolution-input.md:13`, lines 53, 59, and 70,
  `plans/follow-ups/marked-package-entry-targets.md:10`, lines 11, 78, 79,
  99, and 102,
  `plans/follow-ups/marked-reuse-link-retarget.md:11`, lines 12, 50, and 55,
  `plans/follow-ups/stylesheet-roots-span-parent.md:9`,
  `plans/follow-ups/flaky-warm-bundle-cache-no-record.md:13`, line 70, and
  line 72, `plans/follow-ups/serve-pause-warm-head.md:10` and line 45,
  `plans/follow-ups/serve-sidecar-prestart.md:7` and line 26, and
  `plans/follow-ups/sidecar-loaded-state-selection.md:10` and line 41.
- **Reason:** The workspace orchestrator chose on 2026-11-20 to record these
  pointers and not to fix them in the folder evidence branch, because the
  fix adds a scope round of about thirty minutes before the final gate.

- **Source:** Review.
- **Category:** Docs or spec.
- **Terms:**
  - **Line pointer:** a `path:line` code span in a follow-up item under
    `plans/follow-ups/` that names a place in the code.
  - **Frozen check:** the read-only check of 2026-11-20 below. It ran on the
    frozen source of the folder evidence branch, against the merge base
    `a2f61eb53`, before the branch merged `origin/main` at `a16a623e6`.
- **Background:**
  - Follow-up items name code places as line pointers. The follow-up layout
    asks for "Each file path and line" in the **Location** field.
  - The frozen check compared each line pointer into a source file that the
    branch changed with the same line at the merge base. Its counts belong
    to that check only:
    - In 13 items that the branch did not edit, 57 pointers then cited a line
      that held other text. The cause: the branch changed the cited source
      files.
    - At that check, the behaviour prose of these items stayed correct, and
      each cited source file existed.
    - At least one pointer was already wrong at the merge base.
      `jsconfig-resolution-input.md:53` cites `reuse` at
      `packages/mokly/src/sidecar/compiled.ts:106`. `reuse` was at line 111
      at the merge base and at line 114 in the frozen source.
    - The check did not confirm the intended target of the other pointers.
  - Later main changes closed 10 of the 57 pointers:
    - Main completed and deleted the
      [worker reuse provenance item](https://github.com/mokly-ai/mokly/blob/a2f61eb53ddaa76f5ce08b60a30932207f5b6ebc/plans/follow-ups/worker-bundle-reuse-provenance.md?plain=1),
      which held 5 of them, at lines 12, 39, 43, 49, and 102.
    - Main completed and deleted the
      [export pattern literal replacement item](https://github.com/mokly-ai/mokly/blob/a16a623e670deca5256ef6a43044f9441abad313/plans/follow-ups/export-pattern-literal-replacement.md?plain=1),
      which held 3 of them, at lines 9, 62, and 116.
    - Main rewrote `plans/follow-ups/installed-module-watch-paths.md` in #384
      and #385. Its two recorded pointers,
      `crates/mokly-render/src/bundle.rs:177` at lines 8 and 30 of the
      [earlier version](https://github.com/mokly-ai/mokly/blob/a2f61eb53ddaa76f5ce08b60a30932207f5b6ebc/plans/follow-ups/installed-module-watch-paths.md?plain=1),
      are no longer in the item.
  - The plan reuse change on branch
    `calummoore/mokly-plan-reuse-editor-files-2-4oor` closed 6 more. It
    completed and deleted the
    [editor invalidation item at `3450ee997`](https://github.com/mokly-ai/mokly/blob/3450ee9970a80d21c39cc29a7d8a92fb18165e64/plans/follow-ups/serve-plan-editor-invalidation.md?plain=1),
    which held them at lines 8, 9, 10, 47, 49, and 51 on 2026-11-21.
  - The **Location** holds the other 41 pointers in 9 items. When this item
    was added, main and the folder evidence branch had left these items
    unchanged since the merge base, apart from a two-line change of
    `stylesheet-roots-span-parent.md` that kept its recorded line 9. So the
    item lines were exact then. No later check confirmed the cited source
    lines.
  - Later edits of these items, from their Git history:
    - #408 changed two other lines of `css-bundling-global-pool.md` in place.
    - #448 replaced line 54 of `ancestor-churn-disables-durable-capture.md`
      with three lines. So its pointers at the recorded item lines 68, 70,
      72, and 74 moved to lines 70, 72, 74, and 76. The **Location** gives
      the new lines.
    - The plan reuse change edited `ancestor-churn-disables-durable-capture.md`
      and `marked-package-entry-targets.md`, and it moved no cited line. It
      changed the text at the cited lines 10, 11, and 99 of
      `marked-package-entry-targets.md`, and no cited line of the other item.
    - Nobody checked the cited source lines after these edits.
  - The record started in `plans/follow-ups/follow-up-line-pointer-drift.md`.
    Main deleted that item in #410 on 2026-11-20, after it re-anchored the
    two pointers that the item itself named, with a symbol beside each. The
    [deleted drift item at `b3f753722`](https://github.com/mokly-ai/mokly/blob/b3f753722c31afb718f7188386c11a1cfc92cfda/plans/follow-ups/follow-up-line-pointer-drift.md?plain=1)
    keeps the earlier history of the record. This item carries only the
    open pointers that the folder evidence branch moved.
  - The restored bundle reuse change (#465) added request pins and two seed
    install methods to `crates/mokly-sidecar/src/pool_bundle_cache.rs`. Its
    review of 2026-11-21 found 7 pointers into that file, in 3 items, that
    were already wrong on `main` before the change and moved further with
    it. Their targets at the head of that change, `05c7fe4d6`:
    - `flaky-warm-bundle-cache-no-record.md:13` cites lines 41 to 150 for
      the bundle cache code of the pool. That code is now at lines 17 to 187,
      from `BundleAttempt` to the end of `complete_bundle`.
    - `flaky-warm-bundle-cache-no-record.md:70` cites lines 131 to 143 for
      the save of `complete_bundle`. It is now at lines 173 to 185.
    - `flaky-warm-bundle-cache-no-record.md:72` cites line 62 for the load
      in `seed_bundle`, and its next sentence cites line 63 for the cause.
      They are now at lines 107 and 108.
    - `serve-pause-warm-head.md:10` and line 45 cite line 62 for the load in
      `seed_bundle`. It is now at line 107.
    - `sequential-evidence-capture-cost.md:14` and line 87 cite lines 111 to
      123 for the save of `complete_bundle`. It is now at lines 173 to 185.
  - The warm edit bundle change of 2026-11-22 added the source digest
    boundary to `crates/mokly-sidecar/src/pool.rs`. Its review found 4
    pointers into that file, in 2 items, that were already wrong at its merge
    base `249fa1aa5` and moved further with it. Their targets at the head of
    that change:
    - `serve-sidecar-prestart.md:7` and line 26 cite lines 75 and 119 for
      `acquire` and `spawn`. `Pool::acquire` is now at
      `crates/mokly-sidecar/src/pool_leases.rs:16`, and `Pool::spawn` at
      `crates/mokly-sidecar/src/pool.rs:120`.
    - `sidecar-loaded-state-selection.md:10` and line 41 cite line 171 for
      the slot that goes back to the idle queue when its request ends. That
      push is now in `Pool::release`, at line 215.
  - The workspace orchestrator's call of 2026-11-20: record these pointers,
    so that one later change updates the line references together. A fix in
    the folder evidence branch was rejected, because it adds a scope round
    of about thirty minutes before the final gate. The behaviour prose stays
    correct, and the cited source files resolve.
  - The shared `documentation` skill already holds the wider rule for this
    class: a doc that contradicts the changed code gets fixed, and a change
    that removes or renames a name searches `docs/`, `plans/`, and every
    `README.md` for it.
- **Problem:** 52 line pointers in 13 follow-up items cite source lines that
  moved: 41 that the folder evidence branch moved, 7 into
  `pool_bundle_cache.rs` that were already wrong and that #465 moved
  further, and 4 into `pool.rs` that were already wrong and that the warm
  edit bundle change moved further.
- **Impact if no action:** A reader who follows such a pointer opens the
  wrong code and must search for the target. A wrong pointer can also
  mislead a fix.
- **Root question:** How do these 13 items get true source pointers again
  after the code moved?
- **Options:**
  - **A.** In a later branch, re-anchor the 52 pointers at that branch's
    commit. Cost: the next move can break them again. Effort: Small.
  - **B.** Apply A, and name the symbol beside each pointer, as #410 did. A
    reader then finds a moved target by its name, and a search for the name
    finds the pointer. Cost: the lines can still drift. Effort: Small.
  - **C.** Leave the pointers. The prose stays correct, and the cited files
    resolve, but a reader opens the wrong lines. Effort: Small.
- **Left out:**
  - A proposal to the shared skills repository, such as anchors on a file
    and a symbol: the `documentation` skill already holds the wider rule for
    docs drift, so this item proposes no other wider fix.
  - A repository check that resolves each line pointer under `plans/`: it is
    a new gate, so it needs the user. It also cannot tell a moved target from
    a line that still exists.
- **Wider fix:** None. The shared `documentation` skill is the wider rule in
  force for this class.
- **Previous examples:**
  - Commit `6e02b32dd` of 2026-11-01 re-anchored line pointers in
    `plans/follow-ups/nested-own-preview-matches.md` after code moved.
  - On 2026-11-18, the branch
    `calummoore/fu-linked-renderer-stylesheet-root-crva` re-anchored 27
    pointers that its change shifted in nine items.
  - On 2026-11-19, the branch `calummoore/mokly-return-warmup` re-anchored
    the seven pointers that it moved, with a symbol beside each.
  - On 2026-11-20, #410 re-anchored two stale pointers with a symbol beside
    each.
- **Recommendation:** B. It fixes the 52 recorded pointers and keeps them
  easy to find after the next move.
- **Action:** fix after merge, apply B, because the workspace orchestrator
  chose on 2026-11-20 to record these pointers instead of a fix in the
  folder evidence branch, to avoid a scope round of about thirty minutes
  before the final gate.
