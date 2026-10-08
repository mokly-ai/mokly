# Vacuous Test Prevention

Status: Active; Milestones 1 through 8 completed. The
reviewer agent runs the post-push review, and the implementation agent applies
`Auto-fix: yes` findings. Finding 4 remains for the user to decide. The plan
closes when its PR merges.
Created 2026-10-06 with the user's consent after a report that four
unit tests check nothing. The user chose four options: rewrite
the empty checks with checked helpers, test-first; add a zero-assertion guard to
the unit runner; add checked catalogue-selection helpers and a lint rule; and
make no change to the review prompt. On 2026-10-06 the user asked for every
milestone, including the Milestone 6 lint extension, with implementation
delegated to a Codex agent and checked by the planning agent.

Make a test that checks nothing fail. A guard fails every unit test that makes
no assertion. Checked helpers fail when a catalogue selection matches nothing,
and a lint rule sends selections through them. Milestone 3 rewrites the stale
checks listed below. Milestone 1 writes the contract into a new
protocol page, `docs/protocol/ci-test-assertions.md`.

## Background

PR #131 (`c4138a0`, merged 2026-10-05) replaced entry ids such as
`design-component-overview` with file-derived paths such as
`design/components/overview`. It edited all seven affected test files. It
updated the ids that made a test fail. It did not see the ids that made a test
pass without checking anything: `entry.id === "design-review-dark-scheme"`
became `entry.path === "design-review-dark-scheme"`.

Before this change, a filtered loop that matched nothing made no assertion,
and `node:test` reported it as passed. An absence check on an obsolete id
also passed. The gate did not reject either case.

## The Nine Empty Checks

| Check                                                                       | Why it is empty                    | Replacement                                                                                                          |
| --------------------------------------------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `tests/component_design_review.test.ts:14`, current-page links, two runs    | Filter `design-component-`         | `entriesUnder(manifest, "design/components", { kind: "screen" })`                                                    |
| `tests/component_design_review.test.ts:37`, design-only footer, two runs    | Filter `design-component-`         | The same selection                                                                                                   |
| `tests/design_modern_controls.test.ts:80`, legacy footer and view markup    | Filter `design-`                   | Screens and component variants under `design`                                                                        |
| `tests/design_library_styles.test.ts:57`, ownership of implementation, CSS  | Filter `design-ui-`                | `entriesUnder(manifest, "design/library", { kind: "component", variants: "exclude" })`; the slug is the last segment |
| `tests/design_appearance_variants.test.ts:204`, depicted previews           | Old ids in the list at `:24`       | The nine current paths below, read through `entriesAt`                                                               |
| `tests/design_appearance_variants.test.ts:231`, removed fixed-theme screens | Old ids                            | `assertAbsent` for `design/browse/appearance/states/light-preview` and `.../states/dark-preview`                     |
| `tests/design_screens.test.tsx:60`                                          | Old id `design-browse-tags`        | `assertAbsent(manifest, "design/browse/tags")`                                                                       |
| `tests/design_appearance_controls.test.ts:69`                               | Old id `design-review-dark-scheme` | `assertAbsent(manifest, "design/changes/outcomes/dark-scheme")`                                                      |
| `tests/design_library_inventory.test.ts:94`                                 | Old id `design-root`               | `assertAbsent(manifest, "design")`                                                                                   |

The preview list maps each old `design-appearance-<name>` id to a path below
`design/browse/appearance/`: `overview`, `states/auto`, `workspaces/props`,
`workspaces/instance`, `status/loading`, `status/unavailable`,
`workspaces/side-by-side`, `workspaces/difference`, and `status/flow`.

A removed entry gets the path that it would have under file-path identity: the
folder where `c4138a0` moved its siblings, plus its old name. For example,
`design-review-changed` moved to `design/changes/outcomes/changed`, and
`design-appearance-light-only` moved to
`design/browse/appearance/states/light-only`. The two former collections,
`design-root` and `design-browse-tags`, become the folder paths that they would
occupy.

## Decisions

### Zero-assertion guard

- `scripts/verification/assertion-guard.mjs` is the `--import` entry. Sibling
  modules hold the resolve hook and the counting `assert` modules. Each file
  stays under 300 lines.
