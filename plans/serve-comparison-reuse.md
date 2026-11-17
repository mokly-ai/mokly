# Reuse unchanged Serve view comparisons

Status: Active. On branch `calummoore/mokly-comparison-reuse-1see`, no pull request exists yet. The completing pull request deletes this plan.

Mokly compares a catalogue against a pinned Git base to produce Changes.
Serve repeats that comparison after watched edits. Most views keep the same inputs.
Retain the last complete per-view results and compare only views whose inputs cannot be proved equal.
Run every catalogue-wide step again. Keep every published byte equal to a full comparison.

The user authorized planning, implementation by delegation, review, and an open pull request on 2026-11-17.
The performance orchestrator owns design decisions. This workspace must not merge its pull request.
The orchestrator's calls below follow the user's 2026-11-16 instruction to improve Changes speed and reliability without memory exhaustion.
The starting commit is `794b30a91`. The implementation can integrate later `origin/main` commits.

Contract owners:

- [Comparison](../docs/protocol/mokly-comparison.md).
- [Changes serving](../docs/protocol/mokly-changes-serving.md).
- [Comparison serving](../docs/protocol/mokly-comparison-serving.md).
- [On-demand Serve](../docs/protocol/mokly-on-demand.md).
- [Comparison crate](../crates/mokly-compare/README.md).
- [CLI crate](../crates/mokly-cli/README.md).

## Design

The retained unit is the output before catalogue-wide attribution.
It contains immutable pre-attribution evidence and that view's warnings.
Read usage from the current generations for every classification. Do not retain a second usage copy.
It contains no rendered tree, source generation, source lease, or comparison document bytes.
Entry pairing and move detection run before reuse checks.
Admit candidate views in stream order. Prove each candidate on its worker before any preparation.
Base proof lookups use retained-only identities. Head proof-read failures become misses.
A checking wrapper never forwards an identity proof that bypasses its checks.
The accepted path map participates in identity because other entries' moves can change a view's material and ownership.
Record reads through the generation and memo interfaces, plus a digest of the scalar consumer inputs.
A new read automatically enters the proof. Revalidate all recorded reads against current content identities.
The input inventory below audits the proof boundary. It is not an independent hand-kept key list.

Current entry and view order controls insertion into the complete pending collection.
Reducers read shared per-view records and write separate classification output.
They cannot mutate a retained observation or owned-style candidate.

Catalogue-wide attribution, implementation impact, use-case impact, affected usages, projection, and snapshots consume that complete collection.

`comparison_views::collect` currently preserves memo calls in pairing and view order.
Commit `86b7d5765` and the scheduling tests require stable first errors, source-failure reporting, warning order, cancellation, and bounded cache work.
Reuse checks and misses keep ordered consumption. Speculative workers must not introduce source reads or failures for skipped views.
Published output and failure semantics stay equal. Work counters report actual work, including saved work, without pretending comparisons ran.
The full comparison path retains its current work ordering and counters.

My implementation calls, 2026-11-17, within the approved proof and memory design:

- Use the existing frozen digest map for base proofs. This avoids another base copy and permits no source read.
- Hash configuration and scalar inputs into fixed digests without retaining serialized buffers. Unknown serialization disables reuse.
- Deduplicate each recorded view read and each attempt's revalidation probe. Stop new recording after overflow to bound work and memory.
- Revalidate head resources through a fresh streamed digest and the frozen check. A proof must not allocate a complete image.
- Keep the checked head document read. It preserves wrapper checks; the release measurements must include its cost.
- Require a trusted lossless restorer before reading captured usage directly. Other restorers keep the document and fallback checks.
- Remove a redundant whole-map allocation sweep. Charge drops already remove their registry entry, so the sweep added quadratic work.
- Use the production `Source::comparison_attempt` seam in the existing lifecycle test. It checks real staging without adding unrelated IO injection.

My integration call, 2026-11-17: use the `comparison_usage` boundary merged in `ce654a90c` without a compatible copy.
Captured usage comes directly from encoded metadata. This supersedes my initial trusted-restorer usage call above.
Keep the trusted-restorer requirement for document identity proofs, where restoration affects proof validity.
Move our fallback regression to the live document read and retain its exact typed failure assertion.
The performance orchestrator explicitly requested this integration on 2026-11-17.

