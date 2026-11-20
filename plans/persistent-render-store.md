# Reuse rendered documents after Serve restarts

Status: Active. On branch `calummoore/mokly-first-changes-5-render-store-p3o6`, no pull request yet. The pull request that completes the work deletes this plan.

Mokly renders every view again after a Serve restart. The first Changes on
`mokly-cloud` takes about 12 to 14 seconds. The head usage pass renders 1,508
views and takes 7.35 seconds. This change retains complete rendered documents
in the existing Mokly cache directory. The process cache keeps its current
256 MiB bound and its current eviction rules.

On 2026-11-19, the user chose step 5 of the stacked first-Changes series.
The chosen approach is a persistent render store. The user accepted stale
results across restarts for unsupported render inputs: files, environment
variables, the clock, and random values. The watch contract already excludes
these inputs. Stored descriptions remain excluded.

The performance orchestrator's calls of 2026-11-19 are the starting design:

- Use a new kind of the existing cache. Keep its location, ownership,
  durability, receipt, and corruption rules. Every rejected entry is a miss.
- Key documents by their document key, Node version, platform, Mokly version,
  and the `jsconfig.json` chain. Do not key by the whole JavaScript bundle.
- Read after a process-cache miss and before composition. Run each side's
  closure walk, link checks, and usage recording on stored reads.
- Write outside the render and publication path. Use a bounded queue.
  Drop an offered write when the queue has no room.
- Bound retained disk bytes. Evict by access order. Add no setting.
- Measure two real restarts, including one with a changed line. Measure hits,
  write cost, first Changes, published bytes, and whole-tree memory.
- Add tests first. Prove restart reuse, key misses, corruption misses,
  eviction, and a full queue that cannot block a render.

Contract owners:

- [Cache storage](../docs/protocol/mokly-base-cache.md).
- [Runtime and memory](../docs/protocol/mokly-runtime.md).
- [Watch inputs](../docs/protocol/mokly-watch.md).
- [Format versions](../docs/protocol/mokly-format-versions.md).
- [Timing and budgets](../docs/protocol/mokly-timings.md).
- [Graph boundary](../crates/mokly-graph/README.md).
- [Cache implementation](../crates/mokly-compare/README.md).

## Design calls

### 1. Store documents through the existing cache

- **Severity:** High. **Effort:** Large.
- **Source:** Design.
- **Category:** Performance.
- **Location:** `crates/mokly-graph` and `crates/mokly-compare`.
- **Terms:**
  - **Document key:** The hash of supported inputs for one rendered view.
  - **Receipt:** The cache record that marks durable data as complete.
- **Background:** The graph retains documents in process memory. The cache
  implementation already owns durable files, leases, and byte accounting.
- **Problem:** A restart loses the rendered documents and repeats sidecar work.
- **Impact if no action:** Warm restarts keep the 7.35-second head render pass.
- **Root question:** How can a restart reuse unchanged documents with equal output and bounded memory?
- **Options:**
  - **A.** Retain complete documents as a new existing-cache kind. Inject a
    store boundary into the graph. Reuse the lossless document representation
    and the durable cache rules. Give this kind an indexed access path rather
    than scanning all receipts on each read or write. Persist all metadata
    outside the existing compressed tree payload too. Effort: Large.
  - **D.** Pack documents and an index into durable segment entries of the
    same kind. Publish one receipt for each segment. Evict whole segments
    by access order. This reduces files and flushes but coarsens eviction.
    Effort: Large.
  - **E.** Apply A with the compiled toolchain identity, the compilation
    identity inputs absent from document keys, and the native core build
    identity. Include the platform. This covers Node, Mokly, configuration
    chains, extends targets, and applicable peer manifests. Do not include
    the complete compilation identity or ordinary JavaScript source bytes.
    A native executable digest can supply the core build identity without
    another process. HTML-only documents need no sidecar identity.
    Effort: Large.
  - **F.** Apply A without durability flushes. Publish digest-checked files
    by rename and treat torn files as misses. A crash can lose recent entries.
    This changes the required durability rule. Effort: Large.
- **Left out:** Process-only reuse cannot survive a restart. Stored
  descriptions fail the accepted description rule. A whole-bundle identity
  invalidates unchanged views after one source edit. B is an independent
  single-file store with another ownership, receipt, and eviction system.
  D is better on the points the options check found. C stores sidecar
  fragments and fails the complete-document read path. F cannot be selected
  while the task requires the bundle kind's durability rule.
