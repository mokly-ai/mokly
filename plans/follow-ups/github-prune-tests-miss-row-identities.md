# GitHub cleanup tests miss reversed cutoffs

- **Severity:** Medium. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-01, from the post-push retention review and the independent check of finding 4.
- **Location:** `crates/mkc-store-pg/tests/maintenance/github_prune_tests.rs:57`; `crates/mkc-store-pg/src/github_oauth_retention.sql`; `crates/mkc-store-pg/src/github_delivery_retention.sql`.
- **Reason:** The user deferred this work to a follow-up on 2026-11-02. It does not block the current PR.
- **Decision:** The user approved deferral, without selecting an implementation option. Keep A as the recommendation for future work.

**Terms:** An OAuth flow supports GitHub sign-in or account connection. A
webhook delivery stores a GitHub event and its processing state.

**Background:** GitHub cleanup removes flows that expired at least one day
ago. It removes finished webhook deliveries received at least thirty days
ago. Live flows, recent records and unfinished deliveries must remain. The
current SQL implements these rules correctly.

**Problem:** The database test checks deletion counts, without checking which
rows remain. It creates no unexpired OAuth flow.

The OAuth fixtures expire one second before the cutoff, at the cutoff and
one second after it. All three flows have already expired. Reversing `<=` to
`>=` still deletes two rows, then zero rows.

The finished delivery fixtures arrive at offsets of minus one, zero, zero and
plus one second. Reversing `<=` to `>=` still deletes batches of two, one and
zero rows. Old pending and processing deliveries remain under either
comparison because the status filter excludes them.

The query-plan test checks only the index name and `Index Cond:`. Both btree
comparisons meet those assertions. Command tests use empty tables. Service
tests use mocks. No other real-store test checks the retained identities.
Earlier completion reporting claimed live-flow coverage, but the fixture
contains no live flow. This evidence comes from inspection. Neither mutation
was executed during the read-only review.

**Impact if no action:** A later comparison error can delete live sign-in
flows and recent deliveries while the tests pass. It can retain old records.
Recent finished deliveries also prevent repeat processing of webhook
redeliveries in `crates/mkc-api/src/github/acceptance.rs`.

**Root question:** How should the gate prove that GitHub cleanup removes only
eligible records?

**Options:**

- **A — Extend the existing database test.** Add an unexpired OAuth flow and
  assert the exact retained identities. Keep the count and batch assertions.
  The `github_oauth_flow` and `github_delivery` reads work by primary key and
  can check expired records. Prove that each reversed comparison fails, then
  restore the correct SQL. Effort: Small.
- **B — Extend the command integration test.** Add old and live records and
  assert survivors after each command. This exercises more composition code
  and adds runtime. The binary's own clock makes an exact cutoff fixture
  difficult. Effort: Small.
- **C — Add a shared retention-test helper.** Require explicit deleted and
  retained identities for each database pruning scenario. Apply it across
  pruning tests. This reaches tests that already check survivors and cannot
  force future tests to use the helper. Effort: Medium.

**Recommendation:** A. It verifies the rule at the lowest level that executes
the SQL. It adds exact cutoff and survivor checks without changing product
code.

**Wider fix:** C covers the assertion class, but other pruning tests already
check survivors. The testing skill already requires proof that each test can
fail. A is sufficient for this defect.

**Previous examples:** Auth pruning tests in
`crates/mkc-store-pg/tests/maintenance/prune_tests.rs` and build pruning tests
in `crates/mkc-store-pg/src/_tests_/build_pg/retention_tests.rs` already check
retained rows. No other count-only cutoff case was found.

**Left out:** Changing correct SQL does not close this gap. Counts alone do
not identify survivors. Asymmetric fixtures without identity checks give less
protection at the same cost. A property-test dependency adds no boundary
coverage here. A shared delete builder still needs query-specific tests.
Service mocks do not execute SQL. Worker-side filtering breaks eligibility
before the batch limit. Leaving the test unchanged does not meet the goal.

**Related:**
`plans/follow-ups/gc-continuations-lack-independent-regressions.md` records a
different condition mutation that existing tests miss. The fixes use separate
test files and can share one test-only change.

**Action:** Fix after merge in separate work requested by the user. Confirm
the approach when that work starts. Do not change tests or SQL in the current
PR.