### Complete input inventory

An input identity is a content digest or a typed scalar. Pointer identity proves nothing.
Unknown identity, missing proof, failed restoration, or changed input causes a full view comparison.
The implementor must confirm this inventory against every changed read before coding.

| Input                                                    | Reader and required coverage                                                                                                                                                                                                                                                                                                 |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base commit, selected base reference, catalogue identity | `ComparisonRequest`, `base_render::Changes::classify`, `snapshots::create`. Fence the retained classification.                                                                                                                                                                                                               |
| Adopted configuration and effective comparison settings  | `ResolvedConfig`, `graph` configuration keys, `serve_changes_native::classify_native`. Include resolved roots, config file, review settings, and effective script mode. A changed fence forces a full classification.                                                                                                        |
| Before and after view recipes                            | `comparison_preparation::prepare` reads `comparison_document`. Use graph render-cache input keys, including entry source, module closures, bindings, props, axes, HTML components, slot fragments, render environment, and stylesheet inputs. `planning::documents`, `component_keys`, and `render_closure` form these keys. |
| Actual comparison material                               | `view_material::compare`, `matching_tree`, `owned_styles::compare`, and `inline_styles::compare` read composed trees, ignored regions, owned style records, and usage. Require keys that cover these inputs. Read usage afresh rather than retain it. Unknown custom generations cannot opt into reuse accidentally.         |
| Both entry records                                       | `Consumer` reads entry presence, kind, address, variant parent, and component identity. `entry_classification`, `root_impact`, and move pairing read metadata, content, source paths, and use-case membership. Hash the full paired catalogue records conservatively.                                                        |
| Route identity and move flag                             | `comparison_routes::stream`, `Consumer`, resource alias mapping, and material URL normalization read axes, routes, presence, and moved status.                                                                                                                                                                               |
| Complete accepted path map                               | `matching_tree`, `view_material`, resource evidence, owned styles, and root impact remap identities. Any changed map invalidates affected proofs conservatively.                                                                                                                                                             |
| Both previous resource closures                          | `comparison_resources::closures` reads seeds, transitive edges, files, warnings, owner evidence, ignored references, and instance references. Validate every prior dependency and any closure-policy or inventory input that can change membership.                                                                          |
| Resource content and absence on both sides               | `comparison_resources::aliases` and `evidence`, `instance_proof`, and `ResourceMemo` read digests and bytes. Include the union of closure routes on both sides, including opposite-side absence. Never treat unavailable content as proven equal.                                                                            |
| Embedded HTML, linked CSS, CSS imports, and URL targets  | `css_documents::collect` and its import walk read embedded HTML and stylesheet facts through the memo. Record every transitive read, including resources outside the direct evidence list.                                                                                                                                   |
| Closure validation and source failures                   | Graph public policy, base `SourceFailures`, capture fallback, and `FrozenResources` control errors and warnings. Preserve their checks. A proof cannot bypass a checking wrapper or a changed public-policy input.                                                                                                           |
| Cancellation and success admission                       | `RenderGeneration::check_cancelled`, `Changes::classify` source-failure checks, and `ChangeCancellation::commit`. Reuse never suppresses cancellation. Only accepted complete results replace retention.                                                                                                                     |

The nearby kept-base branch changes base capture ownership, cancellation, and source freshness.
It adds `ServeChanges::kept_base`, `ServeBase`, `base_reader`, and `base_retention`.
The usage branch adds `RenderGeneration::comparison_usage` and reads captured usage without restoring documents.
Use that boundary for current usage. If it has not merged, add only the compatible boundary and capture fast path needed here.
A base commit alone never proves base bytes. Working package styles, filters, LFS, and Git configuration can change them.
Use the current base generation's retained content identities.
Keep the reuse layer separate from both. Do not keep their generations in the result cache.
When either branch merges first, merge `origin/main` and preserve its checks and usage path.

### 1. Prove all comparison inputs equal

