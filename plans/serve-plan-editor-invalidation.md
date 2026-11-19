# Preserve exact Serve plans after unrelated file additions

Status: Active. On branch `calummoore/mokly-plan-reuse-editor-files-6dni`, no pull request yet. The completing pull request deletes this plan.

Mokly compiles catalogue JavaScript in a Node sidecar. Serve can reuse a captured import plan on later edits.
A swap file or backup file changes a recorded directory listing and defeats that reuse.
An added entry changes the record key even when no recorded resolution input changes.

The performance orchestrator owns the calls below, dated 2026-11-18.
The user delegated Changes speed and reliability decisions on 2026-11-16 and prohibited changes that can exhaust memory.
The chosen direction is G with a path-table plan encoding. The original preferred combination was E.
Both bounds stay at 8 MiB. The branch adds no setting, gate, retry, process, timeout increase, or edit capture.

Contract owners:

- [Serve edit plans](../docs/protocol/mokly-sidecar-plans.md).
- [Compiled recipes](../docs/protocol/mokly-sidecar-recipes.md).
- [Bundle disk cache](../docs/protocol/mokly-base-cache.md).
- [Render crate](../crates/mokly-render/README.md).
- [Sidecar crate](../crates/mokly-sidecar/README.md).
- [Sidecar package](../packages/mokly/README.md).

## Measurement and decisions

The baseline uses merged main `be242a628`, its release core, and matching dists.
Each case uses fresh Serve, one worker, and a fresh product cache. Retained files appear after the first captured compile.
One setup edit and restore precede three measured edit and restore cycles. Three interleaved rounds rotate the cases.
Each step waits for a new live generation and ready Changes. The whole-harness RSS stop is 4,500,000 KiB.

All nine editor edits and all nine added-entry edits fell back. All nine contrast edits used the plan.
The editor files change one captured listing. The added entry changes none of the captured resolution inputs.
Four planned imports directly request candidates in the editor directory. This is a proxy, not a complete C index.
The baseline pair uses 4,521,323 bytes for 5,137 imports and 14,530 recorded inputs.
Full measurements and option estimates stay in `.context/serve-plan-editor-invalidation/baseline-report.md`.

### 1. Routine additions defeat exact edit reuse

- **Severity:** Medium. **Effort:** Large.
- **Source:** Design.
- **Category:** Performance.
- **Location:** `packages/mokly/src/sidecar/resolution-evidence.ts`, `physical-inputs.ts`, and `crates/mokly-render/src/edit_plans.rs`.
- **Terms:**
  - **Plan record:** A captured import plan with the resolution evidence of the same compile.
  - **Resolution evidence:** Recorded files, directory members, and links that can change an import selection.
  - **Native-first:** The compile path that starts with native esbuild resolution and then classifies the result.
- **Background:** Serve captures its first published head. Later edits capture and store nothing. A current plan replaces the native attempt and classification. Uncovered imports use full resolution.
- **Problem:** An unrelated directory member rejects the record. Changed entry, stories, or renderer settings also prevent record lookup.
- **Impact if no action:** Each later JavaScript edit loses the plan benefit for the session.
- **Root question:** How can file changes that cannot change planned import selections preserve exact Serve edit reuse?
- **Options:**
  - **A.** Keep full listings and the full bundle key. Both measured cases keep falling back. Effort: Small.
  - **B.** Exclude entry files, stories files, renderer, and evaluation from the plan key. Keep resolution settings. Directory changes still invalidate. Effort: Medium.
  - **C.** Link evidence to each import. Send only current imports and resolve stale imports inside the planned attempt. Effort: Large.
  - **D.** Replace full listings with candidate observations in shared evidence. This changes compiled and stored reuse too. Effort: Large.
  - **E.** Combine B and D. It changes evidence rules for every reuse owner. Effort: Large.
  - **F.** Combine B and C. It avoids a copied resolver model but needs a per-import evidence index. Effort: Large.
  - **G.** Combine B with plan-only candidate names. Only the Rust plan check filters full listings. Other reuse owners keep their rules. Effort: Large.
  - **H.** Combine B with an idle captured head compile that refreshes the record. Earlier edits remain stale. It adds scheduling and memory work. Effort: Large.