- `scripts/verification/unit-runner.mjs` passes
  `--import tsx --import ./scripts/verification/assertion-guard.mjs` under both
  policies. Since main's #155, `executeUnitTests` in
  `scripts/verification/unit-execution.mjs` holds these flags for both policies
  and the targeted developer runs. Every `node --test` command in a CI
  workflow or composite action passes the same flags. Since main's #175
  deleted `tests/ci_workflow.test.ts`, `tests/verification_entrypoints.test.ts`
  checks this as a policy property. A direct run uses
  `node --import tsx --import ./scripts/verification/assertion-guard.mjs --test <file>`.
  A run without the guard is partial verification.
- A resolve hook, registered with `module.register`, maps `node:assert`,
  `node:assert/strict`, `assert`, and `assert/strict` to counting modules when
  a file inside the repository root imports them. Files under `node_modules`
  and the guard's own modules get the real modules. The guard derives the
  repository root from its own location.
- A `load` hook generates counting-module source from the real module's export
  names on the running Node release. Direct hook tests statically import
  `initialize`, `resolve`, and `load`. The export ratchet needs no new baseline
  exception.
- Never change Node's `assert` object; Node compares assertion methods by identity.
- Count method reads because call wrappers change generated `assert.ok` messages.
- A counting module's default export is a `Proxy` over the real module. Each
  read of a function-valued property counts once, so `assert.equal(...)` counts
  when the test reads `equal`. A direct call such as `assert(value)` counts
  once. Reads of `AssertionError`, `Assert`, and `CallTracker` do not count.
  `strict` returns the counting strict export. The counting modules also
  provide the real modules' named exports; each call of a named export counts
  once.
- Reads of assertion methods through `t.assert` count the same way. The guard
  replaces each test context's `assert` property with a counting `Proxy`.
- Root `beforeEach` and `afterEach` hooks, registered before any test file
  loads, open and close a frame for each test. A counted read or call adds one
  to every open frame, so a parent test gets credit for its subtests. Assertions in the
  test body, in its subtests, and in file `beforeEach` hooks count. Assertions
  in `afterEach`, `after`, and `t.after()` callbacks do not count, because the
  guard's `afterEach` hook runs first.
- A test that closes with zero assertions fails with
  `test made no assertions: <full test name>`.
- A test skipped by option, or a test that calls `t.skip()` or `t.todo()`, is
  exempt. The guard wraps the `skip` and `todo` methods of each test context,
  because Node 22.14 does not run `afterEach` after a run-time skip. A test
  declared with `todo: true` reports the guard error as a todo failure, which
  does not fail the run.
- A test that starts while a test that is not its ancestor is open fails with
  `assertion guard needs sequential tests: <open test> is still running`. Node
  runs the tests of one file sequentially by default, and no file opts out
  today.
- The guard acts only in the process that the test runner starts for a test
  file. It acts when `NODE_TEST_CONTEXT` is set and
  `MOKLY_ASSERTION_GUARD_PID` is not set, and it then sets
  `MOKLY_ASSERTION_GUARD_PID` to its process ID. The runner's own process has no
  `NODE_TEST_CONTEXT`, so it does nothing. A Node process that a test forks with
  inherited `execArgv` inherits both variables and does nothing, so its stdout
  and exit code stay unchanged.
- A failing assertion keeps its caller as the first stack frame. A method read
  adds no frame. For a direct call or a named export, the counting module
  removes its own frame from the stack.
- A failing `assert.ok(expression)` without a message keeps Node's generated
  message. A failing direct call or named `ok` call without a message shows the
  counting module's source in that message. Today every assertion import in
  `tests/` is a default import, and no test calls the default export directly.
- A test whose claim is "completes without an error" states it with
  `assert.doesNotThrow(...)` or `await assert.doesNotReject(...)`.
- Playwright specs are out of scope. The helpers and the lint rule cover them.

### Checked catalogue selection

- `tests/helpers/catalogue_selection.ts` accepts any value with
  `entries: readonly ManifestEntry[]`.
