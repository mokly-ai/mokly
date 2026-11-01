# Failed base reads lose their cause as unknown

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-01, from the branch
  `conductor/rust-rebuild-150-process-tree-stops`. The root-cause trace of
  finding 8 found it.
- **Location:** `crates/mokly-source-interface/src/error.rs:96` to line 114,
  `crates/mokly-catalogue/src/config.rs:46` to line 62,
  `crates/mokly-compare/src/git_failures.rs:15` to line 55,
  `crates/mokly-cli/src/changes_diagnostics.rs:28` to line 33, and
  `crates/mokly-compare/tests/engine_support/mod.rs:157` to line 159.
- **Reason:** The code is older than the branch that found it, and the fix
  changes a diagnostic that a protocol page specifies.

- **Source:** Implementation.
- **Category:** Product bug.
- **Terms:**
  - **Source tree:** the read boundary of a catalogue, either the working
    tree or a base `GitTree`, defined in `crates/mokly-source-interface`.
  - **Catalogue caller:** a function in `crates/mokly-catalogue` that turns a
    failed source read into a `config-invalid` issue.
  - **Stored failure:** the first fatal failure that a base `GitTree` keeps,
    or its first limit when no fatal failure occurs.
  - **Conversion failure:** a checkout filter or conversion of a base file
    that fails, reaches its time limit, or passes a byte bound.
- **Background:**
  - `GitTree::failed`, at `crates/mokly-compare/src/git_failures.rs:15` to
    line 55, turns each failed base read into a `SourceError`.
  - It turns a conversion failure into `SourceError::Unavailable`, with the
    safe message "base resource {path} is unavailable: {cause}". A conversion
    failure never becomes the stored failure.
  - It turns each other failure into `SourceError::Internal`, which wraps the
    typed Git error. It also keeps that failure as the stored failure.
  - `SourceError::code`, at `crates/mokly-source-interface/src/error.rs:96` to
    line 114, returns "unknown" for each error that is not `Io`.
  - The config loader formats the path and that code as a `config-invalid`
    issue, at `crates/mokly-catalogue/src/config.rs:46` to line 52 and line
    56 to line 62. So a failed base read gives "mokly.config.json: unknown".
  - The issue holds only that text, so its cause is lost.
  - More catalogue callers build the same text from `code()`:
    - `config.rs:218` runs in each base load. It receives base Git failures.
    - `config_paths.rs:178` and `:212` receive base Git failures only when
      the base configuration has a setting that they check.
    - Line 178 checks `watch.rules[].paths`. Line 212 checks `renderer`,
      `moduleResolution.packageRoots`, and each local path of a `stylesheets`
      rule. A local path is not a URL and does not start with `$`.
    - `config_paths.rs:85` receives no base read. `GitTree::project` returns
      its input path unchanged, so `configuration_alias` returns at
      `config_paths.rs:70` to line 71 before any read.
    - `config.rs:194` runs only without an explicit file. The base load in
      `crates/mokly-cli/src/changes_base.rs:77` passes one, so only the test
      fixture below reaches it.
    - `discovery_walk.rs:96`, `:132`, and `:191` run in the base discovery
      walk. They receive base Git failures.
    - `preparation.rs:91` and `:136` run in the base preparation. They
      receive base Git failures.
    - `discovery.rs:114` reads only an output path. The base discovery at
      `changes_base.rs:83` passes none, so it receives no Git failure.
  - In a build, `crates/mokly-compare/src/base_render.rs:215` to line 223
    reports the stored failure before the catalogue error. A genuine Git
    failure then fails the command as `git-failed`, with its cause.
  - A conversion failure is not the stored failure. In `build` and
    `publish`, `crates/mokly-cli/src/changes_policy.rs:20` to line 25 then
    makes Changes unavailable with the reason "base validation failed".
  - `crates/mokly-cli/src/changes_diagnostics.rs:28` to line 33 builds the
    detail, and `crates/mokly-cli/src/changes_output.rs:104` to line 108
    prints it: "base {commit}: [mokly/config-invalid] mokly.config.json:
    unknown". The safe conversion message is lost.
  - `build` and `publish` print that detail line with no hint, at
    `changes_output.rs:104` to line 116. This follows
    `docs/protocol/mokly-base-preparation.md:91` to line 93, which makes
    base diagnostics detail lines.
  - Serve prints the same failure as a `review-invalid` error block, at
    `crates/mokly-cli/src/serve_changes.rs:166` to line 171. Its detail holds
    the same "unknown" text.
  - In rich mode, that block ends with the hint "Fix the reported comparison
    input and retry.", at `crates/mokly-cli/src/output.rs:170`.
  - Serve rich mode also prints a `! Changes unavailable` line with that
    detail, at `crates/mokly-cli/src/serve_output.rs:187` to line 196.
  - Serve gives no "base validation failed" reason. Only
    `crates/mokly-cli/src/build_changes.rs:58` reaches
    `changes_policy::unavailable`.
  - That path shows no `base-conversion` warning, because `base_render.rs:273`
    adds those warnings only to a successful result.
  - `crates/mokly-cli/src/build_output.rs:206` to line 212 prints a
    `config-invalid` issue of the head build. Head reads use the working tree,
    so no base read reaches that output.
  - The test fixture at `crates/mokly-compare/tests/engine_support/mod.rs:157`
    to line 159 loads a base `GitTree` without its stored failure. So a Git
    failure in a compare test shows only "unknown".
  - The macOS CI of commit `3960484b` showed this in the test
    `referenced_resource_edits_stay_ready_and_missing_targets_fail`. Its log
    held this error:

    ```text
    Catalogue { source: Config(Issue { code: ConfigInvalid, message: "mokly.config.json: unknown", ... }) }
    ```

  - The trace inferred its cause from the code: a Git child that exited
    before attachment. The log did not show it.
  - The code is the same on `origin/main` before this branch.
    `SourceError::code` dates from the Rust rebuild `d935e6a6` of 2026-10-25.
  - The protocol rules for this case:
    - `docs/protocol/mokly-base-preparation.md:51` to line 54: genuine Git
      command and object failures remain fatal `git-failed` errors. A failed
      conversion makes that resource unavailable with a `base-conversion`
      warning.
    - `docs/protocol/mokly-base-preparation.md:89` to line 92: a fatal failure
      takes precedence over historical validation. Base diagnostics name the
      full base commit and the original terminal code.
    - `docs/protocol/mokly-git.md:103` to line 105: a failed conversion makes
      that resource unavailable with a `base-conversion` warning.
    - `docs/protocol/mokly-root-discovery.md:26` to line 28: other read or
      projection errors of a walk fail with `config-invalid`. The text names
      the path and the error code, "`unknown` if absent".
    - `docs/protocol/mokly-terminal-errors.md:104` to line 109: a rich error
      shows the original safe detail. `MOKLY_DIAGNOSTIC=1` appends the core
      cause chain, which an issue built from text does not have.
    - `docs/protocol/mokly-terminal-errors.md:124`: the hint of
      `config-invalid` is "Fix the reported configuration value and retry."
