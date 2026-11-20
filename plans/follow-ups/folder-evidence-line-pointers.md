# Folder evidence branch moved follow-up line pointers

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-20, from the read-only line pointer check of the branch
  `calummoore/mokly-folder-export-evidence-7rox`. This item carries the open
  part of that record. `plans/follow-ups/follow-up-line-pointer-drift.md`
  held it until main deleted that item in #410.
- **Location:** `plans/follow-ups/sequential-evidence-capture-cost.md:10`,
  lines 11, 12, 13, 54, 59, 69, 78, 81, 83, and 218,
  `plans/follow-ups/ancestor-churn-disables-durable-capture.md:8`, lines 9,
  10, 68, 70, 72, and 74,
  `plans/follow-ups/bundle-recipe-query-suffix.md:7`, line 8, and line 28,
  `plans/follow-ups/css-bundling-global-pool.md:9` and line 73,
  `plans/follow-ups/fallback-keys-checkout-folder.md:10`, line 72, and line
  74,
  `plans/follow-ups/jsconfig-resolution-input.md:13`, lines 53, 59, and 70,
  `plans/follow-ups/marked-package-entry-targets.md:10`, lines 11, 78, 79,
  99, and 102,
  `plans/follow-ups/marked-reuse-link-retarget.md:11`, lines 12, 50, and 55,
  `plans/follow-ups/serve-plan-editor-invalidation.md:8`, lines 9, 10, 47,
  49, and 51, and
  `plans/follow-ups/stylesheet-roots-span-parent.md:9`.
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
  - The **Location** holds the other 47 pointers in 10 items. Main and the
    branch left these items unchanged since the merge base, apart from a
    two-line change of `stylesheet-roots-span-parent.md` that kept its
    recorded line 9. So the item lines are exact. No later check confirmed
    the cited source lines.
  - The record started in `plans/follow-ups/follow-up-line-pointer-drift.md`.
    Main deleted that item in #410 on 2026-11-20, after it re-anchored the
    two pointers that the item itself named, with a symbol beside each. The
    [deleted drift item at `b3f753722`](https://github.com/mokly-ai/mokly/blob/b3f753722c31afb718f7188386c11a1cfc92cfda/plans/follow-ups/follow-up-line-pointer-drift.md?plain=1)
    keeps the earlier history of the record. This item carries only the
    open pointers that the folder evidence branch moved.
  - The workspace orchestrator's call of 2026-11-20: record these pointers,
    so that one later change updates the line references together. A fix in
    the folder evidence branch was rejected, because it adds a scope round
    of about thirty minutes before the final gate. The behaviour prose stays
    correct, and the cited source files resolve.
  - The shared `documentation` skill already holds the wider rule for this
    class: a doc that contradicts the changed code gets fixed, and a change
    that removes or renames a name searches `docs/`, `plans/`, and every
    `README.md` for it.
- **Problem:** 47 line pointers in 10 follow-up items cite source lines that
  the folder evidence branch moved.
- **Impact if no action:** A reader who follows such a pointer opens the
  wrong code and must search for the target. A wrong pointer can also
  mislead a fix.
- **Root question:** How do these 10 items get true source pointers again
  after the folder evidence branch moved the code?
- **Options:**
  - **A.** In a later branch, re-anchor the 47 pointers at that branch's
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
- **Recommendation:** B. It fixes the 47 recorded pointers and keeps them
  easy to find after the next move.
- **Action:** fix after merge, apply B, because the workspace orchestrator
  chose on 2026-11-20 to record these pointers instead of a fix in the
  folder evidence branch, to avoid a scope round of about thirty minutes
  before the final gate.
