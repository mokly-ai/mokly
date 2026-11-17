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
Decide reuse at stream admission before speculative workers receive a view.
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
- **Left out:** Pointer equality and edited-file heuristics cannot prove output equality. A fails the required speed goal. C exceeds Serve's one-classification scope. E alone fails the required per-view reuse scope. Watcher invalidation cannot replace complete content proofs.
- **Wider fix:** D. Recorded reads cover new inputs without relying on an inventory edit.
- **Previous examples:** Graph content keys and bounded comparison capture.
- **Assumptions:** Byte equality and content identity are task requirements. Both remain in force.
- **Recommendation:** D, refining the original B. Record the complete read set and validate content identities.
- **Action:** fix now, apply D as the checked refinement of B.

Performance orchestrator's call, 2026-11-17: choose B for correctness and faster watched classifications.
My call, 2026-11-17: use checked option D to make the approved content proof complete as reads evolve.

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
- **Left out:** Reusing final entry output violates byte equality. Only these two approaches retain the required evidence.
- **Wider fix:** C. Reducers cannot leave old classification state in retained records.
- **Previous examples:** `comparison_attribution` and `affected::collect` consume all pending observations and usages.
- **Assumptions:** The task requires all catalogue-wide steps for every classification. This remains in force.
- **Recommendation:** C, refining the original A. It preserves the reduction boundary without mutable retained evidence.
- **Action:** fix now, apply C as the checked refinement of A.

Performance orchestrator's call, 2026-11-17: choose A to preserve attribution, impact, projection, and snapshots.
My call, 2026-11-17: use checked option C. Shared immutable evidence avoids duplicate storage and stale reducer state.

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
- **Root question:** How can Serve retain reusable evidence within a fixed resident byte budget on the measured catalogues?
- **Options:**
  - **A.** Charge all retained payload and metadata bytes under a fixed bound. Retain nothing on overflow. Effort: Medium.
  - **B.** Evict individual views under a fixed byte bound. Effort: Medium.
  - **C.** Spill retained evidence to disk. Effort: Large.
  - **D.** A, but read current usage through `comparison_usage` instead of retaining usage. Effort: Medium.
  - **E.** A, with shared immutable evidence charged once across the slot and candidate. Effort: Small.
- **Left out:** B violates the requested retain-nothing overflow rule. C adds unrequested persistent state. Unbounded retention violates the memory requirement.
- **Wider fix:** A. One charging boundary covers each retained object and the staging overlap.
- **Previous examples:** Bounded base captures and `ResourceMemo` byte charges.
- **Assumptions:** Fixed byte accounting and full fallback on overflow come from the task. Both remain in force.
- **Recommendation:** E with D, refining the original A. Sharing prevents duplicate charges, and fresh usage removes a large retained payload.
- **Action:** fix now, apply A.

Performance orchestrator's call, 2026-11-17: choose A. No change may increase memory exhaustion risk.
My call, 2026-11-17: start with an 8 MiB resident bound, including staged and retained evidence.
Share immutable evidence by rule and charge each allocation once. The bound covers all draining and staged attempts too.
Reject a candidate before allocating beyond the bound. Failed or cancelled attempts keep the accepted slot.
A successful overflowing classification clears the slot, as the approved retain-nothing rule requires.
Do not apply the checker's suggestion to preserve an older slot after successful overflow. It conflicts with that rule.
My call, 2026-11-17: read current usage instead of retaining it. This fits the nearby usage branch and reduces memory.
Measure charged bytes on every fixture and peak RSS before final acceptance. Lower the bound if evidence requires it.
The 200 ms and 0.6 second targets apply to `mokly-cloud`, with 1,508 views.
The large fixtures use their default dimensions: 30 areas, 40 screens, 12 rows, and 5,850 views.

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
- **Left out:** A misses required output. C removes the performance benefit. Screenshots cannot establish byte equality.
- **Wider fix:** B. The oracle exercises the actual output builders.
- **Previous examples:** Existing engine scheduling equivalence tests and projection tests.
- **Assumptions:** The task requires lasting equality between two production paths. Its oracle protects that continuing requirement.
- **Recommendation:** B. Compare published bytes, normalized warnings, and all three terminal counts.
- **Action:** fix now, apply B.

