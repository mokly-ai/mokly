# Two copies of the scripts mode remain

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-01, from the branch
  `conductor/rust-rebuild-150-base-install-scripts-and-managers`: the rest
  of user item 155, from finding 51 of the review of user decision 135 B.
- **Location:** `crates/mokly-cli/src/options.rs:61`,
  `crates/mokly-cli/src/serve_services.rs:53` and `:106`,
  `crates/mokly-cli/src/static_runtime.rs:91`, and
  `crates/mokly-cli/src/changes_runtime.rs:50` and `:136` to line 158.
- **Reason:** On 2026-10-28 the user chose only to store the mode on the
  install command, and the removal of these copies deletes live code.

- **Source:** Review.
- **Category:** Code structure.
- **Terms:**
  - **Scripts mode:** whether a base dependency install runs lifecycle
    scripts. The working-tree setting `review.baseInstallScripts` sets it.
    The flags `--base-install-scripts` and `--no-base-install-scripts`
    override it for one run.
  - **Override:** the `Option<bool>` that
    `Common::base_install_scripts_override` in
    `crates/mokly-cli/src/grammar.rs` makes from the two flags. It is `None`
    when no flag is given.
- **Background:**
  - `Changes::classify` in `crates/mokly-compare/src/base_render.rs`
    receives the override as a parameter. It uses the override when it is
    set, and the working-tree setting otherwise. It passes the result to the
    base provider as `BaseRequest::install_scripts`.
  - The test
    `install_scripts_override_takes_precedence_over_the_working_setting` in
    `crates/mokly-compare/src/_tests_/base_selection_tests.rs` pins this
    order. With `review.baseInstallScripts: true`,
    `--no-base-install-scripts` keeps scripts off.
  - On 2026-10-28 the user chose to store the mode on the install
    `Command`, so that the install environment reads it and no longer
    guesses it from the arguments. That change landed. The same review had
    proposed the removal of the two copies below as a separate option, and
    the user did not select it.
  - `options::apply_base_install_scripts` in
    `crates/mokly-cli/src/options.rs:61` writes the override into the
    resolved configuration. `crates/mokly-cli/src/serve_services.rs:53` and
    `:106` and `crates/mokly-cli/src/static_runtime.rs:91` call it.
  - Every caller also passes the override to `Changes::classify`, which
    prefers it, so the write has no effect. `classify` is the only reader of
    `review.baseInstallScripts`.
  - `PhasedChanges` in `crates/mokly-cli/src/changes_runtime.rs` stores its
    own copy of the override, which `changes_runtime::service` receives. Its
    `classify` ignores its own parameter and passes the stored copy.
  - All copies come from the same command-line flags, so they agree today.
- **Problem:** The scripts mode reaches `Changes::classify` along two paths:
  the override parameter and the configuration write. `PhasedChanges` also
  keeps its own copy and ignores the parameter that its caller passes. The
  copies can disagree after a later change.
- **Impact if no action:** A later change can update one copy and miss
  another. For example, a caller that passes a different override to
  `PhasedChanges::classify` gets no effect.
- **Root question:** Where should the scripts mode of one command live on
  its way to `Changes::classify`?
- **Options:**
  - **A.** Remove `apply_base_install_scripts` and its three calls, and let
    `PhasedChanges` pass on its parameter. The override parameter of
    `classify` then carries the mode alone. The change deletes live code
    that is on `origin/main`. Effort: Small.
  - **B.** Keep the copies. They agree today, and the precedence test pins
    `classify`. A later change can still update one copy and miss another.
    Effort: Small.
  - **C.** Resolve the mode once at the command boundary, and pass one
    `bool` to `classify` in place of the override. Remove the configuration
    write, the copy in `PhasedChanges`, and the `Option<bool>` field of
    `ServeChanges` in `crates/mokly-cli/src/serve_changes.rs`. The
    public `ChangesService::classify` API of `mokly-compare` changes, and
    the precedence test moves to the new resolver. Effort: Medium.
- **Left out:**
  - Keep the configuration write as the only carrier, and remove the
    override parameter of `classify`. It also changes the public API, and it
    stores a one-run command-line choice in the working-tree configuration.
    C is better on every point.
  - A shared global value. It hides state that belongs to one command, and
    A is better on every point.
- **Wider fix:** None. After A, no layer keeps a second copy, and the
  precedence test pins the one place that combines the override with the
  setting.
- **Previous examples:** Before the change of 2026-10-28, the install
  environment guessed the mode from the install arguments. Storing the mode
  on `Command` removed that copy.
- **Recommendation:** A. It removes the write that has no effect and the
  ignored parameter with a Small change, and it keeps the `classify` API
  and its precedence test.
- **Action:** ask the user, because A deletes live code that is on
  `origin/main`, and on 2026-10-28 the user chose only to store the mode on
  `Command`, not to remove these copies.