- The selection helpers are preconditions. They throw `CatalogueSelectionError`
  and never call `node:assert`, so a selection never counts as an assertion.
  - `entryAt(manifest, path, kind?)` returns the entry at `path`. It throws when
    the entry is missing or has another kind.
  - `entriesAt(manifest, paths, kind?)` returns the entries in the given order.
    It throws for a missing, duplicate, or wrong-kind path.
  - `entriesUnder(manifest, folder, options?)` returns, in manifest order, the
    entries whose path starts with `<folder>/`. The `kind` option is one kind or
    a list. The `variants` option is `"include"` (default), `"exclude"`, or
    `"only"`; an entry with `variantOf` is a variant. It throws when fewer than
    `min` entries match; `min` defaults to 1.
  - `entriesWhere(manifest, description, predicate, options?)` returns the
    entries that satisfy `predicate`. It throws with `description` when fewer
    than `min` entries match; `min` defaults to 1.
- `min` defaults to 1. Raise it only when the test needs that many entries
  to prove its claim and no assertion already checks the count. Never copy an
  exact count into `min`; exact counts belong in assertions. Both helpers
  validate it before selecting entries. A value that is not a positive safe
  integer raises `CatalogueSelectionError` with reason
  `min must be a positive integer` and `matches=0`.
- `assertAbsent(manifest, path)` is an assertion. It throws
  `CatalogueSelectionError` when its anchor holds no entry. Then it asserts with
  `node:assert/strict` that no entry has `path`. The anchor is the parent folder
  of `path`, or the catalogue root when `path` has no `/`. The root is live
  when the manifest has at least one entry. An empty root throws with reason
  `catalogue root has no entries`. A live anchor proves that the check still
  looks at a real area. A top-level absence check also selects a real entry
  from its module when the root alone cannot prove the path shape.
- The helpers return the manifest's own entry objects, never copies.
- Kind arguments narrow the result type of `entryAt`, `entriesAt`, and
  `entriesUnder`. A component kind still permits a component variant unless
  `variants: "exclude"` removes it. `variants: "only"` returns only screen
  variants and component variants. `entriesWhere` preserves a type guard's
  narrowed result type.
- Every error names the helper, the path or folder, the kind or variant filter,
  and the match count.
- The shared lookups use `entryAt`: `designDocument` in
  `tests/helpers/design_catalogue.ts` and `componentParent` in
  `tests/helpers/component_views.ts`.
- `componentParent` keeps its variant rejection and throws
  `CatalogueSelectionError` when the selected component is a variant.

### Lint rule

`eslint.config.js` adds a `no-restricted-syntax` block for
`tests/**/*.{ts,tsx}` and ignores `tests/helpers/catalogue_selection.ts`.
`packages/viewer/tests` selects no catalogue entries and stays out of scope.
Each message names the helper to use.

1. Continue filter, Milestone 5:
   `ForOfStatement[right.type='MemberExpression'][right.property.name='entries'] > BlockStatement > IfStatement:matches([consequent.type='ContinueStatement'], [consequent.type='BlockStatement'][consequent.body.length=1][consequent.body.0.type='ContinueStatement'])`.
2. Prefix filter, Milestone 5:
   `CallExpression[callee.object.property.name='entries'][callee.property.name=/^(filter|flatMap|find|findLast|findIndex|some|every)$/] CallExpression[callee.property.name=/^(startsWith|endsWith)$/][callee.object.property.name='path']`.
3. Literal path, Milestone 6: the same selection calls, containing
   `BinaryExpression[operator=/^[!=]==$/][left.property.name='path'][right.type=/^(Literal|TemplateLiteral)$/]`.

Selectors 1 and 2 implement the approved rule without its false positives. An
assertion such as `assert.ok(entry.path.startsWith(...))` and a filter on
another `path` field stay allowed. Selector 3 extends the rule. It sends
literal-path lookups through `entryAt` and `assertAbsent`, so a future absence
check cannot go stale silently. The user approved this extension on 2026-10-06.

The rule sees syntax only. It does not see filters over arrays derived from
`entries`, comparisons with variables, or content filters in inner loops. The
guard still fails such a test when it makes no assertion.

## Milestone 1: Define the contract — completed

Write the guard, helper, and lint contracts into the documentation before any
code changes.

- [x] Add `docs/protocol/ci-test-assertions.md` with the guard, the selection
      helpers, the lint rule, and their limits, as decided above. Keep it under
      250 lines. Set its Delivery Status to planned and link this plan.
- [x] Index the page in `docs/protocol/README.md` beside CI suite evidence.
- [x] Link the page from the Unit/integration and Repository rows of the gate
      table in `docs/protocol/ci-verification.md`. Change only those table
      rows, because the page has 247 of its 250 lines.
