# Pinned mimalloc races option writes and loses purges

- **Severity:** Low. **Likelihood:** Common. **Effort:** Large. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-22, from branch `calummoore/mokly-core-allocator-purge-zlcf`,
  review finding 3 (its split-off wider fix) and a problem outside the scope
  that the check of that finding found.
- **Location:** The `libmimalloc-sys` dependency in `crates/mokly-cli/Cargo.toml`,
  `libmimalloc-sys` 0.1.49 and `mimalloc` 0.1.52 in `Cargo.lock`, and the doc
  comment of `MimallocPurgeDelay` in `crates/mokly-cli/src/allocator.rs:34`.
- **Reason:** No crates.io release of `libmimalloc-sys` vendors mimalloc v3.7.0
  yet, and the upgrade changes the allocator under every measured result, so it
  needs its own performance check.

- **Terms:**
  - **Core:** the `mokly` Rust binary of the crate `mokly-cli`.
  - **mimalloc:** the global allocator of the core, built from the C sources
    that the crate `libmimalloc-sys` vendors.
  - **Purge delay:** the mimalloc option `purge_delay`, the time after which a
    freed memory range becomes due for its return to the operating system.
  - **Serve:** the `mokly serve` command, which hosts a catalogue and compares
    the working tree with a base commit.
  - **First ready Changes:** the first comparison result that Serve completes
    as ready after it starts.
- **Background:**
  - The core uses `mimalloc` 0.1.52 and `libmimalloc-sys` 0.1.49 from
    crates.io. They vendor mimalloc v3.3.2. On 2026-11-22, `libmimalloc-sys`
    0.1.49, released on 2026-05-22, was the newest release. The request to
    update its sources to mimalloc v3.4.5, pull request #169 of
    `purpleprotocol/mimalloc_rust`, was open since 2026-07-23.
  - After Serve's first ready Changes, `MimallocPurgeDelay` calls
    `mi_option_set_default` once, to make 30 ms the default purge delay. Serve's
    other threads run at that point, and they read the purge delay when they
    free pages.
  - In v3.3.2, each option is a plain `long`
    (`include/mimalloc/internal.h:407-413`). `mi_option_set_default`
    (`src/options.c:314-320`) writes it, and `mi_option_get`
    (`src/options.c:271-280`) reads it, with no atomics. The Rust bindings say
    that the setter is not thread safe. So the write is a data race under the C
    standard.
  - A reader still gets a valid delay on every supported platform. The value is
    one aligned `long`, so a reader sees 1,000 or 30. Each reader only checks
    the sign of the delay or computes a purge time from it. The doc comment of
    `MimallocPurgeDelay` gives this reasoning with the source lines. A build
    with a thread sanitizer still reports the race.
  - Upstream issue #1494 of `microsoft/mimalloc`, "mi_option_set races with
    concurrent reads of shared option state", closed on 2026-11-16. Its fix,
    commit `660b6248e0`, "make option state atomic so options can be set
    concurrently with readers", stores every option value as a relaxed atomic.
    It adds 35 lines and removes 22. Release v3.7.0, published on 2026-11-17,
    holds it. In v3.7.0, `mi_option_set_default` still writes only an option
    that the environment did not set.
  - v3.7.0 also holds commit `67e8f523e1`, "fix lost arena purges by using
    always-writing atomic min/exchange on purge expirations", from 2026-11-06.
    In v3.3.2, `mi_arena_schedule_purge` (`src/arena.c:2059-2083`) sets the
    expiration of an arena only with a compare-and-swap from 0, and
    `mi_arenas_try_purge` (`src/arena.c:2162-2208`) can reset the global
    expiration to 0. So a scheduled purge can stay undone until a later full
    collect, and its freed range stays committed.
  - On 2026-11-22, the performance orchestrator of the change decided: do not
    patch mimalloc, keep the run-time call, document the race as a known and
    accepted formal data race in the doc comment and in the pull request, and
    record the upgrade in this item.
- **Problem:** The pinned mimalloc does not synchronize the run-time write of
  the purge delay with its readers. It can also lose a scheduled purge.
- **Impact if no action:** The formal data race stays in every Serve session
  that reaches ready Changes, and a thread sanitizer reports it. Lost purges
  keep some freed memory committed until a later full collect, which adds to
  the core RSS.
- **Root question:** How does the core get a mimalloc that synchronizes option
  writes with their readers and keeps every scheduled purge?
- **Options:**
  - **A.** Patch the pinned mimalloc: backport commits `660b6248e0` and
    `67e8f523e1` to the v3.3.2 sources. The patched crate needs a home. The
    vendored `src/extended.rs` of `libmimalloc-sys` has 1,126 lines, over the
    300-line cap that `cargo xtask rust-file-length-lint` applies to every Rust
    file under `crates/`. A new top-level directory changes the Directories
    table of `docs/protocol/repository-layout.md`. The orchestrator rejected a
    mimalloc patch on 2026-11-22. Effort: Large.
  - **B.** Adopt mimalloc v3.7.0 or later when a crates.io release of
    `libmimalloc-sys` vendors it. Run the performance check of the purge delay
    again, because v3.7.0 also changes purging and the reading of the
    environment. Then remove the data race paragraph from the doc comment of
    `MimallocPurgeDelay`, and keep the safety comment of the call. Effort:
    Large.
  - **C.** Use upstream's own Rust crates from `contrib/rust` of
    `microsoft/mimalloc`, pinned to the tag `v3.7.0` as a git dependency, with
    the performance check of B. `mokly-cli` would be the first `mokly-*` crate
    with a git source. Effort: Large.
  - **D.** Add a new `mokly-*` crate that vendors the v3.3.2 C sources with
    both commits backported. It declares only the functions that the core
    calls, and it implements the global allocator. It passes the file-length
    lint and needs no layout change. Its cost: a C build for Linux, macOS, and
    Windows MSVC, and upkeep until B. Effort: Large.
- **Left out:**
  - A Rust lock around the setter: mimalloc's readers stay outside the lock.
  - An atomic store on the writer side only: the readers stay plain loads.
  - The 30 ms setting at startup, before Serve starts its threads: in the
    performance check of 2026-11-22, it slowed the warm first ready Changes by
    68 ms on the median of 16 restart pairs, over the guard of +40 ms.
  - Another allocator: the work is about the core's mimalloc.
- **Wider fix:** B. Upstream's synchronized option state protects every future
  run-time option change, with no source that Mokly must keep.
- **Previous examples:** None found.
- **Related:**
  - [purge-delay-unmeasured-platforms.md](./purge-delay-unmeasured-platforms.md)
    measures the purge delay on macOS and Windows. An upgrade changes the
    allocator under those measurements.
  - [core-rss-retained-free-pages.md](./core-rss-retained-free-pages.md)
    measures the core RSS that freed pages keep. Lost purges can be part of
    that gap.
- **Recommendation:** B. It removes both problems with upstream's own fixes and
  adds no source that Mokly must keep.
- **Action:** fix after merge, apply B, because no crates.io release vendors
  mimalloc v3.7.0 yet, and the upgrade needs its own performance check.
