# Share one tested LRU in mokly-css

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-19, from the branch `calummoore/mokly-classify-memo`, the wider fix that the check of finding 8 of its second review split off, with the gap in `MemoryParsedCss` that the same check found outside the scope.
- **Location:** `crates/mokly-css/src/reference_cache.rs` (`State::reuse` and `State::retain`), `crates/mokly-css/src/parsed_cache.rs` (`MemoryParsedCss::parse`), `crates/mokly-css/src/_tests_/rule_tests.rs` (`parsed_cache_shares_equal_bytes_and_obeys_its_byte_bound`).
- **Reason:** The shared type changes `parsed_cache.rs`, which that branch did not change, for a Low test gap.

- **Source:** Review.
- **Category:** Test.
- **Terms:**
  - **Byte-bounded LRU:** a cache that keeps entries within a byte bound and drops the least recently used entry first. A hit makes its entry the most recent one.
  - **`MemoryReferenceCache`:** the memo of `syntax::references` results in `crates/mokly-css/src/reference_cache.rs`.
  - **`MemoryParsedCss`:** the cache of parsed stylesheets in `crates/mokly-css/src/parsed_cache.rs`.
- **Background:**
  - Both caches keep their own LRU bookkeeping by hand: a map of entries and a map from a sequence number to the key. A hit moves the entry to a new sequence number.
  - `memo_keeps_its_byte_bound_and_drops_the_least_recent_scan` in `crates/mokly-css/src/_tests_/reference_cache_tests.rs` checks the recency of `MemoryReferenceCache`. It fails when a hit does not move its entry, and when a hit moves the order record but keeps the old sequence of the entry.
  - No test checks the recency of `MemoryParsedCss`. Its test keeps two sheets under a bound that never overflows after a hit, and the two parse-count tests in `mokly-compare` keep two sheets under a 64 KiB bound.
  - Other hand-written LRUs exist in `crates/mokly-graph/src/cache_tier.rs` and in `mokly-compare` (`source_cache.rs`, `resource_memo_state.rs`).
- **Problem:** A change that stops a hit of `MemoryParsedCss` from moving its entry keeps every test green. The two `mokly-css` caches also repeat the same bookkeeping.
- **Impact if no action:** `MemoryParsedCss` can drop its most used sheets first without a sign, and each new cache copies the bookkeeping again.
- **Root question:** How do the byte-bounded caches of `mokly-css` keep a recency rule that one test covers?
- **Options:**
  - **A.** Add a recency test to `MemoryParsedCss`, in the shape of the memo test: measure the charge of one entry, fill three, reuse the oldest, add one, and check the hits and the parses. Effort: Small.
  - **B.** Move the bookkeeping into one byte-bounded LRU type, private to `mokly-css`, whose only lookup refreshes the entry. Let both caches use it, and keep the memo test as the recency test of the shared path. Effort: Medium.
- **Left out:** A library LRU, because a cache must still call the lookup that refreshes, so a lookup that does not refresh still passes every test. A mutation-testing gate, because a new gate needs the user.
- **Wider fix:** B. No cache of the crate can skip the refresh, and one test covers the shared path.
- **Previous examples:** The memo test of that branch first passed with a first-in, first-out memo, before its second review.
- **Recommendation:** B. It removes the repeated bookkeeping and the untested copy at once.
- **Action:** fix after merge, apply B, because it changes `parsed_cache.rs`, outside the files of that branch.
