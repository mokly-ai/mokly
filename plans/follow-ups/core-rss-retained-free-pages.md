# Core RSS stays about twice the live heap

- **Severity:** Low. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-22, from the memory breakdown of the second speed change
  of branch `calummoore/mokly-edit-background-render-olos`, which the
  performance orchestrator requested after its gate.
- **Location:** `crates/mokly-cli/src/main.rs:99`, the mimalloc global
  allocator of the core, and `MimallocPurgeDelay` in
  `crates/mokly-cli/src/allocator.rs:40`, which sets the purge delay. Its
  caller is `Source::finished` in `crates/mokly-cli/src/serve_changes.rs:179`.
  `crates/mokly-cli/Cargo.toml:37` and line 38 select `mimalloc` 0.1.52 and
  `libmimalloc-sys` 0.1.49 with its `extended` feature. `libmimalloc-sys`
  0.1.49 builds mimalloc 3.3.2 unless its `v2` feature is on.
- **Reason:** Branch `calummoore/mokly-core-allocator-purge-zlcf` ships only
  the purge delay setting of option A, and the gap that stays needs its own
  measurement by source first.

- **Source:** Implementation.
- **Category:** Performance.
- **Terms:**
  - **Live heap:** the bytes that the core holds through mimalloc, as a
    counting allocator around mimalloc reports them.
  - **RSS:** the resident anonymous memory and swap of the core process, which
    the whole-tree memory peak of a Serve session counts.
  - **Purge delay:** the mimalloc option `purge_delay`, the time after which a
    freed memory range becomes due for a purge, its return to the operating
    system.
  - **Thread-free list:** the list of a mimalloc 3 page that holds the blocks
    that other threads free, until a thread collects the page.
  - **Core CPU ratio:** the CPU time of the core divided by the CPU time of the
    other processes of the same Serve session.
