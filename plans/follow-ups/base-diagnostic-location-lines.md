# Base details print location lists on one line

- **Severity:** Low. **Likelihood:** Rare. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-01, from the branch
  `conductor/rust-rebuild-150-base-install-scripts-and-managers`. The
  investigation of `plans/follow-ups/rich-base-diagnostics-width.md` found it
  outside that item.
- **Location:** `crates/mokly-cli/src/changes_output.rs:104`,
  `crates/mokly-cli/src/redaction.rs:35` to line 42,
  `crates/mokly-cli/src/build_output.rs:183` to line 192,
  `crates/mokly-catalogue/src/identity.rs:244` to line 256, and
  `docs/protocol/mokly-terminal-errors.md:54` to line 56.
- **Reason:** The code is older than the branch that found it, and the
  problem lies outside the item that the investigation checked.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Changes unavailable details:** the base diagnostics that `build` and
    `publish` print on stderr when the base fails validation. The command
    still succeeds.
  - **Location list:** a diagnostic message that gives a heading and then
    one location on each following line. `identity::list` in
    `crates/mokly-catalogue/src/identity.rs` builds it, for example for
    duplicate paths and case collisions.
- **Background:**
  - `docs/protocol/mokly-terminal-errors.md:54` to line 56 says: "A
    diagnostic whose exact text lists locations prints those locations as
    following lines, as `git-uncommitted` does. Each line escapes its control
    characters and has its own width bound in rich mode."
  - `Redactor::safe` in `crates/mokly-cli/src/redaction.rs:35` escapes every
    control character, line breaks included, as text such as `\u000a`.
    `Redactor::safe_lines` at line 40 keeps line breaks and escapes the other
    controls.
  - For the head catalogue, `crates/mokly-cli/src/build_output.rs:183` to
    line 192 prints the codes `DuplicateExport`, `DuplicatePath`,
    `CaseCollision`, `DuplicateFolder`, and `DuplicateMovedFrom` through
    `Style::error_lines`, which uses `safe_lines`. Their locations print as
    following lines.
  - `changes_output::diagnostics` at `crates/mokly-cli/src/changes_output.rs:104`
    prints each Changes unavailable detail through `Redactor::safe`.
  - So a base with duplicate paths or a case collision prints its location
    list as one line with literal `\u000a` text, in plain and in rich mode.
  - `docs/protocol/mokly-base-preparation.md` says that base diagnostics are
    detail lines that name the full base commit and the original terminal
    code.
- **Problem:** The Changes unavailable details print a location list as one
  line with literal `\u000a` text, not as following lines.
- **Impact if no action:** A user who reads why Changes is unavailable sees
  escape codes in place of a list of paths. The plain line of a base
  diagnostic also differs from the head error of the same diagnostic.
- **Root question:** How should the Changes unavailable details show a
  diagnostic that lists locations?
- **Options:**
  - **A.** In `changes_output::diagnostics`, use `Redactor::safe_lines` for
    the codes whose text lists locations, and indent each following line
    under its detail. The plain bytes of these details change from one line
    to several lines. Effort: Small.
  - **B.** Keep one line for each detail, and add the escaped form to
    `docs/protocol/mokly-terminal-errors.md` as an exception for the Changes
    unavailable details. This changes a requirement. Effort: Small.
  - **C.** Do A through one helper that `build_output` and `changes_output`
    both use. The helper owns the list of codes whose text lists locations,
    so a new such code keeps its lines on both paths. Effort: Small.
  - **D.** Print one detail line for each location, each with the full base
    commit and the code, after one detail line with the heading. Each line
    then names the commit, but the commit and the code repeat on every line,
    and the format differs from the head error. Effort: Small.
- **Left out:** Change nothing. The details keep breaking the rule for
  location lists, so it fails the goal.
- **Wider fix:** C. One helper decides which diagnostics keep their lines,
  so the head and the base cannot differ again.
- **Previous examples:** The head error path already keeps these lines
  through `Style::error_lines`.
- **Related:** [rich-base-diagnostics-width.md](./rich-base-diagnostics-width.md)
  changes the same code, `changes_output::diagnostics`, so one branch can do
  both. The rich width of each following line then follows the answer of
  that item.
- **Recommendation:** C. It prints the locations as following lines, as the
  requirement asks, and one helper keeps the head and the base alike.
- **Action:** fix after merge, apply C, because it is a product bug outside
  the reviewed diff, and C follows the requirement in force at
  `docs/protocol/mokly-terminal-errors.md:54` to line 56.