- **Severity:** High. **Likelihood:** Common. **Effort:** Medium.
- **Source:** Design.
- **Category:** Product bug.
- **Location:** `crates/mokly-compare/src/comparison_views.rs`.
- **Background:** Serve compares each view after every edit. Render keys already describe document inputs.
- **Problem:** Unchanged document keys alone cannot prove unchanged resource or catalogue inputs.
- **Impact if no action:** Stale Changes can hide a real edit.
- **Root question:** How can Serve publish Changes sooner and keep every published byte equal to a full comparison?
- **Options:**
  - **A.** Compare every view in full. Effort: Small.
  - **B.** Reuse only after complete content proofs, with full comparison on uncertainty. Effort: Medium.
  - **C.** Introduce a persistent dependency database for comparisons. Effort: Large.
  - **D.** B, with a recorded generation and memo read set plus scalar input digests. Effort: Medium.
  - **E.** Memoize pure sub-steps and keep full document and closure work. Effort: Medium.
  - **F.** Prove a slot on its worker before preparation. Keep current usage from its checked proof read. Effort: Medium.
  - **G.** Share bounded attempt-wide identities for recording and revalidation. Use ordered lookups and binary digests. Effort: Medium.
  - **H.** Do not cache unknown base probes. Later views can use digests learned by earlier full comparisons. Effort: Small.
  - **I.** Record individual path-map and public-policy lookups instead of whole inventories. Effort: Large.
- **Left out:** Pointer equality and edited-file heuristics cannot prove output equality. A fails the required speed goal. C exceeds Serve's one-classification scope. E alone fails the required per-view reuse scope. Watcher invalidation cannot replace complete content proofs.
- **Wider fix:** D. Recorded reads cover new inputs without relying on an inventory edit.
- **Previous examples:** Graph content keys and bounded comparison capture.
- **Assumptions:** Byte equality and content identity are task requirements. Both remain in force.
- **Recommendation:** D, refining the original B. Record the complete read set and validate content identities.
- **Action:** fix now, apply D as the checked refinement of B.

Performance orchestrator's call, 2026-11-17: choose B for correctness and faster watched classifications.
My call, 2026-11-17: use checked option D to make the approved content proof complete as reads evolve.
My refinement call, 2026-11-17: apply checked F, G, and H within D.
Basic reuses 582 of 590 views, but its first measured branch still adds proof work and repeated checked reads.
Run worker proofs before preparation, preserve ordered consumption, and permit no base source read.
Read current head usage from the proof's checked artifact to avoid a second document read.
Share record-time identities and use retained checked digests after an actual comparison read.
Keep I out of this change. Whole-inventory changes conservatively compare every view after an add, remove, or move.

### 2. Preserve catalogue-wide reduction

- **Severity:** High. **Likelihood:** Common. **Effort:** Medium.
- **Source:** Design.
- **Category:** Product bug.
- **Location:** `crates/mokly-compare/src/comparison.rs`.
- **Background:** CSS attribution and component impact depend on all views together.
- **Problem:** Reusing final entry classifications would omit current catalogue evidence.
- **Impact if no action:** Attribution, affected usages, and Changes membership can differ from a full comparison.
- **Root question:** Which reusable result preserves current catalogue-wide output?
- **Options:**
  - **A.** Retain immutable per-view results before attribution and rerun all reducers. Effort: Medium.
  - **B.** Incrementally maintain each catalogue-wide dependency and reducer. Effort: Large.
  - **C.** A, with shared immutable per-view records and separate reducer output. Effort: Medium.
  - **D.** C, with rule merging before sharing and catalogue attribution over borrowed normalized observations. Effort: Medium.
- **Left out:** Reusing final entry output violates byte equality. Only these two approaches retain the required evidence.
- **Wider fix:** C. Reducers cannot leave old classification state in retained records.
- **Previous examples:** `comparison_attribution` and `affected::collect` consume all pending observations and usages.
- **Assumptions:** The task requires all catalogue-wide steps for every classification. This remains in force.
- **Recommendation:** C, refining the original A. It preserves the reduction boundary without mutable retained evidence.
- **Action:** fix now, apply C as the checked refinement of A.

Performance orchestrator's call, 2026-11-17: choose A to preserve attribution, impact, projection, and snapshots.
My call, 2026-11-17: use checked option C. Shared immutable evidence avoids duplicate storage and stale reducer state.
My refinement call, 2026-11-17: apply checked D within C.
The current attribution call clones shared rule observations. Borrow normalized observations to remove that extra allocation and work.