- **Left out:** Edit capture violates the task. Editor ignore lists cannot prove exactness. Watch events can miss external roots or events. A resolver probe trace is absent from esbuild's API. A kept esbuild context keeps both attempts. Editor setup advice fails the goal.
- **Shared assumptions:** The task requires equal output, recorded inputs, and errors. It requires both 8 MiB bounds, no edit capture or storage, and one planned attempt. Disk identity, durability, publication, and admission rules stay. G drops the code's shared evidence form. C and F drop whole-record invalidation. H drops the code's fixed record after the first capture.
- **Wider fix:** F removes dependence on copied resolver candidate rules. It needs a separate performance orchestrator decision.
- **Previous examples:** The resolved follow-up records three fallbacks in each case at `efb17e824`.
- **Recommendation:** G, replacing E. Measurements support both parts. Its candidate model cannot change compiled-result or disk-cache admission.
- **Action:** Apply the performance orchestrator's call of 2026-11-18 under the user's delegation. Ask it if exactness or the measured size condition fails.

The fresh options check added F and G and recommended G. The performance orchestrator approved G on 2026-11-18.
Its reason limits model errors to the plan path of one session. Compiled and stored reuse keep whole listings.
The original check stays in `.context/serve-plan-editor-invalidation/options-check-transcript.md`.
The second check retains G and adds H. The orchestrator's existing pause-item call keeps idle refresh outside this branch.

### 2. Candidate names need room in real records

- **Severity:** Medium. **Effort:** Large.
- **Source:** Design.
- **Category:** Performance.
- **Location:** `crates/mokly-sidecar/src/resolution_plan.rs` and `packages/mokly/src/sidecar/captured-plan.ts`.
- **Terms:**
  - **Path table:** A plan encoding that stores each path once and uses indices in import entries and candidate observations.
- **Background:** The real mokly-cloud head has 13,057 imports and 22,927 evidence inputs. Its pair uses 8,102,796 bytes. It leaves about 286 KB below 8 MiB before candidate names.
- **Problem:** G can exceed the bound and disable plan reuse on the user's catalogue.
- **Impact if no action:** The branch can meet its small fixture goal and fail its real catalogue goal.
- **Root question:** How can candidate filtering and exact plan reuse fit both 8 MiB bounds with at least 1 MiB spare?
- **Options:**
  - **A.** Keep repeated paths. Reject oversized records as today. It risks losing real catalogue reuse. Effort: Small.
  - **B.** Add importer and target tables to G. Deduplicate paths used by plan imports and candidate names. Effort: Large.
  - **C.** Use E to shrink shared directory observations. It widens candidate-model impact to persistent compiled reuse. Effort: Large.
  - **D.** Drop names from the largest directories when bounds would fail. Those directories keep whole comparisons and can lose editor-file reuse. Effort: Medium.
  - **E.** Compact evidence only in the core record with the path table. Keep compiled and stored evidence forms unchanged. Counting needs the same representation. Effort: Large.
  - **F.** Use a path table for shared evidence too. It moves compiled, disk, and TypeScript consumers beyond G's scope. Effort: Large.
- **Left out:** A larger bound violates the task. Compressed-byte accounting cannot bound decoded memory. Decoded-byte accounting gives compression no capacity gain. Counting once does not shrink retained records. Lazy decoding changes disk rules and does not fix pair size.
- **Shared assumptions:** The user requires two 8 MiB bounds. The performance orchestrator requires G and at least 1 MiB margin. B drops the code's string map. E and F drop full evidence wire-form accounting. D drops whole-plan rejection when names alone overflow.
- **Wider fix:** F removes repeated observation paths across all reuse owners. It belongs with the remaining start-cost work.
- **Previous examples:** The record-start-cost follow-up identifies repeated paths across all plan stages.
- **Related:** Item 1, the same code. G needs the smaller record.
- **Recommendation:** B. It keeps G's limited scope and removes repeated paths.
- **Action:** Apply the performance orchestrator's updated call of 2026-11-18. Stop and ask it if measured margin is less than 1 MiB.

