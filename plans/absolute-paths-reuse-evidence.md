# Absolute paths reuse evidence

Status: Active. On branch `calummoore/mokly-absolute-paths-evidence-fix-zqzl`, no pull request yet. The completing pull request deletes this plan.

Mokly compiles catalogue JavaScript with native esbuild resolution first.
Its reuse evidence omits mapped targets when an absolute request matches a
TypeScript `paths` key. Adding an earlier target can change fresh output
while reuse still serves the old output.

The performance orchestrator approved this work on 2026-11-18.
The user's 2026-11-16 instruction gives that orchestrator the design calls
for Changes speed and reliability. The instruction also forbids changes
that can exhaust machine memory. This task authorizes implementation,
review, and an open pull request. The performance orchestrator owns merging.

Contract owners:

- [Compiled recipes and release](../docs/protocol/mokly-sidecar-recipes.md).
- [Serve edit plans](../docs/protocol/mokly-sidecar-plans.md).
- [Bundle cache](../docs/protocol/mokly-base-cache.md).
- [Mokly package](../packages/mokly/README.md).

## Design

### 1. Absolute mappings must invalidate every reuse owner

- **Severity:** High. **Likelihood:** Rare. **Effort:** Medium.
- **Source:** Design.
- **Category:** Product bug.
- **Location:** `packages/mokly/src/sidecar/resolution-evidence.ts`.
- **Terms:**
  - **Reuse evidence:** File and directory observations that determine whether compiled catalogue JavaScript remains current.
- **Background:** Mokly keeps compiled catalogue JavaScript in memory and on disk. Serve can also keep a resolution plan.
- **Problem:** An absolute request bypasses mapped-target capture. Creating an earlier mapped target leaves the old evidence current.
- **Impact if no action:** A later compile selects a different module while reuse serves stale JavaScript.
- **Root question:** How can each captured owner preserve native-first module selection when a `paths` key matches an absolute import?
- **Options:**
  - **A.** Mark matching absolute requests incomplete. This loses captured reuse for the affected form. Effort: Medium.
  - **B.** Capture all matching mapped targets before the absolute return. Keep written-path observations and whole comparisons. Effort: Medium.
  - **C.** Resolve each import again before every reuse. This adds resolver work to unchanged compilations. Effort: Large.
  - **D.** Add a class test for every mapped request and target addition. This needs approval for a test of the class. Effort: Medium.
- **Left out:** Change nothing fails the correctness goal. Disabling all reuse breaks the requirement to preserve other reuse speed.
- **Wider fix:** The shared evidence producer and whole comparisons already cover the owner class. B fixes its omitted absolute branch directly.
- **Previous examples:** Workspace 54 reproduced stale in-process and disk reuse. Ordinary relative two-target mappings already capture earlier candidates.
- **Recommendation:** B. The options check confirmed conservative capture for exact keys, wildcard patterns, and target order.
- **Action:** fix now, apply B to supported target forms. Apply A when a matching absolute request uses target syntax the reader cannot represent safely.

Shared assumptions:

- Native-first output defines correct selection. Source: this task and the recipe protocol. Kept.
- Every other reuse retains its behavior and speed. Source: this task. Kept.
- No new setting, gate, retry, or memory risk. Source: this task. Kept.
- Marked Serve edit reuse needs a separate probe. Source: the recipe protocol and this task. Kept.

Performance orchestrator calls of 2026-11-18:

- The initial call chose A. The updated call prefers B because the probe graded capture Small and it preserves reuse.
- Prefer B when it stays small. The updated probe graded it Small and it preserves reuse for the rare form.
- Fall back to A if exact and wildcard mapping behavior cannot be confirmed or owner regressions do not pass.
- Probe marked edit reuse with the same addition. Decline only unsafe compilations by the smallest correct rule if needed.
- Record B as a follow-up only if A ships. Ordinary relative mappings and unmatched absolute imports keep reuse.