Performance orchestrator's call, 2026-11-17: choose B, including every named edit and invalidation case.

## Milestone 1: Document the Serve contract

Depends on: none

Use the `docs implementor` action. No UI or mockup changes are needed.

- [ ] Update Changes serving to permit proven per-view reuse while requiring exhaustive semantic classification.
- [ ] State Serve-only retention, success admission, full invalidation, bounded bytes, and unchanged output in comparison serving.
- [ ] Add a temporary status line linked to this plan while the contract is not implemented.

## Milestone 2: Implement bounded per-view reuse

Depends on: 1

Use the `non-ui implementor` action. Keep the full comparison path authoritative.

- [ ] Add red-first public-boundary tests for skipping proven views and comparing changed or unknown views.
- [ ] Implement content proofs for every input in the inventory, including both-side resource absence and transitive memo reads.
- [ ] Preserve ordered failures, warning output, cancellation checks, and full-path work counters.
- [ ] Share immutable pending evidence before attribution. Read current usage and rerun all catalogue-wide steps.
- [ ] Add complete byte charging. Check the 8 MiB resident bound before retention allocation. Retain nothing on overflow.
- [ ] Keep no document tree, generation, lease, or resource byte payload in retained results.
- [ ] Wire one Serve-owned slot across source generations. Commit staging in `finished(Ok)` after Ready admission.
- [ ] Keep staging outside comparison results. Reset it before each attempt, including kept-base retry.
- [ ] Charge shared allocations once, including cancelled attempts still draining. Clear the slot on successful overflow.
- [ ] Force full comparison after base, adopted configuration, or effective settings changes.
- [ ] Test cancellation, failure, overflow, no previous result, and invalidation through the production boundary.
- [ ] Integrate either nearby branch if it merges into `origin/main`, preserving both changes.

## Milestone 3: Equivalence and measurements

Depends on: 2

Use the `non-ui implementor` action for the oracle and measurement tooling.
The orchestrator runs the release measurements and final gate.

- [ ] Add the byte oracle for the index, entry details, comparison documents, snapshots, and review result.
- [ ] Compare normalized warnings and the three terminal counts, including conversion and dependency warnings.
- [ ] Cover a module edit, CSS-only edit, image edit, binding title edit, moved entry, added entry, removed entry, and `ReviewIgnore` change.
- [ ] Cover base change, settings change, metadata change, cross-entry move mapping, and uncertain proofs.
- [ ] Show the oracle fails when reuse accepts changed inputs. Save red-first evidence outside the plan.
- [ ] Measure added test cost and run new asynchronous tests ten times if any are added.
- [ ] Prepare isolated checkouts and target directories for merged `main` and the branch. Serialize release builds with `CARGO_INCREMENTAL=0`.
- [ ] Measure first classification, `review.compare-views`, edit-to-Changes-ready, and peak RSS on `examples/basic` and the large HTML and React fixtures.
- [ ] Send the implementation SHA to the performance orchestrator immediately after the push for `mokly-cloud` measurements.
- [ ] Confirm the cloud goals with the performance orchestrator: compare at most 200 ms, edit improvement at least 0.6 seconds, first classification within 5%, RSS within 5%.
- [ ] Remove temporary protocol status lines after implementation and align crate READMEs and entry points.

Options check: `.context/serve-comparison-reuse/options-check.md`.
Evidence lives under `.context/serve-comparison-reuse/`.

## Milestone 4: Verify, review, and open the pull request

Depends on: 1, 2, 3

The orchestrator owns these steps.

- [ ] Use Git 2.45 or later first on `PATH`, with `git-lfs` installed.
- [ ] Run targeted tests, Rust format and clippy, `cargo xtask check --suite repository`, and `cargo xtask check`.
- [ ] Run a watched Serve smoke test. Check disk and RAM before each large Cargo build.
- [ ] Check every delegated TODO against the diff and repository rules.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the full pushed diff against `origin/main` with `implementation-review`. Check every finding, fix confirmed fix-now findings, record follow-ups, re-review, and use the second fix round if required.
- [ ] Delete this plan under the `plans` skill after every other required TODO is complete.
- [ ] Open the pull request into `main`. Preserve dated decisions and the plan permalink in its description. Watch CI with `scripts/ci-wait.sh`. Report to the performance orchestrator. Do not merge.
