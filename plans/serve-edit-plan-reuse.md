# Reuse captured resolution plans for Serve edits

Status: Active. On branch `calummoore/mokly-sidecar-plan-reuse-srh7`, no pull
request yet. The pull request that completes this work deletes this plan.

Mokly compiles catalogue JavaScript in a Node sidecar. The native esbuild
attempt produces a resolution plan. A second attempt applies that plan when
native resolution differs from Mokly's rules. Serve repeats both attempts
on an edit, even when only source content changed.

Keep the plan with the resolution evidence of its captured compile. Before
an edit, use the Rust evidence check. Complete, durable, and current evidence permits the planned
attempt directly. Missing or stale evidence keeps the native-first path.
Unknown imports keep the existing full resolver. Output, recorded inputs,
errors, live reuse, and disk safety keep their existing meaning.

Contract owners:

- [Compiled recipes and capture modes](../docs/protocol/mokly-sidecar-recipes.md).
- [Serve edit plans](../docs/protocol/mokly-sidecar-plans.md).
- [Sidecar module sources](../docs/protocol/mokly-sidecar-modules.md).
- [Bundle entries and stable capture](../docs/protocol/mokly-base-cache.md#bundle-entries).
- [Sidecar crate](../crates/mokly-sidecar/README.md).
- [Render crate](../crates/mokly-render/README.md).

## Authority and scope

On 2026-11-16, the user delegated Changes performance and reliability design
to the performance orchestrator. The user authorized multiple pull requests
and merges without more approval. No change may exhaust machine memory.
The performance orchestrator supplied calls P1 through P6 below on
2026-11-18 under that authority. This branch opens its pull request but does
not merge it. The performance orchestrator owns the merge.

- P1: Keep each captured native plan with that compile's evidence as one
  bounded record. A plan above its byte bound is not retained.
- P2: Before a Serve edit, check the record through Rust. Current evidence
  permits the planned attempt. The later ruling below adds durability. Missing and stale records keep native-first.
  An uncovered import keeps the full resolver.
- P3: Measure core transfer against sidecar routing before choosing the
  owner. The record either travels from the core or stays with its worker.
- P4: Include the record in the durable recipe, within existing disk bounds.
  A warm start can then reuse its plan on the first edit.
- P5: A reused plan preserves compiled output, recorded inputs, and errors.
  Keep a two-path oracle regression test, as the task explicitly requires.
- P6: Add no setting, gate, retry, or process. Serve edits still capture and
  store nothing. A stale record stays stale until another captured compile.

The pause capture proposal, called C4 in
[the warm-head follow-up](./follow-ups/serve-pause-warm-head.md), remains
separate. It is not P4 of this plan's call list. This change adds no idle
compile, stop capture, or promotion of an edit recipe.

Replaced ways: none. Native-first remains the required fallback. Full
resolution remains the required path for imports outside the saved plan.
The change extends the lifetime of a plan without replacing either resolver.

## Design and options

Shared terms:

- **Captured compile:** a bundle request in the `full` capture mode.
- **Edit compile:** a bundle request in the `serveEdit` capture mode.
- **Resolution evidence:** recorded paths, metadata contents, directory
  entries, and link targets that can change import selection.
- **Plan record:** a native import plan and its captured resolution evidence.
- **Durable recipe:** a compiled bundle eligible for the existing disk cache.

### 1. Preserve resolution work across content edits

- **Severity:** Medium. **Effort:** Medium.
- **Source:** Design.
- **Category:** Performance.
- **Location:** `packages/mokly/src/sidecar/bundle.ts`,
  `crates/mokly-render/src/physical_inputs.rs`.
- **Background:** Native classification already produces planned targets.
  Captured compiles already record resolution facts separately from source
  content. Serve edits deliberately omit capture.
- **Problem:** An edit repeats native resolution and classification.
- **Impact if no action:** The edit retains about one second of avoidable
  bundle work on the performance orchestrator's catalogue.
- **Root question:** How can edits reuse resolution work with equal results
  and bounded memory?
- **Options:**
  - **A.** Keep a bounded plan record from the last captured compile. Check
    its evidence before edits. Use full resolution for uncovered imports.
    Effort: Medium.
  - **B.** Keep an esbuild build context for incremental rebuilding. This
    changes lifetime and retention across every compile. Effort: Large.
  - **C.** As A, but require complete and durable evidence before using
    saved targets. Other edits stay native-first. Effort: Small.
  - **D.** As A, but match only resolution settings. An added catalogue
    entry can keep the record when its evidence stays current. Effort: Small.
  - **E.** Keep advisory import keys and resolve them fully on each compile.
    Classify each compile again. No target is reused. Effort: Medium.
  - **F.** Check evidence separately for each plan entry. A stale entry
    keeps full resolution. This needs an evidence index. Effort: Large.
- **Left out:**
  - Change nothing fails the requested edit latency improvement.
  - Reuse without evidence violates P2 and can select stale targets.
  - Capture every edit violates P6 and the retained C1 capture policy.
  - A second resolver or mirror compile repeats work and violates the
    single-attempt path required for current evidence.
  - B does not remove classification or both attempts with the current
    consumer plugin. It does not satisfy this change's chosen scope.
  - The performance orchestrator rejected E on 2026-11-18. It retains
    classification and adds resolver round trips.
  - The performance orchestrator kept D and F outside this change on
    2026-11-18. Whole-record fallback stays. Measure its effect instead.
- **Assumptions:** Output, inputs, and errors stay equal, from P5. Source
  content alone does not invalidate resolution facts, from PR #312's code.
  Capture stays off for edits, from P6. No assumption lacks a source.
- **Wider fix:** E proves each compile again, but fails the chosen speed
  approach. C protects this optimization under the accepted stability rules.
- **Previous examples:** PR #312 separates resolution evidence from render
  inputs. PR #311 classifies native imports before planned compilation.
- **Recommendation:** C, changed from A after the options check. It prevents
  carrying the two reproduced capture mutations into later edits.
- **Action:** Answered by the performance orchestrator on 2026-11-18: C.
  This narrows P2 on purpose. Durability also gates in-process plan reuse.
  Existing compiled-result reuse keeps its rules. P1, P5, and P6 stay.

### 2. Choose the record owner

- **Severity:** Medium. **Effort:** Medium.
- **Source:** Design.
- **Category:** Performance.
- **Location:** `crates/mokly-render/src/runtime.rs`,
  `crates/mokly-sidecar/src/pool_affinity.rs`.
- **Background:** The core owns the Rust evidence reader. Bundle requests
  can run on any worker. Recipes already restore into different workers.
- **Problem:** Record ownership adds either transfer work or worker routing.
- **Impact if no action:** The implementation cannot safely select a saved
  plan after the original compilation lifetime ends.
- **Root question:** Where can a saved plan serve edits with the least
  latency and memory cost?
- **Options:**
  - **A.** Keep a bounded record in the core. Check there and send only the
    plan on an edit request. Existing worker selection stays. Effort: Medium.
  - **B.** Keep the record in one sidecar. Route edits to its process and
    check its evidence in Rust. Worker loss needs record restoration.
    Effort: Large.
  - **C.** Keep a core record and install copies in workers on demand. Send
    an identifier on later edits. This adds installed-state bookkeeping.
    Effort: Medium.
- **Left out:**
  - A new process violates P6.
  - Disk reads on each edit add a new hot-path cost without reducing the
    need for the Rust evidence check.
- **Assumptions:** Rust decides current evidence, from P2. Any worker can
  receive a bundle today, from the pool code. C drops that transfer
  assumption after its first installation. The request remains private.
- **Wider fix:** A. A request carries its complete compilation prerequisite.
- **Previous examples:** The pool already transfers immutable recipes for
  worker restoration and keeps their data in shared Rust ownership.
- **Related:** Item 1 supplies the record. Item 3 persists it.
- **Recommendation:** A. It keeps worker selection and restoration simple.
  The options check kept A after reading the measured transfer costs.
- **Action:** My owner call of 2026-11-18 implements P3. The performance
  orchestrator confirmed the corrected measurement on 2026-11-18. Measure
  transfer, Rust evidence validation, Rust encode and decode, and map
  construction together. Compare their cost with the removed native attempt
  and classification. End-to-end edit latency remains the final test.

### 3. Keep warm starts safe and bounded

- **Severity:** Medium. **Effort:** Medium.
- **Source:** Design.
- **Category:** Performance.
- **Location:** `crates/mokly-sidecar/src/compiled.rs`,
  `packages/mokly/src/sidecar/bundle-recipe.ts`.
- **Background:** A durable recipe already contains complete, stable
  resolution evidence. The disk cache bounds the whole serialized recipe.
- **Problem:** A restored compile has no native plan today.
- **Impact if no action:** Every edit of a warm session lacks a plan, because
  that session runs no captured head compile.
- **Root question:** How can a warm Serve session reuse its stored plan
  within the existing memory and disk bounds?
- **Options:**
  - **A.** Extend the compiled recipe with an optional plan record. Charge
    plan and evidence together to 8 MiB. Retain no oversized plan. Bound the
    core's retained records to 8 MiB in total. Effort: Medium.
  - **B.** Put the plan in a second durable entry with its own lifecycle and
    a compilation reference. Effort: Large.
  - **C.** Give the plan its own 8 MiB bound beside the evidence allowance.
    A record can reach 16 MiB. Effort: Small.
  - **D.** Encode importer and target tables to reduce repeated absolute
    paths while keeping A's bounds. Effort: Small.
  - **E.** Keep the plan beside the compiled payload on wire and disk. A
    typed core record pairs it with the same evidence Arc. Restore requests
    carry no plan. Warm seeding attaches a loaded plan only after the sidecar
    accepts its matching runtime key. Effort: Medium.
  - **F.** Keep only the existing SHA-256 settings key, instead of the full
    settings value. This saves a small settings copy but hashes every edit
    lookup and makes the match depend on the digest. Effort: Small.
  - **G.** Count settings at sidecar admission too. Both bounds then count
    settings, plan, and evidence. This changes the pair rule for little
    headroom on the measured fixtures. Effort: Small.
  - **H.** Count estimated heap bytes in the core. This needs an unmeasured
    size model and changes the unit of the fixed bound. Effort: Medium.
- **Left out:**
  - Memory-only retention violates P4.
  - An unbounded plan violates P1 and the user's memory constraint.
  - A separate cache adds ownership and atomicity rules that the existing
    publication already supplies.
  - A total that does not charge retained settings fails the total bound.
    A separate settings allowance enlarges it.
- **Assumptions:** Only captured durable results reach disk, from P6 and the
  bundle-cache contract. The existing frame and disk bounds remain in force.
- **Wider fix:** E. Cache-only plan data stays outside restored programs and
  compiled-output comparisons.
- **Previous examples:** PR #312 uses shared compiled recipes in memory and
  validates the durable record before storage.
- **Related:** Item 2 chooses where the live reference stays.
- **Recommendation:** E, changed from A after the options check. It keeps
  one publication and avoids sending plan data on every program restore.
- **Action:** My placement call of 2026-11-18 implements P1 and P4. Apply E.
  The performance orchestrator confirmed the bound policy on 2026-11-18:
  one combined 8 MiB record bound and 8 MiB total core retention. Measure
  actual plan and evidence together. Use D within those bounds if needed.
  Ask the performance orchestrator before using C.

### 4. Keep an older eligible record

- **Severity:** Medium. **Effort:** Small.
- **Source:** Implementation.
- **Category:** Docs or spec.
- **Location:** `crates/mokly-render/src/edit_plans.rs`,
  `docs/protocol/mokly-sidecar-plans.md`.
- **Background:** A successful captured compile can supply no eligible plan.
  The owner can still hold an older record of equal settings.
- **Problem:** The first calls did not state whether that older record stays.
- **Impact if no action:** The replacement transition has no stated rule.
- **Root question:** May a later full result without a record end the older
  record, or does only the older record's own evidence decide its use?
- **Options:**
  - **A.** Keep the older eligible record. Check its own complete, durable
    evidence before every edit. Keep both bounds. Effort: Small.
  - **B.** Remove the older equal-settings record after each successful full
    capture, then retain the replacement only when eligible. This follows
    released-recipe replacement but loses valid reuse. A full reuse hit also
    supplies no plan, so class-map requests and memory seeds can remove a
    valid record. Effort: Small.
  - **C.** Remove the older record only when a later capture has incomplete
    or unstable evidence. This adds cause-specific rules without a safety
    gain over checking the older record. Effort: Small.
  - **D.** Check the older evidence once when a later capture supplies no
    record, and remove it when stale. This loses reuse when a changed input
    returns to its captured state. Effort: Small.
- **Left out:** A new refresh compile belongs to C4. An ineligible
  replacement violates the admission rule. Several records per settings,
  a cut-down plan, and per-entry checks add work outside this decision.
  Keeping the older plan on disk would change the latest-compilation rule.
- **Assumptions:** The Rust evidence check still proves the saved targets,
  from P2 and the durability ruling. P5 still requires equal output. P6
  still forbids capture on edits. Both bounds stay fixed, from the ruling.
- **Wider fix:** A keeps the plan paired with the evidence that authorizes it.
- **Previous examples:** Released recipes replace equal settings under a
  different lifetime in `crates/mokly-sidecar/src/pool_recipes.rs`.
- **Recommendation:** A. Current evidence preserves safe and useful reuse.
- **Action:** The performance orchestrator chose A on 2026-11-18, as its
  item 6, under the user's design delegation of 2026-11-16. Each use checks
  the older record against current files. A later capture does not weaken
  that proof. Released-recipe replacement serves a different owner and
  lifetime. The options check kept A and added C and D. A later stored
  compilation without a plan can still replace the disk entry, so the
  predecessor then survives only in the running process.

### 5. Accept the measured start cost

- **Severity:** Medium. **Effort:** Small.
- **Source:** Design.
- **Category:** Performance.
- **Location:** `packages/mokly/src/sidecar/captured-plan.ts`,
  `crates/mokly-sidecar/src/durable_recipe.rs`,
  `crates/mokly-compare/src/bundle_codec.rs`,
  `crates/mokly-compare/src/bundle_codec_read.rs`,
  `crates/mokly-compare/src/bundle_codec_write.rs`,
  `crates/mokly-sidecar/src/pool_bundle_cache.rs`, and
  `crates/mokly-render/src/edit_plans.rs`.
- **Terms:**
  - **Dirty restart:** a Serve restart after unreverted edits.
  - **First Changes:** the first browser-visible ready comparison state.
  - **serve.ready:** the timing event when Serve starts accepting requests.
- **Background:** The performance orchestrator compared release cores and
  matching dists of `efb17e824` and main `2e6bde9c2` on mokly-cloud.
  Three interleaved rounds followed priming, with four CPUs, four sidecars,
  and `--base HEAD`. Each run made a strict build, three edits, and a dirty
  restart. The full accepted table belongs in the pull request.
- **Problem:** Each edit improves from 4.18 to 3.13 seconds, but starts and
  builds increase. Warm serve.ready rises from 1.69 to 1.86 seconds.
  Dirty-restart serve.ready rises from 3.70 to 4.14 seconds.
  Warm and dirty-restart first Changes each rise by 0.4 seconds.
  Strict build rises from 19.0 to 19.7 seconds. The cause is not isolated.
- **Impact if no action:** The accepted edit improvement can ship, while
  starts and builds retain their measured cost.
- **Root question:** How does the change keep its faster edits without
  slower starts and builds?
- **Options:**
  - **A.** Ship the measured implementation and record a follow-up to measure
    and reduce the start cost. Effort: Small.
  - **B.** Reduce the plan encoding before this pull request. This adds a
    wire and disk representation change and more verification. Effort: Medium.
  - **C.** Omit plans from base-side compiles, whose extracted source roots
    cannot match a head entry. This changes the captured-plan contract and
    needs a new decision and measurement. Effort: Medium.
  - **D.** Count each plan and evidence pair once. Decode entries through
    explicit fields instead of serde flatten buffering. The formats stay,
    but the gain needs measurement. Effort: Medium.
  - **E.** Decode and count a stored warm plan at the first edit. This changes
    the entry layout, provenance, and warm-start contract. It needs a new
    decision and measurement. Effort: Large.
- **Left out:**
  - Removing stored head plans violates warm-start reuse.
  - Increasing the bound violates the fixed memory policy and removes no
    start or build work.
  - Shipping without the follow-up violates the orchestrator's acceptance.
  - Reverting plan reuse loses the required edit improvement.
  - Raw untyped plan JSON violates shared boundary typing.
  - Moving the cache write is owned by the bundle-cache cost follow-up.
- **Assumptions:** A session makes many edits per start, from the acceptance.
  C drops this reason for base-side entries, which have no edit consumer.
  B tests the unproved encoding cause. D tests the repeated passes instead.
  E drops eager decode, which the code uses but no requirement fixes.
  Output, both bounds, and no edit capture stay in force. B through E change
  the measured implementation and need a new mokly-cloud measurement.
- **Wider fix:** C removes unused base work. E moves warm plan work to its
  consumer. Both remain candidates requiring a later contract decision.
  B and D reduce individual costs. A schedules the work.
- **Previous examples:** Item 3 includes compact importer and target tables.
  The bundle-cache request-cost follow-up owns the synchronous write cost.
- **Recommendation:** A, unchanged by the options check. Preserve the
  accepted improvement, then compare all candidates with a stage profile.
- **Action:** The performance orchestrator chose A on 2026-11-18 under the
  user's delegation of 2026-11-16. It accepted 4.18 to 3.13 seconds per edit
  and the small start increases, because a session has many edits per start.
  Whole-tree peak memory decreased from 3,045 to 2,889 MiB. Add its complete
  table to the pull request. The required follow-up includes importer and
  target tables, repeated counting, flatten decode, and first-edit deferral.
  The check is in `.context/serve-edit-plan-reuse/start-cost-options-check.md`.

## Confirmed invariants and measurement calls

The options check is saved in
`.context/serve-edit-plan-reuse/options-check-transcript.md`. Owner costs
are in `.context/serve-edit-plan-reuse/owner-cost.md`.

The performance orchestrator made the calls below on 2026-11-18, under the
user's design delegation of 2026-11-16:

- Use only complete and durable captured evidence for target reuse. The
  known stability limit of PR #312 remains unchanged.
- Keep direct planned compilation. Reject advisory hints because they keep
  classification and resolver round trips.
- Keep whole-record invalidation. Measure a retained backup or swap file
  and an added catalogue entry. Report each case's native-first edit count.
- If a retained swap file defeats every edit, add a follow-up. Keep the
  resolution-settings key and per-edge validation alternatives there. Also
  name directory evidence restricted to selectable candidate names.
- Measure every added edit cost, including Rust reads and wire work.
- Keep combined and total core bounds at 8 MiB. Measure actual size. Try
  importer and target tables before proposing a larger bound.

Implementation invariants:

- A record comes from one bundle call, including an exact native result.
  A native failure provides no plan. Keep the plan of that call's native
  attempt with the evidence shared across that call's attempts.
- Retain a record only from a result that a sidecar of this process produced
  or accepted. A raw disk read cannot authorize a record.
- Only a Serve head keeps the extra long-lived core record owner. Base
  runtimes never use an edit plan.
- The request-only plan changes no bundle setting or compilation identity.
  Edits still receive fresh identities and no captured or stored evidence.
- An import outside the plan uses the existing full resolver.
- A direct planned error is final. No retry follows it. Compare it with the
  native-first oracle error.
- Response sizing drops an optional plan before dropping evidence. A disk
  entry that cannot fit its plan can still store the unchanged recipe.
- Missing, oversized, incomplete, unstable, stale, or incompatible records
  keep the native-first path. A missing plan never weakens live reuse.
- My accounting call of 2026-11-18 charges retained bundle settings too.
  The separate plan-and-evidence admission bound remains 8 MiB. The total
  core-retention bound counts every retained serialized setting, plan, and
  evidence value, because the owner must not keep settings outside its bound.
- My documentation placement call of 2026-11-18 uses a separate Serve edit
  plans page. The recipe page had insufficient room within its protocol cap.
- My implementation details for the owner and placement calls, 2026-11-18:
  compare settings without the evaluation digest, as the pool and disk key do.
  Evict the oldest retained record first, so the newest useful capture stays
  within the fixed total. Share evidence through Arc, so the owner copies no
  evidence. Count the stored Entry once, so each retained field stays charged.
  Keep the optional disk field in format 1, because existing entries remain
  valid and no required field changes. These details preserve the approved
  contracts and the options checks of the owner and placement decisions.

## Milestone 1: Documentation and protocol

Depends on: none

- [x] State plan reuse, evidence validation, unknown imports, bounds, and
      warm restore in the compiled recipe contract.
- [x] Update useful code entry points in the area READMEs.
- [x] Keep the warm-head follow-up current and explicitly outside this work.

## Milestone 2: Captured plans and direct compilation

Depends on: 1

- [x] Define typed Rust wire records and regenerate the TypeScript types.
- [x] Keep each native plan with its captured evidence. Charge both to the
      record bound. Preserve existing capture, identity, and frame rules.
- [x] Accept a request-only plan for edit compilation. Run its planned
      attempt directly. Preserve full resolution of uncovered imports.
- [x] Add the oracle test and attempt-count assertions. Cover content edits,
      new imports, new modules, changed index priority, manifest changes,
      tsconfig paths, links, errors, and an oversized record. Prove new
      behaviour red first. Existing sidecar tests stay unchanged.

## Milestone 3: Core reuse and durable restore

Depends on: 2

- [x] Retain the last captured record by equal settings in a byte-bounded
      Serve-head core owner. Keep it after the compilation lease ends.
- [x] Before edits, validate through the Rust physical evidence reader.
      Send only a complete, durable, and current plan. Keep stale records until a captured compile.
- [x] Restore the plan from the existing durable recipe on warm startup.
- [x] Test invalidation, record eviction, the edit marker, and the first
      warm edit. Preserve bundle-cache and Serve tests.
- [x] Test that an ineligible later full capture keeps the older record,
      and that only current evidence permits an edit to use it.
- [x] State total settings accounting and the older-record rule in Kept
      Records. Remove temporary status lines and add final README entry points.

## Milestone 4: Measurement and verification

Depends on: 3

Evidence: `.context/serve-edit-plan-reuse/measurement-execution-report.md`,
`performance.md`, `owner-cost.md`, and `mokly-cloud-accepted.md`.
The early suite and ten-run records are in `early-repository-result.json`
and `ten-runs/results.json` in that folder.
The complete gate result is in `complete-gate-result.json` there.

- [x] Build last merged main and this branch in separate checkouts with
      separate Cargo targets. Use release binaries and matching sidecar dists.
- [x] Measure actual plan and evidence together, plus retained settings and
      the kept total, before fixing their wire encoding. Keep both bounds at 8 MiB.
- [x] Measure first Changes, edit-to-Changes-ready, sidecar.bundle spans,
      attempt counts, and peak RSS on examples/basic and scripts/large
      fixtures. Keep before and after records under `.context/`.
- [x] Measure retained swap or backup files and an added catalogue entry.
      Report native-first counts. Add the required editor follow-up if all
      edits fall back while its file stays present.
- [x] Record the accepted mokly-cloud measurements and add the requested
      start-cost follow-up, including compact importer and target tables.
- [x] Run targeted tests and new asynchronous tests ten times. Run
      `cargo xtask check --suite repository`, then `cargo xtask check`.
      Put Git 2.45 or newer first on PATH, install git-lfs, and use pinned Bun.
- [x] Check every large Cargo build's disk and RAM first. Disable Cargo
      incremental builds. Run one Cargo build at a time.
- [x] Commit and push. Send the performance orchestrator the implementation
      SHA and dist build commit at once for mokly-cloud measurement.

## Milestone 5: Review and pull request

Depends on: 4

- [x] Rebuild after the clean main palette merge. Check its styles,
      snapshots, and affected browser cases. Preserve both merge parents.
      Evidence: `.context/serve-edit-plan-reuse/palette-merge-audit.log`.
- [ ] Review the whole diff against origin/main through implementation-review
      after the push. Run finding checks and its two fix rounds. Record
      deferred and outside-scope findings as follow-up items.
- [ ] Delete this plan when the plans skill says. Keep its dated calls and
      permalink in the pull request description.
- [ ] Open the pull request into main. Wait for CI through scripts/ci-wait.sh.
      Fix branch failures and rerun unrelated failures once. Send the final
      report to the performance orchestrator. Do not merge.
