# The fixed benchmark memory stop censors JavaScript runs

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-18, from the options check of decision 4 in the
  generation affinity plan, branch
  `calummoore/mokly-sidecar-generation-affinity-jmbb`: its blocked wider fix,
  option I.
- **Location:** `scripts/large/memory.ts:8` and line 133,
  `scripts/large/options.ts:20` and lines 51-53,
  `tests/fixtures/large/README.md:78-80`, and
  `tests/large_process.test.ts:109`.
- **Reason:** The fix changes a documented default and adds a stop to tracked
  tooling, so it needs a user decision and its own branch.

- **Source:** Implementation.
- **Category:** Test.
- **Terms:**
  - **Large benchmark:** the opt-in harness `npm run benchmark:large` under
    `scripts/large/`. It measures build, Serve, Changes, and watch on a
    generated large fixture.
  - **Memory stop:** the safety stop of that harness. It ends a run when the
    sampled RSS sum of the harness tree passes `--memory-stop-kib`.
  - **Censored run:** a run that a safety stop or a time limit ended before
    ready Changes. Its result is missing, not slow.
  - **Live floor:** a check in each sample of the host's `MemAvailable`. It
    ends the run below a set value.
  - **OOM kill:** the kernel ends a process when the host has no memory left.
- **Background:**
  - `scripts/large/memory.ts:8` sets the default stop to 1,750,000 KiB, about
    1.67 GiB. The sampler reads `ps` every 50 ms. When the harness tree sum
    passes the stop, at line 133, it ends the run and records a failure.
  - `--memory-stop-kib` sets another stop, and 0 turns the stop off, at
    `scripts/large/options.ts:51-53`. `tests/large_process.test.ts:109`
    asserts the default.
  - The stop is a host safety stop, not an acceptance budget. The first line
    of `scripts/large/memory.ts` says so. The Budgets table of
    `docs/protocol/mokly-timings.md`, at line 224, budgets RSS only for
    isolated setup.
  - `tests/fixtures/large/README.md:78-80` says: "`--memory-stop-kib`
    defaults to 1750000; use 0 to disable it. React Serve needs a larger stop
    on a machine with more memory. Do not raise the stop on a shared machine
    without sufficient capacity."
  - The default came with PR #199, commit `d935e6a66`. The benchmark starts
    two sidecars by default, at `scripts/large/options.ts:22`.
  - On 2026-11-01, an eight-CPU host with 16 GiB used a stop of 6 GiB by
    hand, `--memory-stop-kib 6291456`, with two sidecars. The command is at
    `plans/follow-ups/large-benchmark-liveness.md:46`.
  - The user's rule of 2026-11-16 forbids a change that can exhaust the
    memory of a machine.
  - On 2026-11-18 an 8 GiB host ran JavaScript comparisons with four
    sidecars, to match a cloud pool of four:
    - The host had 7,941 MiB RAM, 4 CPUs, and 2,047 MiB of swap. It had
      6,346 MiB available before the branch runs.
    - The main small React run stopped at 1,764,140 KiB, 14,140 KiB over the
      stop. The branch small React run completed at 1,725,936 KiB, 24,064 KiB
      under it. So near the stop, chance decided which side completed.
    - The branch minimal React run, with 13 routes, still reached
      1,639,488 KiB.
    - The harness process added 146,376 to 203,960 KiB. The CLI trees alone
      reached 1,547,708 to 1,618,024 KiB and still rose at the stop.
  - The samples of those runs show the limits of a sampled stop:
    - The largest rise between two samples was 215,860 KiB, about 211 MiB.
    - The longest gap between two samples was 250.3 ms.
    - The largest rise in one second was 636,908 KiB, about 622 MiB.
    - The runs passed the stop by 1,104 to 23,004 KiB before the stop ended
      them. Summed RSS also counts shared pages more than once.
  - On that host, one OOM kill of any process in the service that runs all
    agent sessions stops that service. That ends every session. A check
    before a run cannot see heavy work that starts during the run.
  - On 2026-11-18 the generation affinity branch prepared a separately
    labelled profile in an ignored scratch harness:
    - It used a 3 GiB stop, 3,145,728 KiB.
    - It required at least 5 GiB available before each run.
    - It ended a run when `MemAvailable` fell below 1.5 GiB.
    - It kept the runtime, the time limits, the four sidecars, and the
      earlier failed runs.
    - With 5,120 MiB available at the start, about 1.8 GiB stays available
      after one more sample of the largest rise.
  - A safety probe checked its live floor and process cleanup. No benchmark
    attempt used that profile before the cloud acceptance and PR instruction.
  - That profile is dated evidence only. No tracked code uses it.
