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

Background document work must not wait behind the four graph threads that
its sidecar calls occupy today. Use the admitted blocking job for that work.
Build and comparison keep their existing render workers. Renders that never
signal completion retain the current scheduling behavior.

Count limits and byte charges are both required. Charge each extra retained
fragment or completion payload to the existing render-cache accounting.
Keep the total bound at 256 MiB. Take leases without waiting from the retained
240 MiB share, using its existing eviction accounting. Preserve the 16 MiB
compaction headroom. Include payload capacities and queue metadata.
Release each charge when its owner ends, including failure and cancellation.
If the shared budget cannot admit overlap, finish under the current document
place, still within the completion bound. Do not create an uncharged queue or
increase a budget. Compute charges from capacities without JSON encoding.
Keep owning document completion chains bounded by the original stage bound.
Each chain retains only its existing synchronous nested link-validation work.
Nested work takes no new completion place and cannot signal a handoff.

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

## Milestone 5: Measurement and verification

Depends on: 4

- [ ] Build release main and branch in separate checkouts and target directories.
- [ ] Run six interleaved cold and warm rounds on the basic, large HTML, and large React catalogues.
- [ ] Report pass time, first Changes, Serve CPU per second, host CPU, and cgroup anon plus swap for both arms.
- [ ] Check foreground response times and ten-edit sessions for speed and peak memory.
- [ ] Prove equal documents, usage, resources, warnings, diagnostics, and result order once.
- [x] Run targeted tests, the repository suite, and the complete gate with the required tools and locked Cargo graph.
- [x] Run the strict example build and a live smoke. Save a browser screenshot under `.context/`.
- [ ] Commit and push the implementation. Send its SHA and dist source commit immediately for cloud measurement.
- [ ] Obtain cloud acceptance: both startup gains at least 0.8 s, later edits no slower, and both memory peaks within 2%.

Evidence: `.context/busier-sidecars/measurements/` and `.context/busier-sidecars/checks/`.
The complete gate hit the known saved-plan harness flake owned by PR #352.
Its exact reruns passed. Standalone Native, Viewer, Browser, and delivery
coverage passed. No complete-gate pass is claimed. The implementation push
allows independent cloud measurement while local acceptance remains open.

## Milestone 6: Commit, review, and pull request

Depends on: 5

- [ ] Commit with Conventional Commits and push. Send the implementation SHA and dist source commit immediately.
- [ ] Integrate the highest lower step with an open pull request, under the stacking and `git-merge` rules. Recheck the combined tree.
- [ ] Review the complete diff with `implementation-review` after the push. Use `origin/main`, or the named stack base. Apply finding checks and both fix rounds. Record follow-ups for the rest.
- [ ] Delete this plan under the `plans` deletion rules.
- [ ] Open the pull request against the selected stack base. Keep dated decisions and a plan permalink in its description. Wait for final CI with the shared `finish-work` script. Fix branch failures and rerun unrelated failures once. Send the final report to the performance orchestrator. Do not merge.
