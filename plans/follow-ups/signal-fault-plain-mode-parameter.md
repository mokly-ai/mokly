# Signal test helper keeps an unused output mode

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-25, from the branch `calummoore/ci-speed-mokly-test-value-audit-ng54`, review finding 5.
- **Location:** `tests/helpers/static_signal.ts:7-17`, and its callers `tests/static_recovery_signals.test.ts:51`, `tests/static_signal_readiness.test.ts:35`, and `tests/helper_process_ownership.test.ts:38`.
- **Reason:** The second review round found it after the branch's last fix round, and the review procedure stops fix rounds there.

- **Source:** Review.
- **Category:** Dead code.
- **Terms:**
  - **Output mode:** the terminal style of the `mokly` CLI. `plain` prints plain lines. `rich` prints styled progress.
  - **`signalFault`:** a Node test helper. It starts a fault-injected build or publish, waits for a fault marker, and sends SIGINT.
- **Background:**
  - `signalFault(root, verb, mode, fault, signal)` passes `mode` to `faultCommand`, which defaults to `"plain"`.
  - `tests/static_recovery_signals.test.ts` called it with `plain` and with `rich`. The branch above removed the 14 `rich` copies, because the `plain` copies and the `mokly-cli` output tests cover them.
  - Each of the three callers now passes the literal `"plain"`.
- **Problem:** The `mode` parameter of `signalFault` has one value at every caller. Its other value came only from the removed tests.
- **Impact if no action:** The helper suggests that the signal tests cover more than one output mode. A reader can think that `rich` signal handling still has a Node test.
- **Root question:** Should the signal helper accept an output mode when no signal test needs one?
- **Options:**
  - **A.** Remove the `mode` parameter from `signalFault`, call `faultCommand(root, verb, fault)`, and remove the `"plain"` argument from the three callers. No assertion changes. Effort: Small.
  - **B.** Change nothing. Effort: Small.
- **Left out:** A new `rich` signal caller would bring back tests that the branch removed with a proof.
- **Wider fix:** None. The removal steps of the `testing` skill already ask to delete each helper or fixture that only removed tests used.
- **Previous examples:** The same branch removed the unused parameters of `designDocumentFixture` and `designCatalogue`, and the `version`, `pnp`, and `exec` modes of `tests/helpers/base_manager_fixture.ts`.
- **Recommendation:** A. It finishes the helper cleanup, and no assertion changes.
- **Action:** fix after merge, apply A, because the review procedure stops fix rounds after the re-review that found it.
