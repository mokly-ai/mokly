# Discover CSS differential fixtures from tracked stylesheets

- **Severity:** Low. **Effort:** Medium.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** See the affected paths in the task below.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

## Task

Decide finding 1 of the final review of `rebuild/port-111c` at
`b152d0dc` (report: `.context/port-111c/review/review-7.md`). The
validity check confirmed it. The options check added options E to G
and changed the recommendation from A to C.

- Finding 1: the differential fixture list misses two repository
  stylesheets that #227 added, and a moved or deleted listed file breaks
  the `mokly-css` test build. Severity Low, effort Medium. Recommended: C,
  read the tracked stylesheets at test time in an integration test behind
  a test-support feature.
- Open problem found by the options check:
  `crates/mokly-css/src/_tests_/token_differential_tests.rs:200`: the
  assertion that the sources are not empty cannot fail, because the five
  generated stylesheets are always present.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6701).