- **Assumptions:** Complete documents and one cache are requirements of the
  task. Equal bytes and supported-input freshness are requirements of the
  task and runtime contract. Unsupported-input persistence has user approval.
- **Wider fix:** E. Existing toolchain and compilation evidence closes the
  identity gaps without another exhaustive configuration list.
- **Previous examples:** The bundle kind of the cache uses the same separation.
- **Recommendation:** D with E's identity, changed from A through E after the
  options check and storage measurement. Individual durable writes reached
  about 144 documents per second. Segment batches reached about 707. The
  writer retained 99.2% of a 1,508-document synthetic pass. These development
  measurements select batching, not the final startup acceptance result.
- **Action:** fix now, apply D and E. The store is the performance orchestrator's
  call of 2026-11-19. This workspace's orchestrator adds the identity coverage
  on the same date to preserve output across local rebuilds and restarts.

This restart step activates the store in Serve only. The build and publish
commands keep their current source-render path. This clarifies the scope of
call 1 on 2026-11-19 and preserves behavior outside the requested Serve change.

The timing counts keep store hits, misses, faults, writes, and drops separate
from memory-cache hits. Cold measurements empty only the render store. The
cache warning texts name documents and keep the bundle cache's cadence. These
details apply the existing measurement and common-cache requirements.

### 2. Bound storage and queued work by bytes

- **Severity:** High. **Effort:** Medium.
- **Source:** Design.
- **Category:** Performance.
- **Location:** The new render store and its writer boundary.
- **Background:** Documents average about 11.3 KB on `mokly-cloud`. The
  comparison capture encodes 1,508 views into about 17 MB. Both startup and
  ten-edit memory peaks must stay within 2% of main.
- **Problem:** An unbounded writer or store can exhaust memory or disk.
- **Impact if no action:** Persistence can violate the user's memory requirement.
- **Root question:** How can retained renders fit fixed resources without delaying publication?
- **Options:**
  - **A.** Use a fixed disk-byte bound with LRU eviction and one writer.
    Admit queued artifacts under both byte and count bounds. Drop work when
    admission fails. Select final constants from measured sizes and cost.
    Start evaluation at 128 MiB of disk and 8 MiB of queued retained memory.
    Include in-flight work and codec workspace in memory accounting.
    Effort: Medium.
  - **D.** Queue a bounded set of document keys. Read documents without
    promotion from the process cache on the writer. Charge active documents
    and encoding to its existing transit headroom and encoder leases. Reuse
    compact payloads when possible. Drop a key whose document left the cache.
    This keeps one owner of retained document memory. Effort: Medium.
- **Left out:** B keeps only a fixed count and fails the fixed-byte and
  memory requirements. C writes synchronously and fails the
  requirement that writes never delay renders or publication. An unlimited
  queue fails the memory requirement. A new setting breaks the no-setting rule.
- **Assumptions:** Fixed byte bounds, nonblocking offers, and no new setting
  are requirements of the task. The proposed constant values are provisional
  implementation choices, not new product requirements.
- **Wider fix:** D. The process cache remains the document-memory owner.
- **Previous examples:** The process cache accounts for encoding in transit.
- **Recommendation:** D, changed from A after the options check. It keeps
  offers nonblocking without a second queue of retained documents. A remains
  the fallback if the non-promoting read or shared encoding admission is
  unsafe. Any fallback must pass the same measured memory limits.
- **Action:** fix now, apply D. This workspace's orchestrator makes this call
  on 2026-11-19 under the performance orchestrator's resource requirements.

Options-check evidence: `.context/persistent-render-store/plan-options-check.md`.

Implementation details of the checked calls, recorded on 2026-11-19:

- Call 1 E uses the actual Linux running image through `/proc/self/exe`.
  Other targets use an embedded native build nonce. A missing invocation
  marker makes each non-Linux native build refresh that nonce, including
  a dependency-feature rebuild. This requires a CLI relink on a non-Linux
  no-op native build. It preserves native identity without a new process.
- Call 2 D prepares identity and the disk index on the existing writer.
  Encoding waits until the first completed Changes publication, ready or
  unavailable, after head validation. This keeps writes off the cold
  publication path. Stored reads remain available during that interval.