Options check of 2026-11-18: B is conservative for ordinary exact and wildcard targets. Its code is Small, and the requested owner tests make the milestone Medium.
The check found that `${configDir}` targets remain unsafe under a simple loop move.
The marked owner is independent and belongs to item 2.
The check suggested D. It is not selected because the task requests specific owner regressions, not a new class gate.
The task explicitly requests those owner regressions, so the shared testing skill does not remove them.
Evidence belongs in `.context/absolute-paths-reuse-evidence/options-check.md`.

Orchestrator call of 2026-11-18: keep B for represented targets and use the authorized A fallback for unsupported absolute mapped targets.
Reason: the current reader does not expand `${configDir}`, so literal observations can stay current after native selection changes.
The implementation must also preserve literal target text for exact keys, or decline that unsupported absolute form.
Record any lost exact reuse in a follow-up item rather than extending the shared reader in this defect fix.

### 2. Unknown inherited mappings affect edit reuse

- **Severity:** High. **Likelihood:** Rare. **Effort:** Small.
- **Source:** Implementation.
- **Category:** Product bug.
- **Location:** `packages/mokly/src/sidecar/config-inputs.ts`.
- **Terms:**
  - **Package extends:** A TypeScript configuration that inherits settings from an installed package.
- **Background:** Mokly generates absolute imports for catalogue entries. A wildcard mapping can redirect these imports too.
- **Problem:** The existing configuration reader rejects package extends. A conservative marker check would decline their marked edit reuse without knowing whether an absolute mapping exists.
- **Impact if no action:** Keeping those markers can leave stale selection. Declining them can cause extra JavaScript compiles after other edits.
- **Root question:** How should the absolute-mapping fix protect marked edits when the existing reader cannot classify their configuration?
- **Options:**
  - **A.** Withhold the marker when an absolute request's configuration cannot be classified. This preserves correctness but broadens the loss of edit reuse. Effort: Small.
  - **B.** Extend configuration classification to cover native configuration inheritance before deciding about the marker. No native-complete loader exists here. Effort: Large.
  - **C.** Record mapped-target evidence during Serve edits. This changes the chosen edit capture contract and restores work to every edit. Effort: Large.
  - **D.** Defer the marker change. This changes the task goal and leaves demonstrated stale absolute reuse open. Effort: Small.
  - **E.** Make generated entry imports immune to mappings, then classify authored absolute imports. This changes native entry selection. Effort: Medium.
  - **F.** Add mapped-target directories for bare and absolute forms to all live checks. This reaches the wider coherence task. Effort: Large.
- **Left out:** Trusting unchanged consumed files misses earlier unconsumed mapped targets. Ignoring generated imports misses mappings of entry files themselves.
- **Wider fix:** F covers mapped live reuse more broadly. Workspace 63 owns separate coherence work.
- **Previous examples:** The pre-fix probe reused stale marked code after an earlier target appeared. A native probe also redirected a generated entry import through `*`.
- **Recommendation:** E. The performance orchestrator selected E on 2026-11-18. The first recommendation was A, and the check recommended D.
- **Action:** fix now, apply E under the performance orchestrator's decision.

Shared assumptions:

- Generated absolute imports can follow mappings. Source: existing implementation. E drops this assumption under the recorded decision.
- The fix must preserve native-first selection. Source: this task. Kept.
- Reuse for unrelated configurations stays unchanged unless the performance orchestrator approves an exception. Source: this task. Kept.

The second-pass check also reproduced the marked gap for bare mappings.
That pre-existing gap does not remove this task's requirement to fix the absolute form.
The performance orchestrator chose E on 2026-11-18 under the user's delegation of 2026-11-16.
Generated imports load configured files exactly as configured, by absolute path, in native, planned, and full attempts.
Then only authored absolute imports with a matching or unclassifiable configuration withhold the marker.
Reason: A removes the last reuse path from common package-extends catalogues, such as `expo/tsconfig.base`.
Their CSS-only and YAML-only rebuilds would compile the full bundle again after a JavaScript edit.
E keeps common reuse fast and restricts the safety decline to very rare authored absolute imports.
Redirecting configured files through `paths` is an intended behavior change.

Decision conditions:

- Prove identical output, recorded inputs, and errors without matching mappings through the oracle and existing snapshots.
- Preserve aliases, symlinked entries, and generated renderer and preview behavior.
- State the configured-file resolution rule in the entry-resolution protocol.
- Add red-first regressions for generated `*` redirection, authored matching and unclassifiable absolute imports, and package extends without authored absolute imports.
- Stop and ask the performance orchestrator if E exceeds Medium or changes resolution outside the mapped-absolute case.

### 3. `${configDir}` mappings need correct captured evidence

- **Severity:** High. **Likelihood:** Rare. **Effort:** Medium.
- **Source:** Implementation.
- **Category:** Product bug.
- **Location:** `packages/mokly/src/sidecar/config-inputs.ts`.
- **Background:** TypeScript shared configurations can use `${configDir}` in mapped targets and `baseUrl`. esbuild 0.28.2 expands its prefix from the top-level configuration that uses the inherited setting.
- **Problem:** The reader keeps the template literal. Evidence can remain complete and current when an earlier real target appears.
- **Impact if no action:** Bare mappings can serve stale compilations through the captured owners. The absolute-only fallback does not protect them.
- **Root question:** How can captured evidence follow native module selection for `${configDir}` mappings?
- **Options:**
  - **A.** Make each matched request with unsupported `${configDir}` targets incomplete. This loses captured reuse for that form. Effort: Small.
  - **B.** Expand the prefix in the shared reader from the top-level configuration. Preserve the defining directory for ordinary relative targets. Effort: Medium.
  - **C.** Resolve each mapped request again before reuse. This changes the native-first and speed contracts. Effort: Large.
- **Left out:** Change nothing leaves possible stale strict output. An absolute-only decline leaves bare requests unsafe.
- **Wider fix:** The existing shared producer and whole-evidence checks protect each captured owner. B directly repairs the reader for bare and absolute requests.
- **Previous examples:** The options check reproduced stale absolute `${configDir}` reuse. A direct inherited native probe selected the top-level target, then changed selection after an earlier target appeared.
- **Recommendation:** B. The options check confirmed exact prefix expansion against native esbuild. Its code is Small, and its tests make the job Medium.
- **Action:** fix now, apply B. The owner probes reproduced stale strict and disk output. Keep the marked policy separate under item 4.

Shared assumptions:

- Fresh native esbuild selection is the oracle. Source: the task and the performance orchestrator's correction of 2026-11-18. Kept.
- Package inheritance that the reader cannot classify stays incomplete. Source: current capture contract and decision E. Kept.
- Other forms retain their behavior and speed. Source: this task. Kept.

Performance orchestrator call of 2026-11-18: test bare `${configDir}` mappings through in-process, released, restarted disk, strict, and marked owners. If disk or strict output is stale, fix captured evidence in this branch. Prefer small correct expansion; otherwise decline unsupported matched requests.
The performance orchestrator corrected its defining-directory description on 2026-11-18 and confirmed the top-level native behavior.
A marked ordinary bare two-target control must be reported with those five results before any wider marker change.

### 4. Marked mappings must observe earlier selection directories

- **Severity:** High. **Likelihood:** Rare. **Effort:** Medium, if the preferred option fits.
- **Source:** Implementation.
- **Category:** Product bug.
- **Location:** `packages/mokly/src/sidecar/resolution-inputs.ts` and `serve-edit-imports.ts`.
- **Background:** Marked edit compiles rely on live file digests and directory lists. They do not keep full evidence.
- **Problem:** A mapped request can select a later target, package fallback, or directory index while an earlier candidate's directory is absent from the live lists.
- **Impact if no action:** A later file addition can change native selection while marked reuse serves the old module.
- **Root question:** How can marked mappings keep native selection current while normal edit reuse stays fast?
- **Options:**
  - **A.** Keep E here and record the broader marked gap for a separate repair. Effort: Small here.
  - **B.** Omit the marker for mapped bare requests or unknown configurations. This removes common package-extends reuse. Effort: Medium.
  - **B′.** Omit the marker for multiple-target or unknown mappings. The parent superseded this rule because a single target can fall through to package lookup. Effort: Medium.
  - **C.** Extend live directory lists for matched bare targets, through the selected target or all targets on fallback. Omit the marker only when effective paths are unknown. Effort: Medium if it fits.
  - **D.** Omit the marker when selection is not a direct file of the first mapped target, or paths are unknown. This loses reuse for mapped barrels. Effort: Medium if it fits.
  - **E.** Apply C only for readable chains with a known anchor. Keep main's marker and checks for unreadable package inheritance. Include readable `baseUrl` fall-through. Effort: Medium.
  - **F.** Apply C with an esbuild-equivalent package-base reader. This adds package lookup, export conditions, and configuration fallback support. Effort: Large.
  - **G.** Share mapped-candidate selection and substitution between captured evidence and E, while preserving capture's conservative all-matching observations. Effort: Small on top of E.
