# Accepted startup registration has no assertion

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-18, from review round 3, finding 3, on branch
  `calummoore/mokly-startup-base-overlap-rae7`. On the same date, that branch
  deferred the fix until after its merge.
- **Location:** `crates/mokly-cli/src/_tests_/serve_startup_predicate_tests.rs:131`
  to line 153, `crates/mokly-cli/src/serve_startup_native.rs:50` to line 86,
  `crates/mokly-cli/src/serve_startup_base.rs:25` to line 41, line 79 to line
  93, and line 123 to line 181, and the direct `begin` calls at
  `crates/mokly-cli/src/_tests_/serve_startup_base_tests.rs:37`, `:61`, and
  `:80`, `crates/mokly-cli/src/_tests_/serve_startup_wait_tests.rs:41` and
  `:105`, and `crates/mokly-cli/src/_tests_/serve_startup_provider_tests.rs:60`.
- **Reason:** The selected fix changes product code that the source branch had
  frozen for performance measurements, and that branch had used both allowed
  review fix rounds.

- **Source:** Review.
- **Category:** Test.
- **Terms:**
  - **Head:** The current catalogue generation that Serve, the `mokly serve` development server, has installed.
  - **Changes:** The Serve comparison of the head with the base, a historical catalogue from Git.
  - **Startup hook:** `ChangeSource::startup` on `Source` at `crates/mokly-cli/src/serve_changes.rs:97`, through which the server asks the CLI to prepare the base early.
  - **Startup task:** `StartupTask` at `crates/mokly-cli/src/serve_startup_native.rs:50`, the private early base preparation that the hook returns.
  - **Startup record:** `StartupState` at `crates/mokly-cli/src/serve_startup_base.rs:45`, which holds the registered head and token, the selected base key, and one outcome.
- **Background:**
  - Serve first renders every view of the head in a background pass, called current usage. Changes classifies the head only after current usage settles.
  - `docs/protocol/mokly-base-early-preparation.md:13` to line 18 lets Serve start early base preparation once in a session. It starts only for the first head, and only when that head needs a sidecar.
  - The server reaches the startup hook through `startup_preparation::start` at `crates/mokly-server/src/background.rs:51`, in its usage pass. The hook calls `Source::startup_native` at `serve_startup_native.rs:58`.
  - At lines 63 to 71, `startup_native` returns no task when its token is cancelled, when the head needs no sidecar, or when `StartupHandoff::begin` refuses.
  - `begin` at `serve_startup_base.rs:79` to line 93 refuses a second start. Otherwise it marks the task as running and stores the token and a weak reference to the head.
  - Line 68 of `serve_startup_native.rs` registers `self.head` and the hook's own token. The task at lines 72 to 85 holds the same head and token.
  - The task reports to the record. It calls `selected` with its base key at lines 126 to 129, `complete` with its outcome at lines 145 to 150, and `finished` at line 154.
  - After current usage, the classification installs a `StartupProvider` at `crates/mokly-cli/src/serve_changes_native.rs:111` to line 120. Its `take_prepared` at `crates/mokly-cli/src/serve_startup_provider.rs:52` to line 55 calls `StartupHandoff::take` with the head, the selected key, and the classification token.
  - `take` at `serve_startup_base.rs:123` to line 181 is the reader of the record. It waits while the registered task runs. A cancelled classification token ends that wait.
  - When the registered head or the published key differs from the head or key of the reader, `take` rejects the outcome and cancels the registered token. This happens at lines 142 to 149 and 172 to 176. `take` then waits until the task ends and returns no outcome.
  - When both match, `take` returns the outcome once, at lines 150 to 161.
  - An empty record is valid. When the first head needs no sidecar, no task registers, and `take` returns no outcome at once.
  - `crates/mokly-cli/src/serve_delivery.rs:59` builds the one command-owned record. `ServeChanges::create` at `serve_changes.rs:69` to line 84 copies the services into each `Source`, and the copies share that record.
  - `docs/protocol/mokly-base-early-preparation.md` holds the handover rules:
    - Lines 131 to 136: Changes takes the early outcome once, and only with the selected key. While early preparation runs, the classification waits and prepares no base of its own.
    - Lines 144 to 148: Changes captures an unkept early base no second time, and an early error stands.
    - Lines 157 to 159: For another key, Serve rejects the early outcome, cancels early preparation, and waits until it ends.
    - Lines 175 to 177: The decision in force passes an outcome with its key once. It rejects the kept base slot as the only handover, because an unkept base and an error cannot enter that slot.
