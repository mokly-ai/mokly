# Decide whether plans require rejected-option mutations

- **Severity:** Low. **Effort:** Medium.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #225 and its completed plan.
- **Location:** The shared `plans` skill.
- **Reason:** The review or plan deferred this work until after PR #225.

## Task

A review proposed a rule that each rejected decision option must have one mutation and one failing test. This is a new shared process gate and needs a user decision.

## Decision

- **Source:** Review.
- **Category:** process.
- **Background:** Plan reviews check decision options. They do not require a mutation test for every rejected option.
- **Problem:** A rejected option can stay unproved. Requiring proof adds work and a stricter process gate.
- **Impact if no action:** Decision reviews keep the current evidence rule.
- **Root question:** How should Mokly decide whether plans require rejected-option mutations?
- **Options:**
  - **A.** Keep the current options check. Let each plan select useful mutations. Effort: Small.
  - **B.** Require one mutation and failing test for every rejected option. Effort: Medium.
  - **C.** Require mutations only for rejected options that can corrupt output or lose data. Effort: Medium.
- **Left out:** A prose-only proof is already available under option A.
- **Wider fix:** B.
- **Previous examples:** Review findings 2 and 3 of the parallel background pass proposed this rule.
- **Recommendation:** B. It gives every recorded rejection executable evidence.
- **Action:** ask the user, because condition 3 holds. The recommended option adds a new repository gate.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/parallel-background-pass.md?plain=1#L384).
