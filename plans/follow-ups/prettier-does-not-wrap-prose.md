# Prettier does not wrap Markdown prose

- **Severity:** Low (estimate). **Effort:** Small. **Confidence:** High. **Harder later:** Yes.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from the follow-ups of the Milestone 6B review TODO and the reset fix reviews in the deleted `plans/foundation-terraform-from-ci.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `.prettierrc.json:1-6`, the Prettier configuration that the `prettier` stage of `cargo xtask check` reads.
- **Reason:** The fix changes how the formatter rewrites every Markdown file, and the source names it a decision for the user.
- **Checked:** 2026-10-31, at commit `f568853e`. The decision is still open. `.prettierrc.json` still sets `proseWrap` to `preserve` with a print width of 80. This is a policy proposal, not a format failure.
- **Category:** Repository rule.

- **Terms:**
  - **`proseWrap`:** The Prettier option that decides whether the formatter wraps Markdown prose lines, keeps them, or joins them.
- **Background:** The `prettier` stage of the gate checks the format of the Markdown files. With the current setting, the formatter keeps the line breaks that the author typed. Three reviews of the Foundation change found prose lines past 80 columns: review 6 finding 1, reset fix review 1 finding 3 and reset fix review 2 finding 1. The third time, the review named the class a decision for the user.
- **Problem:** Authors wrap prose by hand, so each review keeps finding long lines.
- **Impact if no action:** Reviews spend rounds on line breaks, and Markdown files mix wrapped and long lines.
- **Root question:** Who owns the line breaks of Markdown prose?
- **Options:**
  - **A.** Change nothing, and let reviews keep finding long lines. Effort: Small.
  - **B.** Set Prettier `proseWrap` to `always`, so that the formatter owns every prose line break. Reformat every Markdown file in one change. Effort: Small.
- **Left out:** A line-length lint for Markdown. It detects the class, while B removes it.
- **Wider fix:** B. The formatter removes the class.
- **Previous examples:** Review 6 finding 1, reset fix review 1 finding 3 and reset fix review 2 finding 1 of the Foundation change.
- **Related:** `plans/follow-ups/playwright-config-comment-unwrapped.md` is the same class in a TypeScript comment, which Prettier does not wrap.
- **Recommendation:** B. A formatter rule ends the review rounds for good.
- **Action:** ask the user, because condition 5 holds: the source review named this class a decision for the user.

B reformats many files at once, so land it alone and in a quiet moment, to keep merge conflicts small.

Source: [the Milestone 6B review TODO](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/foundation-terraform-from-ci.md?plain=1#L528-L562) and [the reset fix review](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/foundation-terraform-from-ci.md?plain=1#L564-L613) of the deleted plan.
