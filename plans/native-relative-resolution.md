# Native relative resolution

Status: Active. On branch `calummoore/mokly-edit-native-relative-resolution-8na8`, no pull request yet. The pull request that completes this work deletes this plan.

Serve currently resolves each planned import through a Node plugin callback. This change lets esbuild resolve relative imports when the sidecar can prove equal resolution and equal parsing. Cal authorized planning, implementation, review, and an open pull request on 2026-11-20. The performance orchestrator owns measurements and merges.

Contract owners:

- [Module sources](../docs/protocol/mokly-sidecar-modules.md).
- [Serve edit plans](../docs/protocol/mokly-sidecar-plans.md).
- [Compiled recipes](../docs/protocol/mokly-sidecar-recipes.md).
- [Sidecar code](../packages/mokly/src/sidecar/README.md).

## Required results

- Mokly Cloud edit to Changes improves by at least 0.25 seconds. The orchestrator measures six interleaved rounds of three edits against main.
- Published output stays byte equal on `examples/basic`, large HTML, large React, and Mokly Cloud. A difference stops implementation for a report.
- Memory stays within two percent of main. The orchestrator measures ten-edit sessions.
- Keep the file loading hook. Keep consumed bytes, evidence, watch inputs, and the returned plan equal.
- Finish review rounds and CI. Open the pull request into main. Do not merge.

## Approved design

Cal chose these rules on 2026-11-20:

- Narrow the planned consumer resolution filter so relative specifiers can use esbuild. Other specifiers keep the plan path.
- Check each native metafile import against the plan before publication. A missing entry or different path cannot publish without proof.
- A path mismatch always discards the attempt and compiles through the complete planned path.
- Derive the skipped observation and dependency-usage calls from the metafile. Prove equal evidence with a differential test.
- Change native-attempt filtering only after the planned change passes.
- Keep edits small in files shared with workspaces 54 and 100. Integrate main once after the orchestrator confirms both merges.

The orchestrator approved the planned-fallback protocol change on 2026-11-20. The common edit gets one faster compile. A failed check never publishes an unproved resolution.

## Audit before implementation

- `require.resolve`: esbuild records the original request as an external `require-resolve` edge, without its resolved target. A relative request must force complete planned resolution. Checking absolute physical edges alone would miss it. Dead branches have no resolution in either path.
- Inner plugin resolutions: only `css-resolved` and `repository-resolved` carry relative names. The current callback already passes both to esbuild. CSS applies mapping and observation afterward. Style adapter inner calls use bare names. esbuild rejects relative alias keys. No style-adapter change is needed.
- `sideEffects`: `plannedResult` returns the plan value. esbuild obtains the value from the target package manifest. The plan uses `PackageScope.sideEffects`. Equal paths alone cannot prove equal flags after manifest changes. The accepted native target must have the same current side-effect value. Differential cases cover false and array forms.
- Package type and parsing: native resolution attaches package `type` and TypeScript parse settings. Planned resolution strips them. The module-source protocol requires stripping them. A small esbuild proof confirms equal paths but different code and a different default import for a CommonJS module with `__esModule`. A plain narrowed filter cannot stand as proposed.

Detailed audit evidence: `.context/native-relative-resolution/esbuild-audit/result.json` and `.context/native-relative-resolution/audit.md`. The fresh Claude Opus max options check is `.context/native-relative-resolution/options-check.md`. It corrected the inner-resolution audit and added options below.

## 1. Preserve parsing while removing callbacks

- **Severity:** High. **Effort:** Medium.
- **Source:** Design.
- **Category:** performance.
- **Location:** `packages/mokly/src/sidecar/plugins.ts` and `native-plan.ts`.
- **Terms:**
  - **Plan:** The saved mapping from importer, written import, and kind to the selected file and side-effect flag.
  - **Native resolution:** esbuild selects the imported file without a Node callback result.
- **Background:** Native resolution can change parsing even when it selects the planned file. The current protocol ignores package types and TypeScript parse settings.
- **Problem:** A path-only check accepts results that violate the parsing contract and change bundle bytes.
- **Impact if no action:** The speed change can change default imports and rendered pages.
- **Root question:** How can a planned Serve edit spend less time resolving imports while preserving every output byte?
- **Options:**
  - **A.** Narrow the filter. Fall back whenever a natively selected target has distinct parse settings. Common package types could erase the gain. Effort: Medium.
  - **B.** Derive literal filter exceptions from planned targets with distinct parse settings. Keep those targets on the planned path. Validate the remaining targets after compilation. Filter collisions cost callbacks but preserve bytes. Effort: Medium.
  - **C.** Change the resolver integration to carry parse settings independently from path selection. This requires capabilities absent from the current esbuild plugin interface. Effort: Large.
- **Options added by the check:**
  - **D.** Keep the broad callback but make its plan lookup synchronous. Effort: Small.
  - **E.** Bypass only saved relative strings whose every planned target has safe parsing. Build the complementary filter from a bounded trie. Unknown strings keep the callback. Strings omitted by the builder also keep the callback. Effort: Medium.