- **Left out:** Resolving again on each reuse breaks the speed and native-first contracts. Target count alone misses package fallback and directory-index shadowing.
- **Wider fix:** G shares the mapping step structurally. The whole live-directory comparison is the direct check mechanism.
- **Previous examples:** Ordinary and template two-target probes stayed stale. A single target fell through to an installed package. A mapped directory index can be shadowed by a sibling file.
- **Recommendation:** E through G. The options check names the parent's C-with-exception E. The performance orchestrator granted that exception on 2026-11-18. The first-target fallback shares the unknown-anchor problem.
- **Action:** fix now, apply E through G for readable chains with known anchors. Keep main's marker and live checks for unreadable inherited settings under the approved exception.

Performance orchestrator calls of 2026-11-18, under the user's delegation of 2026-11-16:

- B′ first limited marker loss to multiple-target or unknown effective mappings. A local paths map replaces the inherited map, even with package extends.
- A native single-target package-fallback probe disproved target count as the safety test.
- The updated choice prefers C, then D, then A. The goal is to preserve marked reuse for direct files, barrels, and Expo while checking earlier target directories.
- Tests cover two-target fall-through, single-target package fallback, template targets, mapped barrel shadowing, direct single targets, Expo local overrides, and inherited package mappings.
- The exact likelihood condition is a mapped candidate addition during one live session. The parent calls this Uncommon; the skill's scale records Rare.

Shared assumptions:

- E protects generated imports. Source: item 2 and the parent's unchanged decision. Kept.
- Local paths wholly replaces inherited paths. Source: native override behavior and the parent's decision. Kept.
- The implementation stays Medium. Source: the parent's explicit fallback order. Kept.

Item 3 options check of 2026-11-18: B matches native esbuild 0.28.2.
Expand only a case-sensitive prefix in targets and `baseUrl`, after inheritance.
Keep raw templates in the per-file cache.
Use the as-found top-level configuration folder for the expansion.
An exact key keeps literal target stars; a wildcard replaces the first star with literal matched text.
The inherited target and `baseUrl` regressions prove useful unchanged reuse before the addition.
Captured owner tests now decline stale recipes and produce the fresh strict output.
Evidence: `.context/absolute-paths-reuse-evidence/green-config-dir-released.log`, `green-config-dir-disk.log`, and `green-captured-node.log`.

Main integration of 2026-11-18: merged `c2d4148c7` as `d387c613d`.
The merge was conflict-free. Its remerge audit and all six upstream paths are unchanged.

Item 4 final performance orchestrator call of 2026-11-18, under the delegation of 2026-11-16: apply C where the chain is readable and its anchor is known.
Unreadable package-inherited `paths` and `baseUrl` keep main's marker and live checks.
This supersedes the earlier unknown-paths and package-supplied-paths marker declines.
Reason: those declines remove the last reuse path from common package-extends catalogues, including default Expo.
The readable subset gets stronger checks; the unreadable subset keeps exactly its current risk.
Record that risk and the inherited `baseUrl` native probe in the existing [package-extends follow-up](follow-ups/package-tsconfig-extends-reuse.md), owned by the performance orchestrator.
A full esbuild-equivalent package reader is future option F, Large when combined with this live repair.
The parent also includes the readable `baseUrl` fall-through case if the repair stays Medium.
The final options check names this approved C-with-exception E and recommends E through G.
Root call of 2026-11-18: use G for shared matching and substitution, preserving the captured producer's existing conservative all-matching observations and order.
Reason: the shared mapping rule prevents capture and live checks from computing different targets without changing ordinary captured evidence.
The check's class-test option D for item 3 is not selected; the task authorizes concrete regressions, not a new test for the class.
The final report is `.context/absolute-paths-reuse-evidence/options-check-items-3-4-transcript.md`.

