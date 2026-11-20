# Mockup components stylesheet passes 300 lines

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-06, from branch `calummoore/mac-title-bar-integration`, Milestone 4 of the Mac window plan.
- **Location:** `docs/mockups/styles/components.css`.
- **Reason:** The file already passed 300 lines on `origin/main`, and a split moves rules that many screens and the app share, so a separate branch does it.

- **Terms:**
  - **Shared stylesheets:** the CSS under `docs/mockups/styles`. The catalogue links it, and `packages/app/scripts/sync-styles.mjs` copies it into the app, whose `packages/app/public/index.html` links the same files.
- **Background:** The always-on rules target about 200 lines for a file and split a file that passes 300. `AGENTS.md` makes 300 lines a hard cap for Rust files only. Other files may pass the target for generated code, large data or cohesion, but they are split when practical. `docs/mockups/styles/components.css` holds the registered frames and fragments: the panel, the settings dialog and the settings layer, among others.
- **Problem:** The file had 332 lines on `origin/main` on 2026-11-06. The Mac window change added the settings bar's window insets, so it has 354 lines.
- **Impact if no action:** Agents and reviewers read the whole file on each change, and each new frame rule adds to the later split.
- **Root question:** How does the shared components stylesheet return to the length target?
- **Options:**
  - **A.** Move the settings dialog and settings layer rules into their own stylesheet. Link it where `components.css` is linked: the stylesheet rules of `mokly.config.json`, `packages/app/public/index.html` and the tests that list the linked sheets. Effort: Medium.
  - **B.** Split the file when a branch next changes a frame in it. Effort: Medium.
  - **C.** Do A, and add a length check for changed CSS files. A new check is a new gate, so it needs the user's approval. `plans/follow-ups/changed-files-have-no-length-check.md` holds that choice. Effort: Medium.
- **Left out:** Keep the file as it is. It fails the goal, and no exception for generated code, large data or cohesion covers it.
- **Wider fix:** C. Only a check stops a file from passing the target again, and that check is a pending choice of the user.
- **Previous examples:** `plans/follow-ups/app-test-files-pass-300-lines.md` and `plans/follow-ups/mockups-readme-passes-300-lines.md` record the same class.
- **Related:** `plans/follow-ups/changed-files-have-no-length-check.md`, shared wider fix.
- **Recommendation:** A. One move restores the target, and it changes no rule's effect.
- **Action:** fix after merge, apply A, because the file was already long on `origin/main`, and the split reaches files outside this change.
