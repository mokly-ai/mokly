# Align the Wrangler dependency claim with tests

- **Severity:** Low. **Effort:** Small.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** `docs/protocol/dependency-security.md`.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

- **Source:** Review.
- **Category:** docs or spec.
- **Background:** The dependency security protocol explains why the repository pins Wrangler.
- **Problem:** It names Cloudflare local static-host checks, but no test or script runs Wrangler or Miniflare.
- **Impact if no action:** The protocol claims verification that the repository does not perform.
- **Root question:** How should Mokly align the Wrangler dependency claim with tests?
- **Options:**
  - **A.** Remove the unsupported phrase. Keep the actual dependency reason. Effort: Small.
  - **B.** Add a gate that serves a built site through `wrangler pages dev`. Effort: Medium.
- **Left out:** A hand-written note that calls the check optional still claims a check that does not run.
- **Wider fix:** None. The documentation skill already prevents unsupported protocol claims.
- **Previous examples:** The documentation audit found this drift as user item 191.
- **Recommendation:** A. It makes the protocol match current verification without adding a slow gate.
- **Action:** ask the user, because condition 5 holds. The user deferred this item for a later decision.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6495).