- The store publishes separate cumulative `render.store` state events.
  A sequence orders events from different threads. The process-cache
  counts keep their existing meaning.

### 3. Admit writer work only during idle periods

- **Severity:** Medium. **Effort:** Medium.
- **Source:** Design.
- **Category:** Performance.
- **Location:** Serve activity boundaries and the optional document writer.
- **Terms:**
  - **Activity lease:** A scoped guard that suppresses optional writer work until its active owner releases it.
  - **First latch:** The writer permission that opens after the first committed ready or unavailable Changes result.
- **Background:** A rebuild publishes its head before usage and Changes finish.
  Native HTML work can run without a sidecar call.
- **Problem:** A pause around preparation or sidecar calls leaves parts of an edit unprotected.
- **Impact if no action:** Optional encoding and disk work can continue to slow requests and edits.
- **Root question:** How can optional writes run only while Serve is idle, and resume when idle, without delaying Serve work?
- **Options:**
  - **A.** Give the writer one activity controller and scoped leases.
    Transfer edit ownership through adoption and completion.
    Cover native work, foreground admission, selected captures, sidecar work, and existing maintenance.
    Check permission before each export and publication.
    Existing bounded work can finish. Requests never wait for it. Effort: Medium.
  - **B.** Extend the command's existing pool-admission owner.
    Give the writer an idle-readiness interface.
    Add the same native and lifecycle coverage there.
    This needs more composition and lock-order work. Effort: Medium.
  - **C.** Track generation phases in one command coordinator.
    Drive preparation, usage, Changes, and idle transitions from existing events.
    Keep foreground and pool counters beside them.
    Missing terminal events can keep writes paused. Effort: Medium.
  - **D.** Keep A's writer controller and local activity leases.
    Read the current publication's Changes status before each export and save, outside the controller lock.
    Only Ready or Unavailable permits writing.
    Keep local candidate, foreground, native job, capture, scheduled pool, and maintenance leases.
    Drop the edit transfer through adoption and the separate generation release paths.
    The existing completion notification wakes the writer.
    A missing terminal status leaves writes paused safely until a later generation. Effort: Medium.
- **Left out:** C duplicates the publication owner's phase state. D covers it with fewer transitions.
  A timer heuristic adds an unsupported wait.
  Preparation-only pauses miss background work.
  A sidecar-only check misses native work.
- **Wider fix:** D. Existing publication state covers each adopted edit without a transferred pause scope.
- **Previous examples:** Existing whole-request foreground guards keep detached graph work covered until it returns.
- **Assumptions:** Preserve every output, pool, cache, and admission rule from the task.
  Keep one writer and the first latch.
  A started bounded operation can finish because a request must never wait for its completion.
- **Recommendation:** D, changed from A after the fresh options check.
  Publication state ends each edit at committed completion without extra release paths.
- **Action:** fix now, apply D.
  This workspace's orchestrator makes this call on 2026-11-20 under the performance orchestrator's requirements.

### 4. Bound actual overlapping writer buffers

- **Severity:** Medium. **Effort:** Medium.
- **Source:** Design.
- **Category:** Performance.
- **Location:** Writer batching, segment encoding, and cache export diagnostics.
- **Terms:**
  - **Capacity ledger:** Counters for live owned buffer capacities and their simultaneous high-water value.
  - **Opaque workspace:** Library or allocator memory whose exact capacity the public interface does not expose.
- **Background:** A batch, its next candidate, segment payload, and final segment can overlap.
  Cache reservations and serialized lengths do not measure those allocations.