The performance orchestrator added table encoding on 2026-11-18 after measuring the real mokly-cloud pair.
Its reason keeps G without losing real catalogue reuse and reduces repeated plan bytes at start.
The additional fresh check stays in `.context/serve-plan-editor-invalidation/table-options-check.md`.
It recommends B with D. My call of 2026-11-18 retains the approved B until capacity measurements finish.
D cannot supply the required margin and can discard the names needed for the editor goal. A failed condition goes to the performance orchestrator.

### 3. Unused legacy exports remove every selector

- **Severity:** Medium. **Effort:** Small.
- **Source:** Implementation.
- **Category:** Performance.
- **Location:** `packages/mokly/src/sidecar/plan-candidate-metadata.ts` and `resolution-evidence.ts`.
- **Terms:**
  - **Identity folder export:** A literal package export such as `"./regenerator/": "./regenerator/"`.
- **Background:** G keeps whole directory comparisons for unproved resolver forms. One unproved form currently removes every selector from a plan.
- **Problem:** An unused identity folder export in Babel removes all selectors from both example plans. The release editor case still falls back.
- **Impact if no action:** The branch fails its measured editor-file goal despite complete evidence and records below both bounds.
- **Root question:** How can an editor-file addition keep exact plan reuse when a dependency manifest holds an export form that the candidate model does not prove?
- **Options:**
  - **A.** Admit only literal identity folder exports in metadata. Disable all selectors before export substitution when a folder key can prefix-match the effective request. Preserve the shared evidence walk and reads. Effort: Small.
  - **B.** Model selected legacy folder targets fully. Add their candidates and any missing shared evidence. This widens capture work and needs a separate proof for self-package and alias routes. Effort: Medium.
  - **C.** Track unproved export provenance per directory or import. Retain selectors elsewhere. This needs a new dependency index and a wider proof. Effort: Large.
  - **D.** Admit literal folder keys regardless of their target, with the same request guard and existing target checks. Skip the guard for an exact key that esbuild selects first. Effort: Small.
  - **E.** Check all export forms only when their requests visit them. It needs a broader proof of substituted and decoded targets. Effort: Medium.
  - **F.** Keep selectors for proved matched identity exports on installed or NODE_PATH routes. Self-package routes stay conservative. Duplicate keys and encoded requests need separate exclusions. Effort: Medium.
- **Left out:** Keeping the metadata guard fails the measured goal. Removing it without a request guard admits an unproved selection. Editor ignore rules cannot prove exactness.
- **Shared assumptions:** The task requires exact output, inputs, and errors, unchanged compiled and disk reuse, both bounds, and no edit capture. The existing global selector fallback is a code choice. C drops that assumption. A preserves the current shared capture and physical reads.
- **Wider fix:** B's shared-evidence half records folder targets for every reuse owner. The performance orchestrator owns that separate repair. C addresses other global unproved-form fallbacks.
- **Previous examples:** The initial G audit keeps whole comparisons for absolute mapped imports. Main #343 subsequently repairs their shared evidence.
- **Recommendation:** D, replacing A. The guard depends on the key and effective request, so an unused target needs no identity restriction.
- **Action:** Apply my call of 2026-11-19 under the approved conservative G scope, after a fresh options check.

My call of 2026-11-19 keeps shared capture behavior and reads unchanged.
Unused literal folder exports gain selectors. A possible prefix match disables every selector before the existing substitution.
An existing exact key that esbuild selects first avoids that prefix fallback. No shared observation or physical read changes.
The fresh check recommends D instead of A. My checked call of 2026-11-19 applies D.
The full check stays in `.context/serve-plan-editor-invalidation/unused-exports-options-check.md`.
Whole comparisons retain main's existing observations. They do not repair its missing folder-target or duplicate-key evidence.
The separate self-package follow-up records the reproduced stale compiled, disk, and strict results.
The source proof stays in `.context/serve-plan-editor-invalidation/editor-measurement-failure-analysis.md`.

The performance orchestrator's call of 2026-11-19 requires this correction before the pull request.
Its real mokly-cloud capture confirms that the unused Babel folder export removes every selector.
It requires the calibrated size fixture to capture that Babel form, with names present on both sides.
The fresh check considered full folder-target modeling and local provenance, then recommended the smaller unused-key proof D.

