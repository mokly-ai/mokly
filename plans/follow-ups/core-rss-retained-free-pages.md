# Core RSS stays about twice the live heap

- **Severity:** Low. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-22, from the memory breakdown of the second pull request
  of branch `calummoore/mokly-edit-background-render-olos`, which the
  performance orchestrator requested after its gate.
- **Location:** `crates/mokly-cli/src/main.rs:98`, the mimalloc global
  allocator of the core (`mimalloc` 0.1, `libmimalloc-sys` 0.1.49).
- **Reason:** The performance orchestrator tests allocator settings on its own
  machine, and a change of the allocator needs its measurements first.

- **Source:** Implementation.
- **Category:** Performance.
- **Terms:**
  - **Live heap:** the bytes that the core has allocated and not freed, as a
    counting allocator around mimalloc reports them.
  - **RSS:** the resident anonymous memory and swap of the core process, which
    the whole-tree memory peak of a Serve session counts.
  - **Delayed free:** in mimalloc, a block that one thread frees from the heap
    of another thread goes to a list of the owning thread. The owner reclaims
    it only when it allocates again.
  - **Idle workers:** the threads of the Serve work pool that run background
    and idle jobs.
- **Background:**
  - Measured on 2026-11-22 with probe builds of the core (a counting
    allocator around mimalloc), one cold Serve session of 10 edits on
    mokly-cloud for each arm, 4 vCPU and 7.9 GB, no memory cap: the core RSS
    was about 2 times the live heap in both arms, `main` `a2ae56360` and the
    branch `a9a09edf2`. During the edits, the core RSS had a median of 949 MiB
    on `main`, while its live heap stayed between about 487 and 538 MiB.
  - The same sessions show the effect on one change. The branch built an idle
    step (H) that allocated 377 typed details on idle workers after the first
    ready Changes and kept them until the first edit, when a rebuild on
    another thread freed them. After the idle step, the core RSS of the branch
    settled about 37 MiB above `main`, and it stayed higher for all 10 edits:
    a median of 995 MiB against 949 MiB, and a maximum of 1,088 MiB against
    1,047 MiB. In that time, the live heap differed by only 4 to 9 MiB.
  - These facts fit freed pages that stay committed: the idle workers sleep
    after the step, so the blocks that another thread freed stay on their
    delayed free lists. No ablation has shown it yet.
  - The whole-tree memory checks of that pull request passed near the 2%
    limit, so retained pages decide whether a change of this kind fits. The
    item
    [changes-detail-revision-copies.md](./changes-detail-revision-copies.md)
    keeps H with option I as an open fix that depends on this item.
- **Problem:** The core keeps about as much freed memory resident as it keeps
  live data, and a change that allocates on one thread and frees on another
  can raise the resident memory of a whole session by tens of MiB with almost
  no live data.
- **Impact if no action:** Each Serve session keeps hundreds of MiB more
  resident memory than its live data needs, and changes like H stay near the
  2% memory limit.
- **Root question:** How much of the resident memory of the core is freed
  memory that the allocator keeps, and which allocator setting or call
  returns it without a cost in speed?
- **Options:**
  - **A.** Measure first, with no product change: the same cold sessions with
    `MIMALLOC_PURGE_DELAY=0`, and a probe build of the branch that calls
    `mi_collect(false)` on the idle-worker thread at the end of the idle
    step. Compare the core RSS with the live heap in each. Effort: Small.
  - **B.** Set the mimalloc options that return freed pages sooner, for the
    whole process, from the measured values of A, and check the speed rules
    of the performance orchestrator. Effort: Small.
  - **C.** Call `mi_collect` at the end of idle and background jobs that
    allocate on one thread and leave their data to another thread. Cost: it
    ties those jobs to one allocator. Effort: Small.
  - **D.** Change the allocator of the core, or its configuration, after a
    comparison of RSS and speed. Effort: Medium.
- **Left out:** Change nothing. It fails the goal, because the resident memory
  keeps limiting the memory budget of each speed change.
- **Wider fix:** None, because this is a memory opportunity, not a class of
  defect.
- **Previous examples:** None found.
- **Related:**
  [changes-detail-revision-copies.md](./changes-detail-revision-copies.md)
  holds H and option I, which wait for this item.
- **Recommendation:** A. It costs no product change and names the share of
  retained memory and the setting that returns it.
- **Action:** fix after merge, apply A, because the performance orchestrator
  measures allocator settings first, as it said on 2026-11-22.