- **Problem:** The existing charge alone does not prove the writer's actual retained-byte bound.
- **Impact if no action:** Measurements cannot attribute the cold memory increase or verify writer bounds.
- **Root question:** How can the writer enforce a fixed bound on its simultaneous buffer bytes and report them exactly?
- **Options:**
  - **A.** Keep current copies. Add bounded builders and a capacity ledger.
    Account for the next candidate before export and for every overlapping buffer.
    Extra copies can cause smaller batches or dropped writes. Effort: Medium.
  - **B.** Hash borrowed document slices and allocate the final segment once.
    Remove the intermediate payload copy without changing the envelope.
    Add A's ledger and bounded candidate handling. Effort: Medium.
  - **C.** Stream documents through the existing durable staging boundary.
    Remove both full-segment copies from the writer.
    This changes the atomic-publication interface and its error handling. Effort: Large.
  - **D.** Pass prefix, header, keys, and document slices to the existing staging write.
    Keep flushes, receipts, publication, and error handling.
    This changes the shared storage signature and removes both segment copies. Effort: Medium.
  - **E.** Build the segment in place in one fixed-capacity buffer.
    Reserve prefix and maximum header space, then append stored records.
    Put the header immediately before the payload and save one slice through unchanged storage.
    Reuse that buffer and avoid reparsing the generated header.
    Move every save consumer to the built-segment boundary. Effort: Medium.
  - **F.** Add the capacity ledger to current builders and enforce only the parent's batch bound.
    Keep the larger segment-buffer peak and drop this workspace's combined bound. Effort: Medium.
- **Left out:** C changes more of staging than D for the same eliminated copies.
  A larger cache or allocator-option change breaks the task constraints.
  Reporting reserved charges as measured allocations does not meet the goal.
  One durable entry per document failed the recorded retained-pass measurement.
- **Wider fix:** E. One fixed-capacity owner cannot grow beyond the chosen bound.
- **Previous examples:** The process cache reserves transit headroom, but that charge is distinct from live capacities.
- **Assumptions:** Keep one writer encoder, a fixed disk bound, and key-only pending work.
  These come from the task and the accepted store design.
  Preserve the current durable segment envelope and receipts.
  C drops the buffer-only publication-interface assumption while preserving durability.
- **Recommendation:** E, changed from B after the fresh options check.
  It makes the bound structural and keeps the durable storage path.
- **Action:** fix now, apply E.
  Keep the encoded-length target at 1 MiB initially.
  Enforce a 4 MiB combined retained batch and segment-buffer bound.
  Start with a fixed buffer near 2 MiB plus 32 KiB, then verify its exact capacity.
  Charge that capacity instead of the larger current batch reservation.
  Measure export scratch separately and select its fixed allowance from those measurements.
  Report known capacities, conservative bookkeeping charges, opaque workspace, and allocator-retained pages separately.
  This workspace's orchestrator makes this call on 2026-11-20 under the performance orchestrator's memory requirement.

The fresh check corrected the memory premise. Current batch and segment capacities already fit the current charge under today's growth behavior.
That charge exceeds half of transit headroom and is not a measured live-buffer total.
The much larger whole-tree cold increase needs separate phase and process attribution.
On 2026-11-20, the performance orchestrator traced its two modes to sidecar garbage collection before the final edit.
Report writer retained bytes and capacities. The parent judges memory with three cold ten-edit sessions per arm.

Options-check evidence: `.context/persistent-render-store/m4b-options-check-report.md`.
Read-only preparation: `.context/persistent-render-store/m4b-design-investigation.md`.

### 5. Retain exact supported warm-up inputs

- **Severity:** Medium. **Effort:** Medium.
- **Source:** Design.
- **Category:** Performance.
- **Location:** Stored document metadata, HTML composition, and the existing fragment-to-sidecar call boundary.
- **Terms:**
  - **Invocation descriptor:** Private data that identifies an actual core-to-JavaScript call without duplicating its retained props.
  - **Repair:** Browser-compatible HTML normalization that can remove or rename logical instances.
- **Background:** Current metadata can reconstruct top-level JavaScript calls exactly.
  Retained usage has component props and supplied slot names, but loses call order and effective ignore scope.
  HTML repair can also remove a call's logical input record.
