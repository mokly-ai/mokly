# Required Bun typechecking

Status: Active. [PR #275](https://github.com/mokly-ai/mokly/pull/275) is open on branch `calummoore/bun-typescript-performance`. Decision 1 is resolved as B. The user approved implementation on 2026-11-01. The PR deletes this plan when the work is complete.

Mokly checks five TypeScript projects before its Node tests. The user chose
Bun's native checker for required CI typechecking on 2026-11-01. Node continues
to run the tests and product runtime. TypeScript 6 continues to build the
published JavaScript and declarations.

This change extends the local Bun feature in PR #275. It changes the required
typecheck, its tool setup, and its documentation. It keeps the npm package
manager, lockfile, dependency pins, runtime profiles, and report inventories.
It has no screen, mockup, test-runner, or package-manager migration.

## Decision 1: Choose CI's required typechecker

- **Severity:** Medium. **Effort:** Medium.
- **Source:** Design.
- **Category:** Performance.
- **Location:** `xtask/src/check/commands.rs` and `.github/workflows/ci.yml`.
- **Terms:** **Required check:** a check whose failure prevents CI from passing.
- **Background:** The Viewer suite checks five projects before running Node
  tests. The current required checker uses TypeScript 6. The selected Bun
  1.4.4 checker follows TypeScript 7.0.2 rules.
- **Problem:** Replacing the required checker can change which code CI accepts.
- **Impact if no action:** CI retains the current checker and compiler rules.
- **Root question:** Which compiler should decide whether CI typechecking passes?
- **Options:**
  - **A.** Keep the current CI checker. Bun remains local. Effort: Small.
  - **B.** Require pinned native Bun checking. Keep Node tests and TypeScript 6
    declaration builds. Compiler diagnostics can differ. Effort: Medium.
  - **C.** Keep TypeScript 6 required and add advisory Bun feedback. This adds
    work and preserves the current merge rules. Effort: Medium.
  - **D.** Require both checkers. This retains full TypeScript 6 coverage and
    adds TypeScript 7 checks, work, and rejection rules. Effort: Medium.
- **Left out:** A full runtime migration fails the current reporter and sidecar
  probes. An installer migration answers a package-manager question, not this
  typecheck choice. Hosted-only definitions would duplicate the shared gate.
  A separate TypeScript 7 npm compiler does not apply the chosen Bun approach.
- **Wider fix:** None. Both checkers already share the project inventory.
- **Previous examples:** PR #275 implemented and tested optional local checking.
- **Recommendation:** B. It applies the tested native checker to required CI.
  D retains more compiler compatibility coverage at the cost of checking twice.
- **Action:** Resolved. The user selected B with `1 = B` on 2026-11-01.

Scope sources are the user's B selection and the existing shared-gate contract.
The choice changes compiler authority for the required typecheck. It does not
approve a Bun product runtime, Bun test runner, or Bun package manager.

## Design calls

These calls form the proposed implementation of the approved choice.

1. **One required command.** Agent call, 2026-11-01. Add `typecheck:ci` for the
   required native check. The Viewer suite uses it in hosted, local, and remote
   verification. Separate hosted-only steps would duplicate the gate recipe.
   The standard `typecheck` remains a Node/TypeScript 6 compatibility check.
   The local `typecheck:fast` retains its current fallback behavior.
2. **One tool pin.** Agent call, 2026-11-01. Put `1.4.4` in `.bun-version`.
   Required checking uses that version and never falls back to TypeScript 6.
   Missing, different, unreadable, or unsuccessful Bun reports fail this new
   required command. Use one pin reader for installation guidance in required
   errors and local fast fallback hints. Keep the fast minimum at 1.4.4 and
   preserve its local fallback behavior.
3. **External provisioning.** Agent call, 2026-11-01. Provision Bun where the
   Viewer or complete gate runs. Do not add a Bun npm dev dependency to every
   install, including browser and Windows jobs that set CI duration. Keep the
   npm lockfile and root installation policy unchanged.
4. **Local reproduction.** Agent call, 2026-11-01. The local complete gate and
   selected Viewer suite require the same pinned Bun. Document its manual
   installation. The typecheck commands themselves never download tools.
5. **Remote provisioning after sync.** Agent call, 2026-11-01. The remote Viewer
   provisioner reads the synced pin before running its suite. It must also work
   with an older warmup image that has no Bun. A warmup-only installation cannot
   cover that case or a later changed pin. Each box is fresh and runs one suite,
   so install the synced pin once per remote Viewer run into a private prefix.
6. **Preserve old release refs.** Agent call, 2026-11-01. Release preparation
   provisions Bun before a fallback complete gate when the checked-out source
   has the pin. Older refs without this feature retain their own Node gate.
   Do not add a Bun requirement to releases of those older refs.

The shared inventory keeps these projects in their current order:

1. `packages/mokly/tsconfig.json`, from the repository root.
2. `tsconfig.json`, from the repository root.
3. `packages/ui/tsconfig.json`, from the UI package directory.
4. `packages/viewer/tsconfig.json`, from the viewer package directory.
5. `tsconfig.scripts-declarations.json`, from the repository root.

Run the required command's coordinator with Node. Reuse native checking with
`bun check --no-script --all --project`. Preserve diagnostics, working
directories, first-failure behavior, and unsuccessful process outcomes.
Neither checker writes compiled output. Builds prepare the declarations first.

Use the official `setup-bun` action for hosted provisioning. Pin its reviewed
v2 revision to a full commit hash. Its `bun-version-file` input reads the shared
pin. Set `no-cache: true` to preserve the existing workflow cache policy.
The remote provisioner uses `npm install --global bun@{pin}` with an isolated
`--prefix` under `.context/`. npm verifies registry package integrity. It exposes
the tool only to the Viewer suite's environment and changes no root dependency.

Keep Node runtime profile names and test report schemas unchanged. The runtime
labels describe the process running the tests. Bun changes the checker, not
the Node tests whose evidence the aggregate validates.

Contract owners:

- [Developer commands](../docs/protocol/developer-test-commands.md#type-checks).
- [Verification and gate ownership](../docs/protocol/ci-verification.md).
- [Hosted workflow](../docs/protocol/ci-workflow.md).
- [Verification cache policy](../docs/protocol/ci-verification-security.md).
- [Remote verification](../docs/protocol/remote-verification.md).
- [Remote Testboxes](../docs/protocol/remote-verification-testbox.md).
- [Release evidence](../docs/protocol/npm-release-evidence.md).
- [Release verification](../docs/protocol/npm-release.md).
- [Development guide](../docs/development/README.md).
- [Verification scripts](../scripts/verification/README.md).
- [Task runner](../xtask/README.md).

## Milestone 1: Document the required checker

Depends on: none

Status: Complete.

Document the chosen authority and the tool preparation before changing code.

- [x] Update the developer command contract with standard, fast, and required modes.
- [x] Move Type Checks to `developer-type-checks.md` and retain the old heading as a forwarding link.
- [x] Update the protocol index and current links to the typecheck contract.
- [x] State the required pin and the required mode's failure behavior.
- [x] State that Bun decides required typecheck results, including tests and examples.
- [x] Keep TypeScript 6 package builds, declarations, and Node runtime coverage explicit.
- [x] Align the local, hosted, remote, and release gate contracts and setup guides.
- [x] Preserve older release refs and current report inventories and runtime profiles.
- [x] Add linked pending status lines until each documented behavior works.

Evidence: `.context/bun-ci-typechecking/docs-m1-report.md`.

## Milestone 2: Add the pinned required command

Depends on: 1

Status: Complete.

Add a command without changing the currently selected gate yet.

- [x] Add `.bun-version` with the approved version and one pin reader.
- [x] Use the pin for installation guidance without making the local fallback depend on a valid pin.
- [x] Add `typecheck:ci` through the existing Node coordinator and shared inventory.
- [x] Reuse native flags and preserve project coverage, paths, diagnostics, and exits.
- [x] Fail required checking when the pinned tool cannot run; do not use the local fallback.
- [x] Preserve standard checking and the existing optional fast command.
- [x] Test required-mode selection and failure propagation through injected process boundaries.
- [x] Save failure proofs and ten successful runs of each new asynchronous test.
- [x] Run focused tests, standard typechecking, fast checking, and lint.

Evidence: `.context/bun-ci-typechecking/command-m2-report.md`.

## Milestone 3: Provision hosted gate jobs

Depends on: 2

Status: Complete.

Prepare tools before the required suite starts to use them.

- [x] Resolve and review the immutable `setup-bun` revision and its version-file input.
- [x] Disable the action's download cache in hosted Viewer and release preparation.
- [x] Provision the pin in both Viewer runtime profiles of `.github/workflows/ci.yml`.
- [x] Provision the pin for fallback complete verification in `release-prepare.yml`.
- [x] Keep old refs without the pin usable with their original gate commands.
- [x] Keep npm installs, lockfile use, Node setup, and non-Viewer jobs unchanged.
- [x] Check actual workflow syntax with `actionlint` and inspect the release conditions.

Evidence: `.context/bun-ci-typechecking/hosted-m3-report.md`.

## Milestone 4: Connect the shared gate and remote Viewer

Depends on: 2, 3

Status: Complete.

Make every required Viewer check use the new command with matching tools.

- [x] Install the synced pin before each remote Viewer command, using its private prefix.
- [x] Cover install success, install failure before the suite starts, and Viewer-only tool exposure.
- [x] Keep provisioning outside the typecheck commands and outside npm's root lockfile.
- [x] Route the Viewer gate to `typecheck:ci` after the existing build.
- [x] Preserve Node test entrypoints, inventory, evidence, runtime labels, and suite order.
- [x] Keep Repository, Browser, Native, and delivery gates on their existing runtimes.
- [x] Test gate routing and remote command preparation at their existing public boundaries.
- [x] Update the area READMEs and remove completed pending-behavior status lines.
- [x] Run focused checks and the early Repository suite.

Code evidence: `.context/bun-ci-typechecking/remote-m4-report.md`.

Docs evidence: `.context/bun-ci-typechecking/docs-m4-report.md`.
Gate evidence: `.context/bun-ci-typechecking/early-repository.json`.

## Milestone 5: Verify and deliver

Depends on: 1, 2, 3, 4

Verify the required checker and all gate consumers before the PR merges.

- [x] Build and smoke-test standard, optional fast, and pinned required commands.
- [x] Prove the local fallback still works when Bun is absent.
- [x] Prove the required command fails when the pinned checker is unavailable or different.
- [x] Check temporary type errors and preserve diagnostic paths and first-failure behavior.
- [x] Confirm native checking writes no compiled files and uses all five projects.
- [x] Save one-time timing and command evidence under `.context/bun-ci-typechecking/`.
- [x] Repeat each new asynchronous test ten times without adding retries to tests.
- [x] Check an older warmup preparation and older release-ref conditions without publishing.
- [x] Run a real remote complete gate against the main warmup without Bun, or report the missing access.
- [x] Run formatting, lint, Markdown links, actionlint, and the complete gate with the pin.
- [ ] Verify hosted Viewer logs actually run the pinned native checker under Node test profiles.
- [ ] Confirm required hosted CI succeeds for the final candidate and preserve Node platform coverage.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the complete diff against `origin/main` after the push with the
      `implementation-review` skill. Apply the fix rule, record remaining
      findings as follow-up items, and re-review once after fixes.
- [ ] Delete this plan under the `plans` skill after the required work and reviews finish.
- [ ] Update PR #275 with the final CI behavior, dated decisions, and plan permalink.

Smoke evidence: `.context/bun-ci-typechecking/smoke/`.
Repeat evidence: `.context/bun-ci-typechecking/combined-repeats.json`.
Gate evidence: `.context/bun-ci-typechecking/remote-summary.json`.

## Evidence

CI timing and approach research are under `.context/bun-ci/`.
Plan checks and implementation evidence belong under
`.context/bun-ci-typechecking/`. Keep raw logs and benchmarks out of this plan.
The options check is `.context/bun-ci-typechecking/options-check.md`.