### 3. Retain one accepted Serve classification

- **Severity:** High. **Effort:** Medium.
- **Source:** Design.
- **Category:** Code structure.
- **Location:** `crates/mokly-cli/src/serve_changes_native.rs`.
- **Background:** Each Serve source currently creates a comparison engine for its classification.
- **Problem:** Retention must survive source replacement without accepting failed or cancelled work.
- **Impact if no action:** Reuse disappears after edits or uses partial evidence.
- **Root question:** Which owner retains admitted evidence, and when may the next classification replace it?
- **Options:**
  - **A.** Own one slot in Serve services and commit a complete candidate through cancellation admission. Effort: Medium.
  - **B.** Own a process-global comparison cache shared by commands. Effort: Large.
  - **C.** Persist comparison evidence on disk. Effort: Large.
  - **D.** Carry evidence in the server's accepted publication. In-flight owners extend its lifetime. Effort: Medium.
- **Left out:** B and C exceed the authorized Serve-only lifetime. Updating the slot during comparison violates success admission.
- **Wider fix:** A. Staging and commit separate computation from accepted state.
- **Previous examples:** Serve's cancellation commit boundary and the nearby kept-base slot.
- **Assumptions:** Serve only, one previous complete classification, and full fallback after base or settings changes come from the task.
- **Recommendation:** A. Unlike D, it preserves evidence after failed classifications and bounds every owner.
- **Action:** fix now, apply A.

Performance orchestrator's call, 2026-11-17: choose A. Failed or cancelled work preserves the previous slot.
My call, 2026-11-17: commit in `ChangeSource::finished(Ok)` after Ready publication, inside `cancel.commit`.
Keep the candidate in separate staging, outside `ComparisonResult` and in-flight publication handles.
Reset staging before each engine attempt. A kept-base retry cannot inherit the failed attempt's evidence.

### 4. Bound retained comparison memory

- **Severity:** High. **Effort:** Medium.
- **Source:** Design.
- **Category:** Performance.
- **Location:** `crates/mokly-compare/src/comparison_views.rs`.
- **Background:** Per-view evidence can grow with usage and CSS matches.
- **Problem:** A result-count limit does not bound retained bytes.
- **Impact if no action:** A large catalogue can exhaust process memory.
- **Root question:** How can Serve keep reusable evidence for about 2,000 views within one fixed byte charge of at most 32 MiB?
- **Options:**
  - **A.** Charge all retained payload and metadata bytes under a fixed bound. Retain nothing on overflow. Effort: Medium.
  - **B.** Evict individual views under a fixed byte bound. Effort: Medium.
  - **C.** Spill retained evidence to disk. Effort: Large.
  - **D.** A, but read current usage through `comparison_usage` instead of retaining usage. Effort: Medium.
  - **E.** A, with shared immutable evidence charged once across the slot and candidate. Effort: Small.
  - **F.** Intern read entries once and retain compact per-view lists of those entries. Charge each shared entry once. Effort: Medium.
  - **G.** Keep the fixed 32 MiB bound. Every completed fixture fits, including default HTML at 58.6% of the bound. Effort: Small.
  - **H.** Lower the fixed bound to 24 MiB. Every completed fixture fits, but default HTML has only 21.8% margin for different evidence and staged overlap. Effort: Small.
  - **I.** Lower the fixed bound to 16 MiB. The 2,000-view projections fit, but default HTML overflows and loses all reuse. Effort: Small.
- **Left out:** B violates the requested retain-nothing overflow rule. C adds unrequested persistent state. Unbounded retention violates the memory requirement. A bound above 32 MiB breaks the approved maximum. A dynamic bound or user setting breaks the fixed-bound requirement. These value choices share one approach because the fixed-bound requirement leaves only its size open.
- **Wider fix:** A. One charging boundary covers each retained object and the staging overlap.
- **Previous examples:** Bounded base captures and `ResourceMemo` byte charges.
- **Assumptions:** Fixed byte accounting and full fallback on overflow come from the task. Both remain in force. Per-view projections assume linear scaling, as the measurement call requests. Sequential edits do not measure a draining attempt, but the same ledger bounds it.
- **Recommendation:** G with A, D, E, and F, refining the original E with D recommendation. Shared evidence and compact reads preserve capacity. The approved maximum keeps the measured default HTML fixture and leaves the most margin for staged overlap.
- **Action:** fix now, apply A.

