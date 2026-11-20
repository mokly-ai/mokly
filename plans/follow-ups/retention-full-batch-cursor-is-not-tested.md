# Retention full-batch cursor lacks a regression

- **Severity:** Low (estimate). **Effort:** Small (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-10-31, from the retention review's independent check.
- **Location:** `crates/mkc-publications/src/retention.rs:55`; `crates/mkc-publications/src/_tests_/retention_tests.rs`.
- **Reason:** The producer's full-batch continuation calculation already existed on main and was not changed by this work.

**Terms:** A retention cursor is the last publication ID scanned, used to
continue with the next bounded candidate batch.

**Background:** The worker returns a cursor when its candidate read fills the
100-row batch. The maintenance runner relies on that signal to continue.

**Problem:** Existing producer tests use fewer than 100 eligible candidates.
Returning no cursor for a full batch would leave their results unchanged.
The review identified that mutation statically and did not run it. The cursor
calculation is correct in the current implementation.

**Impact if no action:** A later change can stop cleanup after the first
candidate batch without a producer regression catching it.

**Root question:** How should tests protect the worker's full-batch
continuation boundary?

**Options:**

- **A — Add a producer-boundary unit case.** Return a full candidate batch,
  require its last ID as the cursor, and keep a short-batch case that returns
  none. Effort: Small.
- **B — Add a composed multi-batch database case.** Require one maintenance
  run to consume more than 100 eligible publications. Effort: Medium. This
  adds database setup for a producer decision that a unit case can isolate.

**Recommendation:** A when the user selects this existing gap for work.

**Wider fix:** A shared typed batch result could centralize full-batch
continuation, but the current calculation is small and correct. It is not
needed for this regression.

**Left out:** A browser case is above the boundary and adds no coverage.

**Action:** Keep this separate from the approved retention change. Do not add
tests unless the user requests it.
