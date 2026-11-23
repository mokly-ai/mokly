# Restores of compact documents run uncharged

- **Severity:** Low. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-16, from the branch `calummoore/compact-evicted-documents`, a new problem of the second review round.
- **Location:** `crates/mokly-graph/src/cache.rs`, the compact-tier branch of `MemoryCache::get`, and `crates/mokly-graph/src/document_codec.rs`, `EncodedView::restore`.
- **Reason:** The problem appeared in the last fix round of the branch, and a lease that can block a lookup needs its own design and review.

- **Source:** Review.
- **Category:** Performance.
- **Related:** `plans/follow-ups/early-base-capture-evicted-results.md` records extra
  compact restores after early results leave the full cache. Fewer restores reduce
  this decoder cost. Neither fix replaces the other.
- **Terms:**
  - **Render cache:** the in-memory store of rendered documents that both sides of Changes share in one command. `MemoryCache` in `crates/mokly-graph/src/cache.rs` implements it.
  - **Compact tier:** the part of the render cache that holds evicted documents in the lossless compressed encoding of `EncodedView`.
  - **Transit headroom:** 1/16 of the cache total, reserved for documents on their way to the compact tier and for the encoder leases.
- **Background:**
  - The render cache has one 256 MiB total. The full tier may use all of it except the transit headroom. The compact tier holds evicted documents, up to 128 MiB.
  - A lookup that misses the full tier restores a compact document outside the cache lock with `EncodedView::restore`.
  - Encoders hold a fixed workspace. On 2026-11-16 the branch charged it: a pool of 8 reusable encoder leases, each charged at 384 KiB from the transit headroom.
  - Decoders are not charged. A counting-allocator probe on 2026-11-16 measured 84,256 bytes for one restore: the `miniz_oxide` inflate state, the 32 KiB read buffer of flate2, and the 8 KiB `BufReader` of the codec (flate2 1.1.11, miniz_oxide 0.9.1).
- **Problem:** Each concurrent restore holds about 84 KB that the cache bound does not count. The memory grows with the number of threads that read the cache at the same time: render workers, one per core, and Serve request threads.
- **Impact if no action:** On a 64-core machine about 5.4 MB of decoder memory can sit outside the 256 MiB bound. It cannot exhaust memory, because the thread count bounds it, but the stated bound is not exact.
- **Root question:** How do restores of compact documents keep their working memory inside the cache bound without making lookups slow?
- **Options:**
  - **A.** Reuse one decompressor for each thread, with a thread-local `flate2::Decompress` and a slice parse of the payload, so that a restore allocates no new decoder buffers. The memory stays bounded by the thread count and is not charged. Effort: Small.
  - **B.** A small pool of charged decoder leases from the transit headroom. A lookup waits for a free lease; it never holds the cache lock while it waits. Effort: Medium.
  - **C.** B, and a lookup that finds no free lease within a short bound renders the document instead of waiting. Effort: Medium.
- **Left out:** Charging each restore with a reservation that can fail and make the lookup miss: under a full pass over all views it would turn restores into renders, which fails the speed goal.
- **Wider fix:** B. It puts all working memory of the cache under one charge.
- **Previous examples:** The encoder lease pool of the same branch, for the encoding side.
- **Recommendation:** B. It makes the bound exact, and a restore takes under 1 ms, so a short wait for a lease costs little.
- **Action:** fix after merge, apply B, because the branch is past its last fix round and the lease needs its own review.