- **Problem:** Replaying every usage instance can invent calls or use wrong inputs.
- **Impact if no action:** A restart cannot reliably warm the existing processes with the calls that the store served.
- **Root question:** How can a warm restart warm head processes with real store-served head calls, exact inputs, unchanged output, and bounded memory?
- **Options:**
  - **A.** Reconstruct only top-level JavaScript calls from current prepared inputs.
    Add no stored inputs.
    This needs an explicit narrower scope for HTML-owned JavaScript calls. Effort: Small.
  - **B.** Retain bounded private descriptors for actual component invocations, their order, and ignore scope.
    Refer to surviving usage inputs after repair.
    Move only otherwise-discarded traced props and supplied slot names into a bounded private input table.
    Derive root calls and current generation handles from prepared inputs.
    Keep public usage and comparison identity unchanged. Effort: Medium.
  - **C.** Retain bounded generation-neutral complete request recipes inside the charged document owner.
    Build calls with current handles on a hit.
    This simplifies repair mapping but duplicates props that public usage already retains. Effort: Medium.
  - **D.** Capture bounded references to surviving usage and ignore flags, without orphan inputs.
    Map keys through repair and omit removed invocations.
    Repaired-away regions already carry a repair warning. Effort: Medium.
  - **E.** Capture bounded generation-neutral recipes at the fragment boundary.
    After repair, replace equal props with surviving usage indices and keep only orphan props inline.
    This covers removed calls without changing repair. Effort: Medium.
- **Left out:** Full coverage of HTML-body calls is not a requirement of the accepted performance goal.
  The root may choose A without dropping stored documents.
  References only to surviving usage are a real narrower option, D.
  Persisting generation-owned handles can replay obsolete inputs.
  Replaying composition on a hit repeats the work that the store avoids and can evaluate a sidecar.
  Replaying all returned React instances invents core-to-sidecar calls.
- **Wider fix:** A. Shared canonical root-input, request, and call builders prevent record-path drift without new retained metadata.
- **Previous examples:** The existing usage repair already maps surviving keys and discards removed logical instances.
- **Assumptions:** Preserve #351's mechanism, rules, and 30-call window under the performance orchestrator's call.
  Keep every published byte, usage value, document key, detail id, and comparison identity.
  Keep all retained private inputs inside the existing charged cache owner.
  Only actual supported invocations qualify.
  Full HTML-call coverage came from earlier option text, not the task.
  A drops that assumption. The measured catalogues use only root JavaScript calls or native HTML components.
- **Recommendation:** A, changed from B after the fresh options check.
  It covers every measured catalogue exactly and changes no stored metadata or comparison identity.
- **Action:** fix now, apply A.
  Reconstruct top-level JavaScript root calls only.
  Keep storing every eligible complete document, including HTML bodies that call JavaScript components.
  Those nested calls add no store-fed warm-up request in this change.
  Record current head origin explicitly through the side's source root, since equal base and head can share a generation id.
  Share immutable recent call payloads between the existing recent and per-target queues.
  Deduplicate equal store-derived contributions in the existing bounded recent window, without changing normal render recording.
  This workspace's orchestrator makes this call on 2026-11-20 under the accepted output and memory requirements.

The chosen scope needs no orphan inputs, private codec fields, record-format change, or persistence bypass.
Actual renders and the shared warm-up keep their existing call, yield, end, and render-count rules.
The source arithmetic of the fresh check is not a memory measurement.

Options-check evidence: `.context/persistent-render-store/m4c-options-check-report.md`.
Read-only preparation: `.context/persistent-render-store/m4c-preparation-report.md`.

## Cloud acceptance calls of 2026-11-20

The performance orchestrator accepted the warm restart gain of about 6.5 seconds
on candidate `77c0e70cc` against control `a8256ac6c`. The cold memory and edit
costs do not meet the goal. The following are the performance orchestrator's
calls. They preserve the required output and memory rules.

- Reuse the warm-up mechanism of PR #351 after it reaches `main`. Feed its
  recent-request list from store-served head requests. Widen its target to
  head processes with no render of the newest head generation. After first
  Changes, replay at most 30 such requests per process while Serve is idle.
  Run one call at a time, only with no waiting request and no Serve claim.
  Keep the calls quiet, count them toward the render limit, discard their
  results, and preserve the shared mechanism's request and end rules. Do not add a second mechanism.
  Reason: unchanged warm startup leaves the sidecar processes cold, which
  adds about 0.5 seconds to the first edit.
- Keep the writer paused before first completed Changes. Also pause it while
  a foreground request or edit is in flight. Resume when the pool is idle.
  Reason: about 22 MB of cold-start writes overlap edits and add about
  0.16 seconds to their mean duration.
- Report and bound the writer's actual peak retained queue, batch, and encode
  buffers in a cold session. Encode one document at a time. Select the final
  bound from measurement, with a batch no larger than 4 MiB.
  Reason: cold peak memory was 158 MiB higher across four runs, and 432 MiB
  higher in one ten-edit session. The 2% control limit remains required.
