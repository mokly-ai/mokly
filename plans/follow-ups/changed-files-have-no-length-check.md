# Changed docs and tests have no length check

- **Severity:** Low (estimate). **Effort:** Medium. **Confidence:** High. **Harder later:** Yes.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from the Milestone 6B review follow-up of the deleted `plans/foundation-terraform-from-ci.md` and the post-merge notes of the deleted `plans/cloud-builds.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `xtask/src/checks/length.rs:7-16` and `xtask/src/stage.rs`, beside the `rust-file-length-lint` stage.
- **Reason:** The fix is a new gate, and a new gate needs the user's approval.
- **Checked:** 2026-10-31, at commit `f568853e`. The decision is still open. Only Rust files under `crates` and `xtask` have a length stage, and ESLint has no `max-lines` rule. No new gate is approved.
- **Category:** Repository rule.

- **Terms:**
  - **`rust-file-length-lint`:** The gate stage that fails a changed or untracked Rust file past 300 lines.
- **Background:** The repository rules target about 200 lines for a file and split a file that passes 300. Protocol docs target about 250 lines. Only Rust files have a check. The Foundation change found six Markdown files past 300 lines on `origin/main`, so its review named the class a decision for the user. The cloud builds review, third round finding 8, asked for the same check for Markdown and TypeScript files.
- **Problem:** Docs and tests grow past their targets, and nothing reports it until a review reads them.
- **Impact if no action:** Long files keep growing, and reviews spend rounds on splits.
- **Root question:** How does a change learn that it pushed a Markdown or TypeScript file past its target?
- **Options:**
  - **A.** Change nothing, and let reviews keep finding long files. Effort: Small.
  - **B.** Add a stage that checks changed and untracked Markdown and TypeScript files against their targets, as `rust-file-length-lint` does for Rust. It is a new gate. Effort: Medium.
- **Left out:** A check of every file on each run. Many files already pass their targets, so it would fail at once.
- **Wider fix:** B. It covers every later file of the class.
- **Previous examples:** `plans/follow-ups/mockups-readme-passes-300-lines.md`, `plans/follow-ups/app-test-files-pass-300-lines.md` and `plans/follow-ups/operator-docs-pass-300-lines.md`.
- **Related:** The list below gives the links.
  - The three items under Previous examples are current cases of the class.
  - `plans/follow-ups/operator-docs-pass-300-lines.md`, shared wider fix. This check would stop its class of long docs.
  - [`plans/follow-ups/viewer-stage-mockup-passes-300-lines.md`](https://github.com/mokly-ai/mokly-cloud/blob/164d73db2601d451392a3bfb13b0f918345807b6/plans/follow-ups/viewer-stage-mockup-passes-300-lines.md), shared wider fix. This check would stop its class of long source files.
- **Recommendation:** B. It reports a long file in the change that grows it.
- **Action:** ask the user, because condition 3 holds: B adds a new gate.

Source: [the Milestone 6B review TODO](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/foundation-terraform-from-ci.md?plain=1#L528-L562) and [the cloud builds post-merge notes](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/cloud-builds.md?plain=1#L2245-L2275) of the deleted plans.
