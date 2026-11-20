# Measure and reduce the plan record start cost

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-11-18, from the performance orchestrator's acceptance of
  implementation `efb17e824`, on branch
  `calummoore/mokly-sidecar-plan-reuse-srh7`.
- **Location:** `packages/mokly/src/sidecar/captured-plan.ts:8`,
  `packages/mokly/src/sidecar/recipe-size.ts:15` to line 22,
  `packages/mokly/src/sidecar/transport.ts:39`,
  `packages/mokly/src/sidecar/native-resolution.ts:48` to line 54,
  `crates/mokly-sidecar/src/resolution_plan.rs:26` to line 46,
  `crates/mokly-sidecar/src/durable_recipe.rs:18`,
  `crates/mokly-sidecar/src/pool_bundle_cache.rs:86`, line 128, and line
  139, `crates/mokly-compare/src/bundle_codec.rs:51` to line 57,
  `crates/mokly-compare/src/bundle_codec_write.rs:18` to line 24,
  `crates/mokly-compare/src/bundle_codec_read.rs:100`,
  `crates/mokly-compare/src/bundle_store.rs:147` to line 149,
  `crates/mokly-render/src/edit_plans.rs:57`,
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
  - **Importer and target tables:** a plan encoding that lists each importer
    path and each target path once and refers to them by index.
