# Core RSS stays about twice the live heap

- **Severity:** Low. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-22, from the memory breakdown of the second speed change
  of branch `calummoore/mokly-edit-background-render-olos`, which the
  performance orchestrator requested after its gate.
- **Location:** `crates/mokly-cli/src/main.rs:98`, the mimalloc global
  allocator of the core. `mimalloc` 0.1.52 uses `libmimalloc-sys` 0.1.49,
  which builds mimalloc 3.3.2 unless its `v2` feature is on.
- **Reason:** Workspace 243 measures the mimalloc `purge_delay` as a product
  setting on branch `calummoore/mokly-core-allocator-purge-zlcf`, and the
  next change waits for that result.

- **Source:** Implementation.
- **Category:** Performance.
- **Terms:**
  - **Live heap:** the bytes that the core has allocated through mimalloc and
    not freed, as a counting allocator around mimalloc reports them.
  - **RSS:** the resident anonymous memory and swap of the core process, which
    the whole-tree memory peak of a Serve session counts.
  - **Purge delay:** the mimalloc option `purge_delay`, the time that freed
    memory stays committed before mimalloc returns it to the system. Its
    default is 1,000 ms in mimalloc 3 and 10 ms in mimalloc 2.
  - **Thread-free list:** in mimalloc 3, the list of a page that holds the
    blocks that other threads free, until a thread collects the page.
  - **Second speed change:** H, W1, and C1 of 2026-11-22, built on branch
    `calummoore/mokly-edit-background-render-olos` in commits `ea6724a03`,
    `f453c0440`, `a9a09edf2`, and `0910565bf`, and reverted in `11f8e4ac4`.
    It never opened a pull request.
- **Background:**
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
    - An owner thread keeps its partly used pages and up to 2 full small
      pages of each size class (`page_full_retain`). It abandons its other
      full pages when it searches for free space.
    - A thread that frees a block into an abandoned page collects that page,
      and frees the page when it is empty.
    - A busy owner collects its whole heap every 10,000 slow-path
      allocations. An idle tokio blocking thread ends after 10 s, and the end
      of a thread abandons all of its pages.
    - `mi_collect` collects only the heap of the calling thread. The option
      `abandoned_page_purge` is not read.
  - The performance orchestrator measured on `main` `c699b35d3` on
    2026-11-22: `MIMALLOC_PURGE_DELAY=0` alone lowered the core RSS maximum
    from 981 to 803 MiB, while an A/A block moved it by +12 MiB. The
    whole-tree peak moved by -100 MiB, but its A/A spread is up to 400 MiB
    for each pair.
  - The counting allocator sees only the Rust global allocator. C libraries
    of the core, such as `aws-lc-sys`, keep the system allocator, and thread
    stacks are anonymous memory outside mimalloc too.
  - The pooled whole-tree memory checks of the second speed change passed
    near the 2% limit. The item
    [changes-detail-revision-copies.md](./changes-detail-revision-copies.md)
    keeps H with option I as an open fix that depends on this item.
- **Problem:** The core keeps about as much resident memory as live data. The
  second speed change kept 41 to 46 MiB more core RSS than `main` after its
  first edit, with about 2 MiB more live data, and no measurement names the
  source of that gap.
- **Impact if no action:** Each Serve session keeps hundreds of MiB more
  resident memory than its live data needs, and changes like H stay near the
  2% memory limit.
- **Root question:** How much of the resident memory of the core is freed
  memory that the allocator keeps, and which allocator setting or call
  returns it without a cost in speed?
- **Options:**
  - **A.** Set the purge delay as a product setting, after the measurement of
    workspace 243 on branch `calummoore/mokly-core-allocator-purge-zlcf`
    against the speed rules of the performance orchestrator. Effort: Small.
  - **B.** Split the gap by source in the same sessions: the mimalloc
    statistics of `mi_stats_get_json` at each edit (`committed`,
    `page_committed`, `purged`, `pages`, and `pages_abandoned`), and the core
    RSS by mapping from `/proc/{pid}/smaps` (the mimalloc arenas, the system
    heap, and the thread stacks). Check first that a release build updates
    each counter. Effort: Small.
  - **C.** Test the source in the gap of H with a probe build of `a9a09edf2`,
    the measured arm, whose Rust code equals `0910565bf`: run each chunk job
    of the idle step on a new thread that ends with the job, so that mimalloc
    abandons its pages and the frees of the first edit can free them; or call
    `mi_collect(false)` at the end of each chunk job, which reaches only the
    heap of that thread and not the installs on the async threads. Effort:
    Small.
  - **D.** Build the core with the `v2` feature of `libmimalloc-sys`, whose
    purge delay is 10 ms and whose frees from another thread go to a delayed
    free list of the owner heap, and compare RSS and speed. Effort: Small.
  - **E.** Change the allocator of the core, or its configuration, after a
    comparison of RSS and speed. Effort: Medium.
- **Left out:**
  - Change nothing. It fails the goal, because the resident memory keeps
    limiting the memory budget of each speed change.
  - An arm with `abandoned_page_purge`. mimalloc 3.3.2 does not read that
    option.
- **Wider fix:** None, because this is a memory opportunity, not a class of
  defect.
- **Previous examples:** #297, commit `6d0fcbb46`, moved the core to mimalloc
  and cut the Serve peak RSS from 1,124 MiB to 838 MiB.
- **Related:**
  [changes-detail-revision-copies.md](./changes-detail-revision-copies.md)
  holds H and option I, which wait for this item.
- **Recommendation:** A, with B in the same sessions. A follows the measured
  effect of `MIMALLOC_PURGE_DELAY=0` on `main`, and B names the share of each
  source, so that C runs only if a gap stays.
- **Action:** fix after merge, apply A, because workspace 243 measures the
  purge delay as a product setting first, as the performance orchestrator
  said on 2026-11-22.