- [x] Add one paragraph to "Develop Mokly" in `README.md`: a unit test that
      makes no assertion fails, and tests select catalogue entries through the
      checked helpers.
- [x] Update the unit-suite text in `xtask/README.md`. In the test paragraph of
      `examples/basic/README.md`, state that a moved or renamed spec makes a
      test fail; it cannot leave the test empty.
- [x] Run `npx prettier --check` on the changed Markdown. Run
      `tests/protocol_structure.test.ts`, `tests/protocol_doc_sizes.test.ts`,
      and the guide tests. Review the diff.
- [x] Commit.

## Milestone 2: Checked catalogue selection helpers — completed

Add the helpers and their tests. No existing test changes its behavior.

- [x] Record kind-result narrowing and component-variant rejection in this
      plan and `docs/protocol/ci-test-assertions.md`.
- [x] Add failing tests in `tests/catalogue_selection.test.ts` that use small
      manifest literals:
  - [x] `entryAt`: a found entry, a missing path, and a wrong kind.
  - [x] `entriesAt`: the input order, and missing, duplicate, and wrong-kind
        paths.
  - [x] `entriesUnder`: `design/components` does not match
        `design/componentsx/a` or the folder's own entry; one kind and a list
        of kinds; each `variants` value; the default `min` and a larger `min`.
  - [x] `entriesWhere`: a match, and too few matches with the description in
        the message.
  - [x] `assertAbsent`: a present path raises `AssertionError`; an absent path
        under a live anchor passes; a dead anchor raises
        `CatalogueSelectionError`; a top-level path uses the catalogue root.
  - [x] Every helper returns the manifest's own objects.
  - [x] Kind arguments narrow result types without caller casts.
  - [x] `componentParent` returns a parent and rejects a variant with
        `CatalogueSelectionError`.
- [x] Keep the helper tests under 300 lines by moving shared manifest literals
      to `tests/helpers/catalogue_selection_fixture.ts` and the parent-lookup
      regression to `tests/component_parent_selection.test.ts`.
- [x] Implement `tests/helpers/catalogue_selection.ts` with doc comments on
      every export.
- [x] Route `designDocument` and `componentParent` through `entryAt`. Use
      `componentParent` in `tests/design_modern_controls.test.ts`.
- [x] Run the new tests and every test file that imports a changed helper. Run
      `npm run lint` and `npm run typecheck:prepared`.
- [x] Commit.

## Milestone 3: Rewrite the nine empty checks, test-first — completed

Prove that each check is empty, then make it check the current catalogue.

- [x] Convert each check in the table to its helper, but keep the old id or
      prefix. Run each file. Confirm that each converted check now fails with
      `CatalogueSelectionError`. Record each failed test name and its error
      message in the commit body. Stop if any converted check still passes.
- [x] Change each converted check to the current path in the table.
- [x] Measure each converted loop's current entry count with temporary logs.
      Report the counts and remove the logs before the commit.
- [x] Run the seven changed files. Every test in them must pass.
- [x] Commit.

### Review fixes — completed

- [x] Preserve type-guard results in `entriesWhere` and narrow
      `entriesUnder` by its variant filter. Add failing type assignments before
      the implementation change. Remove both repeated loop checks.
- [x] Use `matchesVariants` and remove the formatting directive.
- [x] Move absence tests to `tests/catalogue_selection_absence.test.ts` so the
      expanded type tests stay below 300 lines. Keep every assertion.
- [x] Record the narrowing in this plan and the protocol. Run relevant tests,
      lint, type checks, and formatting. Commit the review fixes separately.

## Milestone 4: Zero-assertion guard — completed

Fail every unit test that makes no assertion.

- [x] Keep only the runner-argument check in the new entrypoint test. The
      existing test already checks both entrypoints.
- [x] Split the existing CI workflow tests by responsibility without changing
      their assertions, so the new native guard test fits the 300-line cap.
- [x] Use `.mjs` guard fixtures and test the resolve/load hooks directly. Run
      the repository ratchet early. Run guard tests on both Node releases.
- [x] Run the generated-expression fixture without `tsx` on both releases;
      Node 24 with `tsx` emits `false == true` even for `.mjs` input. Keep the
      standard flags for the other fixtures.