Performance orchestrator's call, 2026-11-17: choose A. No change may increase memory exhaustion risk.
My initial call, 2026-11-17: start with an 8 MiB resident bound, including staged and retained evidence.
Performance orchestrator's later call, 2026-11-17: measure charge on basic and both default large fixtures.
Estimate bytes per view and choose a fixed bound that fits about 2,000 views, up to 32 MiB.
The 32 MiB maximum is one eighth of the existing render cache budget. It preserves the memory safety goal.
Record the measured charges and final bound here before completion.
Report revalidation time and recorded-read count per classification, so proof checks cannot hide their cost.
Share immutable evidence by rule and charge each allocation once. The bound covers all draining and staged attempts too.
Reject a candidate before allocating beyond the bound. Failed or cancelled attempts keep the accepted slot.
A successful overflowing classification clears the slot, as the approved retain-nothing rule requires.
Do not apply the checker's suggestion to preserve an older slot after successful overflow. It conflicts with that rule.
My call, 2026-11-17: read current usage instead of retaining it. This fits the nearby usage branch and reduces memory.
Measure charged bytes on every fixture and peak RSS before final acceptance. Lower the bound if evidence requires it.
The 200 ms and 0.6 second targets apply to `mokly-cloud`, with 1,508 views.
Performance orchestrator's acceptance, 2026-11-17: accept the measured cloud result at `38b923b5c` against `03bedb6ec`.
Mean edit comparison falls from 863 to 256 ms. Mean edit-to-Ready falls from 7.90 to 7.57 seconds.
The 200 ms target was an estimate. Repeated base preparation hides part of the comparison gain until the separate base reuse change lands.
First Changes rises 4.6%, and peak RSS rises 2.5%. Both meet the 5% limits.
The large fixtures use their default dimensions: 30 areas, 40 screens, 12 rows, and 5,850 views.
My refinement call, 2026-11-17: apply checked F and complete owned-style rule and ancestry charging before sizing.
The preliminary basic run charges 8,742,640 resident bytes for 590 views in steady state.
That projects to about 29.6 MB for 2,000 views before the identified undercharge is fixed.
Compact read sets preserve capacity margin under the approved maximum. Do not lower the view goal or raise the maximum.

My final sizing call, 2026-11-17: keep the fixed 32 MiB bound.
At the third classification, these are the lifetime peaks and live charges before acceptance:

| Fixture             | Views | Peak bytes | Live bytes | Peak bytes per view | Estimate for 2,000 views |
| ------------------- | ----: | ---------: | ---------: | ------------------: | -----------------------: |
| Basic               |   590 |  2,063,304 |  2,025,418 |               3,497 |              6,994,251 B |
| Default HTML        | 5,850 | 19,667,054 | 19,249,170 |               3,362 |              6,723,779 B |
| Supplementary React | 1,950 |  9,378,230 |  9,378,230 |               4,809 |              9,618,697 B |
| Divergent HTML      | 1,950 |  8,536,796 |  8,421,076 |               4,378 |              8,755,688 B |

No completed run overflows. The highest 2,000-view projection uses 9.17 MiB.
It leaves more than 70% of the approved bound for other evidence shapes and staged overlap.
The default HTML peak uses 58.6% of 32 MiB. A 16 MiB bound fits the 2,000-view projections but loses all reuse on that fixture.
The supplementary React peak includes a staged candidate for almost every view.
Live charges before acceptance include the previous accepted slot while it still lives.
These are charged allocations, not RSS. Estimate from peak bytes, not the logical candidate charge.
Both default 5,850-view React attempts fail the unchanged 300-second initial-Ready observer deadline.
Neither reaches a complete classification. Keep these failures visible. Do not raise the deadline or retry.
The separate 1,950-view React runs give supplementary capacity evidence under the same limits.
The React edit changes most render identities: 20 views reuse and 1,930 compare in full.
The full-size React capacity remains unmeasured. This limit does not alter the accepted cloud result.
Local RSS includes native and full CLI-tree measurements. The HTML CLI tree rises 5.43%, and the supplementary React tree rises 12.86%.
Native RSS rises 2.05% and falls 2.50%, respectively.
Local first-classification timings have broad ranges. They do not replace the controlled cloud acceptance.
Proof time and recorded-read counts for all initial, edited, and restored classifications are in the final measurement evidence.
Summed worker proof time overlaps current-usage time and can exceed wall time. Do not add the sums.

