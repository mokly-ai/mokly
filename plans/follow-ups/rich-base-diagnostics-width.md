# Rich base diagnostics skip the width bound

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-01, from the branch
  `conductor/rust-rebuild-150-base-install-scripts-and-managers`, which put
  the problem outside the scope of its first review.
- **Location:** `crates/mokly-cli/src/changes_output.rs:95` to line 121,
  `docs/protocol/mokly-terminal-output.md:51` to line 58, and
  `crates/mokly-cli/tests/changes_build_tests.rs:92`.
- **Reason:** The mismatch is older than the branch that found it, and its
  review found it outside the diff.

- **Source:** Review.
- **Category:** Docs or spec.
- **Terms:**
  - **Rich mode:** the terminal output for an interactive terminal, or for
    `MOKLY_OUTPUT=rich`. Plain mode is the automation output, and it prints
    full lines.
  - **Changes unavailable details:** the base diagnostics that `build` and
    `publish` print when the base fails validation. The command still
    succeeds, and Changes reports why it is unavailable.
  - **Scripts hint:** the sentence that names `review.baseInstallScripts`
    and `--base-install-scripts`. After a private base install with
    lifecycle scripts off, it is one of the Changes unavailable details.
- **Background:**
  - `docs/protocol/mokly-terminal-output.md` bounds every rich line by the
    width of stdout, or by 80 columns when the width is unknown. A cut line
    ends with an ellipsis. Only recovery paths, such as a backup path, are
    never cut.
  - `docs/protocol/mokly-base-preparation.md` says that base diagnostics
    are detail lines that name the full base commit and the original
    terminal code.
  - `changes_output::diagnostics` prints each Changes unavailable detail on
    stderr as `base {commit}: [mokly/{code}] {message}`. Rich mode adds a
    two-space indent and does not cut the line.
  - The text before the message takes 71 columns for the code
    `build-invalid`, because the commit has 40 characters.
  - Other rich lines go through `bounded` in `crates/mokly-cli/src/output.rs`.
    One is the `! Changes unavailable · {reason}` line on stdout.
  - The test `base_validation_failure_keeps_the_head_catalogue_and_prints_each_source_diagnostic`
    in `crates/mokly-cli/tests/changes_build_tests.rs` runs a rich `build`
    with an unknown width. It expects message text of the base diagnostics
    in stderr, so a cut at 80 columns fails it.
  - The scripts hint has 105 characters.
- **Problem:** Rich `build` and `publish` print the Changes unavailable
  details without the width bound of the terminal output contract. The
  contract and the output disagree.
- **Impact if no action:** The contract does not describe the rich output. A
  later change that follows the contract can cut each base diagnostic and
  the scripts hint.
- **Root question:** How should rich `build` and `publish` show the Changes
  unavailable details, so that the terminal output contract and the output
  agree?
- **Options:**
  - **A.** Keep the output. Add the Changes unavailable details to the
    exception of the width rule in `docs/protocol/mokly-terminal-output.md`,
    beside recovery paths. Add a unit test that a rich detail longer than
    the width prints in full. Long details then wrap at the terminal edge
    without an indent. Effort: Small.
  - **B.** Wrap each rich detail at the width, and indent each continuation
    line. Every terminal line then stays inside the width, and the full text
    shows. The width rule gets a wrap rule for these lines. `output.rs` gets
    a wrap helper that keeps ANSI sequences and counts display columns.
    Effort: Medium.
  - **C.** State one width rule for every rich line that the user needs
    whole: recovery paths, the rich hint line of an error, and the Changes
    unavailable details print in full. Give the shared renderer one kind of
    line for them, and print all three through it. Only progress, panel,
    and column lines keep the cut. Effort: Medium.
- **Left out:**
  - Cut each rich detail, as the contract says now. At 80 columns a line
    keeps about 8 characters of its message, and the scripts hint is cut,
    which a fix here must not do. With an exception for the hint line, A is
    better on every point.
  - Print the base commit once as a header line, and cut each shorter line.
    The scripts hint line is still longer than 80 columns, so it is cut.
- **Wider fix:** C. One kind of line that the shared renderer never cuts
  covers every later line that the user needs whole.
- **Previous examples:** Commit `d935e6a6` added the exception for recovery
  paths to the width rule.
- **Related:** [rich-scripts-hint-cut.md](./rich-scripts-hint-cut.md)
  concerns the same width rule for the rich error block. Its chosen option
  makes the rich hint line of an error never cut. A fix here must not cut
  the scripts hint, which these details carry as a separate line. C would
  also cover that hint line.
- **Recommendation:** A. It makes the contract describe the output that a
  test already expects, at the smallest cost. C best protects the codebase,
  because one rule then covers every rich line that must stay whole.
- **Action:** ask the user, because every option changes the width rule of
  `docs/protocol/mokly-terminal-output.md`, and no recorded user decision
  covers that change.
