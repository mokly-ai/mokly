# The app README passes 300 lines

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-06, from Milestone 7 of `plans/loading-states-match-content.md`, on the branch `calummoore/skeleton-sizing-mismatch`.
- **Location:** `packages/app/README.md`.
- **Reason:** The file already had 445 lines on `main` of the old cloud repository, so its split is not part of the loading-states change that grew it.
- **Category:** Repository rule.

- **Terms:**
  - **App README:** The guide of the `@mokly-cloud/app` package: what it does, its commands, its development rules and its key code.
- **Background:** The always-on rules ask each file to stay near 200 lines and to be split when it passes 300. The repository `AGENTS.md` caps changed TypeScript and JavaScript files at 300 lines and protocol pages at 250 lines through the gate, and it sets no cap for a README. The app README had 445 lines on `main` of the old cloud repository at `967ab6c8`. The loading-states change added entries for the new placeholder parts, waits and writes, and the merged tree had 462 lines. On 2026-11-17, after the cloud moved into this repository, the README has 472 lines.
- **Problem:** The README is about 57% over the split threshold. Its Key Code list and its sections on cloud builds and tests make most of its length.
- **Impact if no action:** A reader who looks for one entry point reads a long file, and each change adds to it.
- **Root question:** How does the app's guide stay short enough to read?
- **Options:**
  - **A.** Move the long topic sections, such as Cloud Builds and the browser suite, to linked pages next to the README, and keep the README's summary, commands, development rules and Key Code. Effort: Small.
- **Left out:** Compact the text or remove blank lines. The rules forbid that as a way to meet a limit. There is one real approach, because the length comes from whole topics.
- **Wider fix:** None. `plans/follow-ups/mockups-readme-passes-300-lines.md` records the same problem for the mockups README.
- **Previous examples:** `plans/follow-ups/mockups-readme-passes-300-lines.md`.
- **Recommendation:** A. Topic pages keep each fact in one place.
- **Action:** fix after merge, apply A, because the file passed the limit before this change.
