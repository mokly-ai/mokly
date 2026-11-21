# Playwright config comment line left unwrapped

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from open finding 15 of the Milestone 5 review TODO in the deleted `plans/require-the-installation.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `packages/app/playwright.config.ts:31`.
- **Reason:** PR #69 merged on 2026-10-28 with the finding open, and the workspaces change left it with that plan. The review-fix rule leaves its category to the user.
- **Checked:** 2026-11-17, in this repository after the cloud moved in. The choice is still open. The long line is now line 31, after the shard parser that came before the comment. It still joins the end of one sentence and the start of the next.
- **Category:** Code structure.

- **Background:** The doc comment above the configuration in `packages/app/playwright.config.ts` wraps at 80 columns. Line 31 has 135 characters. It joins the sentence about provider answers with the start of the routing sentence.
- **Problem:** One comment line breaks the wrap of its block.
- **Impact if no action:** The comment is harder to read, and the next edit copies the long line.
- **Root question:** How does the comment keep the wrap of its block?
- **Options:**
  - **A.** Rewrap the comment at 80 columns. Effort: Small.
  - **B.** Leave it. Effort: Small.
- **Left out:** A lint for comment width. It would be a new check for one line.
- **Wider fix:** `plans/follow-ups/prettier-does-not-wrap-prose.md` holds the formatter question for prose line breaks.
- **Previous examples:** None found in TypeScript comments.
- **Related:** `plans/follow-ups/prettier-does-not-wrap-prose.md`, same class in Markdown prose. Its formatter rule does not wrap this TypeScript comment.
- **Recommendation:** A. It is a one-line change.
- **Action:** ask the user, because condition 6 holds: the finding concerns a code comment layout, a category that the review-fix rule does not let an agent fix alone.

Source: [the Milestone 5 review TODO](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/require-the-installation.md?plain=1#L244-L261) of the deleted plan.
