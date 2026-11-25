# Disk spec's full-page capture fails at random

- **Severity:** Medium. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-25, from the branch `calummoore/dropdown-menu-missing-ja6h`, an unrelated flaky test in CI run 45605279317.
- **Location:** `docs/mockups/src/_tests_/disk.spec.ts:238-242`.
- **Reason:** The branch that saw the failure does not change the site mockups or the disk spec, and an unrelated flaky test gets its fix in a separate branch.

- **Terms:**
  - **Disk spec:** the browser spec of the cloud mockup catalogue. For each generated page, in each scheme and width, it checks the page and then saves a full-page screenshot.
- **Background:**
  - On 2026-11-25, the CI job "Mockup checks" (suite `cloud-mockups`) failed the case `disk: static/mokly-generated/design/site/complaints/index.desktop.dark.html` with this text: `Error: page.screenshot: Protocol error (Page.captureScreenshot): Unable to capture screenshot`. The call log shows that animations were disabled and the fonts had loaded before the failure.
  - The failing call is `page.screenshot({ path, fullPage: true, animations: "disabled" })` at `docs/mockups/src/_tests_/disk.spec.ts:238`.
  - The same job passed on the next commit of that branch, which changed no mockup or test file. The page is a long legal text page.
- **Problem:** Chromium sometimes rejects the full-page capture. The suspected source is a full-page capture of a tall page while the compositor has no frame ready. The cause is not confirmed.
- **Impact if no action:** The mockup checks fail now and then on branches that do not touch the mockups, and each failure costs a rerun.
- **Root question:** How does the disk spec capture each page only when Chromium can draw it?
- **Options:**
  - **A.** Repeat the tall site pages (for example 50 runs of the complaints, privacy, and terms pages) to reproduce the failure. Record the page height and the GPU and compositor messages. Then fix the cause, for example with a wait for a drawn frame (two `requestAnimationFrame` callbacks) before the capture. Effort: Medium.
  - **B.** Capture the page in parts of a fixed height and join them. Effort: Medium. It changes the screenshot output.
  - **C.** A shared capture helper for every catalogue screenshot that waits for a drawn frame. Effort: Medium.
- **Left out:** A retry of the capture, because it hides the cause.
- **Recommendation:** A. It finds the cause first. C protects the codebase best when A confirms a frame-readiness cause.
- **Action:** fix after merge, apply A.
