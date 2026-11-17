# Orphan sweep restarts before large bucket tails

- **Severity:** Medium (estimate). **Effort:** Large (estimate). **Confidence:** High. **Harder later:** Yes.
- **Kind:** Needs decision.
- **Added:** 2026-10-31, from an additional observation in the retention review's independent check.
- **Location:** `crates/mkc-publications/src/maintenance.rs:59`; `infra/helm/mokly-cloud/templates/maintenance.yaml:23`.
- **Reason:** The current hard ceiling is explicit; the owner must choose the supported scale and whether scan progress must persist between jobs.

**Terms:** An orphan has no matching database record. A listing cursor marks
the next page of stored objects to inspect.

**Background:** Successful publications remain until project or workspace
deletion. The daily maintenance command starts its orphan listing with no
cursor. It allows 10,000 batches of up to 100 objects. Its Job has a
600-second deadline. The command does not save the listing cursor between
runs.

**Problem:** If a full scan exceeds the page or time budget, the next run
starts at the beginning. If that initial range consists of retained objects,
it remains in place. Orphans after that range can stay unreachable by every
daily run. More than one million listed objects exceeds the page ceiling;
the time limit can be reached earlier. No current production failure or
throughput threshold was measured by this review.

**Impact if no action:** At sufficient scale, jobs can repeatedly fail while
later orphan objects remain. Indexed collection can still make progress by
removing its rows; the orphan listing has the separate problem.

**Root question:** How should bounded daily cleanup reach every orphan as the
retained bucket grows?

**Options:**

- **A — Keep and document the operating bound.** Add an operator procedure
  for a bucket that exceeds the scan budget. Effort: Small. This accepts a
  capacity limit and does not remove it.
- **B — Persist scoped scan progress.** Save completed-page progress by
  bucket/prefix and resume it in the next run. Check provider cursor lifetime
  and restart semantics before choosing the stored marker. Fence concurrent
  cursor updates and test interruption/resumption. Effort: Large.
- **C — Use a separate inventory-driven sweep.** Turn a storage inventory
  into bounded orphan work instead of re-listing the whole bucket each day.
  Effort: Large. This introduces more infrastructure and recovery behavior.

**Recommendation:** B for production growth. It preserves bounded jobs and
prevents repeated work from starving later pages. Decide the supported scale
before implementing it.

**Wider fix:** B makes bounded progress durable across retries and deadlines.
Increasing the deadline alone only moves the capacity threshold.

**Left out:** Age-expiring successful publications breaks the approved
retention policy. Disabling orphan cleanup leaves interrupted writes behind.

**Related:** Splitting indexed collection and sweeping into separate loops,
an option in the continuation-coverage item, removes repeated listing within
one run. It does not by itself preserve progress across runs.

**Action:** Ask the user to choose the operating bound or durable-progress
scope. Do not change limits or cleanup behavior automatically.
