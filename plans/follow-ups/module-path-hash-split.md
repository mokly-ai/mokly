# Support a hash character in module paths

- **Severity:** Medium (estimate). **Likelihood:** Rare (estimate). **Effort:** Small (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #227 and its completed plan, which put the
  problem outside the scope of its first review.
- **Location:** `crates/mokly-render/src/graph.rs:180` and
  `crates/mokly-render/src/definition_input.rs:21` and line 41.
- **Reason:** The split is older than PR #227, and the review found it
  outside the diff of that change.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Definition handle:** the string that names one JavaScript definition
    as `{module path}#{export}`, such as `src/card.tsx#Card`.
  - **Stylesheet root:** one module whose imported stylesheets the render
    runtime bundles into one CSS output for the documents that use it.
- **Background:**
  - `entry_modules` in `crates/mokly-render/src/graph.rs:180` maps each
    JavaScript entry to its module. It splits the handle at its first `#`.
  - The stylesheet roots of the entries come from these module paths.
  - `crates/mokly-render/src/definition_input.rs:21` and line 41 split the
    same handles at their last `#`, with `rsplit_once`.
- **Problem:** A module path that contains `#`, such as `src/c#/card.tsx`,
  loses the part after its first `#` in `entry_modules`. The entry then
  gets the stylesheet module of another path, or none.
- **Impact if no action:** Such an entry renders with the wrong styles, or
  without its styles. The two splits also disagree on the module of the
  same handle.
- **Root question:** How does every reader of a definition handle get the
  exact module path, whatever characters the path holds?
- **Options:**
  - **A.** Change nothing. A `#` in a module path is rare. Effort: Small.
  - **B.** Split the handle at its last `#` in `entry_modules`, as
    `definition_input.rs` does. Effort: Small.
  - **C.** Add one helper that splits a handle into its module path and its
    export. Use it in `graph.rs` and `definition_input.rs`. Effort: Small
    (estimate).
  - **D.** Carry the module path and the export as two fields of the
    definition record, so that no reader parses a string. This changes a
    record that crosses the sidecar boundary. Effort: Large (estimate).
- **Left out:** Rejecting module paths with `#`. Such paths are valid files,
  and the rejection would remove a working layout.
- **Wider fix:** D (estimate). No reader then parses a handle.
- **Previous examples:** None found.
- **Recommendation:** C (estimate). One helper gives every reader the same
  split with a small change. D best protects the codebase, but it is Large.
- **Action:** fix after merge, apply C (estimate), because the wrong module
  path is a product bug outside the reviewed diff, and C is Small.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/per-entry-render-keys.md?plain=1#L556).
