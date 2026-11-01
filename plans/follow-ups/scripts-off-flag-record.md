# Record the scripts-off flag once per base

- **Severity:** Low. **Effort:** Large. **Confidence:** High. **Harder later:** Yes.
- **Kind:** Fix after merge.
- **Added:** 2026-11-01, from the branch
  `conductor/rust-rebuild-150-base-install-scripts-and-managers`, the wider
  fix of finding 2 of its first review.
- **Location:** `crates/mokly-compare/src/base_render.rs:48` to line 77,
  `crates/mokly-compare/src/base_render.rs:112`,
  `crates/mokly-compare/src/base_render.rs:199` to line 269,
  `crates/mokly-cli/src/changes_base.rs:42` and `:103`,
  `crates/mokly-cli/src/changes_static.rs:24` and `:30`, and
  `crates/mokly-cli/src/serve_changes_base.rs:130` and `:136`.
- **Reason:** On 2026-10-29 the user kept this wider fix out of the pull
  request that added the flag, and applied the direct fix there.

- **Source:** Review.
- **Category:** Code structure.
- **Terms:**
  - **Tier two:** the private install of the base commit's dependencies in
    the Mokly cache. Its lifecycle scripts stay off unless the user turns
    them on.
  - **Scripts-off flag:** the `scripts_off` boolean. It is true only when a
    tier-two install supplied the base dependencies with lifecycle scripts
    off. It decides whether a base failure gets the scripts hint.
  - **Scripts hint:** the sentence that names `review.baseInstallScripts`
    and `--base-install-scripts` after a base failure.
  - **Base provider:** an implementation of the `BaseProvider` trait in
    `crates/mokly-compare/src/base_render.rs`. `NativeBase` prepares the
    base. `StaticBase` and `AttemptBase` in `mokly-cli` wrap another
    provider.
  - **`BaseRequest`:** the input of `BaseProvider::prepare`.
    `Changes::classify` builds it for each comparison.
- **Background:**
  - On 2026-10-28 the user chose that `Error::Base` carries a typed
    scripts-off flag. One helper adds the scripts hint to every base failure
    after a scripts-off tier-two install, also to render failures in
    capture.
  - `NativeBase::prepare` in `crates/mokly-cli/src/changes_base.rs` computes
    the flag after the dependency install.
  - The flag travels in each provider result: `PreparedBase` on success and
    `BasePreparationError` on failure. Both are public types in
    `base_render.rs`.
  - `StaticBase` in `changes_static.rs` and `AttemptBase` in
    `serve_changes_base.rs` copy the flag from the result of their inner
    provider into their own result.
  - `Changes::classify` copies the flag onto each `Error::Base` that it
    builds: a preparation failure, a capture failure, and three paths for a
    source failure.
  - `Changes::classify` already reads source failures through
    `HistoricalSources.failures` after `prepare` returns. The flag can use
    the same kind of channel.
  - On 2026-10-29 the user applied option E in the pull request that added
    the flag. A test now sends a true flag through each copy.
  - The tests of the providers are in `crates/mokly-cli/src/_tests_/`, in
    `changes_base_success_tests.rs`, `changes_static_tests.rs`, and
    `serve_changes_base_tests.rs`.
  - The tests of `Changes::classify` are in
    `crates/mokly-compare/src/_tests_/`, in `base_render_failures_tests.rs`
    and `base_selection_tests.rs`.
  - The same day the user kept the wider fix, D, out of that pull request,
    for work after the merge.
- **Problem:** Each provider wrapper and each `Error::Base` construction
  copies the flag by hand. A new wrapper or a new failure path can drop the
  flag, and only a new test would catch it.
- **Impact if no action:** A later base provider or failure path can lose
  the scripts hint for its failures. The tests cover only the copies that
  exist now.
- **Root question:** How does every base failure get the scripts-off state,
  also through a provider wrapper that does not exist yet?
- **Options:**
  - **A.** Add an `AttemptBase` test whose inner provider returns a true
    flag. The `NativeBase` success path stays untested. Effort: Small.
  - **B.** Do A. Also add a `NativeBase` test that prepares a sidecar base
    after a tier-two install with scripts off, and assert a true flag.
    Effort: Medium.
  - **C.** Do B. Also give `PreparedBase` two public methods that keep the
    flag: one replaces the generation, and one makes a
    `BasePreparationError`. Make `StaticBase` and `AttemptBase` use them.
    The public `mokly-compare` API changes, and code changes in both
    packages. A wrapper can still build a wrong flag by hand, because the
    fields and the constructor stay public. Effort: Large.
  - **D.** Record the scripts-off state once, in a write-once field of
    `BaseRequest`. `NativeBase` sets it where it computes the flag.
    `Changes::classify` reads it after `prepare` returns and uses it for
    every `Error::Base`. The provider result goes back to
    `Result<Arc<dyn RenderGeneration>>`. `PreparedBase`,
    `BasePreparationError`, and the copies in `StaticBase` and `AttemptBase`
    then go away. The request type gets a field that `NativeBase` writes
    through a shared reference. The public `mokly-compare` API changes, and
    the change spans two packages. Effort: Large.
  - **E.** Do B. Also send a true flag through the third `StaticBase` arm
    and the source failure paths of `Changes::classify`, and assert it each
    time. The change is test code only. The pull request that added the
    flag applied E. Effort: Medium.
  - **F.** Do E. Also add the two flag-keeping methods of C as private
    functions in `mokly-cli`, and make `StaticBase` and `AttemptBase` use
    them. The public API stays the same. A wrapper can still build a wrong
    flag by hand. Effort: Medium.
- **Left out:**
  - One chain test over the real provider stack. It needs the same
    `NativeBase` success mocks as B, and the tests of E already pin each
    hand-off.
  - Private `PreparedBase` fields that force the use of C. `NativeBase` is in
    `mokly-cli`, so the constructor must stay public.
- **Wider fix:** D. It removes every copy, so no wrapper or `Error::Base`
  construction can drop the flag, also in a later wrapper.
- **Previous examples:** A review of the scripts opt-in on 2026-10-21 found
  that no test checked when the hint appears.
- **Recommendation:** D. One record of the flag removes the copies that the
  tests of E now guard one by one.
- **Action:** fix after merge, apply D, because the user chose D on
  2026-10-29 and kept it out of the pull request that added the flag.
