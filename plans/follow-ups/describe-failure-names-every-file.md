# A describe failure names every file

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-24, from a finding check of the implementation review
  of pull request #492, branch `conductor/storybook-support-b-story-reading`,
  listed outside the scope.
- **Location:** `packages/mokly/src/sidecar/describe.ts:33-37`, where
  `describe` turns an error into `bundle-failed`.
- **Reason:** The message format predates the branch that found it, so the
  review kept this problem out of that branch.

- **Source:** Review.
- **Category:** Product bug.
- **Background:**
  - The fail-closed table of `docs/protocol/mokly-sidecar.md` says that
    `bundle-failed` presents as `build-invalid` "with the module and
    diagnostic".
  - When the collection of definitions throws, `describe` writes the
    message
    `${generation.params.entryFiles.concat(generation.params.storiesFiles).join(", ")}: ${detail(error)}`.
- **Problem:** The message lists every entry module and stories file of the
  generation, not the module that failed, as the code above shows.
- **Impact if no action:** In a large catalogue, the author must search for
  the file that failed.
- **Root question:** How does a `describe` failure name the module that
  caused it?
- **Options:**
  - **A.** Keep the current module in the collection loop, and name it in
    the `bundle-failed` message. Fall back to the file list when the
    failure has no module. Test a failing stories file. Effort: Small.
  - **B.** Turn a module's failure into a source-attributed diagnostic of
    the `describe` result, so that the other modules still describe. It
    adds a new diagnostic kind, which needs the user's approval. Effort:
    Medium.
- **Left out:** A message without the file list fails the goal when the
  failure has no module.
- **Wider fix:** None, because this is one message.
- **Previous examples:** None found.
- **Related:** `plans/follow-ups/esbuild-evaluation-names-every-entry.md`:
  the sibling message of an esbuild evaluation failure in `describe`. Use one
  message form for both. Here the collection loop knows the module. That
  item needs a source map to know it.
- **Recommendation:** A. It meets the fail-closed table with the least
  change.
- **Action:** fix after merge, apply A, because the problem predates the
  branch that found it.
