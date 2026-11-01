# Test the wiring of the comparison step labels

- **Severity:** Medium. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from branch `calummoore/loading-status-updates`, review round 1, finding 1 and two problems that its check found.
- **Location:** `crates/mokly-cli/src/base_dependencies.rs:141`, `crates/mokly-cli/src/changes_runtime.rs:89`, `crates/mokly-cli/src/serve_changes_native.rs:151`, `crates/mokly-cli/tests/changes_names_tests.rs:239`.
- **Reason:** The review rules send each missing-test finding to the user, so the test waits for a decision.

- **Terms:**
  - **Changes:** The Mokly feature that compares the current catalogue with the catalogue of a Git base commit.
  - **Comparison step:** One of the five labels that the `Comparing with <base>` spinner shows while Changes runs, defined in `docs/protocol/mokly-terminal-steps.md`.
  - **Step channel:** The `Steps` trait in `crates/mokly-compare/src/comparison_steps.rs`, which receives each step as it starts.
  - **`StepCache`:** The cache wrapper in the same file. It announces a source cache build as extracting and a dependency cache build as installing.
- **Background:** While Changes runs in `mokly serve`, `build`, or `publish`, the spinner names the current step: reading base catalogue, extracting base sources, installing base dependencies, rendering base catalogue, or finding changes. The steps start in `mokly-compare` and in the base provider, and three composition wires carry them to the terminal. `NativeDependencies::prepare_side` wraps its cache in `StepCache`. `changes_runtime::service` passes the one-shot steps to the phase reporter through `PhaseSteps`. `Source::classify_native` passes the Serve steps to the spinner through `RunSteps`, matched by the cancellation token of the classification. Unit tests cover `StepCache`, the order in `Changes`, the rendering step of `NativeBase`, and both spinner owners.
- **Problem:** No test runs a real composition and reads its steps. The native probe in `crates/mokly-cli/tests/changes_names_tests.rs` discards every step, and the command tests pipe stdout, which shows no step. A change that drops one of the three wires, or gives `RunSteps` a different cancellation token, removes the labels without a failed test.
- **Impact if no action:** A later refactor can silently remove the extracting and installing labels, or every label of Serve, `build`, and `publish`.
- **Root question:** How do we stop a later change from silently dropping the steps that real comparison work announces?
- **Options:**
  - **A.** Record the steps in the native probe of `changes_names_tests.rs`. Assert the full order for its cold-cache fixture: reading, extracting, rendering, comparing. It covers the cache wrapper and `PhaseSteps`, with no new command run. It does not cover Serve. Effort: Small.
  - **B.** Add a native dependency preparation test with a real temporary cache, and observe its extracting and installing steps. It needs a new fixture and covers only the cache wrapper. Effort: Medium.
  - **C.** Add a Serve command test with stdout on a pseudo-terminal, as `crates/mokly-cli/tests/serve_js/fixture.rs` opens one for stdin. Assert the visible labels during a real comparison. It covers every Serve wire, but it adds a slow command run with a Git fixture. Effort: Medium.
  - **D.** Put the cache construction of `NativeDependencies` behind an injected trait, and add a `unimock` unit test of `BaseDependencies::prepare`. The product gets a seam that only this test uses. Effort: Medium.
  - **E.** Give `CachedExtraction` and `DependencyTiers` a required `steps` field, so that their builders announce their own steps, and delete `StepCache`. A dropped cache wire becomes a compile error, but `PhaseSteps` and `RunSteps` stay untested. Effort: Large.
  - **F.** Give `DiskCache` a required `steps` field instead, and delete `StepCache`. It gives the guard of E in fewer files, but the generic cache then maps cache kinds to terminal steps. Effort: Large.
  - **G.** Do A. Also add a Serve unit test that runs `Source::classify` with a Git runner that fails at the first command and a `Progress` mock. Assert that `Progress::step` receives the reading step with the same cancellation token as the classification. Both tests are in-process and add no command run. Effort: Small.
- **Left out:** More tests that construct `StepCache` directly fail the goal, because they never run a composition. Changing nothing fails the goal. A build method on the cache `Reporter` trait is worse than F on every point.
- **Wider fix:** E. It removes the silent drop of the cache steps for every composition, but it is Large and covers neither `PhaseSteps` nor `RunSteps`.
- **Previous examples:** None found.
- **Recommendation:** G. It covers all three wires, including the token match of Serve, at the lowest level that fails, and adds no command run. E best protects the cache steps against a future composition.
- **Action:** ask the user, because the review rules send each missing-test finding to the user (decision-test condition 6).