### 5. Check every published byte

- **Severity:** High. **Effort:** Medium.
- **Source:** Design.
- **Category:** Test.
- **Location:** `crates/mokly-compare` and `crates/mokly-cli` comparison tests.
- **Background:** Reuse changes which per-view work runs, but the published result must stay equal.
- **Problem:** A count-only assertion misses stale warnings, usage, evidence, or document paths.
- **Impact if no action:** A fast classification can publish different Changes.
- **Root question:** What evidence proves that reuse preserves published Changes over successive edits?
- **Options:**
  - **A.** Compare counts and state summaries. Effort: Small.
  - **B.** Run full and reuse paths on the same sequence and compare all published bytes. Effort: Medium.
  - **C.** Add a full comparison to each production classification. Effort: Medium.
  - **D.** Generate property-based edit sequences. This broader test needs user approval. Effort: Large.
  - **E.** Compose real Session, FrozenResources, and captured base generations in one Git-fixture oracle case. Effort: Large.
- **Left out:** A misses required output. C removes the performance benefit. Screenshots cannot establish byte equality.
- **Wider fix:** B. The oracle exercises the actual output builders.
- **Previous examples:** Existing engine scheduling equivalence tests and projection tests.
- **Assumptions:** The task requires lasting equality between two production paths. Its oracle protects that continuing requirement.
- **Recommendation:** B. Compare published bytes, normalized warnings, and all three terminal counts.
- **Action:** fix now, apply B.

Performance orchestrator's call, 2026-11-17: choose B, including every named edit and invalidation case.

## Replaced ways

| Old way                                                         | Consumers                                      | Replacement                                                                                 |
| --------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Owned attribution inputs and deep copies of shared observations | Comparison reduction and CSS attribution tests | Borrowed normalized observations. Merge each view's rules before sharing.                   |
| Independent retained maps of read routes and identities         | Saved views and identity validation            | Shared interned read entries and compact per-view lists. Temporary recording stays bounded. |

Keep no adapter for either old consumer API. Move tests with all their assertions.
The full comparison remains required for build, publish, misses, and unknown inputs.

## Milestone 1: Document the Serve contract

Depends on: none

Use the `docs implementor` action. No UI or mockup changes are needed.

- [x] Update Changes serving to permit proven per-view reuse while requiring exhaustive semantic classification.
- [x] State Serve-only retention, success admission, full invalidation, bounded bytes, and unchanged output in comparison serving.
- [x] Add a temporary status line linked to this plan while the contract is not implemented.

## Milestone 2: Implement bounded per-view reuse

Depends on: 1

Use the `non-ui implementor` action. Keep the full comparison path authoritative.

- [x] Add red-first public-boundary tests for skipping proven views and comparing changed or unknown views.
- [x] Implement content proofs for every input in the inventory, including both-side resource absence and transitive memo reads.
- [x] Preserve ordered failures, warning output, cancellation checks, and full-path work counters.
- [x] Share immutable pending evidence before attribution. Read current usage and rerun all catalogue-wide steps.
- [x] Add complete byte charging. Check the measured fixed resident bound, at most 32 MiB, before retention allocation. Retain nothing on overflow.
- [x] Complete owned-rule and detached-ancestry charging. Use borrowed normalized observations in attribution.
- [x] Move comparison and CSS test consumers to borrowed attribution. Delete the replaced owned-input API and deep-copy path.
- [x] Share bounded record-time and revalidation identities. Use compact shared read sets and ordered duplicate lookup.
- [x] Prove worker slots before preparation. Keep fresh usage from the same checked head proof read and preserve ordered errors.
- [x] Let retained-only base probes learn prior full-read digests. Forward proofs for uncaptured transparent routes.
- [x] Release unpublished staging when a Changes pass ends. Keep the accepted slot and terminal diagnostics unchanged.
- [x] Report record-time proof and current usage work in addition to revalidation work.
- [x] Keep no document tree, generation, lease, or resource byte payload in retained results.
- [x] Wire one Serve-owned slot across source generations. Commit staging in `finished(Ok)` after Ready admission.
- [x] Keep staging outside comparison results. Reset it before each attempt, including kept-base retry.
- [x] Charge shared allocations once, including cancelled attempts still draining. Clear the slot on successful overflow.
- [x] Force full comparison after base, adopted configuration, or effective settings changes.
- [x] Test cancellation, failure, overflow, no previous result, and invalidation through the production boundary.
- [x] Integrate either nearby branch if it merges into `origin/main`, preserving both changes.

