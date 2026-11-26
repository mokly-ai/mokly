# Equivalence oracles stay as expected-value sources

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-26, from branch `calummoore/ci-speed-test-scope-items-9-to-15-and-19-rsi4` (PR #565), test-scope item 12B.
- **Location:** `crates/mokly-graph/src/_tests_/render_reference.rs`, `crates/mokly-server/src/_tests_/reuse_oracle/`, `tests/sidecar_json.test.ts`, `crates/mokly-html/src/_tests_/pipeline_differential_tests.rs`, `crates/mokly-catalogue/src/_tests_/html_token_span_tests.rs`.
- **Reason:** The user's test-scope decision removes equivalence proofs, but other tests read these oracles as their expected values, so a removal needs a scope choice.

- **Terms:**
  - **Oracle:** a frozen copy of older product code, or a third-party parser such as html5ever, that a test compares with the product's output.
- **Background:** On 2026-11-26 the user's test-scope decision 12B removed the one-time third-party and equivalence proofs from the suites. PR #565 removed the pure proofs: the pnpm three-version test, the lightningcss and yaml-rust2 probes, the CSS token differential, and a frozen format-gate test. It kept the five oracles at the locations above.
- **Problem:** Other product tests use these oracles as the source of their expected values. A removal without a new source would remove assertions from kept tests. The testing rules forbid that.
- **Impact if no action:** About 0.5 s of CI test time stays.
- **Root question:** Should tests that other tests use as their expected-value source stay?
- **Options:**
  - **A.** Keep the oracles. Effort: Small.
  - **B.** Replace each oracle with literal expected values in about 10 tests, then remove it. This saves about 0.5 s. Effort: Large.
- **Left out:** Remove the oracles without a new expected-value source, because kept tests would lose assertions.
- **Wider fix:** None. The cost is below any structural change.
- **Previous examples:** None found.
- **Related:** `plans/follow-ups/corpus-fixture-unit-test-reads.md` names `pipeline_differential_tests.rs` for its fixture reads. That item does not depend on this answer.
- **Recommendation:** A. The saving is far below the work and the risk of B.
- **Action:** ask the user, because it is a scope choice under the user's decision 12B.
