# Site docs code panels have six small loose ends

- **Severity:** Low. **Likelihood:** Rare. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-21, from `calummoore/canvas-redesign-m6-site-docs-570n`.
- **Location:** `apps/site/src/components/docs/CodeCopy.tsx`,
  `apps/site/src/docs/code-panel.ts`, `apps/site/src/docs/sample-band.ts`,
  `apps/site/astro.config.mjs`, `apps/site/src/icons.ts`
- **Reason:** The Canvas docs milestone found them, but each was outside its
  listed files or below its bar.

- **Terms:**
  - **Code panel:** the Canvas frame that draws a docs code block, with a
    head that names the language and holds Copy.
  - **Sample band:** the HTML sample fence of "Your first screen".
- **Background:** Milestone 6 moved the docs code blocks onto the shared
  Canvas code panel. It left these items:
  1. A second Copy within two seconds ends "Copied" early.
  2. A fence with an unknown language gets an empty language tab. No page
     has one today.
  3. Both docs islands import the whole icon set, about 2.5 KB after gzip.
  4. The light Shiki theme stays configured, but no panel uses it.
  5. Each code block keeps a tab stop, though it no longer scrolls.
  6. The shell language set exists twice: in `code-panel.ts` and in
     `components/CodePanel.astro`. Milestone 8 already shares the helpers of
     `sample-band.ts`.
- **Problem:** Each item is small, and none breaks a page today.
- **Impact if no action:** Slightly larger islands, one wasted tab stop per
  code block, and two copies of the same helpers that can drift.
- **Root question:** Which of these does the site fix, and where?
- **Options:**
  - **A.** Fix all six in one change: reset the Copied timer on each press,
    fall back to "text" for an unknown language, import single icons, drop
    the light theme, remove the tab stop when a block does not scroll, and
    let `CodePanel.astro` import the language set from `code-panel.ts`.
    Effort: Small.
  - **B.** Fix only 5 and 6, which affect readers and maintainers most.
    Effort: Small.
- **Left out:** Leaving all six, because 5 costs keyboard readers a stop on
  every block.
- **Wider fix:** A.
- **Previous examples:** None found.
- **Recommendation:** A. Each fix is a few lines.
- **Action:** fix after merge, apply A.
