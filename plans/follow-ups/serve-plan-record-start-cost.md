# Measure and reduce the plan record start cost

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-11-18, from the performance orchestrator's acceptance of
  implementation `efb17e824`, on branch
  `calummoore/mokly-sidecar-plan-reuse-srh7`. Updated 2026-11-18 on branch
  `calummoore/mokly-plan-reuse-editor-files-6dni`, which took over the
  importer and target table encoding.
- **Location:** `packages/mokly/src/sidecar/captured-plan.ts:7`,
  `packages/mokly/src/sidecar/recipe-size.ts:7` to line 31,
  `packages/mokly/src/sidecar/transport.ts:39`,
  `crates/mokly-sidecar/src/resolution_plan.rs:62` to line 128,
  `crates/mokly-sidecar/src/compiled.rs:72` to line 83,
  `crates/mokly-sidecar/src/durable_recipe.rs:18`,
  `crates/mokly-sidecar/src/pool_bundle_cache.rs:86`, line 128, and line
  139, `crates/mokly-compare/src/bundle_codec.rs:51` to line 57,
  `crates/mokly-compare/src/bundle_codec_write.rs:18` to line 24,
  `crates/mokly-compare/src/bundle_codec_read.rs:100`,
  `crates/mokly-compare/src/bundle_store.rs:147` to line 149,
  `crates/mokly-render/src/edit_plans.rs:60`,
  `crates/mokly-render/src/bundle_attempt.rs:51`, and
  `crates/mokly-render/src/side.rs:85` to line 97.
- **Reason:** The performance orchestrator accepted this start cost on
  2026-11-18, because a Serve session makes many edits per start.

- **Terms:**
  - **Plan record:** the native import plan of one captured compile, paired
    with the reuse evidence of that compile.
    `docs/protocol/mokly-sidecar-plans.md` holds its rules.
  - **Captured compile:** a `bundle` request in the `full` capture mode. A
    Serve edit uses the `serveEdit` mode, which captures and stores nothing.
  - **Warm start:** a Serve start whose head and base bundles hit the bundle
    cache, the OS cache of compiled bundles in `crates/mokly-compare`.
  - **Dirty restart:** a Serve restart after unreverted edits. It restores
    the stale head entry, the sidecar rejects it, and the head compiles.
  - **Path table:** the plan encoding that lists each path once and refers
    to it by position. The section "Plan Format" of
    `docs/protocol/mokly-sidecar-plans.md` defines it.
