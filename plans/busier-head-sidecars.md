# Keep head sidecars busy during startup

Status: Active. On branch `calummoore/mokly-first-changes-4-busier-sidecars-3nds`, no pull request exists yet. The completion pull request deletes this plan.

On 2026-11-19, Cal chose option D of the first-Changes series. Each step gets
its own stacked pull request. This plan owns step 4: reduce the startup head
usage pass without changing its result. Cal delegated design choices that
keep output equal and memory bounded. Cal holds every merge into `main`.

The performance orchestrator's calls of 2026-11-19 require a gap probe before
design, an evidence-based options check, unchanged process and ordering rules, and
red-first tests for changed scheduling. The probe was reported before design.
It found that core document work occupies 59.7% of the gaps. Admission and
JSON work occupy small shares. Serve did not saturate four CPUs.

The baseline is current `origin/main`, initially `6ae96ed08`, then
`f4f0082fd`. The latter changes only agent instructions. Before acceptance,
main advanced to `c05a9d47b` with shutdown fixes and a Windows process test.
The branch integrated it without conflicts and preserves every incoming path. Probe evidence is
under `.context/busier-sidecars/probe/`. Logs remain outside this plan.

Contract owners:

- [On-demand Serve](../docs/protocol/mokly-on-demand.md).
- [Sidecar memory](../docs/protocol/mokly-sidecar-memory.md).
- [Source root scheduling](../docs/protocol/mokly-sidecar-root-scheduling.md).
- [Render cache](../docs/protocol/mokly-runtime.md#render-graph-and-cache).
- [HTML pipeline](../crates/mokly-html/README.md).
- [Server](../crates/mokly-server/README.md) and [CLI](../crates/mokly-cli/README.md).

## Design decision

### 1. How should the head pass finish sooner?

- **Severity:** Medium. **Effort:** Large.
- **Source:** Design.
- **Category:** Performance.
- **Location:** `crates/mokly-server/src/background.rs`, `crates/mokly-graph/src/workers.rs`, and `crates/mokly-html/src/javascript.rs`.
- **Terms:**
  - **Usage pass:** Serve renders all current views after readiness, then starts Changes classification.
  - **Completion:** Core parsing, composition, validation, serialization, closure work, and cache work after a fragment returns.
  - **Stage bound:** The smaller of Serve workers and current sidecar capacity, with a minimum of one.
- **Background:** A view holds its batch place until its whole document ends. The graph also holds a render thread during its sidecar wait. Each sidecar is busy for about 63% of its render interval.
- **Problem:** Completion prevents another view from reaching an idle sidecar. Repeated HTML parsing also consumes CPU.
- **Impact if no action:** The startup pass and first Changes keep their current delay.
- **Root question:** How can Serve finish the current views and publish first Changes at least 0.8 s sooner while keeping output, responsiveness, scheduling, and memory limits?
- **Options:**
  - **A.** Reduce sidecar CPU work only. Choose byte-equal cuts from a Node profile. Its gain is unknown. Effort: Medium.
  - **B.** Overlap sidecar work and completion under separate stage bounds and shared byte accounting. Host CPU can limit its gain. Effort: Large.
  - **C.** Combine B with one fragment token pass for parsing and source checks. This also reduces core CPU work. Effort: Large.
  - **D.** Combine C with profile-supported sidecar cuts. Profile Node before changing its work. Keep only cuts that preserve exact results and improve measured cost. Effort: Large.
  - **E.** Render later root fragments ahead through the existing cache. The check proposed this handoff owner. Its fallback repeats failed or unretained calls. It is excluded as proposed. Effort: Large.
  - **F.** Combine E with the token pass and supported sidecar cuts. It retains E's repeated-call risk. It is excluded as proposed. Effort: Large.
- **Left out:**
  - Single parsing alone saves too little to meet the target.
  - More sidecars breaks the fixed pool size and increases memory.
  - Uncharged completion state breaks the explicit memory requirement.
  - A larger cache breaks the fixed 256 MiB bound.
  - More queued requests on each process changes claims, recycling, and deadlines.
  - A larger whole-document window alone leaves the graph thread limit and adds uncharged trees.
  - Dropping normalization or validation has no equal-output proof.
  - E and F repeat a failed render or a render that the cache did not retain. This adds a retry or duplicate attempt.
  - Deeper core cuts alone have no supported gain that meets the target.
  - Transport handoff cuts alone do not meet the target.
  - An asynchronous client changes the claim path that must stay.
  - Base work during the pass needs another memory rule and does not shorten this pass.
  - Moving memory sampling changes the recycling contract.
  - Persistent renders belong to step 5.
- **Shared assumptions:** Exact output, freshness, root scheduling, foreground priority, pool size, claims, cache bounds, and start/report order remain requirements. Sources: Cal's task and the contract owners above. Outside host load is measured context, not a requirement. B through D drop the current whole-document batch mechanism and render-pool dispatch assumption. C and D drop repeated fragment parsing.
- **Wider fix:** D. Explicit stage ownership and charged byte leases prevent completion from accumulating outside the bound.
- **Previous examples:** PR #225 and the follow-up items for sidecar prestart, parsed-tree memory, and bundle-response encoding.
- **Recommendation:** D. Overlap alone can become CPU-limited. The check recommended F instead of the original D. Keep D because E and F add repeated calls, while Cal forbids new retries. D preserves the single attempt and supports the existing failure path.
- **Action:** fix now, apply D. This is the workspace orchestrator's call of 2026-11-19 under Cal's design delegation. The independent options check is complete.

The options check added E and F and identified the ownership requirements
below. Its report is `.context/busier-sidecars/plan-options-check.md`.
No choice needs Cal. A failed render-ahead call repeated by its own document
is a retry under this task, regardless of its name.

### 2. How should Node avoid repeated parsing?

- **Severity:** Medium. **Effort:** Medium.
- **Source:** Design.
- **Category:** Performance.
- **Location:** `packages/mokly/src/sidecar/registry-styles.ts`, `styles.ts`, `markup.ts`, and `render.ts`.
- **Terms:**
  - **Parsed fragment:** The parse5 tree for one exact HTML string. Registry class selection and markup finalization currently build separate trees.
- **Background:** The Node profile attributes 7.78% of render samples to registry HTML parsing and 8.25% to final markup parsing. HTML stays equal unless a component renderer drops its node and needs a prefix. The duplicate parse exists only with a nonempty native registry sheet.
- **Problem:** Screens parse the same bytes twice. Components can change the bytes by adding an output prefix, so their earlier tree cannot always be reused.
- **Impact if no action:** Sidecars keep paying this parser and allocation cost while overlap approaches the CPU limit.
- **Root question:** How can each render parse equal HTML bytes once, with identical output, errors, and order, and memory bounded by that render?
- **Options:**
  - **A.** Keep both parses and rely on the other planned cuts. This has no Node change but retains the measured work. Effort: Small.
  - **B.** Share a typed per-render owner of exact HTML and its lazily parsed tree. Reuse it for both existing consumers. A changed string gets a new owner. The tree stays live during registry CSS filtering, so peak memory needs measurement. Effort: Medium.
  - **C.** Merge registry class collection and markup finalization into one collector. It can also remove a tree walk, but must defer errors to preserve phase precedence. Effort: Large.
  - **D.** Memoize parse results across renders. It could remove more work, but requires keys, eviction, byte accounting, and a measured equal-input rate. Effort: Large.
  - **E.** Keep the string APIs and pass an exact-string parse memo through every consumer. It gives the same saving but can silently lose sharing when a caller omits it. Effort: Medium.
- **Left out:** Skipping source locations changes replacement offsets. Reusing a tree after a prefix changes the input and its positions. Global unbounded memoization breaks memory limits. Registry CSS caching has no measured equal-input rate and answers a different question.
- **Shared assumptions:** Exact HTML, CSS, marker records, offsets, error order, and wire output remain requirements from the task. No new persistent cache or budget is required. The separate parse invocations are code mechanics that B and C drop. D drops the per-render lifetime assumption.
- **Wider fix:** B. One exact-input owner makes sharing explicit without persistent state.
- **Previous examples:** The same profile found repeated core fragment tokenization, addressed in Milestone 3.
- **Recommendation:** B. The independent check kept B. Its type binds each tree to its exact bytes, and every caller must use it. E permits a missed sharing argument.
- **Action:** fix now, apply B. This is the workspace orchestrator's call of 2026-11-19 under Cal's delegation. The fresh options check is complete.

Keep parsing lazy when the registry CSS is empty. Keep registry processing
before marker finalization. A component output prefix changes the exact input
and must invalidate its earlier tree. Session rendering and every direct
consumer use the new owner. Do not retain a converter for the string API.
The owner and its tree end with one render and never enter a wire response.
Every parse uses source locations, even when the registry reads first. Both
consumers treat the tree as read-only. Keep their separate walks: the registry
does not enter template content, while markup finalization does. Markup skips
style children, while registry selection visits them. Keep `nativeSheet()`
and CSS failures before markup failures. Release the old owner after a prefix,
without a second live alias. Keep registry styles before inline styles.

The owner can overlap one tree with the PostCSS working tree. Check its early
cgroup peak before accepting the cut. The large HTML fixture has no native
registry and gets no parser saving. The profile's component views retain their
node, so all 1,560 profiled views can share their parse. The check report is
`.context/busier-sidecars/node-parse-options-check.md`.

## Design and ownership

The process pool already releases its slot before completion. The new work
must admit the next view sooner, rather than extend or replace that lease.
Keep the default pool's claims and growth checks unchanged.

Keep at most one stage bound of views in each current pass window and one
shared bound of owning completion chains across replacement passes. Cancelled
views that never hand off retain the original server worker and claim bounds.
Read capacity before admission. A lower capacity stops new work without
cancelling work already admitted. Preserve catalogue start order and ordered
warning and failure delivery. Publish usage only after every document ends.

Only a successful root fragment of the owning head view can yield its place.
The root has no HTML template and has built no partial tree. Template views
keep their document place and take a completion place before composition.
Nested link-validation renders cannot signal for their caller. Foreground
and base calls retain their rules. A view signals once. Later fragment calls
use the existing gate. Failed root calls follow the original failure path.

Take a worker permit only at view start. Release it at the admitted handoff.
Completion waits only for a completion place. It never waits for foreground
idleness or another worker permit. Acquire no blocking completion place while
holding a fragment flight, cache mutex, or anchor flight. The handoff occurs
after the fragment flight guard drops. Cancellation discards unpublished
evidence. Stop drains both stages.

The accepted correction separates root acquisition from document completion.
Keep root waits off the render pool. Keep heavy completion on its existing
threads. The full ownership rules are in decisions 3 and 4 below.

Keep completion counts and a separate bounded transient byte owner. Keep
cache lookup, insertion, compaction, retention, and its 256 MiB total on main's
path. The performance orchestrator authorized the separate transient bound
on 2026-11-20 after the measured cache displacement. Nested validation stays
in its owning synchronous completion chain and takes no second place.

Document the reason that sidecar-stage views can hold worker permits while
their calls wait behind later calls from completion. Run an early cgroup
memory diagnostic after bypassing the render pool. Allocator heaps on the
additional busy threads must also pass the whole-tree memory condition.

Use one fragment token stream for the tree and existing source checks.
Preserve the first error in token order, page-check precedence, repaired
trees, warnings, authenticated markers, source locations, and raw-text rules.
Keep final document normalization and every closure and link check.

Profile Node once before choosing any sidecar cut. A material new design call
gets its own options check before code. Keep request types and wire semantics
unless a checked design call explicitly changes them.

Replaced ways:

- Whole-document background occupancy becomes bounded, charged stage ownership.
  Consumers: the usage window, background workers, graph dispatch, and stop.
  Migrate them in Milestone 4. Keep ordinary render behavior intact.
- Separate fragment parsing and source-check parsing become one token stream.
  Consumers: JavaScript fragment expansion and its validation result.
  Migrate them in Milestone 3. Remove only the redundant invocation.
- Separate Node HTML parses become one per-render exact-input owner.
  Consumers: registry styles, style collection, markup finalization, render,
  session rendering, and direct registry tests. Migrate them in Milestone 2.

## Acceptance update, 2026-11-20

The performance orchestrator measured six interleaved Mokly Cloud runs of `0b2295917` against main `c05a9d47b`.
The usage pass improves by 961 ms. First Changes improves by 270 ms because base capture slows by 874 ms.
Base capture renders 126.7 sidecar views instead of 45.5. Usage-pass cache evictions grow from 626 to 704.
Capture cache misses grow from 91 to 253. Each later edit's classification is 100 to 150 ms slower.
The orchestrator confirms cache displacement, rather than unfinished completion work, explains this cost.

The orchestrator's call of 2026-11-20 changes first-Changes acceptance to at least 0.5 s earlier.
The classify stage of each edit must be within 20 ms of main. Session CPU must not increase.
Memory stays within 2% on basic, large HTML, and large React. The existing usage-pass gain target remains.
The orchestrator allows completion bytes outside retained-cache capacity, or another bound that preserves head cache contents.
The 256 MiB retained-render cache total must not increase. No allocator option may change.

### 3. Keep completion on existing allocating threads

- **Severity:** Medium. **Effort:** Large.
- **Source:** Implementation.
- **Category:** Performance.
- **Location:** `crates/mokly-graph/src/session.rs:141`, `crates/mokly-html/src/composition.rs`, and `crates/mokly-graph/src/workers.rs`.
- **Terms:**
  - **Completion:** Parsing, composition, validation, serialization, closure checks, and cache insertion after a fragment returns.
  - **Render pool:** Existing machine-sized Rayon threads that run ordinary document and comparison work.
  - **Tokio blocking job:** Existing server job that waits for a synchronous background document call.
- **Background:** Main runs background document allocations on the render pool. Step 4 runs the whole document on a Tokio blocking job. The pure HTML fixture has no Node sidecar or successful root handoff.
- **Problem:** The native core retains 51,113,984 extra bytes at startup. The measured memory ratio is 1.061739. Core thread counts match at phases, but different thread groups perform the allocations. The core uses mimalloc with per-thread heaps.
- **Impact if no action:** The change fails the required 2% memory bound.
- **Root question:** How can document work use memory within 2% of main while keeping the useful overlap, existing scheduling, and exact output?
- **Options:**
  - **A.** Run non-handoff document kinds on the existing render pool. Acquire completion before pool dispatch. Keep eligible JavaScript roots on their current admitted job. This is narrower, but JavaScript still allocates on different threads. Effort: Medium.
  - **B.** Split eligible root fragment acquisition from document completion. Acquire the fragment on the admitted job, then run all allocation-heavy completion on existing render threads. Carry the exact single-attempt result, including failures. This needs an explicit phase owner across composition. Effort: Large.
  - **C.** Keep current thread placement and lower the number or retained bytes of overlapping completions. This can reduce memory, but can lose the required startup gain and does not remove duplicate allocating heaps. Effort: Medium.
  - **D.** Restore original graph-pool dispatch for all backgrounds. Keep parser cuts only. This removes useful overlap and fails the supported startup goal. Effort: Medium.
  - **E.** Keep composition on the admitted job, then move finishing, closure checks, and insertion to the render pool. Most tree allocations remain on the admitted job. Effort: Medium.
- **Left out:**
  - C retains the allocation placement that the probe implicates.
  - D loses the required overlap gain.
  - A first-call fragment interceptor or a second compose pass needs an equality guard or control-flow error. B uses the existing root-only call site directly.
  - More threads or processes breaks the fixed-resource goal.
  - Changing mimalloc options or purges breaks the performance orchestrator's call.
  - Raising memory limits breaks acceptance.
- **Shared assumptions:** Exact output, freshness, root scheduling, pool size, cache bound, no retry, and the memory bound remain task requirements. Current synchronous whole-document execution is code mechanics, which B drops. The dispatch probe must establish whether placement causes the measured bytes.
- **Wider fix:** B. An explicit phase owner keeps heavy document work on the existing bounded allocator heaps.
- **Previous examples:** The pure HTML pair isolates 51,113,984 extra native-core bytes. The original-pool variant returns its startup memory ratio to 0.994680. Thread counts alone do not identify individual heaps.
- **Recommendation:** B. The fresh options check replaces provisional A. Existing render-pool placement removes the HTML increase. B gives that placement to every view kind and keeps useful overlap. A leaves JavaScript allocation placement unprotected.
- **Action:** fix now, apply B. This is the workspace orchestrator's call of 2026-11-20. The performance orchestrator approved the prepared-root design. The causal probe and fresh options check are complete. No user decision is pending.

### 4. Keep head cache entries during overlap

- **Severity:** Medium. **Effort:** Medium.
- **Source:** Implementation.
- **Category:** Performance.
- **Location:** `crates/mokly-graph/src/background.rs`, `crates/mokly-graph/src/cache_state.rs`, and `crates/mokly-server/src/background_stage.rs`.
- **Terms:**
  - **Payload lease:** A capacity-based byte reservation that lives until one owning completion job ends.
  - **Head cache:** The existing render cache entries produced by the current usage pass and reused by base capture.
- **Background:** The first implementation deducts payload leases from retained render-cache capacity. Reservations discard oldest retained documents instead of preserving their compact forms. This creates more base renders and later edit work.
- **Problem:** About 78 extra usage-pass evictions lead to about 81 extra sidecar views in base capture. Their cost removes most startup gain. Later edit classification also slows.
- **Impact if no action:** First Changes and later edits fail acceptance despite the faster head pass.
- **Root question:** How can overlap bound its extra in-flight bytes while the render cache keeps the same contents and eviction counts as on main?
- **Options:**
  - **A.** Admit a payload only from currently unused retained-cache capacity. Keep original dispatch ownership when the cache has no room. Cache inserts must not lose entries to active leases. This may disable overlap late in the pass. Effort: Medium.
  - **B.** Move payload leases to a separate, small count-and-byte bounded owner. Leave cache capacity, compaction, insertion, and eviction exactly on the main path. Refuse handoff when the transient bound is full. Choose the internal byte cap from measured fragment capacities and the whole-tree memory allowance. This is authorized by the performance orchestrator. Effort: Medium.
  - **C.** Combine B with the phase split of item 3 B. This labels the combined fix and is not a separate budget approach. Effort: Large.
  - **D.** Cap each root charge and keep only the existing shared count bounds. The total byte bound grows with capacity. Effort: Small.
  - **E.** Use B, but end a charge at completion entry. This permits more overlap if measured refusals cost the startup target. Effort: Medium.
- **Left out:**
  - A loses overlap when the cache fills, or still displaces retained entries on insert. Main already has 626 usage-pass evictions on Cloud.
  - Reservations that compact instead of discard still change retention and add encode CPU.
  - Raising 256 MiB breaks the task.
  - Compaction-headroom leases reduce main's existing compaction capacity.
  - Unbounded payloads break memory safety.
  - Smaller cache-evicting charges still discard useful entries repeatedly.
  - Retrying refused or unretained payloads is forbidden.
- **Shared assumptions:** The cache stays bounded at its existing total and preserves main's compaction behavior. Sources: task and performance orchestrator's explicit call. Charging extra payloads to retained-cache capacity is an earlier design mechanism, which the orchestrator now allows B and C to drop. Extra retained bytes still require explicit lifetime, count, byte, cancellation, and fallback bounds.
- **Wider fix:** B. A transient owner separates dispatch overlap from the useful retained render set.
- **Previous examples:** The orchestrator's cloud capture counts show this exact displacement cost. The existing sidecar memory rule separately bounds in-flight work and process retention.
- **Related:** Item 3 shares option C's phase owner with item 3 option B. Either implementation must preserve completion admission outside flights and cache locks.
- **Recommendation:** B, together with item 3 B. Stages owns the byte bound beside its completion count. The retained cache follows main's path. Refusal keeps original dispatch ownership. Use E only if measured refusals cost the startup target.
- **Action:** fix now, apply B. The fresh options check kept B. This implements the performance orchestrator's call of 2026-11-20 without raising the cache bound.

The full options check is `.context/busier-sidecars/performance-fix-options-check.md`.
The performance orchestrator approved the combined design on 2026-11-20.
The revised acceptance supersedes the earlier first-Changes target in this plan.

The explicit prepared result includes success or failure. Composition consumes
it only at its owning root call. Shared start and request builders prevent
request drift. A second take returns an internal error and never renders again.
Custom composers default to no preparation.

All completion-place waits happen on the admitted job before render-pool
dispatch, outside fragment flights, anchor flights, and cache locks. Native
templates, Markdown, cached documents, and ineligible views use the existing
render worker. Eligible root acquisition remains on the admitted job. Full
composition, serialization, closure checks, nested validation, and insertion
run on the existing render worker. Nested validation takes no second place.

The cache probe changes no count, promotion, or decode. The real read occurs
once on the render worker. A late cache eviction falls back to the original
worker-bound path. A prepared failure keeps its exact error wrapping and
single attempt without completion admission. Traces keep render.fragment
inside render.document.

Stages owns a shared transient byte budget across replacements. Charges use
capacities and metadata, without JSON encoding. A successful charge lasts
until view finish. Refusal retains the original dispatch worker. Every
cache lease and its altered retained-capacity arithmetic is removed, so
cache insertion, compaction, lookup, and bounds match main. The initial
internal cap is 4 MiB for one Serve. This is a small bounded part of the
measured memory allowance. No setting is added. Measure actual charges and
refusals before accepting it.

## Milestone 1: Documentation and contracts

Depends on: none

- [x] Document the bounded stages, charged memory, fallback, priority, order, and draining rules.
- [x] Update the server and CLI entry-point descriptions that change.
- [x] Keep protocol and README status lines until the implementation matches.

Evidence: `.context/busier-sidecars/docs-m1-report.md`. Root checked all four
diffs and clarified the shared-work wait and the zero floor of cache capacity.

## Milestone 2: Sidecar CPU work

Depends on: 1

- [x] Capture one Node CPU profile of the startup usage pass on clean main.
- [x] Identify Mokly-owned work separately from React and consumer rendering.
- [x] Record any selected sidecar cut and run its options check before implementation.
- [x] Share the per-render parsed HTML owner across registry and final markup processing.
- [x] Preserve lazy empty-registry behavior, component-prefix invalidation, source positions, and error order.
- [x] Keep separate read-only tree walks. Check the combined early cgroup peak in Milestone 4 before accepting the owner lifetime.
- [x] Migrate all consumers and tests of the replaced string API, with every assertion preserved.
- [x] Run targeted existing tests and a one-time exact-output and parse-count proof.

Evidence: `.context/busier-sidecars/sidecar-cpu/`.

## Milestone 3: Cheaper fragment completion

Depends on: 1

- [x] Share the existing token stream between fragment parsing and source checks.
- [x] Preserve error order, page precedence, source positions, repair, and warnings.
- [x] Run existing HTML and rendering tests unchanged. Save a mutation or equivalence proof.
- [x] Remove the redundant parse invocation and identify the useful code entry points for documentation.

Evidence: `.context/busier-sidecars/core-completion/` and
`.context/busier-sidecars/node-parse/`. The existing saved-plan flake passed
its one exact rerun. The pull request body will record this occurrence, as
the performance orchestrator requested.

## Milestone 4: Bounded overlap

Depends on: 2 and 3

- [x] Add failing behavioral tests before implementing the changed scheduling rule.
- [x] Prove that the next view can start while the first completes, within both stage bounds.
- [x] Prove ordered reporting, foreground priority, cancellation, and stop draining.
- [x] Add byte leases within existing render accounting and synchronous fallback when no charge fits.
- [x] Release dispatch ownership only after claim release and safe payload admission.
- [x] Check nested link renders, template eligibility, lock-free waits, and the unchanged single-attempt failure path.
- [x] Run background documents on their admitted blocking job without the graph-pool bottleneck.
- [ ] Attribute the early diagnostic memory variation and confirm the acceptance bound.
- [ ] Run an early cgroup anon-plus-swap diagnostic of both parser cuts and the bypass before accepting them or running the full matrix.
- [x] Keep the existing Serve and pool tests unchanged. Repeat new asynchronous tests ten times.
- [x] Remove pending documentation status lines after the implementation matches.

Evidence: `.context/busier-sidecars/bounded-overlap/report.md` and
`.context/busier-sidecars/docs-m4-report.md`. Root checked ownership, cache
accounting, defaults, replacement, and preserved tests against the code.

## Milestone 4a: Acceptance corrections

Depends on: 2 and 3

- [x] Attribute the HTML core increase with a context-only existing-pool variant.
- [x] Attribute the first capture regression with the performance orchestrator's exact-arm cache counts.
- [x] Run a fresh options check for the thread placement and transient owner.
- [ ] Update protocol decisions and crate entry points for the accepted corrections.
- [ ] Extract shared pre-root state and request construction. Carry one opaque successful or failed prepared result.
- [ ] Put all full completion on existing render workers. Admit completion before pool queueing, outside flights and locks.
- [ ] Preserve one counted cache read and exact error/trace nesting. Keep nested checks inside the owner.
- [ ] Replace retained-cache leases with a shared 4 MiB transient owner in Stages. Restore main's cache path.
- [ ] Add red-first regressions for the changed preparation, worker placement, cache retention, charge refusal, and cleanup behavior.
- [ ] Preserve every existing Serve and pool test. Repeat new asynchronous tests ten times.
- [ ] Measure actual charge sizes/refusals, cache counts at startup and per edit, and the corrected whole-tree memory on all fixtures.
- [ ] Obtain the revised canonical acceptance before the pull request.

Evidence: `.context/busier-sidecars/cloud-0b229-result.md`,
`measurements/diagnostic-html-graph-placement-report.md`, and
`performance-fix-options-check.md` under the same context folder.

## Milestone 5: Measurement and verification

Depends on: 4

- [x] Build release main and branch in separate checkouts and target directories.
- [ ] Run six interleaved cold and warm rounds on the basic, large HTML, and large React catalogues.
- [ ] Report pass time, first Changes, Serve CPU per second, host CPU, and cgroup anon plus swap for both arms.
- [ ] Check foreground response times and ten-edit sessions for speed and peak memory.
- [ ] Prove equal documents, usage, resources, warnings, diagnostics, and result order once.
- [x] Run targeted tests, the repository suite, and the complete gate with the required tools and locked Cargo graph.
- [x] Run the strict example build and a live smoke. Save a browser screenshot under `.context/`.
- [x] Commit and push the implementation. Send its SHA and dist source commit immediately for cloud measurement.
- [ ] Obtain revised cloud acceptance: usage pass at least 0.8 s sooner, first Changes at least 0.5 s sooner, each edit classification within 20 ms, session CPU no higher, and memory within 2%.

Evidence: `.context/busier-sidecars/measurements/` and `.context/busier-sidecars/checks/`.
The complete gate hit the known saved-plan harness flake owned by PR #352.
Its exact reruns passed. Standalone Native, Viewer, Browser, and delivery
coverage passed. No complete-gate pass is claimed. The implementation push
allows independent cloud measurement while local acceptance remains open.

## Milestone 6: Commit, review, and pull request

Depends on: 5

- [x] Commit with Conventional Commits and push. Send the implementation SHA and dist source commit immediately.
- [ ] Integrate the highest lower step with an open pull request, under the stacking and `git-merge` rules. Recheck the combined tree.
- [ ] Review the complete diff with `implementation-review` after the push. Use `origin/main`, or the named stack base. Apply finding checks and both fix rounds. Record follow-ups for the rest.
- [ ] Delete this plan under the `plans` deletion rules.
- [ ] Open the pull request against the selected stack base. Keep dated decisions and a plan permalink in its description. Wait for final CI with the shared `finish-work` script. Fix branch failures and rerun unrelated failures once. Send the final report to the performance orchestrator. Do not merge.
