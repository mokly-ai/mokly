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
`f4f0082fd`. The latter changes only agent instructions. Probe evidence is
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

## Design and ownership

The process pool already releases its slot before completion. The new work
must admit the next view sooner, rather than extend or replace that lease.
Keep the default pool's claims and growth checks unchanged.

Keep at most one stage bound of views in sidecar work and one in completion.
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
Keep active composed trees bounded by the original stage bound.

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

## Milestone 1: Documentation and contracts

Depends on: none

- [ ] Document the bounded stages, charged memory, fallback, priority, order, and draining rules.
- [ ] Update the server and CLI entry-point descriptions that change.
- [ ] Keep protocol and README status lines until the implementation matches.

## Milestone 2: Sidecar CPU work

Depends on: 1

- [ ] Capture one Node CPU profile of the startup usage pass on clean main.
- [ ] Identify Mokly-owned work separately from React and consumer rendering.
- [ ] Record any selected sidecar cut and run its options check before implementation.
- [ ] Apply only measured, byte-equal cuts. Record when no useful cut is supported.

Evidence: `.context/busier-sidecars/sidecar-cpu/`.

## Milestone 3: Cheaper fragment completion

Depends on: 1

- [ ] Share the existing token stream between fragment parsing and source checks.
- [ ] Preserve error order, page precedence, source positions, repair, and warnings.
- [ ] Run existing HTML and rendering tests unchanged. Save a mutation or equivalence proof.
- [ ] Remove the redundant parse invocation and update useful code entry points.

## Milestone 4: Bounded overlap

Depends on: 2 and 3

- [ ] Add failing behavioral tests before implementing the changed scheduling rule.
- [ ] Prove that the next view can start while the first completes, within both stage bounds.
- [ ] Prove ordered reporting, foreground priority, cancellation, and stop draining.
- [ ] Add byte leases within existing render accounting and synchronous fallback when no charge fits.
- [ ] Release dispatch ownership only after claim release and safe payload admission.
- [ ] Check nested link renders, template eligibility, lock-free waits, and the unchanged single-attempt failure path.
- [ ] Run background documents on their admitted blocking job without the graph-pool bottleneck.
- [ ] Run an early cgroup anon-plus-swap diagnostic before the full acceptance matrix.
- [ ] Keep the existing Serve and pool tests unchanged. Repeat new asynchronous tests ten times.
- [ ] Remove pending documentation status lines after the implementation matches.

## Milestone 5: Measurement and verification

Depends on: 4

- [ ] Build release main and branch in separate checkouts and target directories.
- [ ] Run six interleaved cold and warm rounds on the basic, large HTML, and large React catalogues.
- [ ] Report pass time, first Changes, Serve CPU per second, host CPU, and cgroup anon plus swap for both arms.
- [ ] Check foreground response times and ten-edit sessions for speed and peak memory.
- [ ] Prove equal documents, usage, resources, warnings, diagnostics, and result order once.
- [ ] Run targeted tests, the repository suite, and the complete gate with the required tools and locked Cargo graph.
- [ ] Run the strict example build and a live smoke. Save a browser screenshot under `.context/`.
- [ ] Commit and push the implementation. Send its SHA and dist source commit immediately for cloud measurement.
- [ ] Obtain cloud acceptance: both startup gains at least 0.8 s, later edits no slower, and both memory peaks within 2%.

Evidence: `.context/busier-sidecars/measurements/` and `.context/busier-sidecars/checks/`.

## Milestone 6: Commit, review, and pull request

Depends on: 5

- [ ] Commit with Conventional Commits and push. Send the implementation SHA and dist source commit immediately.
- [ ] Integrate the highest lower step with an open pull request, under the stacking and `git-merge` rules. Recheck the combined tree.
- [ ] Review the complete diff with `implementation-review` after the push. Use `origin/main`, or the named stack base. Apply finding checks and both fix rounds. Record follow-ups for the rest.
- [ ] Delete this plan under the `plans` deletion rules.
- [ ] Open the pull request against the selected stack base. Keep dated decisions and a plan permalink in its description. Wait for final CI with the shared `finish-work` script. Fix branch failures and rerun unrelated failures once. Send the final report to the performance orchestrator. Do not merge.
