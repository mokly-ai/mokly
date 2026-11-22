# Purge delay unmeasured on macOS and Windows

- **Severity:** Low. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-11-22, from branch `calummoore/mokly-core-allocator-purge-zlcf`.
- **Location:** `PURGE_DELAY_MS` and `MimallocPurgeDelay` in
  `crates/mokly-cli/src/allocator.rs:22` and line 40, the call in
  `Source::finished` in `crates/mokly-cli/src/serve_changes.rs:179`, and the
  expected delays in `crates/mokly-cli/tests/allocator_tests.rs:28` and line 41.
- **Reason:** The change had only a Linux machine for its measurements, and CI
  runners give no stable timing on macOS or Windows.

- **Terms:**
  - **Purge delay:** the mimalloc option `purge_delay`, the time after which a
    freed memory range becomes due for a purge, its return to the operating
    system.
  - **Core:** the `mokly` Rust process of the crate `mokly-cli`, without its
    Node sidecar processes, which do not use its allocator.
  - **Core CPU ratio:** the CPU time of the core divided by the CPU time of the
    other processes of the same Serve session.
  - **Whole-tree peak:** the highest sample of the anonymous memory and swap of
    all processes of one Serve session, read from the cgroup of the session.
  - **Cold 10-edit session:** one Serve session with a new cache directory and
    ten one-line edits of line 35 of
    `docs/mockups/src/screens/product/settings/slug-editor.tsx` in the
    `mokly-ai/mokly-cloud` catalogue.