- [x] Add failing tests in `tests/verification_assertion_guard.test.ts`. Each
      test starts Node with the guard flags and the repository reporter on a
      fixture in `scripts/verification/_fixtures_/assertion-guard/`. Like
      `tests/verification_process.test.ts`, it removes `NODE_TEST_CONTEXT` and
      the guard's process record from the child environment. Then it reads the
      event report. Cover these cases:
  - [x] A test without an assertion fails with the documented message. A test
        with one passes.
  - [x] A subtest's assertion gives credit to its parent. A subtest without an
        assertion fails.
  - [x] `describe` and `it` follow the same rules.
  - [x] A skip option, `t.skip()`, and a todo test do not fail the run, and the
        tests after them still pass.
  - [x] `await assert.rejects(...)`, a direct `assert(value)` call, a named
        import, a `t.assert` method, and an import of `node:assert` each
        count. `node:assert` keeps its loose comparisons, and its `strict`
        property counts.
  - [x] An assertion in a file `beforeEach` hook counts. An assertion only in
        `afterEach` or `t.after()` does not.
  - [x] Concurrent sibling tests fail with the sequential message.
  - [x] `assert.match`, `assert.doesNotMatch`, and the `rejects` message
        "Missing expected rejection" behave as they do without the guard.
  - [x] The first stack frame of a failing assertion is the fixture line.
  - [x] A failing `assert.ok(expression)` without a message shows the fixture's
        expression in its generated message.
  - [x] A Node child that a fixture forks with inherited `execArgv` keeps its
        stdout and exit code.
- [x] Add a test to `tests/verification_entrypoints.test.ts` that the unit
      runner loads the guard under both policies. Add a test to
      `tests/ci_workflow.test.ts` that each native `node --test` step loads it.
- [x] Implement the guard modules as decided above.
- [x] Add the guard flag to `scripts/verification/unit-runner.mjs`, after
      `tsx`, and to the three native steps in `.github/workflows/ci.yml`.
- [x] Make the ten tests that only complete without an error state that claim
      with `assert.doesNotThrow` or `await assert.doesNotReject`:
      `tests/baseline_timings.test.ts:97`,
      `tests/build_gitignore_generated.test.ts:126`,
      `tests/compatibility.test.ts:193`,
      `tests/component_source_build.test.ts:118`,
      `tests/export_module_references.test.ts:8`,
      `tests/export_references.test.ts:27`,
      `tests/export_references.test.ts:42`,
      `tests/path_identity_review.test.ts:36`,
      `tests/publication_input_confinement.test.ts:56`, and
      `tests/verification_process_owner.test.ts:128`.
- [x] Run `npm run test:prepared` on the `.nvmrc` release and on Node
      22.14.0, the CI minimum. If the guard fails another test, for example
      after the Milestone 2 helper change, give that test an assertion that
      states its claim. Both runs must pass. Record both suite durations, with
      and without the guard, in the commit body.
- [x] Smoke test: add a temporary test file with one empty test, run
      `npm run test:prepared`, and confirm the guard message and the failed
      run. Then delete the file.
- [x] Commit.

## Milestone 5: Lint prefix and continue filters — completed

Send catalogue selections through the checked helpers.

- [x] Preserve the existing assertion claims in the migrated files.
- [x] `min` defaults to 1. Raise it only when the test needs that many entries
      to prove its claim and no assertion already checks the count. Never copy
      an exact count into `min`; exact counts belong in assertions.
- [x] Record the selectors 1 and 2 lint result over `tests/` before and after
      migration. The reported-site count must change from 23 to 0.
- [x] Run each browser spec affected by the shared fixture, including each
      project where it runs, without setting `PLAYWRIGHT_CHANNEL`.
- [x] Add failing tests in `tests/eslint_catalogue_selection.test.ts` that call
      `ESLint.lintText` with a `tests/` file path:
  - [x] Selectors 1 and 2 report each banned shape, including the braced
        `continue` form, with the documented message.
  - [x] Helper calls, `entries.map`, an assertion on
        `entry.path.startsWith(...)`, a `continue` in an inner loop, a loop over
        `Object.entries(...)`, and a filter on another `path` field report
        nothing.
  - [x] The helper module and files outside `tests/` report nothing.