- **Left out:** A as an ordinary path compiles twice on every fixture, because every fixture has repository parse settings. Keep A only as fallback. Native parse settings break byte equality. D keeps every round trip. Cal's empty-callback measurement bounds that gain below the 0.25-second goal.
- **Wider fix:** C separates selection from parsing, but needs an upstream or replacement resolver interface.
- **Previous examples:** `tests/sidecar_native_plan.test.ts` covers package-type interop and TypeScript parsing.
- **Recommendation:** E, changed from B after the options check. It preserves B's safe bypasses and sends new strings through the original resolver.
- **Action:** Design call, apply E. The orchestrator chose E on 2026-11-20 to preserve parsing and avoid a second compile for new strings.

Shared assumptions: keep the existing esbuild version and plugin API, from the repository dependencies. Keep the parsing contract, from the module-source protocol. Keep captured file bytes, from Cal's scope. Option C revisits the plugin integration, but keeps the public requirements.

## 2. Prove new relative imports efficiently

- **Severity:** Medium. **Effort:** Medium.
- **Source:** Design.
- **Category:** performance.
- **Location:** Planned-attempt verification in `packages/mokly/src/sidecar/bundle.ts`.
- **Background:** An edit can add a relative import absent from the saved plan. Today the same compile resolves that import through the full resolver.
- **Problem:** A second complete compile can make this common edit slower despite improving ordinary edits.
- **Impact if no action:** The pull request could hide a common slower case behind the average gain.
- **Root question:** How can an import-adding edit preserve resolution without losing the speed gain?
- **Options:**
  - **A.** Discard the result and run the complete planned compile. Measure and report the cost. Effort: Small.
  - **B.** Resolve only missing edges in one resolve-only esbuild call. Accept only equal paths, side-effect flags, and compatible parse settings. Record the same observations. Effort: Medium.
  - **C.** Build a filter that routes unknown relative specifier strings through the complete resolver during the first compile. Existing safe strings can still be new for another importer. Validate those cases after compilation. Effort: Medium.
  - **D.** Classify missing internal relative targets with the existing native classifier. Accept only a target that maps to itself without distinct parsing or a module fallback. Record its observations. Effort: Small.
- **Left out:** Accepting missing entries without proof breaks exactness. For internal relative edges, D proves the same resolver rules without B's extra esbuild call. B remains an alternative for relative `require.resolve`, whose target the metafile omits. A path mismatch must still use A.
- **Wider fix:** C. Unknown strings use the full resolver by default. It is the same filter as item 1E.
- **Previous examples:** The existing consumer callback sends unplanned imports through `resolveImport` in the current compile.
- **Recommendation:** D with A for rejected edges and relative `require.resolve`, changed from B after the check. C handles ordinary new strings first.
- **Action:** Design call, apply C and D. The orchestrator chose this on 2026-11-20. Measure import-adding edits and report any fallback cost.

Shared assumptions: only a missing entry can use the smaller proof, from Cal's 2026-11-20 addition. A mismatched planned path always falls back. No new protocol behavior or output change is authorized beyond the explicit fallback.

## Milestone 1: Guarded planned compilation

Depends on: none

This milestone includes documentation first, then the planned compile. No screen or mockup changes are needed.

- [x] Complete the four-case audit and merge the fresh Claude options check into this plan before implementation.
- [ ] Delegate the protocol clause and sidecar README update. Preserve the parsing requirement.
- [ ] Write and observe red tests for callback removal, resolution mismatch or missing entries, and equal evidence.
- [ ] Implement guarded planned relative resolution. Preserve inner plugin resolutions, relative `require.resolve`, parse settings, and side-effect flags.
- [ ] Run the targeted tests. Run each new asynchronous test ten times. Record test cost.
- [ ] Compare ordinary and import-adding edits locally before selecting the missing-entry option.
- [ ] Prove published byte equality on all four fixtures. Stop and report a difference.

## Milestone 2: Native-attempt filtering

Depends on: 1

- [ ] Audit the narrower native filter against the same exceptional cases. Report a required protocol change before implementation.
- [ ] Write red tests, implement the narrower native hook, and preserve the full-path fallback.
- [ ] Run targeted tests and repeat the published-byte proof.

## Milestone 3: Verification and pull request

Depends on: 1, 2

- [ ] Run local edit A/B on `examples/basic` and large React. Include an added relative import.
- [ ] Give the orchestrator the candidate SHA for Mokly Cloud performance and memory measurements.
- [ ] After confirmation that workspaces 54 and 100 merged, integrate `origin/main` once with the `git-merge` skill.
- [ ] Run the repository suite and complete gate. Use one heavy job and check disk and memory before Cargo builds.
- [ ] Commit with Conventional Commits and push this workspace branch.
- [ ] Review the full branch against `origin/main` with the `implementation-review` skill. Apply its finding checks and fix rounds.
- [ ] Delete this plan when the `plans` skill permits it. Keep its dated decisions in the pull request.
- [ ] Open the pull request into main. Wait for CI with `scripts/ci-wait.sh`. Fix branch failures. Report the PR and SHA without merging.