- **Background:**
  - The core ships for five native targets: Linux x64 and arm64, macOS x64 and
    arm64, and Windows x64.
  - The core uses mimalloc v3 as its global allocator. The mimalloc v3 default
    purge delay is 1,000 ms.
  - mimalloc runs a due purge only during a later allocator call: a page free,
    a page abandon, or a collect. So an idle process can keep freed memory for
    longer than the delay.
  - Serve compares the working tree with a base commit and publishes the
    result as Changes. Its first ready Changes is the first Changes result that
    it publishes as ready after it starts.
  - After Serve publishes its first ready Changes, `Source::finished` calls
    `MimallocPurgeDelay` through the `PurgeDelay` boundary. It sets the purge
    delay to 30 ms with `mi_option_set_default`, once for each process. It
    does this on Linux, macOS, and Windows, with no `cfg`.
  - Startup, `build`, `publish`, and a Serve session that never reaches ready
    Changes keep the mimalloc default of 1,000 ms.
  - mimalloc reads its environment before the `main` function runs.
    `mi_option_set_default` changes only an option that no valid environment
    value set. So a valid `MIMALLOC_PURGE_DELAY` value keeps priority at
    startup and after the first ready Changes.
  - The way back for a user: `MIMALLOC_PURGE_DELAY=1000` in the environment of
    the core keeps the mimalloc default for the whole session.
  - A purge works differently on each platform:
    - Linux: `madvise(MADV_DONTNEED)`. A later reuse of the range page-faults.
    - macOS: `madvise(MADV_FREE_REUSABLE)`. mimalloc already calls
      `MADV_FREE_REUSE` on every reuse of a committed range, purged or not.
    - Windows: `VirtualFree(MEM_DECOMMIT)`. A reuse needs
      `VirtualAlloc(MEM_COMMIT)` and page faults.
  - On 2026-11-22, the orchestrator of the change accepted the same 30 ms on
    every platform as a known limit, with only Linux measured. Its reasons:
    - The purge code is the same on every platform.
    - mimalloc v2 used a default purge delay of 10 ms on every platform for
      years, and 30 ms is a longer delay.
    - The change that selected mimalloc, PR #297 and commit `6d0fcbb46`, also
      shipped on all five native targets after one Linux measurement.
  - The rejected platform exceptions were Linux only, 1,000 ms on Windows, and
    a longer delay such as 100 ms on macOS and Windows.
  - The `mokly-cli` tests run on Linux, macOS, and Windows in CI. So
    `allocator_tests.rs` checks the setting on all three, but CI measures no
    memory or speed. The test runs a debug probe of the binary. The probe
    prints the delay at startup and after the call that Serve makes. The test
    expects 1000 and then 30, and 250 twice with `MIMALLOC_PURGE_DELAY=250`.
  - In the checks below, a warm session starts Serve with the caches of an
    earlier session. The listening line is the line that Serve prints when it
    listens for requests.
  - The first version of the change set the 30 ms at the start of the `main`
    function, before any thread started. Its Linux measurement:
    - The machine was a KVM guest with Linux 6.8, 4 vCPUs, and 7.9 GB of
      memory, on an AMD Ryzen 9 9950X host. The core linked mimalloc v3.3.2.
    - Every arm used one release core of `main` at `3362e250d`. The arms
      differed only in `MIMALLOC_PURGE_DELAY` in the environment of the core.
      So each delay applied from the start of the `main` function.
    - Serve ran the `mokly-ai/mokly-cloud` catalogue at `194fdb78`, with
      `--base HEAD`, the default sidecar count, and `--debug-timings`. The
      catalogue used the `@mokly/*` packages built from the same commit.
    - The final run had four arms: a control arm and an A/A arm with the
      mimalloc default, and 10 ms and 30 ms.
    - Each round ran one cold 10-edit session of each arm, in rotated order.
    - The first of 9 rounds was a warm-up, so 8 pairs counted.
    - A sampler read the memory and the CPU time of every process every
      200 ms.
    - Raw CPU time varied by up to 60% between sessions of one arm, because of
      host load. The core CPU ratio cancels most of that.
  - The Linux result of the first version, paired against the control arm:

    | Measure          | Control arm mean | 30 ms                                                          |
    | ---------------- | ---------------- | -------------------------------------------------------------- |
    | Core RSS maximum | 1,076 MiB        | −156 MiB, lower in 8 of 8 pairs                                |
    | Core RSS median  | 951 MiB          | −105 MiB                                                       |
    | Whole-tree peak  | 2,758 MiB        | −157 MiB, −5.7%                                                |
    | Core CPU ratio   | 0.395            | +1.2% against both default arms, +0.2% against the control arm |

  - The A/A arm against the control arm: core RSS maximum −7 MiB, and core CPU
    ratio −1.8%.
  - The delay had to lower the core RSS maximum by at least 100 MiB. It had to
    raise the core CPU ratio by at most 2%.
  - 0 ms lowered the core RSS maximum by 220 MiB in screening, but it raised
    the core CPU ratio by 5.8%. 10 ms lowered it by 179 MiB, but it failed the
    CPU bound, with +2.9% against both default arms. 100 ms missed the core RSS
    goal, with −94 MiB in a screening run of 4 rounds.
  - The performance orchestrator then checked the first version on its own
    quiet machine:
    - Cold, 6 pairs: the core RSS maximum fell by 126 MiB, lower in 6 of 6
      pairs. The whole-tree peak fell by 1.1%, and the core CPU ratio stayed
      within +2%.
    - Warm edits, 24 edits: +1 ms.
    - Warm restarts, 16 pairs: the listening line came 10 ms later on the
      mean. The first ready Changes came 123 ms later on the mean and 68 ms
      later on the median, slower in 11 of 16 pairs.
    - Its guard allowed at most +40 ms on that median, so the first version
      did not merge.
    - The cause: startup frees and reuses large buffers, and a 30 ms delay
      purges them between the startup phases.
  - The current version of the change sets the 30 ms only after the first
    ready Changes. Its Linux measurement compared release builds of `main` at
    `3362e250d` and of the branch. It used the machine, the catalogue, and the
    sampler of the first measurement:
    - Warm, 8 rounds: the core RSS maximum fell by 105 MiB, lower in 8 of 8
      rounds. The core RSS median fell by 26 MiB, and the whole-tree peak fell
      by 3.0%.
    - The core minor faults to the listening line and to the first ready
      Changes were equal to those of `main`. The core minor faults for each
      edit rose by 115%.
    - Warm times against `main`, on the mean and on the median:
      - The listening line: −85 ms and −30 ms.
      - The first ready Changes: −277 ms and −138 ms.
      - Each edit: −104 ms and −13 ms.
    - Cold, 4 pairs: the core RSS maximum fell by 82 MiB, lower in 4 of 4
      pairs. The core RSS median fell by 45 MiB, the whole-tree peak fell by
      2.1%, and the core CPU ratio rose by 1.1%.
  - The current version keeps less of the cold gain, because the core RSS
    maximum of a cold session comes during the edits:
    - The maximum before the first ready Changes: `main` 815 to 851 MiB, the
      first version 732 to 759 MiB, and the current version 849 to 864 MiB.
    - The maximum during the edits: `main` 1,045 to 1,104 MiB, the first
      version 890 to 943 MiB, and the current version 974 to 987 MiB.
    - The current version enters the edits at the level of `main`. The
      startup memory that waits for its 1,000 ms purge stays committed when
      the edits start.
  - On 2026-11-22, the performance orchestrator chose to ship the current
    version. Its official check of that version uses a cold bar of 60 MiB: 6
    cold pairs, at least 5 of 6 lower, and a whole-tree peak at most 1% above
    `main`. Its speed bars stay as they were for the first version. The check
    passed every bar on its own quiet machine:
    - Cold, 10 pairs: the core RSS maximum fell by 93 MiB, lower in 10 of 10
      pairs. The whole-tree peak fell by 3.65%. The core CPU ratio rose by
      1.84%, and the first ready Changes came 40 ms sooner on the median.
    - Warm edits: +5 ms in its 8 rounds, and −49 ms with the 8 rounds of the
      change pooled.
    - Warm restarts, 16 pairs: the listening line came 3 ms sooner, and the
      first ready Changes 14 ms sooner on the median.
    - `examples/basic` with 4 sidecars, cold: the whole-tree peak fell by 0.6%.