- [x] Migrate the 23 remaining sites in 15 files to the helpers:
      `tests/browser/component_design_fixture.ts`,
      `tests/browser/design_comparison_eligibility.spec.ts`,
      `tests/browser/design_library.spec.ts`,
      `tests/component_design_attribution.test.ts`,
      `tests/design_appearance_controls.test.ts`,
      `tests/design_appearance_variants.test.ts`,
      `tests/design_comparison_scrolling.test.ts`,
      `tests/design_comparison_stacks.test.ts`,
      `tests/design_component_comparison_states.test.ts`,
      `tests/design_document_styles.test.ts`,
      `tests/design_library_inventory.test.ts`,
      `tests/design_library_usage.test.ts`, `tests/design_links.test.ts`,
      `tests/design_links_inventory.test.ts`, and
      `tests/design_screen_counts.test.ts`.
- [x] Add the ESLint block with selectors 1 and 2.
- [x] Run `npm run lint`, the changed unit test files, and the changed browser
      specs with `npx playwright test <spec>`.
- [x] Commit.

## Milestone 6: Lint literal path lookups — completed

Extend the lint rule to literal path lookups, as the user approved on
2026-10-06.

- [x] Resolve the top-level absence contract in a separate commit, test-first.
      A top-level path uses the catalogue root. The root is live when at least
      one entry exists; an empty root throws `CatalogueSelectionError` with
      reason `catalogue root has no entries`. Migrate the `helper` check in
      `tests/component_registry_validation.test.ts` to `assertAbsent`, after
      `entryAt(manifest, "action", "component")` proves the module's path shape.
- [x] Apply the reviewer correction in a separate commit before selector 3:
  - [x] Remove the eleven raised `min` values from Milestone 5. Keep exact count
        assertions and use the default minimum.
  - [x] Define and test positive safe integer validation before implementing
        it. Both selection helpers throw `CatalogueSelectionError` with reason
        `min must be a positive integer` for zero, negative, fractional,
        `NaN`, infinite, or unsafe values. Keep the helper files under 300 lines.
  - [x] Record the minimum rule and validation in the protocol and this plan.
  - [x] Run the changed unit files, helper tests, ESLint, and prepared type
        checks. Browser specs are unchanged and need no repeat run.
  - [x] Commit the correction.
- [x] Extend the lint tests. Selector 3 reports a literal path compared with
      `===` or `!==` in `find`, `some`, `filter`, and `every` calls on
      `entries`. A comparison with a variable reports nothing.
- [x] Keep fixture construction separate from absence assertions. Use
      `entriesAt` for a retained path list and `entriesWhere` for exclusions.
- [x] In `tests/move_links.test.ts`, select the saved component from its
      manifest with `entryAt`, then find the private compiler location by that
      checked path. The private record is not a manifest entry. Assert that
      the location record exists; keep all render diagnostics.
- [x] Record the selector 3 count before and after the complete migration.
- [x] Migrate the 54 sites in 32 files. A presence lookup becomes `entryAt`, an
      absence check becomes `assertAbsent`, and a literal list becomes
      `entriesAt`. When a migrated test then makes no assertion, add one that
      states its claim. Today the sites are in
      `tests/browser/design_library.spec.ts`,
      `tests/browser/evidence_removed.spec.ts`,
      `tests/browser/frame_adapter_fixture.ts`, `tests/build.test.ts`,
      `tests/build_imported_styles_links.test.ts`,
      `tests/catalogue_parent_title.test.ts`,
      `tests/catalogue_projection.test.ts`,
      `tests/catalogue_removed_previews.test.ts`, `tests/changes.test.ts`,
      `tests/component_build.test.ts`,
      `tests/component_fast_path_resources.test.ts`,
      `tests/component_registry_validation.test.ts`,
      `tests/component_rendering.test.ts`,
      `tests/deleted_resource_classification.test.ts`,
      `tests/design_library_usage.test.ts`, `tests/design_screens.test.tsx`,
      `tests/entry_attribution.test.ts`, `tests/entry_discovery.test.ts`,
      `tests/example_baseline.test.ts`,
      `tests/example_imported_styles.test.ts`,
      `tests/imported_asset_inputs.test.ts`, `tests/move_links.test.ts`,
      `tests/page_model.test.ts`, `tests/public_exclusions.test.ts`,
      `tests/removed_screen_previews.test.ts`, `tests/review.test.ts`,
      `tests/review_basics.test.ts`, `tests/review_regressions.test.ts`,
      `tests/server_changed.test.ts`,
      `tests/server_changed_manifest.test.ts`,
      `tests/server_route_scoped_bootstrap.test.ts`, and
      `tests/watch_imported_assets.test.ts`.
