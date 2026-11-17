# Docs added after the audit keep code names

- **Severity:** Low (estimate). **Effort:** Large (estimate). **Confidence:** High. **Harder later:** Yes.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from pending decision 9 and its unchecked TODO in the deleted `plans/documentation-skill-alignment.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `docs/protocol/persistence-boundaries.md`, `docs/protocol/cloud-build-runner.md` with its split-off `docs/protocol/cloud-build-sandbox.md`, `docs/protocol/product-mockups-viewer.md`, and `docs/protocol/desktop-app.md` with its split-off `docs/protocol/desktop-bundle.md`. The background names the other docs.
- **Reason:** The decision was proposed on 2026-10-21 and is still pending. PR #51 merged the same day without its answer.
- **Checked:** 2026-11-01, on the branch `calummoore/mokly-cli-upgrade` at commit `62e623ca`, with its uncommitted Mokly 0.18.0 docs. The decision is still open. `persistence-boundaries.md` and `product-mockups-viewer.md` still pass 250 lines. All six pages in the location still hold code names and mechanics.
- **Category:** Docs or spec.

- **Terms:**
  - **Documentation skill:** The shared rule set that keeps code names, mechanics, history and evidence out of protocol docs.
  - **The audit:** The read of all protocol docs on 2026-10-19 that listed the passages that PR #51 moved or dropped.
- **Background:** The list below gives the facts.
  - The `documentation` skill changed on 2026-10-17. A protocol doc now holds only requirements and decisions in force, near 250 lines.
  - PR #51 aligned the docs that the audit read. The user approved the removals of decision 1 on 2026-10-20.
  - PRs #42, #43, #45, #48, #49 and #50 merged during that work. They added new protocol docs and passages under the earlier rules.
  - Those passages name code, describe mechanics, narrate tests and record evidence. Decision 1 did not cover them, so the merge kept them word for word.
  - On 2026-10-21, eight docs passed 250 lines: `cloud-builds.md` 333, `publication-ingest.md` 305, `cloud-build-runner.md` 296, `product-mockups-viewer.md` 279, `persistence-boundaries.md` 276, `desktop-app.md` 271, `settings-dialog.md` 254 and `preview-seed.md` 254.
  - On 2026-10-30, four still passed: `persistence-boundaries.md` 310, `cloud-build-runner.md` 296, `product-mockups-viewer.md` 279 and `desktop-app.md` 271. Later splits fixed the others.
  - At commit `f568853e` the same four had 310, 296, 279 and 272 lines.
  - On 2026-11-01, the Mokly 0.18.0 docs on the branch `calummoore/mokly-cli-upgrade` split two of them, under the `documentation` skill's rule for a touched doc that passes the target. `cloud-build-runner.md` moved its sandbox, output and reconciliation text into `cloud-build-sandbox.md`. `desktop-app.md` moved its bundle and origin text into `desktop-bundle.md`.
  - The splits moved the text without aligning it. The new pages still name code, such as `create_sandbox`, `mkc-build-sandbox::policy::denied_destinations`, `isDesktopShell()` and `startDesktop`.
  - After the splits, the four docs have 310, 249, 299 and 220 lines. `cloud-build-sandbox.md` has 93 lines and `desktop-bundle.md` has 71.
- **Problem:** Protocol docs that merged after the audit still mix requirements with code names, mechanics, test narration and evidence. Two docs pass the length target.
- **Impact if no action:** Reviewers check code against docs that also describe how the code works, so the docs go stale on refactors. New docs copy the older pattern.
- **Root question:** Do the passages that merged after the 2026-10-19 audit get the same alignment as the audited ones?
- **Options:**
  - **C.** Leave the content as it is. Effort: Small.
  - **D.** Split only the docs that pass 250 lines, two since the move to Mokly 0.18.0. Leave the other passages as they are. Effort: Medium.
  - **B.** Audit and align the content in a separate plan and pull request, and split the long docs. Effort: Large.
- **Left out:** Option A, align the content inside PR #51. That pull request merged on 2026-10-21.
- **Wider fix:** B. One audit under the current skill aligns every passage of the class.
- **Previous examples:** PR #51 aligned about 910 passages of the same classes.
- **Related:** `plans/follow-ups/doc-splits-have-no-removal-audit.md` holds the audit rule for document splits that B and D would use.
- **Recommendation:** B. It was the recommendation on 2026-10-21. It applies one rule to every protocol doc.
- **Action:** ask the user, because condition 4 holds: the options trade documentation quality against a Large docs change, and the 2026-10-21 decision is still unanswered.

Source: [decision 9](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/documentation-skill-alignment.md?plain=1#L99-L115) of the deleted plan.
