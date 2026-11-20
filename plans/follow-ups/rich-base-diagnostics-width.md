# Rich base diagnostics skip the width bound

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-01, from the branch
  `conductor/rust-rebuild-150-base-install-scripts-and-managers`, which put
  the problem outside the scope of its first review.
- **Location:** `crates/mokly-cli/src/changes_output.rs:99` to line 126,
  `crates/mokly-cli/src/one_shot/phases.rs:93` to line 106,
  `docs/protocol/mokly-terminal-output.md:51` to line 59,
  `docs/protocol/mokly-terminal-errors.md:150` to line 163, and
  `crates/mokly-cli/tests/changes_build_tests.rs:91` to line 126.
- **Reason:** The mismatch is older than the branch that found it. Its review
  found it outside the diff.

- **Source:** Review.
- **Category:** Docs or spec.
- **Terms:**
  - **Rich mode:** the terminal output for an interactive terminal, or for
    `MOKLY_OUTPUT=rich`. Plain mode is the automation output. It prints full
    lines.
  - **Changes unavailable details:** the base diagnostics that `build` and
    `publish` print on stderr when the base fails validation or reaches a
    comparison limit. The command still succeeds.
  - **Scripts hint:** the 105-character sentence that names
    `review.baseInstallScripts` and `--base-install-scripts`. After a private
    base install with lifecycle scripts off, it is the last detail line.
  - **Width rule:** the paragraph at
    `docs/protocol/mokly-terminal-output.md:51` to line 59. It cuts each rich
    line at the terminal width and exempts only recovery paths and the rich
    hint line of an error.
  - **Rich hint line:** the last line of a rich error block, which holds the
    recovery action of the error and is never cut.
- **Background:**
  - The width rule cuts every rich line at the width of stdout, or at 80
    columns when the width is unknown. Only recovery paths, such as a backup
    path, and the rich hint line of an error are never cut.
  - `docs/protocol/mokly-base-preparation.md` says that base diagnostics are
    detail lines that name the full base commit and the original terminal
    code.
  - `changes_output::diagnostics` prints each detail heading as
    `base {commit}: [mokly/{code}] {message}`. `one_shot/phases.rs` writes
    these lines to stderr. Location lists continue on following indented
    lines. Rich mode adds a two-space indent to every line, retains the
    location indent, and does not cut any line.
  - The text before each heading message takes 71 columns for
    `build-invalid`. The scripts hint line has 176 columns.
  - The hint rule at `docs/protocol/mokly-terminal-errors.md:150` to line 163
    gives the scripts hint to every base failure in every command, as one
    complete sentence.
  - On 2026-10-29 the user chose that rich output shows the whole scripts
    hint in every command, while plain output stays the same. The rich hint
    line of every error is never cut. In Serve and in a failed `build` or
    `publish`, the scripts hint is that line, in place of the hint of the code
    in the rich error table of `docs/protocol/mokly-terminal-errors.md`.
  - Other rich lines go through `bounded` in `crates/mokly-cli/src/output.rs`.
    One is the `! Changes unavailable · {reason}` line on stdout.
  - Rich Serve shows the same base diagnostics in an error block and in a
    reason line. It cuts the detail line of the block and the reason line.
    The reason line leaves the scripts hint out.
  - The test
    `base_validation_failure_keeps_the_head_catalogue_and_prints_each_source_diagnostic`
    runs a rich `build` with an unknown width. It expects the full message
    text in stderr. A cut at 80 columns fails it.
  - The rich width behavior matches `origin/main`, since the Rust rebuild of
    2026-10-25.
- **Problem:** Rich `build` and `publish` print each base diagnostic in full.
  The width rule cuts every rich line except recovery paths and the rich hint
  line of an error. The contract and the output disagree.
- **Impact if no action:** The contract does not describe the rich output. A
  later change that follows the contract can cut each base diagnostic to
  about 8 columns of its message.
- **Root question:** What should a rich terminal show of each base
  diagnostic when Changes is unavailable, while the scripts hint stays whole?