- Fix both confirmed review findings. The highest state sequence must always
  name the newest complete state. Send one SHA with all fixes. The parent
  must approve the confirming run before the pull request opens.

Clarification by the performance orchestrator, 2026-11-20: the earlier phrase "end on any request" was imprecise.
A waiting request takes the process after the warm-up call in flight.
The warm-up continues when the pool is idle.
Keep every end event of #351, including its render-limit cap.
The only warm-up changes are recent store-served head requests and targets without a render of the newest head generation.
A warm-up call in flight also pauses the store writer because the pool is busy.

The performance orchestrator's confirming driver waits 3,000 ms after the ready SSE event before each edit.
Its edit clock starts after the edit command returns.
Keep a separate immediate-edit performance case to check interruption cost.
The stated benchmark gap authorizes that delay only in the measurement driver.

Stack update by the performance orchestrator, 2026-11-20: step 2 and the lower ready fixes merged into main.
Open this pull request against main after the approved #351 integration and confirming run.

On 2026-11-20, the performance orchestrator approved one merge of `origin/main`
after PR #350. Preserve step 2. The warm-up implementation still waits for
#351 on `main`. Independent writer fixes and measurement preparation continue
in the meantime.

## Milestone 1: Documentation and protocol

Depends on: none

State the accepted persistent-render rules before implementation. Add a
linked status line until the implementation meets those rules.

- [x] Update the cache, runtime, format, and timing contracts. Keep the watch
      input list unchanged. Explain unsupported-input reuse across restarts.
- [x] Update the architecture and affected crate READMEs for the new boundary.

Evidence: `.context/persistent-render-store/docs-report.md`.

## Milestone 2: Durable store and bounded writer

Depends on: 1

Retain lossless complete documents under the common cache rules. Keep failures
optional and preserve the process-cache bound.

- [x] Read relevant crate READMEs and Rust reference rules.
- [x] Add assertion-red tests through real public boundaries for durable
      restart bytes, changed-key misses, damaged and foreign-entry misses,
      access-order eviction, and full-queue drops without a time assertion.
- [x] Implement the versioned payload and fixed-byte render cache kind.
- [x] Implement bounded writer admission and off-path writes. Check writer
      lifetime, cancellation, durable publication, and concurrent readers.
- [x] Measure stored fraction and durable write throughput after one complete
      cold pass. Avoid per-document namespace scans. Evaluate batched segment
      publication if individual durable writes cannot retain that pass.
- [x] Record measured sizes, queue behavior, and write cost under `.context/`.
- [x] Measure encoder-lease contention with the writer active. Keep its
      export reservations inside the existing process-cache headroom.

Evidence: `.context/persistent-render-store/milestone-2-report.md` and the
final root checks in `m2-root-clippy.log` and `m2-root-repeats.json` there.

## Milestone 3: Render integration and freshness

Depends on: 2

Use stored compositions without bypassing validation or changing output.

- [x] Key stored documents with all required runtime, build, and configuration inputs.
      Test the `jsconfig.json` chain, including changed and missing candidates.
- [x] Inject the shared store into head and base graph runtimes. Read after a
      memory miss. Offer fresh documents without blocking publication.
- [x] Prove that stored reads repeat closure, link, and usage work for their
      current side. Preserve root scheduling and memory admission.
- [x] Run targeted tests. Run each new asynchronous test ten times. Record
      assertion-red evidence, run times, and test counts under `.context/`.
- [x] Remove documentation status lines when the implementation meets them.
- [x] Check the upgrade guide against implemented behavior. Correct the cache
      deletion wording for the accepted unsupported-input rule.

## Milestone 3a: Store-cold benchmark preparation

Depends on: 2

The benchmark reset is independent of graph wiring. It uses the CLI's cache
announcement and the `renders` kind, without copying platform cache paths.
Any discovery Serve invocation is unmeasured benchmark preparation. The
product starts no new process for this helper.

- [x] Make the official large-fixture cold path empty only the render kind
      before every measured cold start. Keep the other cache kinds and warm
      writes. Keep the existing scenario results and timeouts.
- [x] Prove reset behavior red first, then green. Check the new asynchronous
      test ten times. Align the large-fixture README.

