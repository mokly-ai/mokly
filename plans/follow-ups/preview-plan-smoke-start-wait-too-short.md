# Preview plan smoke start wait too short

- **Severity:** Medium. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-25, seen in a local `cloud-rust` suite run on the branch `calummoore/builds-log-why-an-attempt-ends-as-9iep`.
- **Location:** `scripts/cloud/smoke_support.py:30-66`, `crates/mkc-api/tests/preview_plan_tests.rs:15-35`, `crates/mkc-api/tests/support/python.rs:35`.
- **Reason:** The branch does not touch the API start or the smoke scripts.

- **Terms:**
  - **Preview plan smoke:** The `mkc-api` test `running_api_assigns_preview_workspace_plans`. It runs `scripts/cloud/smoke_preview_plan.py`, which starts the real `mkc-api` binary on an isolated database schema.
- **Background:**
  - `Api.event` in `smoke_support.py` waits 15 seconds for the API's `address` log line.
  - In a local `cargo xtask check --suite cloud-rust` run on 2026-11-25, the test failed with `Python smoke must exercise response validation` at `crates/mkc-api/tests/support/python.rs:35`. The script had stopped with `AssertionError: Timed out waiting for address:` and no API output.
  - The same test passed alone right after, in 24.38 seconds: `cargo test --locked -p mkc-api --test preview_plan_tests`.
  - It failed again on 2026-11-26 in a complete `cargo xtask check` run on the branch `calummoore/preview-password-sign-in-jofl`, together with `api_admits_only_configured_origins_and_selects_each_request_cookie` in `crates/mkc-api/tests/desktop_origin_tests.rs`, which uses the same `Api` helper and stopped with the same `Timed out waiting for address:`. Both passed alone right after, in 8.9 and 19.5 seconds, with `cargo nextest run --locked -p mkc-api --test desktop_origin_tests --test preview_plan_tests`.
  - The suite runs many test binaries in parallel. The suspected source is a slow API start, such as migrations on a fresh schema, under that load.
- **Problem:** The test fails when the machine is busy, with a message that hides the timeout.
- **Impact if no action:** A loaded local or CI run of the `cloud-rust` suite can fail without a defect.
- **Root question:** What signal should the smoke wait for, so that a slow start does not fail it?
- **Options:**
  - **A.** Wait for the `address` line until the API process exits or a much longer bound passes, and print the timeout in the Rust assertion. Effort: Small.
  - **B.** Prepare the schema before the API starts, so that the start does no migration work. Effort: Medium.
- **Left out:** A retry of the test, because a retry hides the cause.
- **Wider fix:** None found.
- **Previous examples:** None found.
- **Recommendation:** A. The process exit is an explicit signal, and the message then names the cause.
- **Action:** fix after merge, apply A, because the problem is outside the scope of the branch. Reproduce the slow start under load first, as the `deterministic-tests` rules ask.