## Milestone 3: Equivalence and measurements

Depends on: 2

Use the `non-ui implementor` action for the oracle and measurement tooling.
The orchestrator runs the release measurements and final gate.

- [x] Add the byte oracle for the index, entry details, comparison documents, snapshots, and review result.
- [x] Compare normalized warnings and the three terminal counts, including conversion and dependency warnings.
- [x] Cover a module edit, CSS-only edit, image edit, binding title edit, moved entry, added entry, removed entry, and `ReviewIgnore` change.
- [x] Cover a changed `ReviewIgnore` annotation while delivered HTML bytes stay equal.
- [x] Cover base change, settings change, metadata change, cross-entry move mapping, and uncertain proofs.
- [x] Show the oracle fails when reuse accepts changed inputs. Save red-first evidence outside the plan.
- [x] Measure added test cost and run new asynchronous tests ten times if any are added.
- [x] Prepare isolated checkouts and target directories for merged `main` and the branch. Serialize release builds with `CARGO_INCREMENTAL=0`.
- [x] Measure first classification, `review.compare-views`, edit-to-Changes-ready, and peak RSS on `examples/basic` and the large HTML and React fixtures. Preserve the default React deadline outcome and supplement it near 2,000 views under the same limits.
- [x] Measure retained charge on each fixture, estimate bytes per view, and choose a fixed bound fitting about 2,000 views, at most 32 MiB.
- [x] Measure a divergent branch with a head-only shared stylesheet and a global CSS edit. Check reuse and the byte charge.
- [x] Record measured charges and the chosen bound in this plan. Report revalidation duration and recorded-read count for each classification.
- [x] Send the implementation SHA to the performance orchestrator immediately after the push for `mokly-cloud` measurements.
- [x] Confirm cloud performance acceptance with the performance orchestrator. Record the accepted 256 ms comparison, 0.33 second edit improvement, first Changes within 5%, and RSS within 5%.
- [x] Remove temporary protocol status lines after implementation and align crate READMEs and entry points.
- [x] Record the performance orchestrator's requested proof-cost follow-up, with options and expected effort. Keep its choice open for a later branch and make no code change here.

Final paired measurements: `.context/serve-comparison-reuse/refined-measurements/comparison-final.md`.
Steady-state sizing: `.context/serve-comparison-reuse/refined-measurements/capacity-final.json`.
Final sizing options check: `.context/serve-comparison-reuse/final-sizing-options-check.md`.
Both default React deadline outcomes: `.context/serve-comparison-reuse/refined-measurements/default-react-deadline-outcomes.json`.
Implementation evidence: `.context/serve-comparison-reuse/implementation-report.md`.
Refinement evidence: `.context/serve-comparison-reuse/refinement-report.md`.
Docs evidence: `.context/serve-comparison-reuse/final-docs-report.md`.
Options check: `.context/serve-comparison-reuse/options-check.md`.
Final options check: `.context/serve-comparison-reuse/final-options-check.md`.
Preliminary basic measurements: `.context/serve-comparison-reuse/reporting-basic-v1.md`. Repeat after the checked refinements.
Divergent measurement evidence: `.context/serve-comparison-reuse/refined-measurements/divergent-comparison.md`.
Accepted cloud evidence: `.context/serve-comparison-reuse/mokly-cloud-evidence.md`.
Default React main attempt: `.context/serve-comparison-reuse/refined-measurements/measurements-main-react-sse/sample-01/summary.json`. It did not reach initial Ready within the unchanged 300-second observer deadline.
Integration audit: `.context/serve-comparison-reuse/main-additions-audit.txt` and `merged-usage.diff` in the same folder.
The exporter-worker merge is audited in `.context/serve-comparison-reuse/main-03b-integration-audit.json`.
The final main merge is audited in `.context/serve-comparison-reuse/final-main-preservation.json`; its choices are in `final-main-integration-decisions.md` in that folder.
Evidence lives under `.context/serve-comparison-reuse/`.

