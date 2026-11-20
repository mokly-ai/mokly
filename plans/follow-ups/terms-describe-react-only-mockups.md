# Terms describe React-only mockups

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-02, from finding 302 of the final review of the Mokly 0.18.0 upgrade on the branch `calummoore/mokly-cli-upgrade`.
- **Location:** `apps/site/src/content/legal/terms.md:16` and `docs/mockups/src/screens/design/site/policy_screens.tsx:78`.
- **Reason:** The fix changes the published legal text, which needs the user's approval.
- **Category:** Docs or spec.

- **Terms:**
  - **Terms:** the site's Terms of Service at `apps/site/src/content/legal/terms.md`, which `docs/protocol/cloud/site-legal.md` governs.
- **Background:**
  - Section 1 of the Terms says: "Mokly helps teams publish, browse, compare and share React-authored mockups connected to Git repositories, branches and pull requests." The Terms drawing repeats it.
  - Mokly builds HTML screens, React components and Storybook stories, as the guides under `docs/guides/authoring/` say. The contract fixture catalogue of the cloud is HTML-authored.
  - `docs/protocol/cloud/site-legal.md` says that the legal text describes shipped behaviour, and that the Terms carry an approved effective date, 2026-09-22.
  - `apps/site/README.md` still says that a Mokly pin bump checks the Terms against the release notes. The cloud now uses the workspace Mokly packages, so a Mokly change reaches the site without a pin bump, and no release review checks the Terms.
- **Problem:** The service description is narrower than the authoring formats that the service builds.
- **Impact if no action:** A customer who authors HTML screens reads a service description that leaves out their catalogue.
- **Root question:** How do the Terms describe the service across the authoring formats that it builds?
- **Options:**
  - **A.** Say "mockups" without "React-authored" in the Terms and the drawing. Keep the effective date, because "mockups" was also true before the upgrade. Effort: Small.
  - **B.** Do A, and add a requirement to `site-legal.md` that the Terms name no authoring format, because each Mokly change can change the formats. Effort: Small.
  - **C.** Do A, and publish the change with a new approved effective date. Change the tests that expect 2026-09-22: `apps/site/tests/legal.test.ts:72`, `apps/site/tests/browser/documents.spec.ts:115` and `docs/mockups/src/_tests_/design-site-content.test.ts:181`. Effort: Small.
  - **D.** Name the forms that Mokly builds: HTML files, React components and Storybook stories. This needs the new date of C, and each Mokly change that changes the forms opens the legal text again. Effort: Small.
- **Left out:** Restricting the service to React, because it removes supported behaviour and adds an upload rejection. Keeping the text, because it fails the goal.
- **Wider fix:** B. Mokly changes reach the site without a pin bump, so the pin-bump step in `apps/site/README.md` no longer runs, and only a requirement keeps the formats out of the Terms.
- **Previous examples:** Commit `7e35a06a` removed the same React-only claim from the cloud overview.
- **Recommendation:** A. It changes two files and keeps the approved date correct. B stops a later edit from adding the formats back.
- **Action:** ask the user, because the fix changes approved legal text.
