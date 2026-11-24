# Desktop publish command has no test

- **Severity:** Medium. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-24, from review findings 13 and 14 of the branch `calummoore/desktop-releases-become-latest-releases-clkn`.
- **Location:** `packages/desktop/scripts/package.mjs`, the `release-publish` mode. `packages/desktop/src/_tests_/release-build.test.ts`. `packages/desktop/src/_tests_/release-promote-cli.test.ts`. `xtask/tests/cli/desktop_release_workflow_tests.rs`.
- **Reason:** The review ran after the two fix rounds of the branch, so its findings wait for a later branch.
- **Category:** Test.

- **Terms:**
  - **Build record:** A file that the `release-build` command writes before any upload. It lists the name, size and SHA-256 hash of each built file.
  - **Publish command:** `node packages/desktop/scripts/package.mjs release-publish {records}`. It compares the kept build with its record, then publishes to the draft and writes the platform manifest.
- **Background:**
  - On 2026-11-24 the owner chose that a rerun reuses a complete upload only when each GitHub `digest` matches an earlier build record. That reuse works only while each record describes the bytes that were uploaded.
  - The tests run `release-build` and call the upload helper directly. No test runs `release-publish`. A coverage run showed that no test runs the publish command lines of `package.mjs`.
  - Removing the hash comparison and the `sha256` name from the publish command leaves every test passing. Removing only the comparison fails ESLint on the unused name.
  - No test runs the publish command's manifest write either. A wrong output path would pass the gate and fail every release at the step "Upload the verified release manifest".
  - The workflow test now pins step labels, step order and full commands, which the `testing` skill says never get a test. A renamed step fails it.
  - The Linux build step gets no secret, so a check by secrets alone cannot find it.
  - `release-promote-cli.test.ts` runs inside the workspace, where `node_modules` exists. An npm import in the promotion modules would pass, although the promotion job installs no packages.
  - The fake builder of `release-build.test.ts` checks that `GH_TOKEN` is not set, but the test never sets it, so the check cannot fail.
- **Task:**
  - Add a case to `release-build.test.ts`: change one byte of a built file after `release-build`, run `release-publish`, and require the record mismatch error before any GitHub request. Assert that the manifest is written at the path that the workflow uploads, in a success case.
  - In the workflow test, drop the label lookups, the order checks and the full command checks. Instead, require that each step that gets the release token runs the publish script or the promotion script, and that no step that runs `release-build` gets the token. Keep the other credential checks.
  - Run the promotion command test from a temporary copy of the promotion scripts with no `node_modules`.
  - Set `GH_TOKEN` in the build test, so its check can fail.
- **Impact if no action:** A regression in the publish command can upload changed files that a later rerun rejects, or fail every release after the uploads.
- **Related:** `plans/follow-ups/desktop-release-scripts-need-coverage-floor.md` holds the wider fix for this class, which waits for the owner.
- **Done when:** A test runs `release-publish` and fails when its hash comparison is removed, and the workflow test reads no step label.
