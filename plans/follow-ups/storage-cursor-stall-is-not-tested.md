# Storage cursor stall rejection lacks a regression

- **Severity:** Low. **Effort:** Small (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-31, from an additional observation in the retention review's independent check.
- **Location:** `crates/mkc-publications/src/_tests_/maintenance_tests.rs:81`; `crates/mkc-publications/src/maintenance.rs:65-67`.
- **Reason:** The user requires review findings to await a decision before fixes.

**Terms:** A stalled cursor is a nonempty storage continuation that repeats
without advancing.

**Background:** The maintenance contract rejects stalled continuations. The
runner currently checks both its publication cursor and its storage cursor.
The existing stalled-continuation unit case exercises only the publication
cursor and returns before storage work begins.

**Problem:** Removing the storage stall check leaves the current tests
unchanged. A repeated storage token would then run up to 10,000 batches
before returning the same unavailable error. This is a coverage gap, not a
defect in the current guard. The mutation was identified statically, not run.

**Impact if no action:** A later regression can waste the entire job budget on
a repeated page instead of rejecting it promptly.

**Root question:** How should the gate protect prompt rejection of a repeated
storage cursor?

**Options:**

- **A — Extend the existing unit coverage.** Finish retention, return the
  same storage cursor twice, and assert the error and exact batch-call count.
  Effort: Small.
- **B — Introduce validated cursor progress.** Make the collector return an
  explicit advancing/completed result and reject a repeated cursor at that
  boundary; add the defect regression. Effort: Medium.

**Recommendation:** A. The working guard needs a focused regression, not a
new interface.

**Wider fix:** B can centralize cursor progress validation for future callers.
It changes more working code than this test gap needs.

**Left out:** Testing only the final unavailable error does not distinguish
prompt rejection from the 10,000-batch ceiling. A browser test adds no value.

**Related:** The independent-continuation coverage item changes the same test
module. Both can be addressed together if the user approves them.

**Action:** Ask the user whether to apply A. Do not add tests automatically.
