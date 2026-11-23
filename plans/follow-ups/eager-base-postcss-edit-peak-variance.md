# Eager four-sidecar PostCSS edits sometimes peak higher

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Post-merge task.
- **Category:** Performance.
- **Owner:** Cal (@calummoore).
- **Added:** 2026-11-21, from the branch
  `calummoore/mokly-eager-base-preparation-5dkn` at `0db837069`, PR #461,
  after the user accepted decision 4B of its plan, the small-pool serial rule,
  as measured and asked for this item.
- **Location:** None for the analysis, because no record locates a cause in
  the code. The analysis reads these files:
  - `examples/basic/mokly.config.json:8`, which names PostCSS.
  - `crates/mokly-cli/src/serve_eager.rs:79`, the configured-size rule.
  - `crates/mokly-cli/src/serve_pool.rs:98`, which makes the eager pool view.
  - `crates/mokly-sidecar/src/pool_eager.rs:11`, where an eager call reserves
    an empty or base-root slot with its claim.
  - `crates/mokly-sidecar/src/pool_head.rs:15` to line 19, the warm head
    marker.
  - `packages/mokly/src/sidecar/postcss-worker.ts`, the PostCSS child.
  - The Start section of `docs/protocol/mokly-eager-base-preparation.md`, and
    `docs/protocol/mokly-sidecar-memory.md`.
- **Reason:** On 2026-11-21 the user accepted the small-pool serial rule as
  measured, so this analysis of the remaining spread does not block the eager
  base preparation pull request.

- **Terms:**
  - **Basic-four session:** A clean, cold Serve session of the example
    catalogue under `examples/basic`, with an explicit sidecar size of four,
    five edits, and five restores.
  - **Sidecar subtree:** A sidecar Node process with its esbuild service and
    its PostCSS Node children.
  - **Session peak:** The last value of the cumulative peak memory counter of
    the cgroup that holds the whole Serve process tree of one session.
  - **Paired delta:** The session peak of the candidate minus the session peak
    of main, in one pair of alternating sessions.
  - **Core time:** A time in the event log of the Rust `mokly` core, counted
    from the start of its session.
