# Document scripts flags with no Changes build

- **Severity:** Low. **Effort:** Small (estimate).
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan: user item 157, finding 53 of the review of user decision 135 B.
- **Location:** `crates/mokly-cli/src/grammar.rs:44`,
  `crates/mokly-cli/src/grammar.rs:101`,
  `docs/guides/cli/build.md:23`, and `docs/guides/cli/publish.md:29`.
- **Reason:** A user rule of 2026-10-21 deferred each new review item of
  PR #199 until after its merge, for the user's later choice.

- **Source:** Review.
- **Category:** Docs or spec (estimate).
- **Terms:**
  - **Scripts flags:** `--base-install-scripts` and
    `--no-base-install-scripts`, which turn dependency lifecycle scripts on
    or off for the base install of Changes.
- **Background:** A user decision of 2026-10-21 added the scripts flags to
  `build` and `publish`. They change only the base dependency install that
  Changes prepares. `--no-changes` turns off Changes, so no base install
  runs. In the grammar, `--no-changes` conflicts only with `--base`. The
  build and publish guides list the scripts flags and `--no-changes` in one
  table, and say nothing about the pair.
- **Problem:** Mokly accepts a scripts flag with `--no-changes` and ignores
  it without a word.
- **Impact if no action:** A command can look as if it uses a script
  policy that has no effect.
- **Root question:** How should Mokly tell the user that the scripts flags
  do nothing without Changes?
- **Options:**
  - **A.** Document in the build and publish guides that the scripts flags
    have no effect with `--no-changes`. Effort: Small (estimate).
  - **B.** Reject the pair with a CLI error. This adds a rejection.
    Effort: Small (estimate).
- **Left out:** Applying the flags is impossible, because no base install
  runs. The review record that held the other options of this item is not
  available.
- **Wider fix:** B. A grammar conflict makes every unused pair fail at
  parse time, but it adds a rejection.
- **Previous examples:** None found.
- **Related:** [install-scripts-mode-source.md](./install-scripts-mode-source.md)
  keeps the mode of the same scripts flags in one place on the install
  command. Both items touch the flag fields in `grammar.rs`, so one branch
  can do both. Their work differs: this item says what the flags do with
  `--no-changes`, and that item removes repeated copies of the mode.
- **Recommendation:** A. It states the current behaviour without a new
  rejection.
- **Action:** ask the user, because condition 5 holds: the user reserved
  the choice for each open review item of the rebuild.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6154).
