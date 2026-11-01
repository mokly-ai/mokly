# Rich output cuts off the scripts hint

- **Severity:** Medium. **Likelihood:** Rare (estimate). **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-01, from the branch
  `conductor/rust-rebuild-150-base-install-scripts-and-managers`, finding 1
  of its first review.
- **Location:** `crates/mokly-cli/src/output.rs:159` to line 175,
  `crates/mokly-cli/src/changes_diagnostics.rs:130` and `:182`,
  `crates/mokly-cli/src/serve_errors.rs:65` and `:103`,
  `crates/mokly-cli/src/serve_output.rs:187`,
  `crates/mokly-cli/src/build_output.rs:117`,
  `docs/protocol/mokly-terminal-errors.md:148` to line 155, and
  `docs/protocol/mokly-terminal-output.md:51` to line 58.
- **Reason:** On 2026-10-29 the user chose a later small pull request for
  this fix, because `origin/main` already cut the hint in rich mode before
  the branch that found the problem.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Rich mode:** the terminal output for an interactive terminal. It cuts
    each line at the terminal width, or at 80 columns when the width is
    unknown, and ends a cut line with an ellipsis. Plain mode prints full
    lines.
  - **Scripts hint:** the sentence "If this base needs lifecycle scripts,
    enable `review.baseInstallScripts` or use `--base-install-scripts`." It
    is `SCRIPTS_HINT` in `crates/mokly-cli/src/changes_diagnostics.rs`.
  - **Tier two:** the private install of the base commit's dependencies in
    the Mokly cache. Its lifecycle scripts stay off unless the user turns
    them on.
  - **Rich error block:** the lines that `Style::rich` in
    `crates/mokly-cli/src/output.rs` prints for a failure: a headline with
    the code, the indented detail lines, and one indented hint line.
- **Background:**
  - After a tier-two install with scripts off, every failure that Mokly
    attributes to the base gets the scripts hint, in every command.
    `docs/protocol/mokly-terminal-errors.md` states this rule.
  - `changes_diagnostics::failure_detail` ends the failure detail with the
    hint. Plain and rich output both use this detail. The plain line joins
    the detail and the hint with `. `, or with one space after a final `.`,
    `!`, or `?`.
  - Serve prints the detail in its rich error block. It also prints it in
    its rich `! Changes unavailable · {reason}` line on stdout.
  - A fatal comparison failure of `build` or `publish` prints the detail
    after `comparison against base ref "{ref}" failed: `.
  - Each detail starts with `base`, the full 40-character base commit, and a
    colon.
  - `docs/protocol/mokly-terminal-output.md` bounds every rich line by the
    terminal width. Only recovery paths, such as a backup path, are never
    cut.
  - `Style::rich` cuts every line of the error block, the hint line too.
    Its hint line holds the generic hint of the code from the rich error
    table, such as "Fix the reported comparison input and retry."
  - `Style::error_with_recovery` already puts a case-specific recovery in
    the single rich hint line, and at the end of the plain line. It joins the
    plain message and the recovery with one space.
  - The Changes unavailable details of `build` and `publish` print the hint
    as a separate diagnostic line. These lines print in full, so the hint
    stays whole there.
  - No test renders the rich lines that carry the hint. The tests check only
    the strings.
  - On 2026-10-28 the user chose that the hint ends with a period.
  - On 2026-10-29 the user chose option D for a later small pull request.
    The work keeps the plain output bytes the same and keeps the period.
- **Problem:** The hint has 105 characters, and it comes after the commit
  and the failure text. The fixed text before the failure text takes 49
  columns in the Serve error, 73 in the Serve reason line, and 99 in the
  fatal `build` line for the base `origin/main`. So rich mode cuts the hint
  at usual terminal widths. At 80 columns, the fatal `build` line is cut
  inside the commit.
- **Impact if no action:** A user who runs Serve in a terminal does not see
  how to turn on lifecycle scripts. The same is true for a `build` or a
  `publish` that fails in a terminal.
- **Root question:** How does rich output show the full scripts hint in
  every command, while plain output stays the same?
- **Options:**
  - **A.** In rich mode, print the hint on its own line after the error,
    and never cut that line, as recovery paths print. Remove the hint from
    the rich Serve reason line. Rich output then shows two recovery lines:
    the generic hint of the code and the scripts hint. Effort: Medium.
  - **B.** Show the scripts hint as the rich hint line of these failures, in
    place of the generic hint of the code. Users lose the generic hint for
    these failures. As written, B still cuts the 107-column hint line at 80
    columns, because `Style::rich` cuts its hint line. Effort: Medium.
  - **C.** Give the shared rich error renderer a typed list of recovery
    lines that it always prints in full. Move the recovery paths and the
    scripts hint to it. This touches six files in `mokly-cli` and both
    terminal pages. Effort: Large.
  - **D.** Make `Style::rich` never cut its hint line, as recovery paths are
    never cut. Send the scripts hint through `Style::error_with_recovery` as
    the case-specific recovery of the Serve error and of the fatal `build`
    and `publish` error. Remove the hint from the rich Serve reason line.
    Plain output stays one line with the hint at its end. Rich output of
    these failures loses the generic hint of the code, as in B. Both
    terminal pages change. Effort: Medium.
  - **E.** Stop cutting the detail and hint lines of every rich error block.
    Keep the hint at the end of the detail, and remove it from the rich
    Serve reason line. The failure text then shows too. Long errors wrap
    without their indent, and the width rule changes for every rich error.
    Rich output keeps two recovery actions unless E also applies D.
    Effort: Medium.
- **Left out:**
  - A shorter hint. No hint that names the setting and the flag fits after
    the fixed text at 80 columns.
  - A change to plain mode. Plain lines are never cut, so plain output
    already shows the full hint.
  - A Serve layout that prints base failures as the full base diagnostics
    of `build`. It changes the whole Serve failure layout and still leaves
    the fatal `build` and `publish` line.
  - A cut copy of the hint in the rich Serve reason line. Every option
    removes the hint there, because the line cuts it.
- **Wider fix:** D. The shared renderer then never cuts a recovery action,
  whatever its text or length. C adds little to D, because recovery paths
  already print in full. E also shows the failure text, but it changes the
  width rule of every rich error.
- **Previous examples:** A review of the scripts opt-in on 2026-10-21
  proposed the scripts hint as the rich hint line. On 2026-10-28 the user
  chose only the final period, because it cost less. Commit `d935e6a6`
  added the recovery-path exception to the width rule.
- **Related:**
  [rich-base-diagnostics-width.md](./rich-base-diagnostics-width.md)
  concerns the same width rule for the Changes unavailable details of
  `build` and `publish`, which carry the hint as a separate line. A fix
  there must not cut the hint.
- **Recommendation:** D. At the same effort as A, it shows the full hint in
  every rich path and keeps one rich hint line for each error.
- **Action:** fix after merge, apply D, because on 2026-10-29 the user chose
  D for a later small pull request.