- **Background:**
  - Serve compares the working catalogue, the head, with the catalogue at the
    merge-base commit, the base. Eager base preparation starts some base work
    before the head usage pass ends. Its contract is
    `docs/protocol/mokly-eager-base-preparation.md`.
  - The head usage pass renders every head view after readiness. Its event
    stage is `serve.background`. Base validation has the event stage
    `catalogue.validate`, and it includes the base bundle.
  - The accepted Ready-only policy holds for eager work:
    - A cold start finds no complete base extraction to lease. Its base
      discovery and extraction wait for the first readiness of Serve.
    - Base validation waits for the completed head preparation and any watch
      recheck.
    - Base capture, comparison, and publication wait for the complete head
      usage pass.
  - The small-pool serial rule is in force. The performance orchestrator
    selected it on 2026-11-21, and the user accepted it as measured on
    2026-11-21:
    - A configured sidecar size below three uses serial base preparation after
      the head usage pass.
    - A size of three or more keeps the Ready-only eager work.
    - `crates/mokly-cli/src/serve_eager.rs:79` holds the rule.
  - The basic catalogue names a renderer and `postcss.config.mjs` in
    `examples/basic/mokly.config.json`. So its sidecars run PostCSS Node
    children and esbuild services.
  - The measured candidate is production commit
    `487601e1e227982c3cfe6dd78c984ace2f58e8b0`, which applies the rule. The
    control is main `793d0c77d1b096eb988e681963be4bca7a8df353`. The branch head
    `0db837069` adds only a regression test for the handoff of a reserved
    claim. It keeps every production Rust byte unchanged.
  - The warm basic results and the cloud catalogue results passed. These stay
    unchanged: the visible output bytes, the statuses and their order, the
    warnings, the progress, cancellation, the lifetime of the kept base, the
    shared selected maximum of the pool, and the ordinary lifetime of head
    processes.
  - The first check of `487601e1e` passed basic with two sidecars and the cloud
    catalogue with four. Its four cold basic-four pairs had edits within the
    control bounds, but their memory exceeded the 2% bound:
    - The paired deltas were +291, +68, +187, and +6 MiB.
    - The mean paired delta was +138 MiB, or +4.91%.
    - Later gates overwrote their event logs. Only their summaries remain, so
      they cannot give phase timing.
  - Before the repeat, the performance orchestrator set its rule. Accept the
    small-pool serial rule with no further bound when the mean paired delta of
    the eight repeat pairs is at most 2%.
  - The repeat ran eight alternating pairs, so sixteen basic-four sessions.
    Both arms used the same stored release toolchains. The pair numbers follow
    the order of the record.

    | Pair | Main, MiB | Candidate, MiB | Paired delta, MiB |
    | ---- | --------: | -------------: | ----------------: |
    | 1    |     2,843 |          2,811 |               -32 |
    | 2    |     2,689 |          2,730 |               +41 |
    | 3    |     2,682 |          2,686 |                +4 |
    | 4    |     2,698 |          2,725 |               +27 |
    | 5    |     2,708 |          2,648 |               -60 |
    | 6    |     2,610 |          2,782 |              +172 |
    | 7    |     2,720 |          2,739 |               +19 |
    | 8    |     2,684 |          2,693 |                +9 |
    | Mean |  2,704.25 |       2,726.75 |             +22.5 |

  - The mean paired delta of the repeat was +22.5 MiB, or +0.83%. The median
    was +14 MiB. So the repeat passes its rule.
  - The twelve pairs of both checks together give a mean paired delta of
    +61 MiB, or +2.2%, and a median of +23 MiB, or +0.84%. That pooled mean is
    above 2%, so it does not pass a 2% bound. The acceptance rule used only the
    eight repeat pairs.
  - The trace of all sixteen repeat sessions shows these facts:
    - In both arms, the final session peak first appears at a core time of
      about 22 s to 27 s, during the edits.
    - At that time, both arms show the same sampled process count and set: six
      Node processes, two esbuild services, and the core.
    - Do not read the six Node processes as six pool slots. An explicit size
      of four allows at most four sidecars.
    - In every candidate session, base `catalogue.validate` starts after the
      head `serve.background` stage ends. In two examples, the head stage ended
      at 7,158 ms and 7,805 ms, and base validation started at 7,233 ms and
      7,994 ms.
    - The highest paired delta, +172 MiB in pair 6, carries about +146 MiB of
      extra sidecar RSS at the peak. The candidate has no extra process there.
    - No cause is established.
  - The records have these limits:
    - The cgroup peak counter is cumulative. It shows the first sample at the
      final value, not the instant of the maximum.
    - Samples came every 0.25 s. The process RSS reads are not atomic with the
      cgroup read or with each other.
    - So an analysis can give time bounds, not the exact instant of the
      maximum.
  - The machine of the performance orchestrator keeps the records of the
    repeat. They are the `runs/w201t-*.procs` process series, the `*.cgseries`
    cgroup series, and the `*.serve.log.gz` Serve logs. The full event logs are
    in unique gate directories.
  - A separate local diagnostic on 2026-11-21 ran one frozen cold pair. It is a
    single pair, not acceptance evidence:
    - The session peaks were 2,812.7734 MiB on main and 2,822.0391 MiB on the
      candidate, +0.3294%.
    - Both peaks came in edit 5.
    - In both arms, the head sidecar that ran the startup bundle and its
      esbuild service lived until the peak.
    - In the candidate, base source extraction ended at 10,466 ms, after the
      head usage pass ended at 10,414 ms. The base graph reached admission
      only after 10,591 ms.
  - An audit on 2026-11-21 found that the surviving startup process is an
    ordinary head sidecar with its esbuild service. Ordinary pool slots and
    controls own it. `WarmHead.control` at
    `crates/mokly-sidecar/src/pool_head.rs:18` is a weak reference. No
    eager-only owner was found. So the performance orchestrator requested no
    release of that process and no process-count regression test.
  - The confidence grade High covers the observed spread of the paired deltas.
    It does not cover any cause.
