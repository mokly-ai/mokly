# Document splits have no removal audit

- **Severity:** Low (estimate). **Effort:** Small (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from the review of the branch `calummoore/reland-follow-ups`, finding 7. The closed PR #39 approved the rule as part of its finding D2.
- **Location:** `docs/protocol/README.md:1-16` and `AGENTS.md:182`, the review focus, which hold no such rule on `main`.
- **Reason:** The user's answer of 2026-10-26 re-landed only the code fixes of PR #39, and an `AGENTS.md` change needs the user's approval.
- **Checked:** 2026-10-31, at commit `f568853e`. The decision is still open. Neither `docs/protocol/README.md` nor the review focus of `AGENTS.md` holds a split audit.
- **Category:** Process.

- **Terms:**
  - **Document split:** A change that moves text from one doc into others, as PR #51 did when it split protocol docs.
  - **Removal audit:** A list in a pull request description that marks each sentence removed from `main` as moved, replaced or approved for removal.
- **Background:** The list below gives the facts.
  - The review of PR #35 found that earlier document splits had dropped seven rules. The closed PR #39 called this finding D2.
  - On 2026-10-12 the user approved its option B: restore the rules, and add a split-audit rule.
  - The closed PR #39 put the rule in a "Split Audit" section of `docs/protocol/README.md` and in the review focus of `AGENTS.md`. It also added a matching check to `docs/implementation-review-prompt.md`.
  - Its final review added a refinement on 2026-10-15, in commit `babe4a3f`. The audit names the commit that it covers, and a later commit that removes or rewords text on `main` needs a fresh audit.
  - PR #41 deleted `docs/implementation-review-prompt.md` from `main` in commit `871b09ad` on 2026-10-15, because the shared skills now hold the review procedure.
  - On `main`, neither `docs/protocol/README.md` nor the review focus of `AGENTS.md` holds the rule.
  - The `git-commit` skill already requires that a change preserves the content of `origin/main`. It asks for no sentence-by-sentence list for a document split.
- **Problem:** No rule asks a change that moves text between documents to account for each sentence that it removes from `main`. A split can therefore drop a requirement without a signal.
- **Impact if no action:** The next document split can drop a requirement again, and only a later audit finds it.
- **Root question:** How does a change that moves text between documents keep every rule that `main` holds?
- **Options:**
  - **A.** Change nothing. Reviews find dropped rules by reading, as the review of PR #35 did. Effort: Small.
  - **B.** Add the PR #39 rule to the review focus of `AGENTS.md`. It changes an agent rule, which needs the user's approval. Effort: Small. The PR #39 text was:
    "Document splits: the PR description's removal audit names the commit it covers. It lists each sentence removed from `origin/main` as moved, replaced or approved for removal. Refresh it after a later commit removes or rewords mainline text."
  - **C.** Add the rule to a shared skill, such as `git-commit` in `futex-ai/skills`. That skill holds the other rules for pull request descriptions. Every repository then gets it. It changes another repository. Effort: Small.
  - **D.** Do B. Also add the "Split Audit" section of PR #39 to `docs/protocol/README.md`. A new protocol section counts as Large. Effort: Large. The PR #39 text was:
    "When a change moves text between documents, its PR description lists each removed sentence as moved, replaced or approved for removal. Name the destination and retain every rule. Check the complete diff against `origin/main` so a split cannot silently remove a contract. The audit names the commit it covers. Refresh it when a later commit removes or rewords text that `origin/main` has."
- **Left out:** An xtask check that lists the sentences that a change removes. It cannot tell a moved rule from a dropped one, so a person must still judge each line.
- **Wider fix:** C. A rule in the shared skills applies to every repository and every split.
- **Previous examples:** The list below gives them.
  - Finding D2 of the review of PR #35: seven rules that earlier splits dropped, which `plans/follow-ups/pr-39-doc-fixes-still-apply.md` still lists in part.
  - Finding F10 of the final review of PR #39: the app README lost the sentence "The list lives only in the test".
- **Related:** The list below gives the links.
  - `plans/follow-ups/pr-39-doc-fixes-still-apply.md`, same class. Its D2 fixes restore rules that splits dropped, and this item is their wider fix.
  - `plans/follow-ups/follow-up-list-hides-item-choices.md`. The first version of the doc-fixes item held this choice as a paragraph, which that item records.
  - `plans/follow-ups/docs-merge-removals-await-approval.md`, same class. It asks the user to approve removals that the merges of a document alignment made.
  - `plans/follow-ups/docs-added-after-audit-keep-code-names.md`. Its options B and D split long protocol docs, and they would use this audit rule.
  - The deleted item [`build-spec-comments-name-old-doc.md`](https://github.com/mokly-ai/mokly-cloud/blob/10834d30c83cb54b5bdfdb719b99b98febf56fd0/plans/follow-ups/build-spec-comments-name-old-doc.md), same class. Its stale comments named a document that a split moved, which this audit would find. The comment issue is resolved: the branch `conductor/follow-ups-app-test-fixes` fixed both comments on 2026-11-03.
- **Recommendation:** B. It puts the audit where reviewers already look, with the text that the user approved on 2026-10-12. C best protects the codebase, because every repository then gets the rule.
- **Action:** ask the user, because condition 6 holds: the item is about process, and each option that adds the rule changes agent rules.
