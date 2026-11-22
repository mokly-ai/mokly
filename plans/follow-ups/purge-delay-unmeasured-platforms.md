# Purge delay unmeasured on macOS and Windows

- **Severity:** Low. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-11-22, from branch `calummoore/mokly-core-allocator-purge-zlcf`.
- **Location:** `return_freed_memory_sooner` in
  `crates/mokly-cli/src/allocator.rs`, and the expected delay in
  `crates/mokly-cli/tests/allocator_tests.rs`.
- **Reason:** The change had only a Linux machine for its measurements, and CI
  runners give no stable timing on macOS or Windows.

- **Terms:**
  - **Purge delay:** the time that mimalloc waits before it returns a freed
    range of memory to the operating system, 1,000 ms by default in mimalloc v3.
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
  - The core uses mimalloc v3 as its global allocator. At the start of `main`,
    before any thread starts, `return_freed_memory_sooner` sets the purge delay
    to 30 ms with `mi_option_set_default`. It does this on Linux, macOS, and
    Windows, with no `cfg`.
  - mimalloc reads its environment before `main`. `mi_option_set_default`
    changes only an option that no valid environment value set. So a valid
    `MIMALLOC_PURGE_DELAY` value, or the legacy `MIMALLOC_RESET_DELAY`, takes
    priority over the 30 ms.
  - The way back for a user: `MIMALLOC_PURGE_DELAY=1000`, the mimalloc default,
    in the environment of the core restores the earlier behaviour.
  - A purge works differently on each platform:
    - Linux: `madvise(MADV_DONTNEED)`. A later reuse of the range page-faults.
    - macOS: `madvise(MADV_FREE_REUSABLE)`. mimalloc already calls
      `MADV_FREE_REUSE` on every reuse of a committed range, purged or not.
    - Windows: `VirtualFree(MEM_DECOMMIT)`. A reuse needs
      `VirtualAlloc(MEM_COMMIT)` and page faults.
  - On 2026-11-22, the orchestrator of the change accepted the same 30 ms on
    every platform as a known limit, with only Linux measured. Its reasons:
    - The purge code is the same on every platform.
    - mimalloc v2 purged freed segment pages after 10 ms by default on every
      platform for years, and 30 ms waits longer.
    - The change that selected mimalloc, PR #297 and commit `6d0fcbb46`, also
      shipped on all five native targets after one Linux measurement.
  - The rejected platform exceptions were Linux only, 1,000 ms on Windows, and
    a longer delay such as 100 ms on macOS and Windows.
  - The `mokly-cli` tests run on Linux, macOS, and Windows in CI. So
    `allocator_tests.rs` checks the setting on all three, but CI measures no
    memory or speed.
  - The Linux measurement:
    - The machine was a KVM guest with Linux 6.8, 4 vCPUs, and 7.9 GB of
      memory. The core linked mimalloc v3.3.2.
    - Every arm used one release core of `main` at `3362e250d`. The arms
      differed only in `MIMALLOC_PURGE_DELAY` in the environment of the core.
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
  - The Linux result of 30 ms, paired against the control arm:

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
  - 10 ms failed the CPU bound, with +2.9% against both default arms. 100 ms
    missed the core RSS goal, with −94 MiB in a screening run of 4 rounds.
- **Task:**
  1. On a macOS machine and on a Windows machine, run Serve on the
     `mokly-cloud` catalogue with one release core for both arms. One arm runs
     the core as it ships. The other arm adds `MIMALLOC_PURGE_DELAY=1000` to
     the environment of the core.
  2. Run cold 10-edit sessions of both arms in rotated order. Discard the
     first round as a warm-up. Keep at least 8 pairs after it. Add an A/A arm
     to show the noise.
  3. Sample every process at 250 ms or less. Record the core RSS maximum and
     median and the core CPU ratio of each session.
     - On Windows, read the working set as the RSS.
     - On macOS, also record the physical footprint that Activity Monitor
       shows. mimalloc uses `MADV_FREE_REUSABLE` there because the kernel
       accounts the purged pages at once.
  4. Measure the warm edit time of both arms in at least 12 interleaved
     rounds. The warm edit time is the time from a one-line edit to the next
     `ready` publication of Serve, with warm caches.
  5. Record the results in the pull request that closes this item. Propose to
     keep the 30 ms, to change it, or to give a platform an exception. The
     user decides.
  6. A new delay changes `crates/mokly-cli/src/allocator.rs` and the expected
     delay in `crates/mokly-cli/tests/allocator_tests.rs`. A platform
     exception also changes the sentence of `docs/architecture/rust-core.md`
     that starts with "On every platform".
- **Impact if no action:** macOS and Windows users run a purge delay whose cost
  and gain nobody measured. A costlier purge or recommit there can use more CPU
  and slow down edits, and nobody notices.
- **Needs:** A macOS machine and a Windows machine that run Serve on the
  `mokly-cloud` catalogue, each with a per-process memory and CPU sampler. CI
  runners give no stable timing.
- **Done when:** The measurements are recorded, and a user decision keeps the
  delay, changes it, or gives a platform an exception.
