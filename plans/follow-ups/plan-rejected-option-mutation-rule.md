# Decide whether plans require rejected-option mutations

- **Severity:** Low (estimate). **Effort:** Medium (estimate).
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #225 and its completed plan, which put the
  rule outside the scope of its review.
- **Location:** None in this repository. The rule would live in the shared
  `plans` skill of `futex-ai/skills`.
- **Reason:** The rule belongs to the shared skills repository, and it adds a
  process requirement that the user must choose.

- **Source:** Review.
- **Category:** Process.
- **Terms:**
  - **Rejected option:** an option that a plan decision did not choose. The
    plan records it with its reason.
  - **Mutation:** a temporary code change that applies a rejected option, to
    show that a test fails on it.
- **Background:**
  - Plan reviews check decision options. They do not require a mutation test
    for every rejected option.
  - On 2026-10-28, the two reviews of PR #225 proposed this rule three
    times: for the failure report tests, the cancellation tests, and the
    discard tests of the background pass. Each proposal asked for a test
    that fails on each rejected option of the related decision.
  - PR #225 then ran such checks itself. Each of its discard tests failed on
    every one of five runs of its mutation.
- **Problem:** A rejected option can stay unproved. Requiring proof adds work
  and a stricter process gate.
- **Impact if no action:** Decision reviews keep the current evidence rule.
- **Root question:** How should a plan show that its tests reject the
  options that its decisions rejected?
- **Options:**
  - **A.** Keep the current options check. Let each plan select useful
    mutations. Effort: Small.
  - **B.** Require one mutation and failing test for every rejected option.
    Effort: Medium.
  - **C.** Require mutations only for rejected options that can corrupt
    output or lose data. Effort: Medium.
- **Left out:** A prose-only proof is already available under option A.
- **Wider fix:** B. It gives every recorded rejection executable evidence.
- **Previous examples:** The three proposals of the PR #225 reviews on
  2026-10-28, above.
- **Recommendation:** B (estimate). It gives every recorded rejection
  executable evidence.
- **Action:** ask the user, because condition 3 holds: the recommended
  option adds a new process gate.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/parallel-background-pass.md?plain=1#L384).
