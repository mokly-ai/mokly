# Measure idle sidecar child retention

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-11-18, at the performance orchestrator's request during the sidecar memory-guard work.
- **Location:** `crates/mokly-sidecar/src/pool_affinity.rs`, `pool_sources.rs`, `pool_releases.rs`, and `pool_return.rs`.
- **Reason:** Releasing idle children changes the loaded-state and speed trade-off, so it needs a separate design and measurement.

- **Terms:**
  - **Sidecar subtree:** A sidecar process and its PostCSS Node and esbuild children.
  - **Source root:** The current catalogue directory or its extracted comparison base.
- **Background:** A sidecar can keep rich PostCSS and esbuild children while it is idle. Another source root can have its own child subtree at the same time. Default memory admission budgets each sidecar and its Node children, but does not retire idle workers.

  Release Serve measurements used a four-vCPU, eight-GiB Linux machine. Each source had one start, one heading edit, and restoration. Main was `2e6bde9c296e8bd12c16edeb2c23fbd2309b010b`. The memory branch was `7c90446a970b6d19f188b965c1c599b67374e0ed`. The following values are KiB at each run's whole-tree peak sample. They are not sums of independent category maxima.

  | Component             |      Main | Memory branch | Reduction |
  | --------------------- | --------: | ------------: | --------: |
  | Core                  |   635,816 |       628,924 |     6,892 |
  | Direct sidecars       | 1,072,684 |       973,000 |    99,684 |
  | PostCSS Node children |   405,004 |       195,828 |   209,176 |
  | esbuild               |   378,128 |       190,412 |   187,716 |
  | Whole tree            | 2,491,632 |     1,988,164 |   503,468 |

  Both basic runs reached four workers and recorded zero recycle stops. Child processes account for 78.8% of the difference. Main retained its initial rich bundle subtree while the later base subtree existed. The branch replaced its initial rich subtree at its first root switch. The initial main subtree held 717,840 KiB, including 381,784 KiB in children. Later bundle subtrees differed by only 2,080 KiB at these samples.

  Different final-render completion orders fit these choices. Pool release appends an idle slot to the queue. Cross-root fallback takes the first eligible idle slot, subject to the warm-head rule. Generation ranking applies within one root. The measurements did not record the exact available queue or prove that memory admission caused the different completion order.

  Stop order, recycling thresholds, and loaded-state rules were unchanged. Root switches already signalled the old process tree before spawning its replacement. Head return already killed and finished its old process before replacement. The memory change added no wait for old RSS to fall.

  The local React peak decreased only 19,556 KiB. HTML, with no sidecar, increased 20,228 KiB. Independent `mokly-cloud` measurements kept four workers and similar Changes times. Their whole-tree peak fell from 2,798 to 2,389 MiB, but the remote sampler kept no per-process or lifecycle records. That remote difference has no established cause. A lower peak is not a product rule.

- **Task:** Measure the memory retained by idle child subtrees and the cost of releasing and restoring them. Decide whether to release idle PostCSS or esbuild children. Compare that choice with leaving useful state warm and choosing replacement slots by loaded state. Keep exact sidecar overrides, the default admission budget, foreground priority, and healthy edit speed.
- **Impact if no action:** Rich idle children can remain resident beside another root's children. Queue completion order can change the process-tree peak without changing the worker count.
- **Needs:** Nothing. Inspect `docs/protocol/mokly-sidecar-memory.md` for admission and recycling. Inspect `docs/protocol/mokly-sidecar-root-scheduling.md` for root and generation selection.
- **Done when:** A separate design records the memory and speed trade-offs with process snapshots and lifecycle events. The owner chooses a policy before product behavior changes. Any chosen change includes its behavior tests and before/after measurements.
- **Related:** [sidecar-loaded-state-selection.md](./sidecar-loaded-state-selection.md) addresses the useful state that cross-root replacement destroys. Design both policies together.
