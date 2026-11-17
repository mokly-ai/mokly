# Agent rules pass their length target

- **Severity:** Low (estimate). **Effort:** Small (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from the outside-the-scope note of the Milestone 12 review TODO in the deleted `plans/documentation-skill-alignment.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `AGENTS.md`, which `CLAUDE.md` links to.
- **Reason:** A change to the agent rules needs the user's approval.
- **Checked:** 2026-11-17, in this repository after the cloud moved in. The decision is still open. The one `AGENTS.md` of Mokly and the cloud has 235 lines, about 4.7 times the target of the `agents-md` skill.
- **Category:** Repository rule.

- **Terms:**
  - **`agents-md` skill:** The shared skill that defines what a repository's `AGENTS.md` holds, with a target of about 50 lines.
- **Background:**
  - The shared skills hold the always-on rules and the procedures. `AGENTS.md` holds only the rules that are specific to this repository.
  - The item first concerned the `AGENTS.md` of the old cloud repository. It had 191 lines on 2026-10-21, 205 lines on 2026-10-30, and 206 lines at commit `f568853e`.
  - On 2026-11-17 the cloud moved into this repository. The two `AGENTS.md` files became one. The Mokly file had 172 lines on `main` before the move. The move put the cloud rules for one area into the cloud READMEs and the protocol docs under `docs/protocol/cloud/`, as the `agents-md` skill says. The merged file has 235 lines.
- **Problem:** `AGENTS.md` is about 4.7 times the target. Some of its rules may repeat a shared skill or belong in a README or protocol doc near the code.
- **Impact if no action:** Every agent session reads the long file. A rule that repeats a skill can drift from it.
- **Root question:** Which repository rules stay in `AGENTS.md`, and where does the rest go?
- **Options:**
  - **A.** Change nothing, because each rule is specific to this repository. Effort: Small.
  - **B.** Apply the `agents-md` skill to the merged file: move each area rule to the README or protocol doc nearest its code, and remove each rule that a shared skill holds. It changes no code file. A rule that needs a new protocol section makes it Large. Effort: Small.
- **Left out:** None. A and B are the two outcomes.
- **Wider fix:** None. The `agents-md` skill already states the target.
- **Previous examples:** PR #41 of the old cloud repository pointed its `AGENTS.md` at the shared skills on 2026-10-15. The move of 2026-11-17 applied the skill to the cloud rules for one area.
- **Recommendation:** B. A short rule file is read in full.
- **Action:** ask the user, because condition 1 holds: B changes the agent rules.

Source: [the Milestone 12 review TODO](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/documentation-skill-alignment.md?plain=1#L673-L702) of the deleted plan.