- **Background:**
  - The plan reuse change, commit `efb17e824`, lets a Serve edit skip the
    native esbuild attempt when a Rust check proves its plan record current.
  - Since that change, the plan crosses or is counted at these places. Each
    one is a source fact, and nobody timed it on its own:
    - `capturedPlan` at `packages/mokly/src/sidecar/captured-plan.ts:7`
      counts the plan and the evidence against 8 MiB. It serializes the
      whole evidence once to count it.
    - `recipeBytes` at `packages/mokly/src/sidecar/recipe-size.ts:7`
      serializes the compiled payload and module graph once. It sizes the
      response and restore envelopes, with the plan only in the response.
      `checkRecipeSize` at line 22 drops the plan first at line 29 when the
      result does not fit.
    - The transport writes each response through `jsonText` at
      `packages/mokly/src/sidecar/transport.ts:39`. `jsonText` sorts the keys
      of every object, also each object of the plan.
    - The core decodes the whole plan as `ResolutionPlan` at
      `crates/mokly-sidecar/src/resolution_plan.rs:82`, with its path table
      and its candidate names.
    - `DurableRecipe::with_plan` at
      `crates/mokly-sidecar/src/durable_recipe.rs:18` serializes the plan and
      the evidence again to count them. It runs for each offer with a plan,
      at `crates/mokly-sidecar/src/pool_bundle_cache.rs:139`, and for each
      read of an entry with a plan, at
      `crates/mokly-compare/src/bundle_codec_read.rs:100`.
    - The offer count runs before the receipt check that ends an unchanged
      write, at `crates/mokly-compare/src/bundle_store.rs:147` to line 149.
      So a warm hit pays it too.
    - `Codec::encode` at `crates/mokly-compare/src/bundle_codec_write.rs:18`
      writes the plan into the entry payload. The payload digest covers the
      plan bytes on each write and on each hit. When the first encode does
      not fit a limit, it encodes the entry again without the plan.
    - The entry decode reads `StoredGeneration` at
      `crates/mokly-compare/src/bundle_codec.rs:51` to line 57. Its `restore`
      field uses `#[serde(flatten)]`. So serde first collects every field
      except `plan` into a buffered value tree, and then decodes
      `RestoreGeneration` from that tree. This happens on each bundle hit,
      also for an entry without a plan. Before the change, the payload
      decoded `RestoreGeneration` directly.
    - A disk hit decodes the stored plan with the payload. The pool keeps
      the plan beside the restored seed, at `pool_bundle_cache.rs:86`, and
      adds it to an accepted result at line 128.
    - `Records::insert` at `crates/mokly-render/src/edit_plans.rs:60`
      serializes the resolution settings, the plan, and the evidence again to
      count them, under the records mutex. Only the Serve head core calls it,
      from `crates/mokly-render/src/bundle_attempt.rs:51`.
    - The base side, `build`, and `publish` also make captured compiles.
      Their results also carry plans, and their bundle cache entries store
      them. No base runtime sends a saved plan with an edit request.
  - On 2026-11-18, before the path table and candidate names, a probe
    extracted plan and evidence pairs together from actual stored captures.
    It checked their payload digests:
    - `examples/basic`: 5,137 planned imports and 14,764 evidence inputs. The
      plan has 1,915,608 bytes, and the evidence 2,864,817 bytes. The
      retained entry, with settings that have no evaluation digest, has
      4,785,325 bytes. That leaves 3,603,283 bytes under 8 MiB.
    - The default large React fixture of `scripts/large`, with 30 areas, 40
      screens, and 12 rows: 4,247 planned imports and 11,743 evidence inputs.
      The plan has 1,638,752 bytes, and the evidence 2,391,424 bytes. The
      retained entry has 4,032,110 bytes. That leaves 4,356,498 bytes under
      8 MiB.
    - So the evidence is about 60% of the retained `examples/basic` entry.
    - A synthetic plan of 15,251 imports, built from real Babel and PostCSS
      import paths, had 3,907,733 bytes. It is not an actual mokly-cloud
      plan.
    - Later on 2026-11-18, also before the path table, the performance
      orchestrator measured the actual mokly-cloud head and base:
      - Head: 13,057 planned imports and 22,927 evidence inputs. The plan
        has 4,137,612 bytes, and the evidence 3,965,184 bytes. The pair has
        8,102,796 bytes, which leaves 285,812 bytes under 8 MiB.
      - Base: no plan, and 26,455 evidence inputs. The evidence has
        4,869,857 bytes.
      - The whole head recipe has 14,177,681 bytes, and the whole base
        recipe 11,103,681 bytes.
  - Later on 2026-11-18, the performance orchestrator measured a path-table
    checkpoint at `8d530bc6747fb84cf3a24c839d0f3e7b4fe3b1ab`. It ran a strict
    mokly-cloud build with `--base HEAD`, from an empty bundle cache, with
    the matching core and sidecar dist. This checkpoint has no
    candidate names:
    - Head: 13,057 planned imports, 4,438 paths, and 22,927 evidence inputs.
      The import entries use 792,117 bytes, and the paths use 529,929 bytes.
      The plan has 1,322,067 bytes, and the evidence 3,965,184 bytes. Their
      sum is 5,287,251 bytes, with 3,101,357 bytes under 8 MiB. The whole
      head recipe has 11,362,136 bytes.
    - Base: the plan has 1,384,347 bytes, and its 26,455 evidence inputs use
      4,869,857 bytes. Their sum is 6,254,204 bytes, with 2,134,404 bytes
      under 8 MiB.
    - These pair values and the earlier mokly-cloud pair value count
      `planBytes + evidenceBytes`. The Rust `[plan,evidence]` pair adds
      three bytes. The checkpoint Rust pairs are therefore 5,287,254 head
      bytes and 6,254,207 base bytes.
    - No retained-entry size was supplied for this checkpoint. Its values
      prove path-table capacity only. They prove no final candidate-name
      size, final edit speed, or current start cost.
    - The performance orchestrator required the final head and base pairs
      and retained entries to leave at least 1,048,576 bytes under 8 MiB.
      Final measurements must count candidate names and retained resolution
      settings. No final candidate-name measurement is available here.
  - The performance orchestrator measured the change on the mokly-cloud
    catalogue on 2026-11-18:
    - It used 4 vCPUs, pool size 4, and `--base HEAD`.
    - Three interleaved rounds ran after one priming run. Each run made a
      strict build, then three JavaScript edits at line 35 during Serve,
      with whole-tree RSS. Then it made a dirty restart without a reset.
    - It compared `main` at `2e6bde9c2` with the change at `efb17e824`. Each
      side used its own release core and its matching sidecar dist.
  - The results, `main` first and the change second:
    - Edit to Changes ready, nine edits each: 4.18 s and 3.13 s.
    - esbuild compiles in each run of three edits: 6 and 3.
    - Warm serve.ready: 1.69 s and 1.86 s.
    - Warm first Changes: 12.5 s and 12.9 s.
    - Strict build: 19.0 s and 19.7 s.
    - Dirty restart serve.ready: 3.70 s and 4.14 s.
    - Dirty restart first Changes: 14.8 s and 15.2 s.
    - Whole-tree peak, core plus sidecars plus esbuild: 3,045 MiB and
      2,889 MiB.
    - Core peak: 887 MiB and 884 MiB.
    - Most sidecars: 4 and 4.
  - The performance orchestrator accepted the change on 2026-11-18, under
    the user's delegation of 2026-11-16. Each edit became 1.05 s faster, a
    25% reduction, with one esbuild attempt and no memory rise. It accepted
    the start cost, because a session has many edits per start. It required
    this follow-up, including a smaller importer and target table encoding.
  - Suspected cause, not isolated: the encoding, the storage, and the
    restore of the larger recipe with its plan.
  - Every change keeps these requirements:
    - A compile with a plan gives the result or the error of the same
      request without a plan, apart from the fresh edit identity. So the
      output and the recorded inputs stay equal. See the section "Edit
      Requests" of `docs/protocol/mokly-sidecar-plans.md`.
    - Only complete, durable, and current evidence permits a plan, in the
      sections "Plan Records", "Kept Records", and "Edit Requests" of that
      page.
    - A Serve edit captures nothing and stores nothing, in the section
      "Capture Modes" of `docs/protocol/mokly-sidecar-recipes.md`. It keeps
      no record, in the section "Kept Records" of
      `docs/protocol/mokly-sidecar-plans.md`.
    - The plan is not a bundle setting and changes no compilation identity.
      An edit with a current plan makes one esbuild call. Plan reuse adds no
      setting, gate, retry, or process. The section "Edit Requests" states
      these rules.
    - One record holds at most 8 MiB of plan and evidence, in the section
      "Plan Records". That section also rejects a separate 8 MiB plan
      allowance. The kept records hold at most 8 MiB in total, resolution
      settings included, in the section "Kept Records".
    - The plan lists each path once in its path table and carries the
      candidate names of its recorded directories. Both count inside both
      8 MiB bounds. The sections "Plan Format" and "Candidate Names" state
      these rules.
    - The plan stays beside `compiled` on the wire and on disk, and
      `restoreGeneration` carries no plan. The section "Plan Records" states
      both rules.
    - The plan stays a typed boundary type. The `shared-types` skill forbids
      untyped JSON in a boundary type.
    - The disk rules of `docs/protocol/mokly-base-cache.md` stay. Only
      complete and stable evidence reaches the disk. The payload, receipt,
      fault, and lock rules keep their meaning.
    - The bundle cache write stays inside the bundle response, as a review
      of 2026-11-18 decided. `plans/follow-ups/bundle-cache-request-cost.md`
      holds the option that moves it.
    - The 64 MiB frame limit of the section "Transport" in
      `docs/protocol/mokly-sidecar.md` stays. The 512 MiB bundle namespace
      of the section "Budgets" in `docs/protocol/mokly-timings.md`
      stays.
  - The table encoding left this item on 2026-11-18:
    - The performance orchestrator moved it to the exact Serve plan change of
      branch `calummoore/mokly-plan-reuse-editor-files-6dni`. That change
      adds candidate names to the plan, and the names need room inside both
      8 MiB bounds on mokly-cloud.
    - That change stores each plan path once, in the path table. It moves the
      plan wire type, its generated TypeScript type, the core record, and the
      entry payload, and it keeps both 8 MiB bounds.
    - So this item no longer builds or measures a table encoding. Its stage
      profile measures the plan in the path table form, with its candidate
      names.
    - The path table does not shrink the evidence. So each counting pass
      keeps the evidence part of its work.
  - The source suggests these other candidates. Nobody measured any of them:
    - Count each plan and evidence pair once in Rust. Keep the count with the
      shared record, so that the offer and `Records::insert` reuse it. The
      wire and entry formats stay, so it needs no contract decision.
    - Decode the entry without the `flatten` buffering, through explicit
      fields, as the payload decoded `RestoreGeneration` before the change.
      The wire and entry formats stay, so it needs no contract decision.
    - Defer the warm plan decode and count to the first edit. The entry
      keeps the plan bytes in a separate payload part. A hit checks the file
      digest and holds those bytes. The core decodes and counts the plan
      only when an edit first needs it. It saves only warm-start plan work.
      It changes the entry layout, the Bundle Entries rules of
      `docs/protocol/mokly-base-cache.md`, the Warm Start rules of
      `docs/protocol/mokly-sidecar-plans.md`, the pool provenance, and the
      core record. So it needs a decision of the performance orchestrator.
    - Keep plans only where a runtime can use them. A base side uses its
      extracted base directory as its source root, at
      `crates/mokly-render/src/side.rs:85` to line 97. The settings include
      the source root, so a base entry never matches a head request. So
      base-side results carry and store plans that no runtime uses. The
      earlier mokly-cloud base at `efb17e824` had no plan. The path-table
      checkpoint at `8d530bc67` retained a 1,384,347-byte base plan. No base
      runtime uses that plan. A head-side entry of `build` can still serve
      the next warm Serve start.
      This changes the rule of the section "Plan Records" of
      `docs/protocol/mokly-sidecar-plans.md`, so it needs a decision of the
      performance orchestrator and a protocol update.
    - Encode the shared reuse evidence with a path table too, for every reuse
      owner, and keep every observation and every rule. The exact Serve plan
      change named this candidate on 2026-11-18 and left it to this item,
      because it moves compiled and stored reuse.
      - The evidence is about 60% of the retained `examples/basic` entry in
        the probe above. On mokly-cloud, before the path table, the head
        evidence has 3,965,184 bytes, and the base evidence 4,869,857 bytes.
      - Each evidence input is keyed by an absolute path, in `ReuseEvidence`
        at `crates/mokly-sidecar/src/compiled.rs:72` to line 83. In a
        separate capture of `examples/basic` at `be242a628`, 14,064 of its
        14,530 inputs were absent observations.
      - It would also shrink compiled recipes, restore frames, and bundle
        entries.
      - It changes the evidence wire type, its generated TypeScript type, the
        TypeScript and Rust evidence checks, and the entry payload. So it
        needs a decision of the performance orchestrator.