- **Options:**
  - **A.** Keep the output. Add the Changes unavailable details to the
    exception of the width rule, beside recovery paths. Add a unit test that
    a rich scripts hint detail longer than the width prints in full. Long
    details wrap at the terminal edge without an indent. Effort: Small.
  - **B.** Wrap each rich detail at the width. Indent each continuation line.
    Every terminal line then stays inside the width. The full text shows. The
    width rule gets a wrap rule for these lines. `output.rs` gets a wrap
    helper that keeps ANSI sequences and counts display columns. Effort:
    Medium.
  - **C.** State one width rule for every rich line that the user needs
    whole. These lines are the recovery paths, the rich hint line of an
    error, and the Changes unavailable details. Give the shared renderer one
    kind of line for them. Print all three through it. Every other rich line
    keeps the cut. Effort: Medium.
  - **D.** Cut each base diagnostic line at the width, as the width rule says
    now. Keep only the scripts hint line whole, as a recovery action. Rich
    `build` and `publish` then match rich Serve. At 80 columns, a user sees
    about 8 columns of each message and must run again in plain mode. The
    rich test moves its message checks to plain mode. This overrides the full
    rich details on `origin/main`. Effort: Small.
  - **E.** Send every rich line through one typed line that the terminal
    writer bounds by default. Only a line of the whole kind skips the bound:
    recovery paths, the rich hint line, and the details. A printer then
    cannot skip the bound or cut a whole line by mistake. It changes every
    rich printer in `mokly-cli`. Effort: Large.
  - **F.** Stop the cut of every rich error, warning, and diagnostic line. A
    long line then wraps at the terminal edge without its indent. The user
    sees the full failure text. About ten `bounded` calls in eight files
    under `crates/mokly-cli/src` change. Examples are `output.rs:173`,
    `:187`, and `:189`, `build_output.rs:32`, `one_shot/phases.rs:87`,
    `changes_output.rs:85`, `publish_errors.rs:185`, and
    `serve_progress.rs:242`. Three protocol rules change:
    `docs/protocol/mokly-terminal-output.md:51` to line 59,
    `docs/protocol/mokly-terminal-errors.md:52` to line 54, and
    `docs/protocol/mokly-build-warnings.md:115` to line 117. F also keeps the
    whole rich hint line of an error, which the user's choice of 2026-10-29
    requires. Effort: Medium.
- **Shared assumptions:** Every option except D shares five assumptions.
  - Each base diagnostic heading names the full base commit and its code.
    Location lists continue on following indented lines. Sources:
    `docs/protocol/mokly-base-preparation.md:91` to line 92, and
    `docs/protocol/mokly-terminal-errors.md:54` to line 56. Every option
    keeps them.
  - The scripts hint is a separate detail line. Source:
    `docs/protocol/mokly-terminal-errors.md:154` to line 156. Every option
    keeps it.
  - The scripts hint line is never cut. Source:
    `docs/protocol/mokly-terminal-errors.md:153` to line 154, and the user's
    choice of 2026-10-29. Every option keeps it.
  - Plain output does not change. Source:
    `docs/protocol/mokly-terminal-output.md:25` to line 26. Every option
    keeps it.
  - Each base diagnostic shows in full in rich mode. Source: the code at
    `crates/mokly-cli/src/changes_output.rs:115` to line 124 and its test. It
    is not a requirement, because the width rule says the opposite. D drops
    it.
- **Left out:**
  - Cut every rich detail, the scripts hint too. It breaks the hint rule at
    `docs/protocol/mokly-terminal-errors.md:153` to line 156, which the
    user's choice of 2026-10-29 keeps.
  - Print the base commit once as a header line, then cut shorter lines. It
    breaks `docs/protocol/mokly-base-preparation.md:91` to line 92, because
    each diagnostic heading must name the full base commit.
  - Change nothing. The contract and the output keep disagreeing. So it
    fails the goal.
- **Wider fix:** E. It removes both wrong cases of this class: a line that
  must stay whole is cut, and a printer skips the bound. C removes only the
  first case. C is a Medium step toward E.
- **Previous examples:** Commit `dafc5933` of 2026-10-16, which reached `main`
  in `d935e6a6`, added the recovery-path exception after a review found cut
  recovery paths. The first review of the base install fixes branch found
  that rich mode cut the scripts hint in Serve and in a failed `build` or
  `publish`. The fix that the user chose on 2026-10-29 added the rich hint
  line of an error to the exception of the width rule.
- **Recommendation:** A. It is the smallest option that makes the contract
  match the full diagnostics on `origin/main`. E best protects the codebase.
- **Action:** ask the user, because A changes the width rule for each base
  diagnostic, and the user's choice of 2026-10-29 covers only the scripts
  hint.