My review call of 2026-11-19 applies finding 1 option C and finding 2 option E after their fresh Opus checks.
Suffix matching includes extension-only basenames. A capture-time check keeps whole comparison when candidate names omit a native selected target.
It uses the native attempt's metafile and adds no resolver operation or physical read. Each allocation stays inside the existing capture budget.
Portable case fixtures preserve every case-rule assertion. Literal collision evidence and a single-spelling contrast replace a host-dependent Node fixture.
The marked-scan rewrite omission and the self-package folder capture gap predate G and get separate follow-ups.

## Implementation design

Full captured resolution evidence stays unchanged. Candidate names live with the plan, inside both existing serialized bounds.
Only the Rust plan reader applies names to directory comparisons. A directory without proved names keeps its whole comparison.
Compiled-result reuse, TypeScript evidence checks, input stamps, and bundle disk admission keep their current rules.
Capture durability still observes whole directories and path identities. Stored evidence stays full-listing evidence.

Narrow only for audited esbuild 0.28.2. Every other version keeps whole comparisons without rejecting a build.
Record exact bases and effective configured extensions, or esbuild defaults. Include extension rewrites and index names.
Include metadata and PnP names, traversed child names, and the prefix before the first query or fragment suffix.
Include main-field and exports targets, aliases, paths, lookup tiers, and directories that requests can traverse.
Keep kinds, links, canonical directory identity, absences, metadata content, and read errors exact.
Use whole comparisons for non-ASCII names, invalid names, case-folding differences, and each unproved form.
The upstream audit proves the name set. Oracle tests prove the listed cases, not every possible resolver behavior.
The audit stays in `.context/serve-plan-editor-invalidation/exactness-notes.md`.

The plan key retains module resolution, source root, configuration directory, and repository roots.
It excludes entry files, stories files, renderer, and evaluation. Compilation and disk keys retain all settings.
Whole-record invalidation remains. A removed or renamed entry can invalidate its old observations. F addresses that separate case.
The path-table format moves capture, wire, planned compile, retained record, and disk payload consumers together.
Keep typed Rust-owned boundary data. Remove the repeated-path plan format and its consumers. Keep no compatibility converter.
An incompatible cache payload follows the existing version and decode-fault rules. It cannot become a current plan.

My call of 2026-11-18: pair changed-key tests with current and stale evidence. The performance orchestrator approved this call.
The `entries`, `stories`, and `renderer` assertions encode the decision B reverses. Name their replacements in the pull request.
Use retained fields for distinct and oversized bound-test keys. Preserve each eviction, replacement, and bound assertion.
The performance orchestrator approved a direct-plan count for the `new module` integration case on 2026-11-18.
Keep its module and output assertions. Add a stale-candidate contrast. No unrelated invalidation assertion changes.

Replaced ways:

- Full settings as the plan key become resolution settings. Move lookup, insertion, replacement, accounting, and tests in Milestone 2.
- Repeated paths become indexed tables. Move Rust, TypeScript, generated, wire, disk, and test consumers in Milestone 3.
- Whole listings as the only plan comparison gain proved candidate filtering in Milestone 4. Compiled and disk consumers retain whole listings.

## Milestone 1: Documentation and protocol

Depends on: none

- [x] State G, the resolution-only key, typed tables, conservative exactness, and unchanged bounds in the plan protocol.
- [x] Keep recipe and disk rules. Explain the plan-only exception to the no-resolver-model decision where needed.
- [x] Update README entry points for the changed plan owners.

Evidence: `.context/serve-plan-editor-invalidation/docs-milestone-1-report.md` and `docs-milestone-1-checks.log`.

## Milestone 1a: Follow-up ownership

Depends on: 1

- [x] Add the editor-file restart cache follow-up with E's limits.
- [x] Update the start-cost item for table work taken here. Record the verified outside-scope risks with their evidence limits.

Evidence: `.context/serve-plan-editor-invalidation/docs-milestone-1a-report.md`.

## Milestone 2: Resolution-only plan records

Depends on: 1