- **Background:**
  - The second speed change of the branch, H, W1, and C1 of 2026-11-22, was
    built in commits `ea6724a03`, `f453c0440`, `a9a09edf2`, and `0910565bf`,
    and reverted in `11f8e4ac4`. It never opened a pull request.
  - Measured on 2026-11-22 with probe builds of the core (a counting
    allocator around mimalloc), one cold Serve session of 10 edits on
    mokly-cloud for each arm, `main` `a2ae56360` and the second speed change
    at `a9a09edf2`, 4 vCPU and 7.9 GB, no memory cap: in both arms the core
    RSS was about 2 times the live heap. During the edits, the core RSS of
    `main` had a median of 949 MiB, while its live heap stayed between about
    487 and 538 MiB.
  - The same sessions show the effect of one change:
    - The idle step of H kept 18.5 MiB of live data from the first ready
      Changes until the first edit: 8.9 MiB of typed details and 9.6 MiB of
      encoded bytes. After the idle step, the core RSS settled about 37 MiB
      above `main`. So about half of that excess was live data.
    - At the first edit, a rebuild on another thread freed the 8.9 MiB of
      typed copies, and the rebuild records kept the 9.6 MiB of encoded
      bytes, as the rebuild records of `main` keep their own.
    - After the first edit, the live heap differed by about 2 MiB at each
      publication (12 MiB at the first rebuild), and by 4 MiB at the peak,
      542 MiB against 538 MiB. But the core RSS stayed higher for all 10
      edits: a median of 995 MiB against 949 MiB, and a maximum of 1,088 MiB
      against 1,047 MiB.
  - The idle step ran each chunk as its own `tokio::task::spawn_blocking`
    task on the shared blocking pool of the Serve runtime
    (`crates/mokly-server/src/work_idle.rs:26` at `0910565bf`), and each
    install cloned the snapshot on an async worker thread.
  - mimalloc 3.3.2, from its source in `libmimalloc-sys` 0.1.49:
    - A thread that frees a block of a page that another live thread owns
      puts the block on the thread-free list of that page. The block stays
      there until the owner collects the page.
    - An owner keeps its partly used pages and up to 2 full small pages of
      each size class (`page_full_retain`). It abandons its other full pages
      when it searches for free space. A thread that frees a block into an
      abandoned page collects that page, and frees the page when it is empty.
    - A busy owner collects its whole heap every 10,000 slow-path
      allocations. An idle tokio blocking thread ends after 10 s, and the end
      of a thread abandons all of its pages.
    - `mi_collect` collects only the heap of the calling thread. With `force`
      set, it also purges every range that waits for a purge, in all arenas.
      The option `abandoned_page_purge` is not read.
    - A freed range becomes due for a purge after the purge delay, 1,000 ms by
      default. mimalloc runs a due purge only during a later allocator call: a
      page free, a page abandon, or a collect. So an idle process can keep
      freed memory for longer than the delay.
    - The option functions, such as `mi_option_set` and
      `mi_option_set_default`, need the `extended` feature of
      `libmimalloc-sys`, which `mimalloc` also forwards as its own `extended`
      feature. `crates/mokly-cli/Cargo.toml:38` turns it on with a direct
      dependency on `libmimalloc-sys`. That feature adds only Rust bindings,
      and the compiled mimalloc stays the same. It also gives the bindings of
      `mi_collect` and `mi_stats_get_json`.
    - `libmimalloc-sys` 0.1.49 has no named constant for `purge_delay`. So
      `crates/mokly-cli/src/allocator.rs` uses its index, 15, which the
      mimalloc 2 and 3 headers share.
    - The environment variable `MIMALLOC_PURGE_DELAY` still sets the delay
      with no build change.
  - The performance orchestrator measured on `main` `c699b35d3` on
    2026-11-22: `MIMALLOC_PURGE_DELAY=0` alone lowered the core RSS maximum
    from 981 to 803 MiB, while an A/A block moved it by +12 MiB. The
    whole-tree peak moved by -100 MiB, but its A/A spread is up to 400 MiB
    for each pair. The same day it chose to measure the purge delay as a
    product setting on branch `calummoore/mokly-core-allocator-purge-zlcf`.
  - That branch did option A on 2026-11-22, in a narrower form than the plan
    of A:
    - Serve compares the working tree with a base commit and publishes the
      result as Changes. Its first ready Changes is the first Changes result
      that it publishes as ready after it starts.
    - After that point, `MimallocPurgeDelay` sets the default purge delay to
      30 ms with `mi_option_set_default`, once for each process.
    - Startup, `build`, `publish`, and a Serve session that never reaches
      ready Changes keep the mimalloc default of 1,000 ms.
    - A valid `MIMALLOC_PURGE_DELAY` value in the environment keeps priority
      at startup and after the first ready Changes.
  - The branch measured on Linux:
    - The machine was a KVM guest with 4 vCPUs on an AMD Ryzen 9 9950X host.
    - The arms used release builds of `main` at `3362e250d` and of the branch.
    - Serve ran the mokly-cloud catalogue at `194fdb78`. A sampler read every
      process every 200 ms.
    - The whole-tree peak is the highest memory sample of all processes of one
      session.
    - A warm session starts Serve with the caches of an earlier session. The
      listening line is the line that Serve prints when it listens for
      requests.
  - The first version of the branch set the 30 ms at the start of the `main`
    function. Its own measurement set each delay through the environment of a
    release core of `main`:
    - Cold 10-edit sessions, 8 pairs: the core RSS maximum fell by 156 MiB
      from 1,076 MiB, and the core RSS median fell by 105 MiB. The whole-tree
      peak fell by 5.7%, and the core CPU ratio rose by 1.2%.
    - Other delays: 0 ms lowered the core RSS maximum by 220 MiB in
      screening, but it raised the core CPU ratio by 5.8%. 10 ms lowered it by
      179 MiB, but it raised the ratio by 2.9%, above the bound of 2%. 100 ms
      lowered it by 94 MiB in screening, short of the goal of 100 MiB.
    - The performance orchestrator checked the first version on its own quiet
      machine. In 6 cold pairs, the core RSS maximum fell by 126 MiB, lower in
      6 of 6 pairs. The whole-tree peak fell by 1.1%, and the core CPU ratio
      stayed within +2%. Warm edits took 1 ms longer over 24 edits.
    - Its warm restarts, 16 pairs: the listening line came 10 ms later on the
      mean. The first ready Changes came 123 ms later on the mean and 68 ms
      later on the median, slower in 11 of 16 pairs.
    - The guard allowed at most +40 ms on that median, so the first version
      did not merge. Startup frees and reuses large buffers, and a 30 ms
      delay purges them between the startup phases.
  - The current version of the branch sets the 30 ms only after the first
    ready Changes:
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
    `main`. Its speed bars stay as they were for the first version. That check
    was still open when this item was written.
  - The counting allocator sees only the Rust global allocator. C libraries
    of the core, such as `aws-lc-sys`, keep the system allocator, and thread
    stacks are anonymous memory outside mimalloc too.
  - The pooled whole-tree memory checks of the second speed change passed
    near the 2% limit. The item
    [changes-detail-revision-copies.md](./changes-detail-revision-copies.md)
    keeps H with option I as an open fix that depends on this item.
- **Problem:** The core RSS stays about twice its live heap, and no
  measurement names the share of each source. The 30 ms purge delay after the
  first ready Changes leaves the startup memory resident into the edits, and
  it reaches no thread-free list. The second speed change kept 41 to 46 MiB
  more core RSS than `main` after its first edit, with about 2 MiB more live
  data.
- **Impact if no action:** Each Serve session keeps hundreds of MiB more
  resident memory than its live data needs, and changes like H stay near the
  2% memory limit.