Evidence: `.context/persistent-render-store/official-large-cold-report.md`.

## Milestone 3b: Complete the warm measurement seed

Depends on: 3 and 3a

The cold benchmark can finish before Changes completes. Optional writes wait
for that completion. Keep the cold process alive outside its measured window,
so its warm restart can reuse the documents that the writer retains.

- [x] Wait for completed Changes and the writer's idle state after the measured
      cold phase. Use existing wait limits. Record this preparation separately.
- [x] Prove the cold-to-warm seed and retained measured result count through
      targeted tests and a real official benchmark smoke.
- [x] Align the recipe field contract and the unsupported-input authoring guide.

Evidence: `.context/persistent-render-store/official-large-warm-seed-report.md`,
`release-smoke.log`, and the official HTML release smoke records there.

## Milestone 3c: Validate the store timing event

Depends on: 3b

The complete gate found an existing test reader that recognizes only the
three older timing event kinds. Extend that reader for the accepted store
state event. Keep all existing envelope, span, and count assertions.

- [x] Validate the new store state fields and require the event in the
      existing Serve timing test. Rerun the affected test and viewer suite.

Evidence: `.context/persistent-render-store/timing-validator-report.md` and
`viewer-gate-fixed.log`.

## Milestone 4a: Review the pushed candidate

Depends on: 3c

Run the post-push review before the final release series. This avoids
repeating hours of measurements for a review fix. The acceptance results
still block the pull request.

- [ ] Review the complete local diff against `origin/main` after the push,
      with the `implementation-review` skill. Check findings with fresh
      second-pass reviewers. Apply up to two fix rounds and re-review.
      Record deferred work as follow-up items.
- [x] Confirm the review findings with separate fresh checks. Fix confirmed
      foreground preparation and state-ordering defects with assertion-red
      regressions. Preserve the render and memory boundaries.
- [ ] Check the combined fixes, commit and push, then run the fresh re-review.
- [x] Pause new writer units across reference probes and the hand-off to a refreshed
      classification. Apply the checked owner-level lease, keep it with blocking
      work, and prove suppression and release with deterministic barriers.
- [x] Record broader Git default enrollment, pool-release calls, and finite
      response streams as one follow-up class. Keep its missing behavior
      explicit in the protocol status, and include it in the final review.

Evidence: `.context/reviews/calummoore/mokly-first-changes-5-render-store-p3o6/`
holds the independent reports, checks, decisions, and fix-round record.
`.context/persistent-render-store/fix-round-1-report.md` records the delegated
fixes, red proofs, repeated checks, and test-fixture correction.

## Replaced ways in the writer fixes

The built-segment boundary replaces the new record-vector save boundary.
Consumers are the writer batch, the durable backend, command fallbacks, mocks,
and store and writer test fixtures.
The appending stored-record encoder replaces the new owned-record buffer API where the segment builder consumes it.
Move its codec tests and every caller to that boundary with the same assertions.
Remove the unused record-save API, duplicated payload/header reconstruction, and converters after all consumers move.
This replacement changes only the storage introduced by this plan.
It preserves the segment envelope, durable receipts, and external rendered bytes.

## Milestone 4b: Pause writes and measure writer memory

Depends on: 4a finding checks

Apply the performance orchestrator's cold-edit and memory calls. Keep all
existing cache and pool memory limits.

- [x] Record the writer peak queue, active batch, and encode buffers through
      bounded diagnostics. Separate reserved charge from retained allocation.
- [x] Pause optional work while a foreground request or edit is in flight.
      Preserve the first-Changes pause and resume only when the pool is idle.
- [x] Prove the admission and pause behavior red first with deterministic
      barriers. Keep a single encoder and a batch no larger than 4 MiB.
- [x] Move all old record-save consumers to the built-segment boundary.
      Remove the unused save API and its converters. Preserve every existing test assertion.
- [ ] Attribute cold peak anon plus swap by phase and process.
      Separate core writer work from sidecar and allocator-retained memory.
- [ ] Measure compaction admission and drop behavior with the smaller writer reservation.
- [ ] Measure a cold ten-edit session and report exact writer peak bytes.
- [x] Require each document backend to supply the envelope version explicitly.
      Preserve the Mokly package version and remove the implicit Cargo crate version.
