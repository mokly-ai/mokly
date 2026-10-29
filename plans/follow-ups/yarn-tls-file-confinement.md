# Confine Yarn TLS file settings

- **Severity:** Medium. **Effort:** Small.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** See the affected paths in the task below.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

## Task

Resolve user item 153 (145 B probe): Yarn TLS file settings read
outside files. Severity Medium, security, effort Small. Options: A,
tier three when a base `.yarnrc.yml` sets `httpsCaFilePath`,
`httpsKeyFilePath`, or `httpsCertFilePath`, Small; B, clear them,
effort not recorded; C, confine them to the repository, effort not
recorded. Recommended: A.

- Security: the hub recommends a decision before the first npm release.

## Decision

- **Source:** Review.
- **Category:** security.
- **Background:** The Task section preserves the completed plan's context, evidence, and recorded options.
- **Problem:** The completed plan left this item open.
- **Impact if no action:** The recorded defect, risk, or process gap remains until the user selects an option.
- **Root question:** How should Mokly confine Yarn TLS file settings?
- **Options:**
  - **A.** Use option A from the Task section. Effort: Small.
  - **B.** Use option B from the Task section. Effort: Small.
  - **C.** Use option C from the Task section. Effort: Medium.
- **Left out:** The completed plan found no third distinct implementation beyond the recorded direct and wider approaches.
- **Wider fix:** C.
- **Previous examples:** The completed plan record linked below.
- **Recommendation:** A. The Task section records this recommendation.
- **Action:** ask the user, because condition 5 holds. The user deferred this item for a later decision.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6133).