- **Problem:** A catalogue caller reduces a failed base read to "unknown".
  For a conversion failure, `build`, `publish`, and Serve then show no cause.
  A compare test that fails on a Git read shows no cause either.
- **Impact if no action:** A user cannot tell why Changes is unavailable when
  a base file fails conversion. The next CI failure of a base Git read needs a
  new trace to find its cause.
- **Root question:** How should a failed base read keep its cause when a
  catalogue caller reports it?
- **Options:**
  - **A.** In the test fixtures that prepare a base `GitTree`, report the
    stored failure before the catalogue error, as `base_render.rs:215` does.
    - It changes no product behaviour.
    - The conversion case of a user stays as it is.
    - Effort: Small.
  - **B.** Give `SourceError` a safe detail: the message of `Unavailable`, or
    the portable code. Print that detail in each catalogue caller.
    - A user then sees the conversion message under `config-invalid`.
    - A Git failure in a test still shows "unknown", because the text of
      `Internal` names the private source path.
    - It changes the text that `docs/protocol/mokly-root-discovery.md:26` to
      line 28 specifies for a walk error.
    - Effort: Medium.
  - **C.** Keep the typed `SourceError` inside the catalogue error, not only
    its code.
    - In `build` and `publish`, the base path then reports a conversion
      failure as "base resource unavailable", with its safe message.
    - `changes_policy.rs:17` to line 19 already gives that reason to a typed
      conversion error. Serve never uses that reason policy.
    - A compare test then shows the Git cause in its error.
    - It changes the code and the reason that a user sees for a failed
      conversion of a base catalogue file.
    - It changes the walk text that `docs/protocol/mokly-root-discovery.md:26`
      to line 28 specifies.
    - Effort: Medium.
- **Shared assumptions:**
  - Public JSON keeps a source-tree path private. Source: the comment at
    `crates/mokly-source-interface/src/error.rs:41`. Its reason holds, so
    every option keeps it.
  - A fatal Git failure takes precedence over historical validation. Source:
    `docs/protocol/mokly-base-preparation.md:89`. Every option keeps it.
- **Left out:**
  - Print the full text of each `SourceError`. The text of `Internal` names
    the private source path and can hold Git output. B gives the safe part at
    the same cost.
  - Change nothing. Users and tests keep losing the cause, so it fails the
    goal.
- **Wider fix:** C. A typed source error keeps its cause across the catalogue
  boundary, so no caller can drop it.
- **Previous examples:** None found.
- **Recommendation:** C. It keeps the cause for users and tests, and it
  reports a failed conversion as the base preparation page asks.
- **Action:** ask the user, because C changes the code and the reason that a
  user sees, and a protocol page specifies them.
