# Docs merge removals still await approval

- **Severity:** Medium. **Effort:** Small. **Confidence:** High. **Harder later:** Yes.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from finding 1 of review 3 in the Milestone 13 review TODO of the deleted `plans/documentation-skill-alignment.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** The docs that the list below names. The protocol docs are under `docs/protocol/cloud/`.
- **Reason:** A removal of functionality on `origin/main` needs the user's explicit approval, and PR #51 merged on 2026-10-21 while the approval was open.
- **Checked:** 2026-10-31, at commit `f568853e`. The decision is still open. The description of PR #51 still shows finding 1 of review 3 as waiting for the user. No current requirement loss is shown.
- **Category:** Process.

- **Terms:**
  - **Decision 1:** The user's approval on 2026-10-20 to drop history and evidence and to move code names, mechanics and case lists out of the audited protocol docs and READMEs.
- **Background:** PR #51 of the old cloud repository aligned the protocol docs and READMEs with the `documentation` skill. While it ran, `main` changed some of the passages that decision 1 dropped. The two merges of `main` on 2026-10-21 dropped those edits together with their passages. They kept each new requirement in them. On 2026-11-17 the cloud moved into this repository: its protocol docs moved under `docs/protocol/cloud/`, the cloud `xtask` and its README went with the old runner, and the cloud workspace README became `docs/development/cloud.md`. The PR description lists the dropped edits, and the list below copies it.
  - The ahead-page table in `site.md` and the page column in `site-docs.md`. Their cases live in `apps/site/tests/docs.test.ts` and in the pages' source comments.
  - The test lists in `changes-check.md` and `web-app.md`.
  - The 2026-10-12 fixture evidence paragraph, the hash table and two file counts in `mokly-artifact-compatibility.md` and `mokly-fixture-regeneration.md`.
  - One test sentence in `shared-control-registrations.md`, and count wording in `product-mockups.md`.
  - The schema-module count in `persistence-boundaries.md`, which now lives in the `mkc-db` README.
  - Test narration, changelog and status sentences in these READMEs: `mkc-api`, `mkc-db`, `mkc-config`, `mkc-catalogue-server`, `mkc-mokly-contract` and its fixtures, `mkc-publications`, the Helm chart, `xtask`, `docs/api`, `apps/app` and the workspace README.
- **Problem:** Decision 1 approved the removal of the audited passages only. Nobody approved the removal of `main`'s later edits to them.
- **Impact if no action:** The record of `main` holds removals without the approval that the repository rules require. A later reader cannot tell whether the removals were wanted.
- **Root question:** Does the user approve the removal of `main`'s edits to the passages that decision 1 dropped?
- **Options:**
  - **A.** Approve the removals, and record the approval in this item's deletion commit. Effort: Small.
  - **B.** Restore the dropped edits that the user names, in their new homes under the `documentation` skill. Effort: Small.
- **Left out:** Restore every dropped edit in the protocol docs. That breaks decision 1, which stays in force.
- **Wider fix:** None. `plans/follow-ups/doc-splits-have-no-removal-audit.md` holds the audit rule for document moves.
- **Previous examples:** Decision 1 itself approved the same classes of removal for the audited passages.
- **Related:** `plans/follow-ups/doc-splits-have-no-removal-audit.md`, same class.
- **Recommendation:** A. The dropped edits are history, evidence and case lists, the classes that decision 1 removed.
- **Action:** ask the user, because condition 3 holds: the option concerns the removal of content from `origin/main`.

The review graded the finding Medium severity and Small effort, and it recommended A. The group reports of the merge listed every dropped line. They lived under `.context/` and are not in the repository.

Source: [the Milestone 13 review TODO](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/documentation-skill-alignment.md?plain=1#L739-L770) of the deleted plan.
