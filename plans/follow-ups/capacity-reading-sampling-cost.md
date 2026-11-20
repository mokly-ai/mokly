# Each capacity reading samples processes and cgroups again

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-11-20, from branch `calummoore/mokly-first-changes-4-busier-sidecars-3nds` (PR #408), during the worker-first investigation of warm restarts.
- **Location:** `crates/mokly-sidecar/src/pool_admission.rs:37` to line 106, `crates/mokly-sidecar/src/process_control.rs:44`, `crates/mokly-sidecar/src/process_memory.rs:71`, `crates/mokly-sidecar/src/memory_table.rs:19` and line 43, `crates/mokly-sidecar/src/process_worker.rs:49` and line 72, `crates/mokly-sidecar/src/host_memory.rs:51` and line 65, `crates/mokly-sidecar/src/cgroup_memory.rs:63`, `crates/mokly-sidecar/src/cgroup_discovery.rs:19` to line 46, `crates/mokly-sidecar/src/cgroup_level.rs:8`, `crates/mokly-cli/src/serve_gate.rs:101` to line 104, `crates/mokly-cli/src/serve_pool.rs:102`, `crates/mokly-cli/src/serve_delivery.rs:159`, and the batch and completion admission at `crates/mokly-server/src/background_admission.rs:37` (`Admission::acquire`) and `crates/mokly-server/src/background_stage.rs:75` (`Stages::acquire`).
- **Reason:** `main` and this branch share the sampler, and a change to it needs its own measurement and proof against the claim and sampling rules of `docs/protocol/mokly-sidecar-memory.md`, so it waits for its own change after this branch merges.

- **Source:** Implementation.
- **Category:** Performance.
- **Terms:**
  - **Capacity reading:** one call of `PoolCapacity::capacity` on a default sidecar pool. It gives the number of sidecars that memory permits now, under "Capacity" in `docs/protocol/mokly-sidecar-memory.md`.
  - **Claim:** the place that one sidecar call holds within the capacity, under "Claims" in the same page. `PoolCapacity::try_claim` grants it.
  - **Sample:** one measurement of the resident memory of a sidecar's process tree.
  - **Full discovery:** `SystemTable::discover`, which refreshes the whole host process list to find the descendants of a sidecar.
  - **Headroom:** the memory estimate of "Memory Estimate" in the same page: the host value, and on Linux the cgroup limits.
- **Background:**

  - Readers of the capacity:
    - The sidecar call admission of `mokly serve`, in `crates/mokly-cli/src/serve_gate.rs`, compares its active calls with `PoolCapacity::capacity` and then calls `PoolCapacity::try_claim`. So one admitted call reads the pool at least twice, and a waiting call reads it again after each wake. That admission holds its own state lock while it reads.
    - The background pass of Serve reads `UsageCapacity::capacity`, which reaches `PoolCapacity::capacity` through `PoolScheduling::limit`. On `main` at `78b08fdf8`, each view start read it. After the worker-first fix of this branch, the pass reads it only at each batch entry of a miss and each completion entry. A view that the render cache or the render store serves makes no batch or completion admission reading. A sidecar call of its link checks still passes the normal checks of the sidecar call admission, so that call reads the pool like any other call.
  - One reading runs `Pool::admission` under the pool lock:
    - For each reserved slot that is not free, it samples the sidecar through `resident_bytes`. The sample refreshes the known process tree.
    - Every 64 samples, it first runs a full discovery. A `processCss` request sets a discovery flag at `process_worker.rs:49`. Only the worker's own memory check clears it, at line 72. Until then, every admission sample of that sidecar also runs a full discovery.
    - It then reads the headroom: a sysinfo memory refresh of the host, and on Linux `/proc/self/cgroup`, `/proc/self/mountinfo`, `cgroup.controllers`, and the `memory.max`, `memory.high`, `memory.current`, and `memory.stat` files of each ancestor level.
    - A pool with no room left to grow, or a stopped pool, returns early without a sample. A pool with an explicit size from `--sidecars` or `MOKLY_SIDECARS` has no memory admission and samples nothing.
  - Profile of `main` at `78b08fdf8`, 2026-11-20. Frame-pointer release build, one unchanged warm restart, `perf record -g -a` at 999 Hz on all CPUs, 11,557 core samples. These counts are inclusive and overlap, so do not add them:

    | Frame                                                                                                | Samples |
    | ---------------------------------------------------------------------------------------------------- | ------: |
    | `UsagePass` window fill                                                                              |     454 |
    | The capacity chain inside it: `UsageCapacity::capacity`, `PoolCapacity::capacity`, `Pool::admission` |     429 |
    | `process_memory` `State::sample`                                                                     |     225 |
    | `CgroupMemory::headroom_bytes`                                                                       |     199 |
    | `SystemMemoryFiles::read`, inside the line above                                                     |     194 |
    | `SystemTable::discover`                                                                              |     169 |
    | `CachedDocuments::load` of stored documents, on the render workers, for comparison                   |     947 |

    On the dispatching task, the 429 samples amortize to about 0.29 ms of CPU for each of the 1,508 view starts. This is an average for each view start, not a measured CPU cost of one capacity call.

  - Earlier paired head windows, 2026-11-20. Same method, one warm restart per arm, `main` at `78b08fdf8` and this branch at `aa78c86a1`. A sampled run groups consecutive samples on one thread with gaps of at most 2.5 ms. Each run count is only a lower bound on calls:

    | Measure                                    | `main`            | `aa78c86a1`          |
    | ------------------------------------------ | ----------------- | -------------------- |
    | Capacity-chain samples of all core samples | 208 of 1,268      | 704 of 2,370         |
    | Sampled runs, all Tokio workers            | 102               | 260                  |
    | Run length, median and maximum             | 1 to 2 ms, 9.5 ms | 1 to 2.9 ms, 25.6 ms |
    | Capacity-chain span                        | 1.70 to 2.24 s    | 1.70 to 3.15 s       |

  - The hot leaves were the sysinfo process refresh with its `stat` file parsing under `SystemTable::discover`, and the kernel's `show_mountinfo` for `/proc/self/mountinfo`, with `lseek` and `read` on `/proc` files. The `aa78c86a1` arm ran more sidecars. The coordinator of the performance work read both more calls and a higher cost for each call into that.
  - The worker-first fix removes unnecessary readings, so it lowers the number of calls. It does not change the cost of one reading, which `main` pays too. On 2026-11-20 the coordinator of the performance work directed this work outside the worker-first change, unless a change is Small and exact. This branch kept it separate, because the worker-first fix removes unnecessary calls, while this sampler serves both `main` and this branch.
  - Rules that stay, from `docs/protocol/mokly-sidecar-memory.md`:
    - Each check reads the estimate again, and a denial applies only to its own check.
    - The capacity counts the reservations, the budgets that live claims hold, and the new reservations that fit now.
    - A grant needs fewer live claims than the capacity. Grants and admissions happen one at a time.
    - A sample measures only processes that the sidecar owns. Discovery runs at spawn, at the first sample after `processCss`, and every 64 samples.
    - The admission sum and its 1 GiB budgets and spare stay.

- **Task:** Lower the CPU cost of one capacity reading and one claim of a default pool. Every capacity, claim, sample, discovery, and budget result must stay what the current code gives.
  1. Measure on the merged tree first, with the method above, on a warm unchanged restart. Record the readings for each view and each call. Split the chain into process samples, full discoveries, the host refresh, and the cgroup reads. Also measure the cost of one reading and one claim at fixed call counts and fixed pool states: a pool with no reserved slot, a partly grown pool, and a full pool.
  2. Choose only changes that keep each result exact. Each candidate below has its proof obligation. None is chosen yet:
     - Read the headroom before the samples. When one more reservation cannot fit even with zero unused budgets, growth is zero whatever the sidecars use, so the samples cannot change the result. Prove that `Pool::admission` gives the same result with and without the skip for every state. Keep the samples that discovery and recycling need.
     - Refresh only the processes that can belong to a sidecar tree, instead of the whole host list. Prove that no descendant that the full discovery finds is missed, on Linux, macOS, and Windows.
     - Clear the discovery flag after the first admission sample that discovers, not only at the worker's own check. Prove that the rule "the first sample after `processCss`" still holds.
     - Reuse the cgroup location and its controller paths between readings, instead of reading `/proc/self/cgroup` and `/proc/self/mountinfo` each time. The coordinator of the performance work named this reuse as a candidate. The process can move to another cgroup, and mounts can change while Serve runs. Prove that the reuse detects each such change before the next reading uses a kept location, and that each reading still reads the current limit and usage files.
  3. A change that keeps every rule above needs no decision. This includes a reuse of the cgroup location that meets its proof. A capacity value cached across readings, a weaker claim, a skipped descendant discovery, or a changed admission sum changes a rule above, so it needs a decision first.
- **Impact if no action:** Each capacity reading and each claim keeps sampling every sidecar and reading the cgroup files. On the warm restart of `main`, that cost amortized to about 0.29 ms of CPU for each view start. Runs of up to 25.6 ms appeared with more sidecars. The pool lock, and in `mokly serve` the state lock of the sidecar call admission, are held while the samples run, so the cost can also delay other calls. `main` and this branch pay it on every sampled reading.
- **Needs:** This branch merged. A Linux host with `perf` for the profiles.
- **Done when:**
  - One reading and one claim cost less than before, measured at matched call counts and in matched pool states, a partly grown pool included.
  - A profile with the method above records the capacity-chain share of the same warm restart. A lower share alone proves no lower cost for each call, because a warm pass after the worker-first fix can make few calls.
  - Tests in `crates/mokly-sidecar` show unchanged capacity, claim, sample, discovery, and budget results.
  - `docs/protocol/mokly-sidecar-memory.md` needs no change, or a decision approves its change.
