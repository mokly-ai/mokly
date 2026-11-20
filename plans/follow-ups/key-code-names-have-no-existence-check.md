# Key Code names have no existence check

- **Severity:** Low (estimate). **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from the decision for the user in the Milestone 12 review TODO of the deleted `plans/documentation-skill-alignment.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** Every `README.md` with a `### Key Code` section, and `tests/markdown_links.test.ts`, the whole-repository Markdown link test.
- **Reason:** The fix is a new gate check, and a new gate check needs the user's approval.
- **Checked:** 2026-11-17, in this repository after the cloud moved in. The Markdown link test checks paths and anchors, but no check reads the names in a Key Code section. No new gate check is approved.
- **Category:** Repository rule.

- **Terms:**
  - **Key Code section:** The `### Key Code` list of a README that names the files, types and functions of its area.
  - **Gate:** `cargo xtask check`, the complete set of suites that every change must pass: the Mokly suites and the 16 cloud suites.
  - **Markdown link test:** `tests/markdown_links.test.ts`, which the Viewer suite runs once. It checks the local links and anchors of `AGENTS.md`, `docs/`, `plans/`, every `README.md`, and the Markdown files under the AGPL paths (`apps/`, the `mkc-` crates, `packages/tokens/`, `infra/`, and `scripts/cloud/`).
- **Background:** The `documentation` skill makes the README `### Key Code` section the home of code references. PR #51 of the old cloud repository moved the code names of the protocol docs into those sections. Findings 4 and 6 of its review found checks that lost their input in that move. Finding 6 is `plans/follow-ups/protocol-symbol-test-checks-nothing.md`. The Mokly READMEs use the same sections, so the class covers both parts of the repository.
- **Problem:** No check proves that a backticked identifier in a Key Code entry exists in the file that the entry links. A rename or a removal leaves the README wrong.
- **Impact if no action:** The entry points of a README drift from the code. Agents and new readers then open the wrong file or look for a symbol that is gone.
- **Root question:** How do README entry points stay true when the code changes?
- **Options:**
  - **A.** Change nothing. Review catches the drift. Effort: Small.
  - **B.** Add a check that reads each Key Code entry and fails when a backticked identifier is not in its linked file. It can run beside the Markdown link test or as an `xtask` check of the Repository suite. It is a new gate check. The `testing` skill keeps doc prose out of tests but keeps link checks, and B checks references as a link check does. Effort: Medium.
- **Left out:** A check that reads the protocol docs. The `documentation` skill moves code names out of them, so such a check covers less after each alignment.
- **Wider fix:** B. It covers findings 4 and 6 and every later README.
- **Previous examples:** None found.
- **Related:** `plans/follow-ups/protocol-symbol-test-checks-nothing.md`, shared wider fix.
- **Recommendation:** B. The Key Code sections are now the only home of code references, so they need the protection that the protocol docs had.
- **Action:** ask the user, because condition 3 holds: B adds a new gate check.

Source: [the Milestone 12 review TODO](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/documentation-skill-alignment.md?plain=1#L673-L702) of the deleted plan.