Orchestrator call of 2026-11-18, confirmed by the performance orchestrator: canonicalize the defining configuration file before anchoring ordinary relative targets, `baseUrl`, and `extends`.
Keep `${configDir}` expansion tied to the as-found top-level configuration folder.
Reason: the native P8 smoke reproduced stale captured reuse for an absolute key under a symlinked tsconfig, so this is necessary for the original selection guarantee.
The small reader correction gets a red-first regression and preserves useful unchanged reuse.

Verification call of 2026-11-18: bound staged live candidate paths by the existing 8 MiB evidence budget before insertion.
Reason: many imports and many mapped targets can multiply retained path strings before the frame check runs.
Charge each distinct path once, conservatively including string and entry overhead.
Overflow omits the marker and publishes no partial live lists; it adds no error or setting.
The bounded one-time probe passes under-cap and over-cap cases with correct emitted values.
Evidence: `.context/absolute-paths-reuse-evidence/live-c-staging-probe.log`.

Main integration of 2026-11-18: merged `a062f18bd` as `fabaf40bf`.
The merge was conflict-free and all 92 upstream paths remain byte-identical.

Follow-up options call of 2026-11-18: recommend G, the superset package reader, after merge instead of F.
Keep F as the exact-reader alternative. Both need base files in the marked live inputs.
Reason: extra candidate evidence can cost reuse without trusting a different selected configuration.
The unreadable-chain exception covers local settings too, because the reader stops before local compiler options.
The protocol and package follow-up state that existing limit without changing C.
The pre-existing marked gap after a relative base-file edit belongs to the existing jsconfig input follow-up.

Follow-up options call of 2026-11-18: recommend D after merge for export-pattern evidence, instead of B.
The shared helper must keep exact targets literal and substitute wildcard matches as written.
Reason: native probes confirm both misreads, but no changed reuse result. This Low, Rare work stays outside this branch.
The checked options and probes are in `.context/absolute-paths-reuse-evidence/followup-options-check.md` and `followup-options-probes/`.

Verification correction of 2026-11-18: E classifies the written authored specifier, as its approved definition requires.
A bare alias with an absolute target belongs to C, including C's unreadable-chain exception.
Readable matching mappings need their earlier candidate checks before the effective written-path fallback.
Reason: classifying the aliased target as authored absolute removes package-extends reuse when no authored absolute exists.
This corrects the implementation to the existing E and C decisions. It adds no resolution rule.

Main integration of 2026-11-18: merged `88b014719` as `e2078588b`.
The merge was conflict-free. The remerge audit passed and all 61 upstream paths remain byte-identical.

Verification correction of 2026-11-18: isolate the strict absolute fixture and cache beneath ignored repository-local scratch state.
Reason: concurrent temporary fixtures changed the shared `/tmp` ancestor during durability capture, which correctly prevented a disk save.
The reproduced test failure concerned the unchanged reuse count, with correct HTML.
Keep every assertion and the conservative durability rule. Add no retry, sleep, or timeout change.
Evidence belongs in `.context/absolute-paths-reuse-evidence/durability-probe.log` and `durability-repeat-02.trace.log`.

Performance orchestrator call of 2026-11-18: accept the additional per-edit configuration and candidate reads in this PR.
Reason: they keep marked reuse correct, use one metadata-edge scan and per-compile caches within the 1 MiB and 8 MiB reader bounds, and add about 1.5% per edit in the `mokly-cloud` comparison.
Do not add a cross-edit cache here. Record that work as a performance follow-up, with exact configuration and candidate invalidation.
Add the small `sidecar.bundle.mapped-lookups` diagnostic sub-span under the existing timing rules. Measure fixture bundle spans before and after the plugin-edge fix.