- **Problem:**
  - The only Rust test that calls the startup hook on a real `Source` is `startup_scheduling_uses_only_the_first_heads_config_and_included_inventory` at `crates/mokly-cli/src/_tests_/serve_startup_predicate_tests.rs:84`. Its hook call is at line 144.
  - The test has eight cases. The renderer, PostCSS, module, and stories cases expect a task. The empty, excluded module, excluded stories, and page cases expect no task.
  - Line 148 asserts the task result of each case. Lines 146 to 152 assert that a rejected case leaves its record unused, through a second `begin` that must succeed.
  - For an accepted case, `expected.is_some()` at line 147 is true, so `||` skips the `begin` call. The record assertion at lines 149 to 152 then passes whatever the record holds.
  - So a hook without the registration clause at `serve_startup_native.rs:65` to line 68 still passes this test. A hook that registers another head or another token also passes.
  - Nothing in the types ties a task to its registration. The code can build a `StartupTask` without a `begin` call, or with other values than the record holds.
  - No other test sees these breaks:
    - The handover tests call `begin` directly, at `serve_startup_base_tests.rs:37`, `:61`, and `:80`, `serve_startup_wait_tests.rs:41` and `:105`, and `serve_startup_provider_tests.rs:60`, all under `crates/mokly-cli/src/_tests_/`.
    - The server tests replace the hook with `ChangeSourceMock::startup`, for example at `crates/mokly-server/src/_tests_/background_overlap/startup_tests.rs:37`. `mokly-server` cannot reach the CLI record.
    - `StartupTask` is private to `serve_startup_native.rs`, so no other test can build it.
    - `tests/serve_capture_timing.test.ts` uses the HTML-only fixture at `tests/helpers/static_changes.ts:22`, so no startup task starts. `tests/browser/large_startup.spec.ts:32` to line 33 uses a missing base.
    - A test of the final Changes content cannot see the breaks, because that content stays correct.
  - The current product code is correct. No product defect is shown.
  - The evidence is a read of the code. Nobody ran a mutation.
  - Limit of that read: no test that it read proves that a later classification reads the record of the first head's hook. Each unit test builds its own record. This item claims no problem there and adds no work for it.
- **Impact if no action:** A later change can break the link between the task and the record while every test passes. Changes then prepares the base again and loses an early unkept base or error, or it waits for early work that it cannot cancel.
- **Root question:** How do we keep each accepted startup task linked to the later Changes, which waits for it, takes its outcome, or cancels it?
- **Options:**
  - **A.** Keep the task-result and rejected-record assertions of the table test. For each accepted case, also assert that a second `begin` on its record refuses. Temporarily remove the production registration, and require an assertion failure in this test. Restore the production bytes before validation. This adds one assertion to the existing real-hook test. It proves only that the record is in use, so it misses another head or another token. Effort: Small.
  - **B.** Add an integration test from the real startup hook through the consumption of the matching outcome. Use controlled preparation inputs and the production startup record. Verify that the classification takes the accepted outcome once. This covers more wiring, but it needs a larger fixture. Effort: Medium.
  - **C.** Keep the table test unchanged. Add one focused test for one accepted head, through the real hook and a fresh startup record. Act as the worker with `selected`, `complete`, and `finished`. Assert that `take` with the source head and the same key returns the completed outcome with its exact typed result. Then use a second fresh record and hook call. Assert that `take` with another key returns no outcome and cancels the hook's own token. Removing the registration, registering another head, and registering another token must each fail an assertion. The test has about 40 lines and depends on the record methods. It changes no product code. Effort: Small.
  - **D.** A, plus a registration value that only the startup record can create. `begin` returns that value. The startup task holds it and takes its head and token from it. A task then cannot exist without its registration, and the task and the record hold the same values. This changes product code in `serve_startup_base.rs` and `serve_startup_native.rs`, and the `begin` calls in four test files. Effort: Medium.
