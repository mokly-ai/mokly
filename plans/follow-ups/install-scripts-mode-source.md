# Store the install-scripts mode in one place

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan:
  user item 155, from finding 51 of the 135 B review.
- **Location:** `crates/mokly-cli/src/grammar.rs:45-48` and `:177`,
  `crates/mokly-cli/src/options.rs:61`,
  `crates/mokly-cli/src/serve_changes.rs:57`,
  `crates/mokly-compare/src/base_render.rs:91`, and
  `crates/mokly-compare/src/dependency_types.rs:113`.
- **Reason:** The plan recorded this item after the user's rule of
  2026-10-21 that new review items wait for the user after the merge.

- **Source:** Review.
- **Category:** Code structure.
- **Terms:**
  - **Install-scripts mode:** whether a base dependency install runs
    lifecycle scripts. `review.baseInstallScripts` and the two
    `--base-install-scripts` flags set it.
- **Background:**
  - On 2026-10-21 the user chose to keep base lifecycle scripts off by
    default, with a working-tree configuration field and two flags.
  - The mode moves through these layers:
    - the parsed flags in `grammar.rs:45-48` and the override at
      `grammar.rs:177`
    - the resolved configuration, through `options.rs:61`
    - an `Option<bool>` in `serve_changes.rs:57`
    - a `bool` in `base_render.rs:91` and `dependency_types.rs:113`
  - The plan records only the recommended option. The other options were in
    the review report, which is not in the repository.
  - The audit of 2026-10-30 found no test that checks the opt-out override.
    With `review.baseInstallScripts: true` in the working tree,
    `--no-base-install-scripts` must still keep scripts off.
    `crates/mokly-cli/src/_tests_/grammar_tests.rs:47` and `:73` only parse
    the flag. A change that drops the `Some(false)` branch at
    `grammar.rs:180-181` would run scripts that the user turned off.
- **Problem:** The same mode is stored in several values as the install
  request moves between layers, so the copies can disagree.
- **Impact if no action:** A later change can apply the wrong mode on one
  path, for example run scripts that the user turned off.
- **Root question:** Where should the install-scripts mode of one base
  install live?
- **Options:**
  - **A.** Keep the repeated mode fields. Effort: Small.
  - **B.** Store the mode on the install command, and derive each use from
    it. Effort: Medium.
- **Left out:** A shared global value. It hides request-specific state, and
  B is better on every point. Fewer than three approaches exist, because
  the mode either has one owner or several copies.
- **Wider fix:** B. One request-owned value removes the disagreement.
- **Previous examples:** None found.
- **Related:** [scripts-flags-no-changes.md](scripts-flags-no-changes.md)
  is about the same flags when `--no-changes` makes them do nothing. A
  branch that applies B touches the same values.
- **Recommendation:** B. One request-owned value removes the disagreement.
- **Action:** ask the user, because on 2026-10-21 the user ruled that new review
  items wait for the user after the merge.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6145).