- **Task:**
  1. Build three release cores with matching sidecar dists, in separate
     checkouts and Cargo targets. Use the `main` commit before the plan reuse
     merge, the latest `main` commit with indexed paths and plan-only
     candidate names, and the work branch.
  2. Profile one warm start, one strict build, and one dirty restart of
     mokly-cloud on the first two builds. Use one-time probes or local
     instrumentation that the change does not keep.
  3. Split the added start time into stages: the sidecar plan count, the
     sidecar size check and response encoding, the core plan decode, the
     `with_plan` counts, the entry encode, write, and flush, the entry read,
     digest, and `flatten` decode, `Records::insert`, and the base-side plan
     work.
  4. Record the plan, evidence, record, and entry sizes of the head and base
     entries of mokly-cloud.
  5. Measure the other candidates that the profile points to.
  6. Choose the reduction by measured gain. It can combine candidates, and
     it keeps every requirement above.
  7. Ask the performance orchestrator before a choice that changes a
     protocol requirement.
  8. Implement the reduction. Keep every plan, oracle, bound, invalidation,
     warm-start, and bundle cache test. Add tests for each new
     representation or rule.
  9. Update `docs/protocol/mokly-sidecar-plans.md` and the area READMEs
     when a behaviour or an entry point changes.
  10. Measure the work branch against the latest `main` with indexed paths
      and plan-only candidate names. Use the accepted method and release
      builds. Also run `examples/basic` and the default large React fixture.
  11. Run `cargo xtask check`.