- **Problem:** The fixed default stop censors JavaScript comparisons on an
  8 GiB host with more than 6 GiB available. Each run on a larger host needs
  a stop that the operator picks by hand.
- **Impact if no action:** JavaScript measurements fail near the stop, and
  chance can decide which side completes. A stop that is raised by hand has no
  live check, so other work on a shared host can still run out of memory.
- **Root question:** How does the large benchmark choose a memory stop that
  keeps a shared host safe and still lets JavaScript runs complete on hosts
  with enough memory?
- **Options:**
  - **A.** Change nothing. Keep the fixed default. Pass a larger
    `--memory-stop-kib` by hand on a host with enough capacity, as the README
    allows. Effort: Small.
  - **B.** Raise the fixed default, for example to 3 GiB. It is unsafe on a
    smaller or a busy host, and it is still one fixed guess. It changes the
    documented default and its test. Effort: Small.
  - **C.** Derive the default stop from the available memory at the start,
    less a fixed reserve. Keep `--memory-stop-kib` as an override and 0 as
    off. It cannot see heavy work that starts during the run. A host other
    than Linux needs another source for available memory. Effort: Medium.
  - **D.** Apply C, and add a live floor. Each sample also reads the host's
    available memory. Below the floor, the harness ends the run with the
    same complete tree stop as the RSS stop, and it records a labelled
    failure. Work of other sessions can then end a run, which gives an honest
    censored result. It changes the documented default and adds a stop. It
    needs tests in `tests/large_process.test.ts` and in the sampler tests.
    Effort: Medium.
- **Left out:**
  - No stop by default. One OOM kill on a shared host can end every session
    there.
  - A hard memory cap from the operating system, such as a systemd scope. It
    needs root and Linux. `tests/fixtures/large/README.md:73` says that the
    harness runs on any Unix host.
  - Fewer sidecars or a smaller catalogue under the old stop. The README
    already says that React Serve needs a larger stop. The minimal React
    catalogue still came within 110,512 KiB of the stop.
  - A sum without the harness process. It gives back at most about 200 MiB,
    and the CLI trees alone still rose at the stop.
- **Wider fix:** D. A stop that follows the host, with a live floor, removes
  the choice of a stop for each host in every later run.
- **Previous examples:** The stop of 6 GiB that was set by hand on a 16 GiB
  host on 2026-11-01. The scratch profile of 2026-11-18 with a 3 GiB stop, a
  5 GiB check before each run, and a 1.5 GiB live floor.
- **Related:**
  - [large-benchmark-sampling-cleanup.md](./large-benchmark-sampling-cleanup.md):
    the live floor of D must end a run with the complete tree stop. The
    sampling-failure path ends less of the tree, as that item records.
  - [large-benchmark-liveness.md](./large-benchmark-liveness.md): its time
    waits also censor runs of the same benchmark. The two fixes are
    independent.
- **Recommendation:** D. It keeps a safety bound on every host, and it
  removes the choice of a stop by hand that censored the runs of 2026-11-18.
- **Action:** ask the user, because D changes the documented default of
  `--memory-stop-kib` and adds a new stop to tracked tooling, and no recorded
  user decision covers either change.
