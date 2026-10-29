# Align the Wrangler dependency claim with tests

- **Severity:** Low. **Effort:** Medium.
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

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6495).
