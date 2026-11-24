# Preview capture is unchecked after workspace sources

- **Severity:** Medium. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-11-24, from the post-merge task of the deleted plan
  `plans/source-packages.md`, on the branch
  `calummoore/mokly-website-redesign-plan-v2-xnnj`.
- **Location:** None.
- **Reason:** A preview capture compares a pull request with `main`, so it
  can prove the fix only after the fix is on `main`.

- **Terms:**
  - **Preview capture:** the job "Capture unprivileged PR catalogue" of the
    Preview workflow (`.github/workflows/preview.yml`). It builds this
    repository's cloud mockup catalogue with a Changes comparison against
    `origin/main`, and `infra/scripts/capture-catalogue.py` rejects an upload
    without a comparison, as `docs/protocol/cloud/preview-capture.md` says.
  - **Workspace package sources:** the Mokly rule in
    `docs/protocol/mokly-comparison-packages.md` that loads a workspace
    package's source file where its export names a built file. Git holds no
    built files, so a base render needs this rule.
- **Background:**
  - From #350 (2026-11-20) until this change, every labelled preview failed.
    The base render could not resolve `@mokly/ui/...` imports, the CLI
    published without Changes, the capture failed with
    `Catalogue capture failed: mokly-upload.json baseRef does not match the capture`,
    and the seed job then failed with `catalogue missing`.
  - Locally, after the change, a build against a base commit printed no
    `base` diagnostic and wrote 6,286 files with ready Changes, against 2,646
    files without Changes before.
- **Task:** Add the `preview` label to a pull request whose base `main`
  holds the change. Check that the jobs "Capture unprivileged PR catalogue",
  "Deploy or remove preview workloads" (with its step "Seed the preview
  sample project") and "Preview required" pass, and that the preview shows
  Changes.
- **Impact if no action:** A preview failure from another cause, such as the
  cloud runner's base install, stays unseen until the next labelled pull
  request.
- **Needs:** The change merged into `main`, and a pull request with the
  `preview` label.
- **Done when:** A dated result names the pull request, the Preview workflow
  run, and the result of each of the three jobs.
