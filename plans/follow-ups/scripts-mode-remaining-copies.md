# A scripts flag also changes head document keys

- **Severity:** Low. **Likelihood:** Common. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-01, from the branch
  `conductor/rust-rebuild-150-base-install-scripts-and-managers`: the rest
  of user item 155, from finding 51 of the review of user decision 135 B.
- **Location:** `crates/mokly-cli/src/options.rs:60` to line 71,
  `crates/mokly-cli/src/serve_services.rs:53` and `:106`,
  `crates/mokly-cli/src/static_runtime.rs:91` and `:162`,
  `crates/mokly-cli/src/changes_runtime.rs:50`, `:94`, and `:136` to line
  158, `crates/mokly-graph/src/config_key.rs:10` to line 26, and
  `crates/mokly-graph/src/planning.rs:127` to line 128.
- **Reason:** The fix deletes a live configuration write on `origin/main`
  whose value reaches head document keys, and no user decision approves that
  deletion.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Scripts mode:** whether a base dependency install runs lifecycle
    scripts. The working-tree setting `review.baseInstallScripts` sets it.
    The flags `--base-install-scripts` and `--no-base-install-scripts`
    override it for one run.
  - **Override:** the `Option<bool>` that
    `Common::base_install_scripts_override` in
    `crates/mokly-cli/src/grammar.rs` makes from the two flags. It is `None`
    when no flag is given.
  - **Configuration key:** the render graph key that `config_key::resolved`
    in `crates/mokly-graph/src/config_key.rs` makes from the whole authored
    configuration.
  - **Document key:** the hash of the inputs of one rendered document. Each
    one includes the configuration key. The public index shows it as
    `documentKey`.
  - **Live generation:** the Serve hash in `live.generation` of the index and
    in `generation` of `live.json`. It hashes the configuration key and every
    document key.
- **Background:**
  - `Changes::classify` at `crates/mokly-compare/src/base_render.rs:180` to
    line 188 prefers the override over `review.baseInstallScripts`. Every
    command passes the override to it.
  - The test
    `install_scripts_override_takes_precedence_over_the_working_setting` in
    `crates/mokly-compare/src/_tests_/base_selection_tests.rs` pins this
    order. With `review.baseInstallScripts: true`,
    `--no-base-install-scripts` keeps scripts off.
  - On 2026-10-28 the user chose to store the mode on the install
    `Command`, so that the install environment reads it and no longer
    guesses it from the arguments. That change landed. The same review had
    proposed the removal of the copies below as a separate option, and the
    user did not select it.
  - The configuration write, `options::apply_base_install_scripts` at
    `crates/mokly-cli/src/options.rs:60` to line 71, also puts the override
    into the in-memory resolved configuration. Serve calls it at
    `crates/mokly-cli/src/serve_services.rs:53` and `:106`. `build` and
    `publish` call it at `crates/mokly-cli/src/static_runtime.rs:91`, also
    with `--no-changes`.
  - `PhasedChanges` in `crates/mokly-cli/src/changes_runtime.rs` keeps a
    third copy, which `static_runtime.rs:162` passes to
    `changes_runtime::service`. Its `classify` drops the parameter that its
    caller passes.
  - `config_key::resolved` serializes all of `config.input`, and
    `crates/mokly-graph/src/planning.rs:127` to line 128 puts the
    configuration key into each document key. So the write enters each head
    document key and the Serve live generation.
  - The write changes the key in a flagged run: a run with a scripts flag
    whose value differs from the explicit `review.baseInstallScripts` value
    of the configuration file. A missing value counts as different.
  - The base configuration loads from the base tree with no write, at
    `crates/mokly-cli/src/changes_base.rs:67` to line 80. So in a flagged
    run, no unchanged base view can reuse the render of the head.
  - `--base` is never written into the configuration. It travels as a
    parameter beside it.
  - `docs/protocol/mokly-publication.md` starts with a status line that links
    to this item, because its rule of 2026-10-28 says that a scripts flag has
    no effect with `--no-changes`. The fix removes that status line.
  - Nobody has measured the lost base reuse. A measurement can raise the
    severity to Medium.
- **Problem:** The scripts mode reaches the base install along two paths, and
  a third copy drops its parameter. The configuration path also makes a
  one-run flag change head document keys and block base reuse.
- **Impact if no action:** A flagged run, such as the publish with
  `--no-base-install-scripts` that the publish guide advises, renders
  unchanged base views again. Its `documentKey` values also depend on the
  flag, also with `--no-changes`, where the guides say that the flag has no
  effect.
- **Root question:** Through which single value should one run's scripts
  choice reach its base install?
- **Options:**
  - **A.** Remove `apply_base_install_scripts` and its three calls. Let
    `PhasedChanges` pass on its parameter, and remove its stored copy and the
    `install_scripts` parameter of `changes_runtime::service`. A flagged run
    then gets the document keys, live generation, and render reuse of the
    same run without the flag. Add one regression test, such as two
    `--no-changes` builds with equal `documentKey` values. Effort: Small.
  - **B.** Keep the copies. The scripts mode stays right, and the precedence
    test pins `classify`. Flagged runs keep flag-dependent keys and lose base
    reuse. Effort: Small.
  - **C.** Resolve the mode once at the command boundary into one `bool`,
    and pass it to `classify` in place of the override. Remove the write, the
    `PhasedChanges` copy, and the `Option<bool>` field of `ServeChanges` in
    `crates/mokly-cli/src/serve_changes.rs`. The `ChangesService::classify`
    trait of `mokly-compare` changes, and the precedence test moves to the
    resolver. The output effect is the same as in A. Effort: Medium.
- **Left out:**
  - The configuration write as the only carrier. It also changes the trait,
    and it keeps the flag in the document keys. C is better on every point.
  - A shared global value. It hides state of one command. A is better on
    every point.
  - Skip the write only with `--no-changes`. It keeps the second carrier and
    the lost reuse. A is better on every point.
  - Remove `review` from the configuration key. It keeps two carriers. It
    also breaks the rule that the live generation hashes the whole
    configuration on purpose, in `docs/protocol/mokly-shell-delivery.md`.
- **Wider fix:** None. After A, each command has one carrier, as `--base`
  has. The precedence test pins the one place that combines it with the
  setting.
- **Previous examples:** Before 2026-10-28, the install environment guessed
  the mode from the install arguments. The user's decision of that day to
  store the mode on `Command` removed that copy.
- **Recommendation:** A. It leaves one carrier for each command, keeps the
  `classify` trait and its test, and stops a one-run flag from changing head
  document keys.
- **Action:** ask the user, because A deletes a live configuration write on
  `origin/main` whose value changes head document keys, and no user decision
  approves that deletion.
