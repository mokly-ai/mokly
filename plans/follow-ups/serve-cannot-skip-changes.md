# Serve cannot skip its Changes work

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-17, from the gap list `plans/follow-ups/mokly-upstream-gaps-to-file.md`, which the Mokly 0.18.0 upgrade of the cloud wrote on 2026-11-02 on the branch `calummoore/mokly-cli-upgrade`. The move of Mokly Cloud into this repository split that list into items.
- **Location:** `crates/mokly-cli/src/grammar.rs:61-76`, the `Serve` options, and `apps/mockups/src/_tests_/serve-fixture.ts:1-7`, the cloud workaround.
- **Reason:** The fix adds a public option to `mokly serve`, which the user decides.

- **Source:** Design.
- **Category:** Test.
- **Terms:**
  - **Changes work:** the background classification and the on-demand comparisons of Serve, which `docs/protocol/mokly-changes-serving.md:21-26` defines.
- **Background:**
  - `build` and `publish` accept `--no-changes`, which starts no Git or comparison work. The options are in `crates/mokly-cli/src/grammar.rs:101-103` and `:127-129`.
  - The `Serve` options in `crates/mokly-cli/src/grammar.rs:61-76` are `--port`, `--watch`, `--no-watch` and `--open`. Serve has no `--no-changes`.
  - One engine serves the background classification of Serve, the on-demand comparison of a selected entry, and the complete comparison of `build`.
  - The served mockup tests of Mokly Cloud start Serve with a base ref that does not exist, so that Changes stay unavailable and no base is extracted or installed. `apps/mockups/src/_tests_/serve-fixture.ts:1-7` states this, and the fixture refuses to start when the ref exists.
- **Problem:** A served test suite cannot turn the Changes work off. It depends on a failed base lookup instead.
- **Impact if no action:** Each served test run depends on the failure path of a missing base ref, which a later change can alter. A suite without that workaround starts background comparison work on each run.
- **Root question:** How does a served test suite run Serve without Changes work?
- **Options:**
  - **A.** Keep the workaround of a missing base ref. Effort: Small.
  - **B.** Add `mokly serve --no-changes`, with the meaning of the `build` option: no Git or comparison work, and Changes disabled. Document it in the Serve guide, and move the cloud fixture to it. Effort: Medium.
- **Left out:** An environment variable for the same switch. The CLI selects Changes through options, and an option shows in the help.
- **Wider fix:** B. Every served suite then states its intent.
- **Previous examples:** `build` and `publish` already have `--no-changes`.
- **Recommendation:** B. The suite states what it needs, and it stops relying on a failure path.
- **Action:** ask the user, because B adds a public CLI option, a change at the CLI boundary that no requirement covers.
