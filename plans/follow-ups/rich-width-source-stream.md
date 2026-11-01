# Rich width also comes from stderr or stdin

- **Severity:** Low. **Likelihood:** Rare. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-01, from the branch
  `conductor/rust-rebuild-150-base-install-scripts-and-managers`. The
  investigation of `plans/follow-ups/rich-base-diagnostics-width.md` found it
  outside that item.
- **Location:** `crates/mokly-cli/src/entry.rs:43` to line 46, and
  `docs/protocol/mokly-terminal-output.md:51` to line 52.
- **Reason:** The code is older than the branch that found it, and the
  problem lies outside the item that the investigation checked.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Rich mode:** the terminal output for an interactive terminal, or for
    `MOKLY_OUTPUT=rich`, also through a pipe. Plain mode prints full lines.
  - **Width rule:** the paragraph at
    `docs/protocol/mokly-terminal-output.md:51` to line 58. It cuts each rich
    line at the terminal width and exempts only recovery paths.
- **Background:**
  - The width rule starts: "Rich lines are bounded by stdout's positive
    `columns` value, or 80 columns when unavailable."
  - `crates/mokly-cli/src/entry.rs:43` to line 46 sets the width from
    `terminal_size()` of the `terminal_size` crate 0.4.4. It uses 80 when the
    call returns nothing or zero.
  - `terminal_size()` checks stdout, then stderr, then stdin, and returns the
    size of the first stream that is a terminal. Its source is
    `src/unix.rs:9` to line 19 of that crate.
  - The same page says that forced-rich output through a pipe keeps its
    starting line and its durable completion lines observable and
    deterministic, at `docs/protocol/mokly-terminal-output.md:73` to line 75.
  - In debug builds, `test_faults::columns` in
    `crates/mokly-cli/src/test_faults/mod.rs` can replace the width for
    tests.
- **Problem:** When stdout is not a terminal but stderr or stdin is, rich
  mode takes the width of that other terminal, not 80. For example,
  `MOKLY_OUTPUT=rich mokly build | tee build.log` cuts its lines at the width
  of the terminal that shows stderr.
- **Impact if no action:** Forced-rich output into a pipe or a file depends
  on the size of another terminal. The contract and the code disagree.
- **Root question:** Which width should bound a rich line when stdout is not
  a terminal?
- **Options:**
  - **A.** Read the width of stdout only, with
    `terminal_size_of(io::stdout())`, and use 80 when stdout is not a
    terminal. This matches the width rule. Effort: Small.
  - **B.** Change the width rule to name the order of `terminal_size()`:
    stdout, then stderr, then stdin. The page then matches the code, and
    forced-rich output keeps depending on the size of another terminal.
    Effort: Small.
  - **C.** Bound each line by the width of the stream that it goes to:
    stdout lines by stdout, and stderr lines by stderr, each with 80 as the
    fallback. `Style` then carries two widths, and the width rule names both.
    Effort: Medium.
- **Left out:** Change nothing. The contract and the code keep disagreeing,
  so it fails the goal.
- **Wider fix:** None. One place in `entry.rs` sets the width for every rich
  line, so A fixes each line. C is wider, but it changes the width rule.
- **Previous examples:** None found.
- **Recommendation:** A. It makes the code follow the width rule in force,
  so forced-rich output into a pipe always uses 80 columns.
- **Action:** fix after merge, apply A, because it is a product bug outside
  the reviewed diff, and A follows the width rule in force with no new
  requirement.