- **Task:**
  1. Collect the retained records of the sixteen repeat sessions. Map each
     record to its pair and its arm.
  2. For each session, bound the time of the session peak. Give the last
     cgroup sample below the final value and the first sample at that value.
  3. Name the edit or the restore, and the event stages, that run inside each
     bound.
  4. At the process samples nearest each bound, give the RSS of the core and of
     each sidecar subtree. Split each subtree into its sidecar, its PostCSS
     children, and its esbuild service. Give the source root and the role of
     each sidecar when the records show them.
  5. Compare the positive pairs, mainly +172, +41, and +27 MiB, with the
     negative pairs, -60 and -32 MiB. Look for a stage order, an edit timing, a
     slot root history, or a subtree RSS that follows the sign of the delta.
  6. In pair 6, find the subtree or subtrees that hold the about +146 MiB of
     extra sidecar RSS. Say from which edit or restore they hold it.
  7. Report an attribution with its evidence. Or say that the cause stays
     unknown, and say what the records cannot show.
  8. Propose a measured bound only when the evidence supports one. Give it to
     the owner as a new decision, with options and a measurement plan. The plan
     states its acceptance rule before any run.
  9. Keep these rules:
     - Do not assert any of these without new evidence: an early base PostCSS
       overlap with the head usage pass, a leak, a garbage collection cause, an
       eager-only owner of a process, or a fix by a hold of cold PostCSS base
       validation until adoption.
     - Use the earlier four pairs only as summary context.
     - Report time bounds, not an exact instant of the maximum.
     - Do not choose a resource lifetime change or a protocol rule in this
       task. Change no product code, test, or protocol doc.
     - A proposed bound keeps every unchanged behaviour that the Background
       lists. It also keeps the warm basic path and the cloud first-Changes
       gain.
- **Impact if no action:** Some cold edit sessions of a PostCSS catalogue with
  four sidecars can keep a higher peak than main. The highest paired delta was
  +172 MiB in the repeat and +291 MiB in the earlier pairs. The mean of the
  repeat stays within its 2% rule. Without an attribution, nobody can size a
  bound or tell whether a later change adds to the spread or removes it.
- **Needs:**
  - The retained records of the sixteen repeat sessions on the machine of the
    performance orchestrator, with the pair and the arm of each record.
  - No build, no code change, and no new measurement for the analysis.
  - When records are unavailable, report the missing evidence. Define the
    timing, process-root, RSS, and cgroup samples that a replacement
    observation needs. Keep the recorded source and toolchain identities
    with that proposal.
- **Done when:**
  - A report gives, for each of the sixteen sessions, the time bounds of the
    session peak, the edit or restore and the stages inside them, and the RSS
    of the core and of each sidecar subtree at the nearest samples.
  - The report compares the positive and the negative pairs. It gives an
    attribution with evidence, or it says that the cause stays unknown, with
    the limits of the records.
  - When the evidence supports a bound, the owner has it as a new decision
    with a measurement plan. Otherwise the report says that it proposes no
    bound.
  - The owner has every sample that the report uses.
- **Related:**
  - [sidecar-idle-child-retention.md](./sidecar-idle-child-retention.md):
    idle PostCSS and esbuild children can stay resident, and queue completion
    order can change the process-tree peak at the same worker count. That item
    chooses a release policy. This item asks why some eager edit peaks are
    higher at the same process set. It must not assume that mechanism, but its
    result can inform that design.
  - [esbuild-memory-after-bundle.md](./esbuild-memory-after-bundle.md): an
    esbuild service can stay resident after a bundle. Both arms here hold
    two esbuild services at the peak. This item does not choose that fix.
  - [eager-base-competes-with-head-usage.md](./eager-base-competes-with-head-usage.md):
    the CPU contention of eager base work with the head usage pass on large
    catalogues. Here, candidate base validation starts after that pass, and
    the peak comes in the edits. Neither result answers the other.
  - [cold-start-base-overlap-memory.md](./cold-start-base-overlap-memory.md):
    the memory of base work beside startup usage in a closed experiment. Its
    diagnostic option asks when added demand peaks. This item asks that for
    the accepted policy on the basic catalogue. Neither result answers the
    other.
