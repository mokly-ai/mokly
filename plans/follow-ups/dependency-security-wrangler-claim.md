# Align the Wrangler dependency claim with tests

- **Severity:** Low. **Effort:** Small.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** See the affected paths in the task below.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

## Task

Resolve user item 191 (docs): `docs/protocol/dependency-security.md`
names "Cloudflare local static-host checks" for the `wrangler` pin,
but no test or script runs `wrangler` or `miniflare`. Severity Low,
docs, effort not recorded. Options (estimate): A, remove the phrase;
B, add a test that serves a built site with `wrangler pages dev`
(Medium; every gate starts the local Cloudflare runtime).
Recommended: A.

## Decision

- **Source:** Review.
- **Category:** docs or spec.
- **Background:** The Task section preserves the completed plan's context, evidence, and recorded options.
- **Problem:** The completed plan left this item open.
- **Impact if no action:** The recorded defect, risk, or process gap remains until the user selects an option.
- **Root question:** How should Mokly align the Wrangler dependency claim with tests?
- **Options:**
  - **A.** Use option A from the Task section. Effort: Small.
  - **B.** Use option B from the Task section. Effort: Medium.
- **Left out:** The completed plan found no third distinct implementation beyond the recorded direct and wider approaches.
- **Wider fix:** None. The existing repository rules already cover this class.
- **Previous examples:** The completed plan record linked below.
- **Recommendation:** A. The Task section records this recommendation.
- **Action:** ask the user, because condition 5 holds. The user deferred this item for a later decision.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6495).
