# Show the install-scripts hint for render failures

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Large. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan:
  user item 152, the wider part of finding 44 of the 135 B review.
- **Location:** `crates/mokly-cli/src/changes_base.rs:86-160` and
  `crates/mokly-cli/src/changes_diagnostics.rs:14-24`, `:89-94`, and
  `:173-174`.
- **Reason:** The plan recorded this item after the user's rule of
  2026-10-21 that new review items wait for the user after the merge.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Base install:** the dependency install that Changes runs for the base
    commit. Lifecycle scripts are off in it by default.
  - **Scripts hint:** the message "If this base needs lifecycle scripts,
    enable `review.baseInstallScripts` or use `--base-install-scripts`".
- **Background:**
  - On 2026-10-21 the user chose to keep base lifecycle scripts off by
    default, with a configuration field and two flags to turn them on.
  - `docs/protocol/mokly-terminal-errors.md:150-151` already requires the
    hint: when a base render fails after a scripts-off tier-two install,
    the diagnostic names `review.baseInstallScripts` and
    `--base-install-scripts`. The page's status line names this item.
  - When base preparation fails at the catalogue or graph step with
    scripts off, `changes_base.rs:86-160` wraps the error as
    `Error::BaseInstallScripts`.
  - `changes_diagnostics.rs` then adds the scripts hint in three places.
    Lines 18-24 add it to Changes details, lines 89-94 to an unavailable
    build, and lines 173-174 to the terminal text.
  - The direct fix of the review, option A, already shows the hint when
    build or publish makes Changes unavailable, also on the comparison
    limit path. It left capture failures and a typed hint field open.
- **Problem:** A render failure in the base capture that disabled scripts
  cause gets no scripts hint, because that path never wraps the error.
- **Impact if no action:** Users see the failure without the setting that
  can recover it.
- **Root question:** How does every failure that disabled scripts can cause
  show the recovery action?
- **Options:**
  - **B.** Add the hint where Changes classifies render failures. Effort:
    Medium.
  - **C.** Carry a typed scripts-disabled cause on the error, and build the
    hint in one helper for every related failure. Effort: Large.
- **Left out:** Option A was the direct diagnostic fix, and it is done.
  Fewer than three open approaches exist, because the hint is either added
  per path or derived from one typed cause.
- **Wider fix:** C. A typed cause stops each failure path from deciding the
  hint on its own.
- **Previous examples:** The review found missing hints on several failure
  paths, and option A fixed the build, publish, and comparison-limit paths.
- **Related:** [install-scripts-hint-period.md](install-scripts-hint-period.md)
  fixes the wording of the same hint. A branch that applies C can fix it in
  the one helper.
- **Recommendation:** C. It gives every applicable failure one source for
  the recovery action.
- **Action:** ask the user, because on 2026-10-21 the user ruled that new review
  items wait for the user after the merge.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6127).
