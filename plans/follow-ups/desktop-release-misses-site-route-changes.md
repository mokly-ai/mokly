# Desktop releases miss changes to site routes and shared settings

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-20, on branch `calummoore/desktop-release-process-ujn3`,
  from the move session's report on the merged move branch.
- **Location:** `release-please-config.json` (the `packages` component),
  `packages/app/src/navigation/return-to.ts:1`,
  `packages/desktop/scripts/site-segments.ts`, `packages/app/tsconfig.json`,
  and `packages/desktop/tsconfig.json`.
- **Reason:** The fix adds a check or moves shared files, so the user must
  choose.
- **Category:** Process.

- **Terms:**
  - **Site segments:** the first path segments of the public site, such as
    `pricing`. The desktop shell opens them in the system browser.
- **Background:**
  - The desktop Release Please component covers `packages/`, except the npm
    CLI and native packages. Release Please gives each component one folder.
  - The app imports the site segments from `apps/worker/src/site-segments.ts`.
    The desktop build writes its own copy, `packages/desktop/src/site-segments.ts`,
    from `apps/site/src/navigation`.
  - Both moved projects extend `apps/tsconfig.json`, which sets the compile
    target of the desktop main process.
  - Test-only imports, such as `apps/_tests_/scratch.mjs`, do not reach the
    shipped app.
- **Problem:** A commit that adds a top-level site route or changes
  `apps/tsconfig.json`, and touches nothing under `packages/`, changes the
  shipped desktop app but starts no desktop release.
- **Impact if no action:** Until the next desktop release, the desktop app
  can open a new site page inside its window instead of the browser.
- **Root question:** How does every change to the shipped desktop app start a
  desktop release?
- **Options:**
  - **A.** Change nothing. State the limit in Desktop distribution. A person
    who adds a site route regenerates the desktop copy in the same commit.
    Effort: Small.
  - **B.** Make the site route check (`routes:check`) also compare the
    committed `packages/desktop/src/site-segments.ts`, and let the app import
    that copy. A route change then always touches `packages/`. This adds a
    stricter check. Effort: Small.
  - **C.** Do B, and move the shared TypeScript settings from
    `apps/tsconfig.json` to a file under `packages/` that `apps/` also
    extends. Effort: Medium.
- **Left out:** A second Release Please component under `apps/`, because it
  would give the desktop two versions. A custom release tool, because the
  user rejected it in decision 1.
- **Wider fix:** C. Every shipped input then lives under `packages/`.
- **Previous examples:** None found.
- **Recommendation:** B. A route change is the likely case, and B covers it
  with an existing check. The compile target changes seldom.
- **Action:** ask the user, because the recommended option adds a stricter
  check.
