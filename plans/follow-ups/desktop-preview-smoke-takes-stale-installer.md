# Preview smoke can take a stale installer

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-24, from review finding 3 of the branch `calummoore/desktop-releases-become-latest-releases-clkn`, which its check moved outside the scope.
- **Location:** `packages/desktop/scripts/package.mjs:20`, the function `packageArtifact`, and `packages/desktop/scripts/packaged-smoke.mjs`, which reads the shared `packages/desktop/release` directory.
- **Reason:** The defect is on `main` and the branch did not cause it, so a separate branch fixes it.
- **Category:** Test.

- **Terms:**
  - **Preview smoke test:** The check that extracts and launches the macOS arm64 ZIP or the Linux AppImage that a preview build made without release credentials.
- **Background:**
  - Preview packaging writes into `packages/desktop/release`, which earlier local builds can still hold.
  - `packageArtifact` takes the first name that ends with `-mac-arm64.zip` or `.AppImage`. Node's `readdir` order puts an older versioned file such as `Mokly-0.1.0-mac-arm64.zip` before a newer one.
  - On 2026-11-24 the installer names lost their version, such as `Mokly-mac-arm64.zip`. A file from a local build before that change can still sort first.
  - CI packages on a fresh runner into an empty directory, so CI never meets the defect.
- **Problem:** On a local machine with old build output, the smoke test can launch an old installer instead of the new one.
- **Impact if no action:** A local smoke run can pass on an old build.
- **Root question:** How does the launch check use the installer of the current build?
- **Options:**
  - **A.** Select the exact fixed name of each platform, from the one fixed inventory that the promotion uses. Effort: Small.
  - **B.** Give each preview build a fresh output directory, and pass it to the smoke test and the artifact upload. Effort: Medium.
- **Left out:** Sorting by name or time keeps the check dependent on file order.
- **Wider fix:** B. It also protects against stale files whose names already follow the contract.
- **Previous examples:** Release packaging already builds into a fresh directory for the same reason.
- **Recommendation:** A. It is the smallest change and uses the release contract.
- **Action:** fix after merge, apply A, because the defect is on `main` and only local runs meet it.