- [ ] Run the repository and complete gates on the combined tree with Rust
      1.98.1. Name each new cloud suite and any machine blocker.

Evidence: `.context/persistent-render-store/m4b-implementation-report.md` records
the source boundary, buffer ownership, red proofs, and targeted checks.

## Milestone 4c: Warm head processes through the shared warm-up

Depends on: 4a finding checks and PR #351 merged into main

Use only the shared warm-up mechanism. Prepare its performance proof while
waiting for the required merge.

- [x] Prepare the unchanged-tree warm restart followed by first-edit
      comparison against the control. Use one-time performance evidence.
- [x] Merge the approved main after #350 and #351 under the merge skill.
      Preserve both features and audit the combined tree.
- [x] Reconstruct exact top-level JavaScript calls through shared canonical builders on usable store hits.
      Preserve public usage, bytes, comparison identity, and document persistence for every view kind.
- [x] Share immutable call payloads across the recent and target queues.
      Deduplicate store-derived equal calls without changing normal render recording or the 30-call bound.
- [x] Feed store-served head requests into the recent-request list. Warm
      head processes with no render of the newest head generation under the
      prescribed idle, claim, cancellation, quiet-call, and render-count rules.
- [x] Count each in-flight shared warm-up call as pool activity for writer suppression.
      Preserve the shared pause-and-continue and end rules.
- [x] Prove scheduling and cancellation red first.
- [x] Save the named assertion-red proof for the failed-warm-up attempt rule.
      Preserve the existing test and restore the temporary mutation.
- [ ] Measure the first edit within the control's run-to-run noise.
- [x] Align protocol and architecture text with these implemented rules.

Implementation and preparation evidence: `.context/persistent-render-store/m4c-implementation-report.md`
and `confirmation/preparation.md` there.
Integration decisions: `.context/persistent-render-store/post-351-merge-decisions.md`.
The current-main integration before the combined gate is recorded in
`post-374-merge-decisions.md` there.
The later parent-approved conflict integration with main 940ddd742 is recorded
in `post-384-merge-decisions.md` there.

## Milestone 4: Measurements and verification

Depends on: 4a fixes, 4b, and 4c

Measure release builds against the last merged main in separate checkouts and
target directories. Run Cargo builds one at a time. Check disk and memory first.

- [ ] Measure at least six interleaved cold and warm rounds on `examples/basic`
      and large HTML and React fixtures. Include unchanged and one-line-edit
      restarts. Compare Changes and published bytes. Measure ten-edit memory.
- [ ] Send the pushed implementation SHA and dist build commit to the
      performance orchestrator for `mokly-cloud` measurement immediately.
- [ ] After the approved main 940ddd742 conflict integration and combined gate,
      send the merged SHA for the parent's short confirmation against that main:
      three changed and three unchanged warm restart rounds, and one cold
      ten-edit session per arm. Obtain acceptance before opening the pull request.
- [x] Commit and push a measurement candidate after its targeted and required
      gate checks. This lets the cloud measurement run before final acceptance.
- [x] Confirm the cloud goals: at least four seconds sooner on warm restart,
      cold startup no more than 2% slower, memory peak no more than 2% higher.
      Run the parent confirming series on the one SHA with all fixes before
      opening the pull request. Include three cold ten-edit sessions per arm.
- [x] Run the strict example build and Serve smoke check.
- [x] Run `cargo xtask check --suite repository` and `cargo xtask check` with
      Git 2.45 or later, git-lfs, pinned Bun, and locked Cargo dependencies.
      Record any machine blocker and each suite that ran.

Evidence: `.context/persistent-render-store/` holds all logs and reports.
`cloud-final-acceptance-0ccd.md` records the accepted final cloud series and its CPU and timing limits.
The performance orchestrator requires no further main merge unless a conflict or CI needs it.

## Milestone 5: Commit, review, and pull request

Depends on: 4 and 4a

- [ ] Commit the final implementation with Conventional Commits and push.
      Watch CI with `scripts/ci-wait.sh`.
- [ ] Integrate current main and the highest lower step that has a pull request,
      under the stacking rule and the `git-merge` skill. Verify the combined tree.
- [ ] Delete this plan under the `plans` skill after its required work completes.
- [ ] Open the stacked pull request. Keep every dated decision and design call
      in its description. Wait for CI. Report to the sending session. Do not merge.
