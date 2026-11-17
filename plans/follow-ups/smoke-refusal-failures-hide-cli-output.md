# Smoke refusal failures hide the CLI output

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-02, from item 16 of the Mokly 0.18.0 upgrade on the branch `calummoore/mokly-cli-upgrade`. It is the open choice "Refusal output" of the deleted `plans/follow-ups/smoke-refusals-skip-recorded-capture.md`. The upgrade applied that item, and it applied option B before the user answered.
- **Location:** `_require_recorded_refusal` in `scripts/publication_smoke_cli.py:34-45`, and the helper `cli_result` in `scripts/publication_smoke_fixture.py:13`.
- **Reason:** On 2026-11-02 the user deferred the choice, so the code keeps option B until the user confirms or changes it.
- **Category:** Test.

- **Terms:**
  - **Publication smoke:** the Python test in `scripts/` that runs the real Mokly CLI against a local API. `cargo test -p mkc-catalogue-server --test publish_tests` starts it.
  - **Recording:** a saved copy of one real CLI run, with its exit code and outputs, under `infra/tests/fixtures/catalogue-capture/`.
- **Background:** The publication smoke compares each refusal of the real CLI with its recording, as the user decided on 2026-10-12. An earlier version showed the CLI's output only when the error output differed.
- **Problem:** Without the helper, a failed exit-code or standard-output check does not show what the CLI printed.
- **Impact if no action:** None while B stays. Without B, an engineer must rebuild the checkout and rerun the CLI by hand after a Mokly or npm change breaks a refusal.
- **Root question:** How does a failed refusal check show what the CLI printed?
- **Options:**
  - **A.** Add the real exit code and both outputs to the three failure messages. About three lines change. Effort: Small.
  - **B.** One helper formats a CLI result, and every CLI check of the script uses it. The code has this now. Effort: Small.
- **Left out:** No change, because the engineer must then rerun the CLI. Print every result before its checks, because B shows the same output only when a check fails.
- **Wider fix:** B. One helper serves every CLI check.
- **Previous examples:** Three other failure messages in `publication_smoke_cli.py` already show the full output.
- **Recommendation:** B. It shows the output for every CLI check, and it keeps passing runs out of the log.
- **Action:** ask the user, because the deleted item left this choice to the user.
