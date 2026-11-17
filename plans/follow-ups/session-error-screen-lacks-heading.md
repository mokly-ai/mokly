# The session error screen has no heading or skip link

- **Severity:** Low. **Likelihood:** Rare. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-04, from task M3a of `plans/loading-states-match-content.md`, on the branch `calummoore/skeleton-sizing-mismatch`.
- **Location:** `ts/app/src/session/guard.tsx`, the frame that draws "Mokly couldn’t load" when the session read fails.
- **Reason:** The defect is in an error screen that the loading-states change did not need to touch, so a separate branch fixes it.
- **Category:** Product bug.

- **Terms:**
  - **Session guard:** `RequireSession` in `ts/app/src/session/guard.tsx`, which every product route uses to read the session before it draws the route.
- **Background:** `docs/protocol/web-app.md`, under Accessibility, says that every screen owns one `main` landmark, one `h1` and a skip link. When the session read fails, the session guard draws an account panel with the error state "Mokly couldn’t load" and one **Try again**.
- **Problem:** That error frame has a `main` landmark but no `h1` and no skip link. The state card's title is an `h2`.
- **Impact if no action:** A screen-reader reader who meets a failed session read finds no page heading, and a keyboard reader has no skip link. Only a failed session read shows this screen.
- **Root question:** How does the session guard's error screen meet the screen rules for headings and skip links?
- **Options:**
  - **A.** Draw the error inside the account shell with the title "Mokly couldn’t load" as its `h1` and the shell's skip link, and keep the state card's own title out, so that the heading is not repeated. Effort: Small.
- **Left out:** Change the protocol so that error frames need no heading. It would weaken an accessibility requirement that every other screen meets. There is one real approach, because the requirement settles it.
- **Wider fix:** None. The requirement already states the rule, and `ts/app/src/_tests_/a11y.spec.ts` checks the screens it visits.
- **Previous examples:** None found.
- **Recommendation:** A. The requirement settles it.
- **Action:** fix after merge, apply A, because the screen is outside the change that found it.