- **Left out:**
  - A test of `StartupState::begin` alone bypasses the hook, so it fails the goal.
  - A Serve command test with timing traces is another test level. A unit test of the hook already fails for each named break, and the `testing` skill puts a test at the lowest level that fails.
  - A test in `mokly-server` can only replace the hook, because that crate cannot reach the CLI record.
  - A guard in `take` that requires a registration fails the goal. It breaks the valid empty record of a first head that needs no sidecar.
  - Changing nothing leaves the accepted registration unprotected.
- **Wider fix:** D. The task cannot exist without the record's registration, and it cannot use other values than the record holds. The entry-point rule of the `testing` skill also stays in force. The first review pass gave no wider fix.
- **Previous examples:** The source branch replaced a helper-only eligibility test with the real-hook table test at `serve_startup_predicate_tests.rs:84`. That test proves rejection, but not the accepted registration. A focused history search found no earlier example.
- **Related:** An earlier review finding of the same branch, now fixed, added the table test for the same hook clause. This item is not a repeat. That fix covers the eligibility guard and the record after a rejection. Keep its eight task-result assertions and its rejected-record assertions.
- **Recommendation:** D, with the reader-level regression proof of C. D removes the representable unregistered task, and C proves through the real reader that the record holds the hook's own head and token. A finding check recommended C while the source branch froze its product code. The first review pass recommended A.
- **Action:** fix after merge, apply D with C's reader-level regression proof, because the test gap is not critical and no current product defect is shown. The branch that applies it does these things:
  - Apply D and the test of C together in one branch.
  - Change `StartupHandoff::begin` to return the registration value of D. Let only the startup record create that value.
  - Build the startup task from that value. Take the head and the token of the task from it.
  - Check once by hand that a deletion of the `begin` call in the hook no longer compiles.
  - Keep the empty record valid for a first head that needs no sidecar.
  - Keep the eight cases of the table test, each task-result assertion, and each rejected-record assertion. Change only the form of their `begin` call.
  - Add the assertion of A: for each accepted case, a second `begin` on its record refuses. Then no case skips the record check.
  - Add the focused test of C. Call the real hook on a real `Source`, as the table test does.
  - Keep the new test deterministic:
    - Run the test on the test thread only. Use no sleep, no clock, and no wait limit.
    - Call `selected`, `complete`, and `finished` before each `take`. Then no `take` waits, also under each mutation below.
    - Use a fresh startup record, a fresh `Source`, and a fresh hook token for each part.
    - Give each `take` a fresh `ChangeToken` that nothing cancels.
    - Build each base key as the `key` helper at `crates/mokly-cli/src/_tests_/serve_startup_base_tests.rs:18` does. That helper is private to the test modules of `serve_startup_base.rs`.
  - Prove each mutation below on the product code of the branch. Apply it temporarily, then run the focused test. The test must fail at the named assertion, not by a hang, a panic in the fixture, or a compile error. The expected failures below come from a read of the code.
    - **No registration:** The hook takes its registration from a fresh `StartupState`, not from `self.services.startup`. The shared record then stays empty. The accepted-outcome assertion of C must fail. The second-`begin` assertion of A must also fail.
    - **Another head:** The hook registers a head other than `self.head`. The accepted-outcome assertion of C must fail.
    - **Another token:** The hook registers a new `ChangeToken` in place of its own token. The assertion of C that the moved-key `take` cancels the hook's own token must fail.
  - After each mutation, restore the exact production bytes. Save a copy of each mutated file before the mutation. After the restoration, compare each file with its copy through `cmp`. Commit no mutation.
  - Then run `cargo test -p mokly-cli serve_startup`. Every startup test must pass.
  - Change no protocol doc, because the behaviour at the boundary stays the same.
  - Delete this item in the same branch.