- **Background:**
  - The plan reuse change, commit `efb17e824`, lets a Serve edit skip the
    native esbuild attempt when a Rust check proves its plan record current.
  - Since that change, the plan crosses or is counted at these places. Each
    one is a source fact, and nobody timed it on its own:
    - `capturedPlan` at `packages/mokly/src/sidecar/captured-plan.ts:8`
      counts the plan and the evidence against 8 MiB. It serializes the
      whole evidence once to count it.
    - `checkRecipeSize` at `packages/mokly/src/sidecar/recipe-size.ts:15`
      serializes the whole result, plan included, to check the frame limit.
      Line 21 drops the plan first when the result does not fit.
    - The transport writes each response through `jsonText` at
      `packages/mokly/src/sidecar/transport.ts:39`. `jsonText` sorts the keys
      of every object, and a plan adds one object for each import.
    - Each plan key is the JSON text of the importer path, the specifier,
      and the import kind, from `planKey` at
      `packages/mokly/src/sidecar/native-resolution.ts:48`. So each key
      repeats an absolute importer path. Each target also holds an absolute
      path.
    - The core decodes the plan as `ResolutionPlan` at
      `crates/mokly-sidecar/src/resolution_plan.rs:26`, a map with one string
      key for each import.
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
    - `Records::insert` at `crates/mokly-render/src/edit_plans.rs:57`
      serializes the settings, the plan, and the evidence again to count
      them, under the records mutex. Only the Serve head core calls it, from
      `crates/mokly-render/src/bundle_attempt.rs:51`.
    - The base side, `build`, and `publish` also make captured compiles.
      Their results also carry plans, and their bundle cache entries store
      them. No base runtime sends a saved plan with an edit request.
  - On 2026-11-18, a probe extracted plan and evidence pairs together from
    actual stored captures. It checked their payload digests:
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
    - No actual mokly-cloud plan or record size was measured.
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
      output and the recorded inputs stay equal. See
      `docs/protocol/mokly-sidecar-plans.md:96`.
    - Only complete, durable, and current evidence permits a plan, at lines
      23, 45, and 85 of that page.
    - A Serve edit captures nothing and stores nothing, at
      `docs/protocol/mokly-sidecar-recipes.md:44`. It keeps no record, at
      `mokly-sidecar-plans.md:48`.
    - The plan is not a bundle setting and changes no compilation identity,
      at line 90.
    - An edit with a current plan makes no native attempt. It makes one
      esbuild call when its guarded result stands. A fallback to the complete
      planned compile makes two, never more. See the
      [guarded attempt rules](../../docs/protocol/mokly-sidecar-plans.md#guarded-attempts).
      Plan reuse adds no setting, gate, or process, as the
      [edit request rules](../../docs/protocol/mokly-sidecar-plans.md#edit-requests)
      say.
    - One record holds at most 8 MiB of plan and evidence, at line 29. The
      kept records hold at most 8 MiB in total, settings included, at line 56. A separate 8 MiB plan allowance was rejected, at line 38.
    - The plan stays beside `compiled` on the wire and on disk, at line 35.
      `restoreGeneration` carries no plan, at line 26.
    - The plan stays a typed boundary type. The `shared-types` skill forbids
      untyped JSON in a boundary type.
    - The disk rules of `docs/protocol/mokly-base-cache.md` stay. Only
      complete and stable evidence reaches the disk. The payload, receipt,
      fault, and lock rules keep their meaning.
    - The bundle cache write stays inside the bundle response, as a review
      of 2026-11-18 decided. `plans/follow-ups/bundle-cache-request-cost.md`
      holds the option that moves it.
    - The 64 MiB frame limit of `docs/protocol/mokly-sidecar.md:38` and the
      512 MiB bundle namespace of `docs/protocol/mokly-timings.md:192` stay.
  - Required candidate: importer and target tables. The performance
    orchestrator required this follow-up to include them. Nobody measured
    them yet.
    - They remove repeated absolute paths from every plan stage above.
    - They change the plan wire type, its generated TypeScript type, and the
      entry payload. They keep both 8 MiB bounds.
    - They do not shrink the evidence. So each counting pass keeps that part
      of its work.
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
      base-side results carry and store plans that no runtime uses. A
      head-side entry of `build` can still serve the next warm Serve start.
      This changes the rule at `mokly-sidecar-plans.md:23`, so it needs a
      decision of the performance orchestrator and a protocol update.
- **Task:**
  1. Build three release cores with matching sidecar dists, in separate
     checkouts and Cargo targets. Use the `main` commit before the plan reuse
     merge, the `main` commit with that merge, and the work branch.
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
  5. Build and measure importer and target tables on that stage profile.
  6. Measure the other candidates that the profile points to.
  7. Choose the reduction by measured gain. It can combine candidates, and
     it keeps every requirement above.
  8. Ask the performance orchestrator before a choice that changes a
     protocol requirement.
  9. Implement the reduction. Keep every plan, oracle, bound, invalidation,
     warm-start, and bundle cache test. Add tests for each new
     representation or rule.
  10. Update `docs/protocol/mokly-sidecar-plans.md` and the area READMEs
      when a behaviour or an entry point changes.
  11. Measure the work branch against `main` with the plan reuse merge under
      the accepted method, with release builds. Also run `examples/basic`
      and the default large React fixture.
  12. Run `cargo xtask check`.
- **Impact if no action:** Each Serve start on mokly-cloud keeps the accepted
  cost. A warm serve.ready takes about 0.17 s more, and a warm first Changes
  0.4 s more. A strict build takes 0.7 s more, and a dirty-restart
  serve.ready 0.44 s more. The edit gain stays.
- **Needs:** Release builds of the three commits with matching sidecar
  dists. A checkout of the mokly-cloud repository. A machine with 4 vCPUs on
  which no other build, test, or timing run is active.
- **Done when:**
  - Under the accepted method, the work branch lowers the start measures
    against `main` with the plan reuse merge, beyond the spread of the
    interleaved rounds. The start measures are warm serve.ready, warm first
    Changes, strict build, and dirty-restart serve.ready and first Changes.
  - Edit to Changes ready, esbuild compiles per edit, whole-tree peak, and
    core peak are no worse.
  - The oracle tests still prove equal output, recorded inputs, and errors.
    The gate passes.
  - The pull request gives the stage profile, the sizes, the measured result
    of importer and target tables, and the complete before and after
    results.
- **Related:**
  - `plans/follow-ups/serve-plan-editor-invalidation.md`, the same code.
    Narrower evidence or per-entry checks can change record size and the
    counting cost that this item measures.
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