- [x] Add selector 3. Run `npm run lint`, the changed unit test files, and the
      changed browser specs.
- [x] Commit.

## Milestone 7: Deliver and review — completed

Complete the required delivery sequence after validation passes.

Evidence: `.context/vacuous-test-prevention/measurements.md`.
Evidence: `.context/vacuous-test-prevention/main-audit.md`.
Evidence: `.context/vacuous-test-prevention/merge-review.md`.
Evidence: `.context/vacuous-test-prevention/gate-results.md`.

- [x] Move verification evidence out of the plan under the updated agent rule.

- [x] Remove optional chains and tautological assertions on `entryAt`
      results in a separate cleanup commit. Run all affected files under the
      guard and retain assertions that state their real claims.
- [x] Set the Delivery Status of `docs/protocol/ci-test-assertions.md` to
      implemented.
- [x] Remove the "planned" assertion-contract wording from `README.md`,
      `xtask/README.md`, `examples/basic/README.md`, and the
      `docs/protocol/README.md` index entry when the protocol is implemented.
- [x] Classify each remaining `"design-…"` literal in `tests/` and confirm that
      no obsolete catalogue entry id remains.
      Evidence: `.context/vacuous-test-prevention/design-literals.md`.
- [x] Fetch `origin/main` and record the source tip. Audit main's additions
      from the branch point. Merge one branch at a time, check the merge
      parents and the remerge diff, and confirm that no file or feature on
      `origin/main` is deleted without approval.
- [x] Run `cargo xtask check` once. If only a known timing test fails, rerun
      that suite once. Report every other failure before changing code.
- [x] Run `git add -A`, commit with Conventional Commits, and push the branch.
- [x] The reviewer agent runs the post-push review against `origin/main` with
      [`docs/implementation-review-prompt.md`](../docs/implementation-review-prompt.md).
      The implementation agent applies the `Auto-fix: yes` findings under the
      `AGENTS.md` review-fix rule.
      Open: the viewer workspace `npm test` runs without the assertion guard (review 1, finding 4); the user decides.
      Evidence: `.context/vacuous-test-prevention/review-1.md`.

## Milestone 8: Combine the test lint rule sets with main — completed

Merge the newer `origin/main` at the user's request. Main's test timing guard
adds a second `no-restricted-syntax` block for `tests/`. ESLint keeps only the
last options of a rule for each file, so two blocks silently drop one rule set.

Evidence: `.context/vacuous-test-prevention/merge-2/` and `merge-3/`.

- [x] Merge `origin/main` at `43ae07b` (#145). Add main's
      `tests/cache_ignore.test.ts` to the guarded native transaction step.
- [x] Merge `origin/main` at `667bbdb` (#151, #152). Keep both protocol index
      entries.
- [x] Add `tests/test_lint_rule_sets.test.ts` first. It checks that both rule
      sets apply to `.ts`, `.tsx`, and spec files, and that each helper keeps
      its exemption. A naive two-block resolution fails its `.ts`, `.tsx`, and
      spec rows.
- [x] Move both restriction sets into shared lists in `eslint.config.js`.
      Each block lists every restriction set for its files.
- [x] State the shared rule in `docs/protocol/ci-test-assertions.md` and
      `docs/protocol/ci-test-timing.md`.
- [x] Run `cargo xtask check`.
- [x] Run `git add -A`, commit with Conventional Commits, and push the branch.
- [x] After the push, the reviewer agent reviews the complete local diff
      against `origin/main` with
      [`docs/implementation-review-prompt.md`](../docs/implementation-review-prompt.md).
      The implementation agent applies the `Auto-fix: yes` findings under the
      `AGENTS.md` review-fix rule.
      Review 3 found one auto-fixed docs finding; finding 4 of review 1 stays
      open. Evidence: `.context/vacuous-test-prevention/review-3.md`.

## Post-merge follow-up (non-blocking)

- Design a zero-assertion check for Playwright specs. Playwright has no
  assertion counter, so the check needs its own design.
