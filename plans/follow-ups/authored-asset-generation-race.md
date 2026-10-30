# Keep authored assets available across generations

- **Severity:** Low (estimate). **Likelihood:** Rare (estimate). **Effort:** Medium (estimate). **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #222 and its completed plan. The CI fix
  milestone of that plan put the problem outside the scope.
- **Location:** `crates/mokly-server/src/backend.rs:186`,
  `crates/mokly-graph/src/session.rs:225`,
  `crates/mokly-graph/src/public_inputs.rs:1`, and
  `docs/protocol/mokly-public-closure.md:71`.
- **Reason:** The 404 comes from closure membership on `origin/main`, outside
  the diff of PR #222, which only exposed it through an extra startup rebuild.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Generation:** one prepared catalogue with its render state and its
    public-file policy. Serve publishes one generation at a time, and a
    source edit prepares a replacement generation.
  - **Closure:** the set of authored files, such as images and stylesheets,
    that one composed document reaches.
  - **Document key:** the hash of the render inputs of one document.
- **Background:**
  - Serve answers `/static/{path}` only for a path in a closure of the
    current generation, and only after the policy of that generation
    accepts the path. `GraphDocuments::authored` in
    `crates/mokly-server/src/backend.rs:186` asks `contains_public_file` in
    `crates/mokly-graph/src/session.rs:225`.
  - In on-demand mode, the closure of a document joins its generation when
    the document renders.
  - On 2026-10-28, the CI browser test "large watch delivers browser
    evidence for react" in `tests/browser/large_watch.spec.ts` got two 404
    responses for `/static/assets/mark.svg`. An extra rebuild at startup had
    published a new generation while the page loaded.
  - PR #244 fixed the case of unchanged documents on 2026-10-29.
    `ClosureInputs` in `crates/mokly-graph/src/public_inputs.rs` keeps the
    closure records of each document key for all generations. A replacement
    now serves the files of each unchanged document without a new render.
- **Problem:** A changed document does not carry its previous closure.
  `docs/protocol/mokly-public-closure.md:71` states this rule, and the test
  `changed_documents_do_not_carry_their_old_public_files` in
  `crates/mokly-graph/tests/public_closure_tests.rs` checks it. When a page of
  the old generation still loads after the replacement publishes, a request
  for a file that only changed documents reach gets 404. The 404 stays until a
  render of the new generation reaches the file.
- **Impact if no action:** A page that loads during a publication can show a
  missing image or style until the shell reloads its frame. The shell reloads
  only frames whose `documentKey` changed, under
  `docs/protocol/mokly-shell-delivery.md:182`. A browser test that edits a
  document while its page loads can record the 404 as a browser error.
- **Root question:** How does a page that loads during a publication get the
  authored files that it references?
- **Options:**
  - **A.** Change nothing. Keep the rule that a changed document does not
    carry its closure, and accept the 404 window before the frame reload.
    Delete this item. Effort: Small.
  - **B.** Carry the previous closure of a changed document into the
    replacement until the replacement renders that document. Check each
    carried file against the policy of the replacement. This changes the
    rule in `docs/protocol/mokly-public-closure.md:71`. Effort: Medium
    (estimate).
  - **C.** Render the changed documents before the replacement publishes, so
    that their closures exist at publication. Every rebuild then waits for
    these renders, which departs from on-demand rendering. Effort: Large
    (estimate).
  - **D.** Answer the authored requests of a page from the generation that
    rendered the page, for example through a generation segment in the
    authored URL. The old generation answers until it drops. Effort: Large
    (estimate).
- **Left out:** Serving every declared file without closure membership.
  PR #244 rejected it on 2026-10-29, because it weakens confinement. Rendering
  every retained view again. PR #244 rejected it, because it repeats work
  that the replacement keeps on purpose.
- **Wider fix:** D (estimate). A page then always reads the generation that
  rendered it, so no publication can separate a page from its files.
- **Previous examples:** PR #244 fixed the same class for unchanged documents
  on 2026-10-29. Before that, PR #222 narrowed its startup replay window on
  2026-10-28, which removed the extra rebuild that exposed the 404.
- **Recommendation:** B (estimate). It closes the 404 window of a changed
  document with the existing closure records and keeps the policy check. D
  best protects the codebase, but it changes every authored URL.
- **Action:** ask the user, because condition 1 holds (estimate): B changes
  the rule that a changed document does not carry its closure, which PR #244
  set on 2026-10-29.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/render-cache-weight-and-watch-recheck.md?plain=1#L485).