Review call of 2026-11-18: apply checked finding 2 option D instead of the first-pass B.
Distinguish direct file and index proof from containment. A contained selection records its folder and manifest, then continues through every remaining candidate.
After all candidates are observed, containment can keep the marker. This preserves useful package-folder reuse and the unreadable-chain exception.
Reason: a descendant does not prove which target selected it. The separate generic package-entry live-input limit stays outside this branch.

## Milestone 1: Contracts and follow-up record

Depends on: none

- [x] Check the existing contracts and record any required documentation changes through the docs implementor.
- [x] Run the read-only options check and merge its result into this plan.
- [x] Validate, commit, and push the initial plan without implementation changes.

## Milestone 2: Reproduce and fix the omitted targets

Depends on: 1

- [x] Delegate to the non-ui implementor. Add red-first regressions for in-process reuse, released seeding, restarted disk reuse, strict build, and Serve plan reuse.
- [x] Probe marked uncaptured Serve edit reuse. Add a red-first regression and the smallest correct fix if needed.
- [x] Implement E and its decision conditions. The parent approved this generated-import boundary change.
- [x] Preserve reuse for ordinary relative mappings and unmatched absolute imports.
- [x] Apply B if its conditions pass. Otherwise apply A and record B in a follow-up item.
- [x] Expand captured `${configDir}` settings from the top-level configuration and preserve exact target text. Item 3 supersedes the incomplete-evidence fallback.
- [x] Reproduce bare `${configDir}` through the five requested owners and the ordinary marked bare control. Apply the approved captured-owner fix after the options check.
- [x] Apply item 4 C with the parent's unreadable-package exception and red-first native cases, including readable `baseUrl` fallback. Update the existing package-extends follow-up.
- [x] Fix the canonical defining-directory anchor under symlinked configurations, with a red-first absolute regression.
- [x] Check the delegated result against the design calls and repository rules.

Evidence: `.context/absolute-paths-reuse-evidence/red-owner-checks.md`.

## Milestone 3: Verification, commit, review, and pull request

Depends on: 2

- [x] Correct the E/C boundary for authored bare aliases with absolute targets, with red-first marker-preservation and mapped-fallback regressions.
- [x] Isolate the strict absolute fixture from concurrent temporary-directory changes, with the existing reuse assertions intact.
- [x] Isolate the new Serve-plan regression after its store-save flake, with traced cause and unchanged assertions. Evidence: `.context/absolute-paths-reuse-evidence/rust-plan-isolation-results.json`.
- [x] Prove unchanged reuse before addition in the released, disk, and strict `${configDir}` regressions.
- [x] Run targeted tests and each new asynchronous test ten times. Record red failures and test cost under `.context/`.
- [x] Run the repository suite and complete gate. Use Git 2.45 or later, git-lfs, and pinned Bun.
- [x] Check disk and memory before large Cargo builds. Use one build at a time, `CARGO_INCREMENTAL=0`, and a checkout-specific target directory.
- [x] Measure `examples/basic` before and after if the change touches a hot path.
- [x] Commit with Conventional Commits and push the branch.
- [x] Apply checked review finding 1 option D through a shared metafile edge reader. Cover CSS and style-wrapper selection, and keep JSX markers.
- [x] Add the approved mapping-scan timing span and performance follow-up. Report fixture bundle-span measurements before and after the plugin-edge fix.
- [x] Apply checked review finding 2 option D. Cover a contained later target and preserve mapped package-folder reuse.
- [x] Review the complete local diff against `origin/main` after the push with the implementation-review skill. Apply its finding checks, fixes, and review rounds.
- [ ] Delete this plan under the plans skill. Keep dated calls and a plan permalink in the pull request description.
- [ ] Open the pull request into `main`. Wait for final CI with `scripts/ci-wait.sh`. Report to the performance orchestrator and do not merge.
