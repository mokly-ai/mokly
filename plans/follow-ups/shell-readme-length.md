# Bring the shell README under its length target

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan: user item 95, F9b item 7 and decision 23.
- **Location:** `packages/viewer/src/shell/README.md:1`.
- **Reason:** On 2026-10-21 the user deferred the open review items of PR #199
  until after its merge, for the user's later choice.

- **Source:** Review.
- **Category:** Repository rule.
- **Background:** `packages/viewer/src/shell/README.md` documents the Browse
  shell, a flat directory of 186 entries since PR #249, and 192 before it.
  The contributor rules target about 200 lines for a file and ask to split a
  file that passes 300. The README had 494 lines under one heading on
  2026-10-21, and 542 lines on `main` at `f93afcea`. Since PR #249 of
  2026-10-30 it has 557 lines and still only two section headings, "Branch
  name" and "Scope". The repository link check reads only `README.md` files,
  `docs/`, `plans/`, and `AGENTS.md`.
- **Problem:** The page mixes entry points, standalone mechanics, and
  subject details under too few headings, and it passes the 300-line split
  rule.
- **Impact if no action:** Readers must scan one long page, and the length
  rule stays unresolved for this file.
- **Root question:** How should the shell's documentation stay findable and
  within the length rule?
- **Options:**
  - **A.** Keep one page, add a heading for each subject, and record the
    length exception, as an earlier decision did for the browser test
    guide. Effort: Small.
  - **B.** Move the standalone paragraphs into
    `packages/viewer/src/standalone/README.md`, and record the exception for
    the rest. Effort: Small.
  - **C.** Split the page into `packages/viewer/src/shell/docs/{subject}/README.md`
    pages, which the link check reads. Effort: Small.
  - **D.** Move the mechanics into module doc comments, and keep a short
    index of entry points. Effort: Large.
- **Left out:** Deleting the mechanics loses the only current explanation of
  those entry points.
- **Wider fix:** D. Code comments keep each mechanism beside its owner and
  leave a short index.
- **Previous examples:** The viewer package README was split into pages
  under `packages/viewer/docs/` and has 306 lines since PR #249, and 294
  before it. An earlier decision kept the browser test guide,
  `tests/browser/README.md`, as one page with a heading for each subject and
  a recorded exception.
- **Recommendation:** A. A split by subject needs doc-only folders in the
  source tree, and module mechanics belong in code comments. D best protects
  long-term ownership.
- **Action:** ask the user, because the user reserved the choice for each open
  review item of the rebuild.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5863).