- [x] Add red tests for added entries with current evidence. Pair entries, stories, and renderer changes with stale evidence.
- [x] Migrate lookup, insertion, replacement, and accounting. Preserve eviction and oversized-key checks with retained fields.
- [x] Preserve no edit capture or storage, whole-record stale rejection, warm starts, and single planned attempts.

Evidence: `.context/serve-plan-editor-invalidation/code-milestones-2-3-report.md`.

## Milestone 3: Compact typed plan encoding

Depends on: 1

- [x] Migrate captured plans, generated types, planned lookup, core records, disk payloads, and fixtures to indexed paths.
- [x] Remove the replaced map encoding and temporary converters. Keep all existing oracle and cache assertions.
- [x] Verify shared paths, side effects, malformed references, bounds, and warm restoration through public boundaries.

Evidence: `.context/serve-plan-editor-invalidation/code-milestones-2-3-report.md`.

## Milestone 4: Exact plan-only candidate comparisons

Depends on: 1, 3

Source proof: `.context/serve-plan-editor-invalidation/candidate-preflight.md`.

- [x] Add red swap and backup regressions for additions and removals after capture, selectable-candidate invalidation, and hidden preferred-candidate invalidation.
- [x] Capture bounded names with indexed directories. Narrow only Rust plan checks for audited forms and version.
- [x] Cover metadata and PnP, traversed children, rewrites, index names, suffix prefixes, links, configured extensions, and case fallback.
- [x] Compare output, recorded inputs, and errors with native-first. Preserve other reuse-owner tests unchanged.
- [x] Update the approved new-module count. Keep output assertions and add a stale-candidate contrast.
- [ ] Measure pair and retained-key bytes on examples/basic, large React, and the cloud-shaped synthetic catalogue.
- [ ] Confirm about 4,400 modules, 13,000 imports, 23,000 inputs, and icon directories of about 1,800 and 1,600 files. Include a used Babel runtime helper and its unused folder export in both captures. Calibrate path lengths and compare the old pair with the real 8,102,796-byte pair.
- [ ] Confirm both bounds fit, with at least 1 MiB margin on that shape. Require actual selectors on both head and base records. Ask the performance orchestrator if they fail.

Evidence: `.context/serve-plan-editor-invalidation/code-milestone-4-report.md`.

## Milestone 5: Verification, measurement, and review

Depends on: 1a, 2, 3, 4

Evidence: `.context/serve-plan-editor-invalidation/2026-11-19-main-code-integration-report.md`.

- [x] Preserve current main's mapped-path capture, configured files, stamp checks, style memo, and watch-plan reuse. Recheck G after integration.
- [x] Run targeted plan, oracle, bound, invalidation, warm-start, and cache tests. Record red assertions, costs, and ten runs of new asynchronous tests.
- [x] Align the final owner README, protocol status lines, and follow-up pointers. Remove the item resolved by main #343.
- [ ] Smoke-test examples/basic. Measure alternating release main and branch in separate checkouts, targets, and matching dists.
- [x] Extract the merged 303-line bundle owner without changing runtime behavior. Recheck the file cap.
- [x] Run `cargo xtask check --suite repository` and complete `cargo xtask check` with Git 2.45+, Git LFS, and pinned Bun.
- [x] Correct hidden-basename rewrite candidates. Add the checked native-selection fallback. Apply the checked portable case fixtures and preserve every assertion.
- [ ] Apply checked option D for unused folder exports, with exact-key priority. Cover matched conservative forms. Keep whole comparisons for unproved encoded bare requests. Repeat the failed editor measurement.
- [ ] Commit and push implementation. Send its SHA, dist source commit, and cache inspection command to the performance orchestrator at once.
- [ ] Obtain real mokly-cloud measurements and sizes for head and base records, with selectors present. Audit rejected real manifests. Require at least 1 MiB margin in both bounds and resolve failed conditions.
- [ ] Review against `origin/main` with `implementation-review`. Run finding checks and two fix rounds when needed. Record follow-ups.
- [ ] Delete this plan and the resolved editor-invalidation item after other TODOs and reviews. Update live references.
- [ ] Open the pull request into `main`. Preserve dated calls and a plan permalink. Wait for CI with `ci-wait.sh`. Report to the performance orchestrator. Do not merge.