- **Root question:** How much of the resident memory of the core is freed
  memory that the allocator keeps, and which allocator setting or call
  returns it without a cost in speed?
- **Options:**
  - **A.** Set the purge delay as a product setting. Done on 2026-11-22 by
    branch `calummoore/mokly-core-allocator-purge-zlcf`, as the current
    version that the Background describes. The plan of A was:
    - Compare `MIMALLOC_PURGE_DELAY` values of 0, 10, and 100 ms with the
      default of 1,000 ms, each against `main`, in cold 10-edit mokly-cloud
      sessions and in cold `examples/basic` sessions with 2 sidecars, in
      pairs.
    - Use the core RSS maximum as the measure of the gain: it must fall by
      more than the A/A spread of about 12 MiB.
    - Keep these bars:
      - Equal published bytes.
      - A whole-tree peak not above `main` by more than 2%.
      - Warm edits, warm restores, and the first Changes within +30 ms of
        `main`.
    - A is done when a merged change sets the delay: through the environment
      that the shim gives the core at `packages/mokly/src/runtime.mjs:46`, or
      through `mi_option_set` in the core with the `extended` feature. The
      branch calls `mi_option_set_default` instead, so a valid environment
      value keeps priority.
    - Effort: Small.
  - **B.** Split the gap by source in cold 10-edit mokly-cloud sessions of the
    core as it ships, with a probe build:
    - Read the mimalloc statistics of `mi_stats_get_json` at the first ready
      Changes and at each edit: `committed`, `page_committed`, `purged`,
      `pages`, and `pages_abandoned`.
    - Split the core RSS by mapping from `/proc/{pid}/smaps`: the mimalloc
      arenas, the system heap, and the thread stacks.
    - Check first that a release build updates each counter.
    - Effort: Small.
  - **C.** Test the source in the gap of H with a probe build of `a9a09edf2`,
    the measured arm, whose Rust code equals `0910565bf`: run each chunk job
    of the idle step on a new thread that ends with the job, so that mimalloc
    abandons its pages and the frees of the first edit can free them; or call
    `mi_collect(false)` at the end of each chunk job, which reaches only the
    heap of that thread and not the installs on the async threads. Effort:
    Small.
  - **D.** Build the core with the `v2` feature of `libmimalloc-sys`, and
    compare RSS and speed. The default purge delay of mimalloc v2 is 10 ms.
    Its frees from another thread go to a delayed free list of the owner heap
    instead of a thread-free list. The core raises that default to 30 ms after
    the first ready Changes, so a v2 arm must also choose that delay. Effort:
    Small.
  - **E.** Change the allocator of the core, or its configuration, after a
    comparison of RSS and speed. Effort: Medium.
  - **F.** Add one forced purge at the first ready Changes. Right after the
    core sets the 30 ms delay, it calls `mi_collect(true)` once on a new
    thread. The forced step of that call purges every range that waits for a
    purge, in all arenas.
    - An experiment of 2026-11-22 measured F on the machine of the
      Background. The call took 0.4 to 3.0 ms.
    - Cold, against `main`: the core RSS maximum fell by 109 MiB, lower in 4
      of 4 pairs, against 82 MiB for the current version alone.
    - Warm, against `main`: the core RSS maximum fell by 100 MiB. The
      experiment measured no startup or edit cost.
    - Before the data, the performance orchestrator set a rule: push F only
      at −125 MiB or more on that machine. F missed the rule, so the branch
      did not merge it.
    - Effort: Small.
- **Left out:**
  - Change nothing. It fails the goal, because the resident memory keeps
    limiting the memory budget of each speed change.
  - An arm with `abandoned_page_purge`. mimalloc 3.3.2 does not read that
    option.
  - A 30 ms purge delay from the start of the `main` function, the first
    version of A. Its warm first ready Changes was 68 ms slower on the median,
    above the guard of +40 ms.
- **Wider fix:** None, because this is a memory opportunity, not a class of
  defect.
- **Previous examples:** #297, commit `6d0fcbb46`, moved the core to mimalloc
  and cut the Serve peak RSS from 1,124 MiB to 838 MiB.
- **Related:**
  - [changes-detail-revision-copies.md](./changes-detail-revision-copies.md)
    holds H and option I, which wait for this item.
  - [purge-delay-unmeasured-platforms.md](./purge-delay-unmeasured-platforms.md)
    measures the 30 ms purge delay of option A on macOS and Windows. A change
    of that setting here, such as F, changes what that task measures.
- **Recommendation:** B. Its split names the largest source of the gap that
  stays, so that F, C, or D runs only when its source is large. Until
  2026-11-22 the recommendation was A, with B in the same sessions.
- **Action:** fix after merge, apply B, because B measures the merged core
  with a probe build.
