# Hot cache may not pay for its memory

- **Severity:** Low (estimate). **Effort:** Small (estimate). **Confidence:** Medium. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from the post-merge notes of the deleted `plans/publication-storage-scaling.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `crates/mkc-catalogue-server/src/cache.rs`, `docs/protocol/cloud/catalogue-delivery.md`, section "Bounded Hot Cache", and `docs/ops/environment.md:287-306`.
- **Reason:** The plan made the cache's removal depend on a measurement under real traffic, and a removal of functionality needs the user's approval.
- **Checked:** 2026-10-31, at commit `f568853e`. The choice is still open. No representative measurement exists. A capacity of 0 already turns the cache off without a code change.
- **Category:** Performance.

- **Terms:**
  - **Hot cache:** The catalogue server's verified-object LRU cache, bounded by `MKC_CATALOGUE_HOT_CACHE_BYTES`.
- **Background:** The storage scaling change of 2026-09-28 added the hot cache to the catalogue server. The plan said to measure the hit rate under real traffic, and to remove the cache if it does not pay for its memory. `plans/follow-ups/serving-memory-limits-not-tuned.md` holds the measurement. The cache reports its hits, misses, evictions and refusals as counters. `docs/ops/environment.md` sets a default of 128 MiB, and allows 0 while operators measure. The plan approved neither a threshold nor an unconditional removal.
- **Problem:** Nobody knows yet whether the cache saves enough storage reads to justify its memory.
- **Impact if no action:** The catalogue pods keep memory for a cache that may serve few hits.
- **Root question:** Does the catalogue server keep its hot cache?
- **Options:**
  - **A.** Keep the cache, and tune `MKC_CATALOGUE_HOT_CACHE_BYTES` from the measurement. Effort: Small.
  - **B.** Remove the cache when the measured hit rate falls below a threshold that the owner sets. Update `catalogue-delivery.md`. Effort: Medium.
  - **C.** Set `MKC_CATALOGUE_HOT_CACHE_BYTES` to 0 when the measurement shows little value. The memory is free, and the code stays for later traffic. Effort: Small.
- **Left out:** Remove the cache before the measurement. No data shows that it does not pay.
- **Wider fix:** None.
- **Previous examples:** None found.
- **Related:** `plans/follow-ups/serving-memory-limits-not-tuned.md`, same measurement. That task measures the hit rate that this choice waits for, and it makes no choice itself.
- **Recommendation:** A (estimate). The source recommended B, but no measurement shows yet that removal is better. If the measurement shows little value, C frees the memory without deleting functionality. B best enforces the plan's test that the cache earns its memory, once the owner sets a threshold.
- **Action:** ask the user, because condition 4 holds: the best option depends on a measurement that does not exist yet. B also removes functionality on `origin/main`, and the owner must set its threshold.

Wait for `plans/follow-ups/serving-memory-limits-not-tuned.md` before you answer.

Source: [the post-merge notes](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/publication-storage-scaling.md?plain=1#L586-L607) of the deleted plan.