- **Impact if no action:** The accepted measurements before the path table
  showed added start cost on mokly-cloud. Warm serve.ready took about 0.17 s
  more, and warm first Changes 0.4 s more. A strict build took 0.7 s more,
  and dirty-restart serve.ready 0.44 s more. Nobody measured how much of
  that cost remains after indexed paths and candidate names. This item must
  keep the accepted edit gain.
- **Needs:** Release builds of the three commits with matching sidecar
  dists. A checkout of the mokly-cloud repository. A machine with 4 vCPUs on
  which no other build, test, or timing run is active.
- **Done when:**
  - Under the accepted method, the work branch lowers the start measures
    against that latest `main`, beyond the spread of the interleaved rounds. The start measures are warm serve.ready, warm first
    Changes, strict build, and dirty-restart serve.ready and first Changes.
  - Edit to Changes ready, esbuild compiles per edit, whole-tree peak, and
    core peak are no worse.
  - The oracle tests still prove equal output, recorded inputs, and errors.
    The gate passes.
  - The pull request gives the stage profile, the sizes, and the complete
    before and after results.
- **Related:**
  - [serve-plan-per-import-evidence.md](./serve-plan-per-import-evidence.md), the same record. A per-import dependency index changes retained bytes and start work. Measure that index before replacing whole-record admission.
  - `plans/follow-ups/serve-editor-files-disk-cache.md`, the same code. Its
    candidate names in compiled and stored reuse would change the evidence
    bytes and the counting cost that this item measures. A restart profile
    must also separate an editor-file miss of the head entry from the plan
    cost.
  - `plans/follow-ups/bundle-cache-request-cost.md`, the same code. It
    profiles the offer copy, the frame count, the restore copy, and the
    Linux flush of each bundle cache request. Its offer and its entry now
    also carry the plan, so one stage profile can serve both items.
  - `plans/follow-ups/sequential-evidence-capture-cost.md`, the same code.
    A dirty restart compiles the head with capture, and that compile now
    also returns and stores its plan.
  - `plans/follow-ups/serve-pause-warm-head.md`, the same code. A dirty
    restart restores the stale head entry, now with its plan, before the
    head compiles.