- **Task:**
  1. On a macOS and a Windows machine, run Serve on the `mokly-cloud`
     catalogue with one release core for both arms. One arm runs the core as
     it ships. The other arm adds `MIMALLOC_PURGE_DELAY=1000` to the
     environment of the core, which keeps the mimalloc default for the whole
     session.
  2. Run cold 10-edit sessions of both arms in rotated order. Discard the
     first round as a warm-up. Keep at least 8 pairs after it. Add an A/A arm
     to show the noise.
  3. Sample every process at 250 ms or less. Record the core RSS maximum and
     median and the core CPU ratio of each session. Record the core RSS
     maximum before the first ready Changes and the maximum during the edits.
     - On Windows, read the working set as the RSS.
     - On macOS, also record the physical footprint that Activity Monitor
       shows. mimalloc uses `MADV_FREE_REUSABLE` there because the kernel
       accounts the purged pages at once.
  4. Measure the warm edit time of both arms in at least 12 interleaved
     rounds. The warm edit time is the time from a one-line edit to the next
     `ready` publication of Serve, with warm caches. Also record the page
     faults of the core for each edit.
  5. Record the results in the pull request that closes this item. Propose to
     keep the 30 ms, to change it, or to give a platform an exception. The
     user decides.
  6. A new delay changes `PURGE_DELAY_MS` in
     `crates/mokly-cli/src/allocator.rs`, the expected delay in
     `crates/mokly-cli/tests/allocator_tests.rs`, and the delay in
     `crates/mokly-cli/README.md`. A platform exception also changes the
     sentence of `docs/architecture/rust-core.md` that starts with "On every
     platform".
- **Impact if no action:** macOS and Windows users run a purge delay whose cost
  and gain nobody measured. A costlier purge or recommit there can use more CPU
  and slow down edits, and nobody notices.
- **Needs:** A macOS machine and a Windows machine that run Serve on the
  `mokly-cloud` catalogue, each with a per-process memory and CPU sampler. CI
  runners give no stable timing.
- **Done when:** The measurements are recorded, and a user decision keeps the
  delay, changes it, or gives a platform an exception.
- **Related:**
  - [core-rss-retained-free-pages.md](./core-rss-retained-free-pages.md) holds
    the core RSS that the purge delay does not return. That is the startup
    memory that stays committed into the edits, and the blocks that one thread
    frees on pages that another, idle thread owns. Its option of a forced purge
    at the first ready Changes would change the setting that this task
    measures.
  - [mimalloc-v3-7-upgrade.md](./mimalloc-v3-7-upgrade.md) upgrades mimalloc.
    The upgrade changes the allocator under the measurements of this task.
  - [purge-delay-switch-after-replaced-changes.md](./purge-delay-switch-after-replaced-changes.md)
    defines which ready Changes starts the 30 ms when Serve replaces a
    comparison right after its publication. Its fix edits the definition of
    the first ready Changes in this item.