## Milestone 4: Verify, review, and open the pull request

Depends on: 1, 2, 3

The orchestrator owns these steps.

- [x] Use Git 2.45 or later first on `PATH`, with `git-lfs` installed.
- [ ] Finish the running gate, then merge main's kept-base change at `b881bfffb` under `git-merge` and preserve both changes.
- [x] Check retained-only proofs through `BaseReader`, including its cancellation, release, replacement, and fresh-base retry boundaries.
- [ ] Run merged-tree targeted tests and the byte oracle. Push the combination and send its SHA before the complete gate for cloud measurement.
- [ ] Run a watched smoke on the combination. Confirm view reuse and kept-base reuse after an edit and exact restoration.
- [ ] Run targeted tests, Rust format and clippy, `cargo xtask check --suite repository`, and `cargo xtask check`.
- [x] Run a watched Serve smoke test. Check disk and RAM before each large Cargo build.
- [x] Check every delegated TODO against the diff and repository rules.
- [x] Commit with Conventional Commits and push the branch.
- [ ] Review the full pushed diff against `origin/main` with `implementation-review`. Check every finding, fix confirmed fix-now findings, record follow-ups, re-review, and use the second fix round if required.
- [ ] Delete this plan under the `plans` skill after every other required TODO is complete.
- [ ] Open the pull request into `main`. Preserve dated decisions and the plan permalink in its description. Watch CI with `scripts/ci-wait.sh`. Report to the performance orchestrator. Do not merge.

The performance orchestrator requested the implementation push before the complete gate on 2026-11-17.
Commit `38b923b5c` is pushed. Its complete gate remains required.
The performance orchestrator also requested that newer `main` merge before the pull request, after these paired measurements.
The performance orchestrator's call of 2026-11-17 adds the kept-base integration after the running gate.
The combined SHA goes to the orchestrator immediately after targeted checks and the push, before the combined complete gate.
Integration preflight: `.context/serve-comparison-reuse/kept-base-preflight.md`.
The integration and preservation records will be `kept-base-integration-report.md`, `kept-base-docs-integration-report.md`, and `kept-base-merge-preservation.md` in that folder.

## Post-merge follow-up (non-blocking)

Performance orchestrator's call, 2026-11-17: record the measured proof cost without a code change in this pull request.
Keep the choice open for a later branch in [Serve comparison proof cost](follow-ups/serve-comparison-proof-cost.md).
The item gives measured work, the existing identity sharing, remaining checked head reads, and options with expected effort.
This explicit deferral does not block this pull request.
The options check also records an existing duplicate closure walk in [the separate closure item](follow-ups/duplicate-head-closure-walk.md).
Its question belongs to a later branch and makes no change here.

Merged-tree smoke evidence: `.context/serve-comparison-reuse/smoke-final-main/summary.json`.
The strict example build is recorded in `strict-example-post-final-main.log` in that folder's parent.
First complete gate attempt: `.context/serve-comparison-reuse/complete-gate-final-main-first-result.json`.
The repository suite passes; viewer typechecking requires the machine's Bun upgrade from 1.3.14 to the repository pin, 1.4.4.
The pre-kept-base gate result is in `.context/serve-comparison-reuse/complete-gate-pre-kept-base-result.json`.
Repository and viewer suites pass. The browser suite has one unrelated failure and 2,286 passes.
The exact failed case passes its focused rerun. Main `51f356574` fixes this race and deletes its resolved follow-up.
Keep that deletion. The recurrence evidence remains in the gate report.
Static delivery did not run after the browser failure. The complete gate remains required on the kept-base integration.

Orchestrator source check: `.context/serve-comparison-reuse/orchestrator-source-check.md`.
