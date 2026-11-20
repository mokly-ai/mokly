# Candidate collector leaves the head little room

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-11-20, from option B of the performance orchestrator's calls of 2026-11-19 on collector overflow, on branch `calummoore/mokly-plan-reuse-editor-files-2-4oor`. That branch continues `calummoore/mokly-plan-reuse-editor-files-6dni`.
- **Location:** `packages/mokly/src/sidecar/plan-candidates.ts`, class `PlanCandidates`; `packages/mokly/src/sidecar/plan-candidate-directories.ts`, function `candidateDirectories`; `packages/mokly/src/sidecar/native-plan.ts`, the `selected` call in `planNative`.
- **Reason:** The performance orchestrator moved this work out of the branch on 2026-11-19, because it is not Small and nobody measured its gain.

- **Terms:**
  - **Collector:** `PlanCandidates`, which collects the plan-only candidate names of a captured compile under a charge budget of 8,388,608 bytes.
  - **Attachment:** `candidateDirectories`, which turns the collected names into candidate rows of the plan after the compile. It has a merge loop, a selected-target loop, and a listing loop.
  - **Pair bound:** the 8 MiB bound of one plan and its reuse evidence together.
- **Background:**
  - A Serve edit can reuse the native import plan of a captured compile. Candidate names let the plan survive an unrelated new file, such as an editor swap file, in a recorded directory.
  - The performance orchestrator measured commit `d1a000b03` on the mokly-cloud catalogue on 2026-11-19, with an instrumented dist:
    - Head: the collector held 3,881,886 B before attachment and 7,947,986 B after, 94.7% of the budget. 6,611 lexical directories, 161,764 names, and 4,424 selected targets.
    - Head record: 3,965,184 B of evidence and a 2,382,445 B plan with names, a 6,347,629 B pair. The margin under 8 MiB is 1.95 MiB.
    - Base: the collector held 4,412,575 B before attachment and reached 8,388,602 B with an overflow. 7,510 lexical directories, 181,096 names, and 4,424 selected targets.
    - Base record: 4,869,857 B of evidence and no plan, because the overflow dropped the plan.
  - The calls of 2026-11-19 set these overflow rules:
    - A collector or attachment overflow keeps the plan without candidate names and with its original paths.
    - A plan whose names fail the pair bound loses the names and their added path rows, and the capture counts it again.
    - Attachment skips canonical directories that the evidence does not list. A compile that fits keeps the same plan bytes.
    - Names for only the directories that attachment finished before an overflow were rejected, because that coverage follows the sorted path order, which users cannot predict.
  - The performance orchestrator expects the base to keep a plan without names of about 4.87 + 1.39 = 6.26 MB after these rules. Nobody has measured it.
  - The head must keep candidate names with at least 1 MiB under both record bounds. The base may keep a plan without names, with at least 1 MiB under both bounds. For the base, the pair and the kept record that it actually retains must each leave at least 1 MiB spare. No capture strips names at run time to create that margin.
  - Option B of 2026-11-19 asked for a cheaper collector, so that the real head keeps at least 1 MiB of collector room and larger catalogues keep their names. Its examples: no charge for a listing entry that is only iterated, and selected targets stored as plan path positions instead of absolute strings.
  - A fresh Opus options check of 2026-11-19 read the source and found these limits:
    - The charge counts JSON bytes plus 1 to 9 container bytes per entry, and it undercounts heap. So a change can remove a charge only with its allocation.
    - Path positions for selected targets change the `selected` call in `planNative`, the collector, and the selected-target loop. A native target keeps its own string when its metafile path differs from its table path.
    - Each listing's `seen` set dies after its directory, but its charge stays. So that charge grows with all listings together.
    - The merge loop charges each collected directory and name a second time. The check estimated 3.0 to 3.4 MB of the head's 4,066,100 B attachment charge for it. This is an estimate, not a measurement.
    - More base names add base record bytes, so each capacity change needs a base record measurement.
    - The check estimated that about 22 more bytes of repository root path could cost the head its names before the unlisted-directory skip. This is also an estimate.
  - A fresh Opus options check of 2026-11-20 named two more alternatives. Each has Medium effort and must be measured before a choice:
    - Dependency names first: at each overflow, the collector frees the names of dependency directories first, marks those directories for whole comparison, and continues. A plan without names applies only when the project directories alone overflow. The order is predictable, and it keeps the measured editor case. It departs from the call of 2026-11-19 against partial names, so it needs a new user call. Its value depends on the measurements of this item. A linked workspace package that the capture reaches through `node_modules` loses its names with the dependencies.
    - Fixed names left out: the seven fixed names leave each collected and stored set, and the Rust plan check adds them back to each directory with names. The check computed 6,611 × 7 = 46,277 fixed names among the 161,764 collected head names of `d1a000b03`, before the merge copies them again. The stored names change meaning, so the Rust check, the protocol wording, and the cache payload version change.
- **Task:**
  1. Build the latest `main` after the change that added this item merges. Use its matching sidecar dist and an instrumented copy that logs the collector charges.
  2. On the mokly-cloud head and base, measure these four values:
     - the merge charge for listed directories and for unlisted directories
     - the listing loop's `seen` charge
     - the selected-target charge
     - the base pair size with names
  3. Measure the dependency-names-first and fixed-names-left-out alternatives with the same instrumented copy. Ask the user before dependency names first, because it departs from the call against partial names.
  4. Give the values to the performance orchestrator. Choose each charge reduction by its measured gain, with its call.
  5. Implement the chosen reductions. Remove each charge only with its allocation. Keep exact plans, both 8 MiB record bounds, the collector budget, the disk rules, and no edit capture. Add a test for each changed charge.
  6. Measure the head and base collector peaks and both record pairs again.
- **Impact if no action:** The historical measurement of `d1a000b03`, before the unlisted-directory skip, put the real head at 94.7% of its collector budget. The head peak after that skip waits for the performance orchestrator's measurement. If the room stays small, a larger catalogue or a longer checkout path keeps its plan but loses its names, so editor files defeat plan reuse again.
- **Needs:** A build of the latest `main` with the matching sidecar dist, an instrumented copy of the dist, the mokly-cloud catalogue of the root `mokly.config.json`, and a machine with no other heavy job.
- **Done when:**
  - The four values are recorded for the head and the base.
  - The real head keeps candidate names with at least 1 MiB of collector room, or the performance orchestrator records why it needs no change.
  - The plan exactness tests and both record bounds still pass.
