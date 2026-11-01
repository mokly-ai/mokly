# Missed plan ticks become review findings

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-01, from branch
  `conductor/rust-rebuild-87-diagnostics-and-html-messages`: option C of
  finding 2 of the re-review of the HTML pipeline implementation review of
  2026-10-28.
- **Location:** None. The rule would live in the shared
  `implementation-review` skill of the `futex-ai/skills` repository.
- **Reason:** The rule changes a shared skill outside this repository, and
  on 2026-10-28 the coordinator kept this choice for the user.

- **Source:** Review.
- **Category:** Process.
- **Terms:**
  - **Plan:** a Markdown file under `plans/` that records the milestones,
    the TODOs, and the dated decisions of one change.
  - **Tick:** the mark `[x]` on a plan TODO. The shared `plans` skill says
    to tick each TODO when its work is complete.
  - **Re-review:** the second review that the shared `implementation-review`
    skill runs after the fixes of the first review.
  - **Shared skills:** the agent instructions of the `futex-ai/skills`
    repository, such as `plans` and `implementation-review`. The agents of
    this repository follow them.
- **Background:**
  - The Rust rebuild plan recorded a user decision of 2026-10-28 for one
    review finding, and the commit `e236ea78` that applied it. Its TODO
    stayed unticked.
  - The implementation review of 2026-10-28 reported a finding that the
    agent fixed with the tick of that TODO.
  - The re-review then reported that the plan did not say why that tick
    needed no user answer. The plan already recorded the user's decision and
    its commit.
  - On 2026-10-28 the coordinator chose to record that reason in the plan.
    Main deleted the plan in commit `133782a9` on 2026-10-30, so that
    choice needs no more work.
  - The coordinator also asked on 2026-10-28 to keep a rule in the shared
    review skill as one question for the user.
- **Problem:** The shared review skill has no rule that a missed tick is not
  a finding when the plan records the decision and the commit. So a review
  can report plan bookkeeping as a process problem.
- **Impact if no action:** Reviews can report such ticks again. Each report
  costs a fix round or a question for the user.
- **Root question:** Should the shared review rules say when a missed plan
  tick is not a finding?
- **Options:**
  - **C.** Add a rule to the shared `implementation-review` skill: a missed
    tick is not a process finding when the plan already records the decision
    and the commit. Effort: Small.
  - **D.** Change nothing. Effort: Small.
- **Left out:** The re-review's two other options edited the Rust rebuild
  plan: record the reason beside the tick, or remove the tick until the user
  answers. Main deleted that plan, so neither has work left.
- **Wider fix:** C. One rule in the shared skill stops this report in every
  repository that uses the skill.
- **Previous examples:** The implementation review and its re-review of
  2026-10-28, which the background describes. No other case was found.
- **Recommendation:** C. The plan already proves the work, so a missed tick
  needs a tick, not a finding.
- **Action:** ask the user, because the coordinator asked to keep this choice
  for the user, and it changes a shared skill outside this repository.

The full historical record is in the
[Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5609).
