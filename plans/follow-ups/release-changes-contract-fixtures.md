# A release changes the Mokly contract fixtures

- **Severity:** High. **Effort:** Medium (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-20, from release PRs #292 (0.20.0) and #418 (0.21.0).
- **Location:** `crates/mokly-graph/src/config_key.rs:24`, `xtask/scripts/mokly-fixtures.mjs`, and `crates/mkc-mokly-contract/fixtures/`.
- **Reason:** The fix changes a published fixture rule or the release workflow, so the user must choose.
- **Category:** Release reliability (estimate).

- **Background:** PR #350 moved Mokly Cloud into this repository. The `cloud-fixtures` suite of the "Workspace checks" CI job regenerates the Mokly contract fixtures with the workspace CLI and compares every byte. `docs/protocol/cloud/mokly-fixture-regeneration.md` says that a release alone changes no fixture.
- **Problem:** The resolved config key holds the Mokly version, and each document key and the deployment ID derive from it. A version bump therefore changes 10 golden files: `checksums.json`, `dogfood.tar.gz`, `index-v9.json`, `inventory.json`, `plan.tar.gz`, and the five `moves-` files. Release Please writes only the version files, so its release PR fails "Required CI". For 0.20.0 and 0.21.0, the performance orchestrator pushed regenerated fixtures to the release branch by hand (`bd2421c49`, `690c06011`).
- **Impact if no action:** Every release PR fails CI until someone regenerates the fixtures on its branch. A later releasable merge into `main` makes Release Please rebuild the branch, and that drops the regenerated fixtures.
- **Root question:** Should the fixtures be independent of the release number, or should each release regenerate them?
- **Options:**
  - **A.** Run the generator with a fixed producer version, for example through a test-only CLI setting, so the document keys use `0.0.0`. Effort: Medium (estimate).
  - **B.** Add a Release workflow step that regenerates the fixtures and commits them to the release PR branch after each Release Please update. Effort: Medium (estimate).
  - **C.** Regenerate by hand on each release PR. Effort: Small each time.
- **Left out:** Leave the document keys out of the drift comparison. That hides differences that the contract must catch.
- **Recommendation:** A (estimate). It keeps the documented rule true, and no release depends on a manual step.
- **Action:** ask the user.
