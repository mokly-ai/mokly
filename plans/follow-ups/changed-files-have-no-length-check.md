# Changed docs outside the protocol have no length check

- **Severity:** Low (estimate). **Effort:** Medium. **Confidence:** High. **Harder later:** Yes.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from the Milestone 6B review follow-up of the deleted `plans/foundation-terraform-from-ci.md` and the post-merge notes of the deleted `plans/cloud-builds.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `scripts/verification/source-file-length.mjs:21-22`, the two patterns that select the files of the changed-file length audit, and the Length Audits section of `docs/protocol/ci-verification-repository.md`.
- **Reason:** The fix widens a gate check, and a new gate rule needs the user's approval.
- **Checked:** 2026-11-17, in this repository after the cloud moved in. The changed-file length audit of the Repository suite checks changed TypeScript and JavaScript files against 300 lines and changed Markdown under `docs/protocol/` against 250 lines. No check reads the length of other Markdown files.
- **Category:** Repository rule.

- **Terms:**
  - **Changed-file length audit:** The Repository suite check that `cargo xtask source-file-length-lint` also runs alone. It reads the files changed against the fetched `origin/main`, plus working-tree and untracked files.
  - **Doc outside the protocol:** A Markdown file that is not under `docs/protocol/`: a README, an architecture doc, an operations runbook, a guide, or a mockup guide.
- **Background:**
  - The shared always-on rules target about 200 lines for a file and split a file that passes 300. The `documentation` skill targets about 250 lines for protocol docs and gives architecture docs the same target. Neither the shared skills nor `AGENTS.md` gives a README or a runbook a number of its own.
  - In the old cloud repository, only Rust files had a length check. The Foundation change found six Markdown files past 300 lines on that `main`, so its review named the class a decision for the user. The cloud builds review, third round finding 8, asked for the same check for Markdown and TypeScript files.
  - On 2026-11-17 the cloud moved into this repository. Its gate already had the changed-file length audit for TypeScript, JavaScript, and protocol Markdown, so that part of the request is in force. `AGENTS.md` names the audit and its two caps.
  - On 2026-11-17, 30 tracked Markdown files outside `docs/protocol/` and `plans/`, changelogs aside, passed 250 lines. Examples: `docs/ops/deploy.md` with 902 lines, `packages/viewer/src/shell/README.md` with 649, `packages/app/README.md` with 472, `packages/ui/README.md` with 465, and `docs/architecture/cloud.md` with 274.
- **Problem:** Docs outside `docs/protocol/` grow past their targets, and nothing reports it until a review reads them.
- **Impact if no action:** Long READMEs and runbooks keep growing, and reviews spend rounds on splits.
- **Root question:** How does a change learn that it pushed a Markdown file outside `docs/protocol/` past its target?
- **Options:**
  - **A.** Change nothing, and let reviews keep finding long docs. Effort: Small.
  - **B.** Extend the changed-file length audit to changed Markdown outside `docs/protocol/`. Architecture docs get the 250-line target of protocol docs. READMEs, runbooks, and guides get the 300-line split limit of the always-on rules, and `AGENTS.md` states it. An exact-cap table, like `xtask/protocol-document-caps.json`, holds each file that passes its limit today and can only shrink. It is a new gate rule. Effort: Medium.
- **Left out:** A check of every file on each run with no caps. Many files already pass their targets, so it would fail at once.
- **Wider fix:** B. It covers every later file of the class.
- **Previous examples:** `plans/follow-ups/mockups-readme-passes-300-lines.md`, `plans/follow-ups/operator-docs-pass-300-lines.md`, and `plans/follow-ups/shell-readme-length.md`. The deleted item [`plans/follow-ups/app-readme-passes-300-lines.md`](https://github.com/mokly-ai/mokly/blob/4eb342907e52dced1a8ad696ca2096de02227460/plans/follow-ups/app-readme-passes-300-lines.md) was a case too, until a split moved the long topics of `packages/app/README.md` to linked pages beside it.
- **Related:** The list below gives the links.
  - The three open items under Previous examples are current cases of the class.
  - `plans/follow-ups/operator-docs-pass-300-lines.md` asks whether to split four long runbooks. Option B here would turn that choice into a gate rule.
  - [`plans/follow-ups/viewer-stage-mockup-passes-300-lines.md`](https://github.com/mokly-ai/mokly-cloud/blob/164d73db2601d451392a3bfb13b0f918345807b6/plans/follow-ups/viewer-stage-mockup-passes-300-lines.md), a long source file of the old cloud repository. The changed-file length audit now covers that class.
- **Recommendation:** B. It reports a long doc in the change that grows it, as the audit already does for code and protocol docs.
- **Action:** ask the user, because condition 3 holds: B adds a new gate rule.

Source: [the Milestone 6B review TODO](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/foundation-terraform-from-ci.md?plain=1#L528-L562) and [the cloud builds post-merge notes](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/cloud-builds.md?plain=1#L2245-L2275) of the deleted plans.
