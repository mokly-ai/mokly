# Meta-Test Reduction

Status: Active. Planned on 2026-10-07. The user approved this direction on
2026-10-07: delete the documentation prose-regex tests and keep the structural
ones, reduce the workflow YAML tests to property tests, move the whole-tree
lints out of the unit suite with the protocol cap table in a data file, leave
the harness and ratchet tests alone, and add two agent rules. That approval
covers every deletion in the Inventory section. `tests/release.test.ts` was
found after the approval and waits for a decision (Decision 7).

## Status And Outcome

About 76 of the 771 unit test files test other tests, CI workflow files,
documentation prose, or repository policy instead of the product. Three kinds
have value: harness unit tests, ratchet unit tests, and structural checks that
compare documentation with code. Two kinds do not: tests that match
documentation sentences with regular expressions, and tests that restate
workflow YAML literals in TypeScript. A third group is misplaced: lints that
scan the whole tree from inside the sharded unit suite.

This plan:

- deletes the documentation prose-regex tests and keeps the structural ones;
- deletes six workflow literal test files and keeps their property, agreement
  and script-execution checks in two new files;
- moves the artifact-path and fixture-lifecycle scans into ESLint rules, moves
  the browser shard-balance bound into the evidence aggregate, and moves the
  protocol cap table into a data file;
- adds two agent rules so the removed patterns do not return.

Harness tests (`verification_*`, `release_*`) and ratchet tests
(`repository_ratchets*`, `source_file_length`, `public_export*`) stay
unchanged. No product behaviour changes. Evidence for every milestone lives
under `.context/meta-test-reduction/`.

## Contract Owners

- [CI test repository inputs](../docs/protocol/ci-test-repository-inputs.md)
- [CI workflow graph](../docs/protocol/ci-workflow.md)
- [CI suite evidence](../docs/protocol/ci-suite-evidence.md)
- [CI verification](../docs/protocol/ci-verification.md) and
  [repository gate](../docs/protocol/ci-verification-repository.md)
- [Repository verification ratchets](../docs/protocol/verification-ratchets.md)
- [Artifact paths](../docs/protocol/mokly-artifact-paths.md)
- [Guides](../docs/protocol/mokly-guides.md)
- [Testbox execution](../docs/protocol/remote-verification-testbox.md)
- `AGENTS.md` (`CLAUDE.md` is a symlink to it)

## Decisions

1. No workflow snapshot test. A snapshot is a cheaper copy of the YAML and
   fails for the same non-defect reasons. Review owns workflow literals.
2. The browser shard-balance bound moves into the evidence aggregate, not into
   a repository-suite script. `validateShardReports` in
   `scripts/verification/report-validation.mjs` already receives every browser
   shard's `assignedTests` and `fullTests`. The 125% bound needs about fifteen
   lines there and no Playwright listing. It then runs in `Required CI` and on
   remote Testboxes from real reports. The local sequential gate runs
   unsharded and does not apply the bound. Alternative A: a
   `scripts/verification/browser-shard-balance.mjs` command in the repository
   suite with six Playwright listings per run, plus an xtask command and its
   tests. The user may select A instead.
3. The cap table lives at `xtask/protocol-document-caps.json`, beside
   `xtask/unused-internal-exports.txt`, the other ratchet baseline. Keys are
   sorted document names relative to `docs/protocol/`. Values are safe
   integers above 250. The file is not under `docs/protocol`, which npm
   publishes.
4. Legacy fallback. The protocol cap ratchet reads the baseline table at the
   comparison commit. Until `origin/main` and every open branch's merge base
   contain the JSON file, the ratchet falls back to the TypeScript table in
   `tests/protocol_doc_sizes.test.ts` at the comparison commit. Removing the
   fallback is a post-merge item.
5. The artifact-path and fixture-lifecycle scans become rules in the local
   `mokly` ESLint plugin under `scripts/eslint/`, the established pattern.
   `npm run lint` already runs in the repository suite.
6. No new external tools. `zizmor` and `actionlint` cover pinned actions and
   template injection, but a new gate needs its own decision. Post-merge item.
7. `tests/release.test.ts` asserts `release.yml` literals (exact dispatch
   input, step order) mixed with properties (no npm token secrets, OIDC
   permissions, pinned checkout). Recommendation: reduce it to its property
   assertions in Milestone 2. That TODO waits for user approval.
8. The untrusted-interpolation scope stays as today: `ci.yml` run steps never
   interpolate `github.event.pull_request.head.ref` or `.labels`, and
   `dependency-audit.yml` run steps contain no `${{`. Broadening to every
   workflow is a post-merge option.

## Inventory

### Documentation prose tests

Delete whole files:

- `tests/guides_ci_verification.test.ts`. Move its structural test "CI flags
  and credential sources exist in code and the upload contract" into
  `tests/guides_ci.test.ts` first.
- `tests/build_warning_protocol.test.ts`.

Delete these tests inside files:

- `tests/guides_ci.test.ts`: "Complete idempotency, accounting and
  cancellation copy stay explicit".
- `tests/guides_upload_validation.test.ts`: "receiver limits, stored blobs and
  plan URL protocols are unambiguous" and "archive rules accept only regular
  files and authenticate before decompression".
- `tests/guides_cli.test.ts`: "build guides explain the cache that Git
  ignores" and "publish and export guides carry the reviewed contract copy".
- `tests/guides_authoring.test.ts`: "the generated-output guides agree with
  index-derived tracking".
- `tests/component_protocol_docs.test.ts`: "delivered component contracts do
  not retain superseded status or version instructions".

Trim these tests. Keep assertions that compare code, constants, tables, fences
or values. Delete sentence regexes and source-text regexes:

- `tests/guides_ci.test.ts`: "CI code fences never invent a receiver request
  path" keeps the fence scan; "documented request headers and acceptance match
  the transport" keeps the fence headers, transport calls and timeout check.
- `tests/guides_upload_validation.test.ts`: "documented retries agree with the
  protocol" keeps the status codes, attempt word, wait wording and Retry-After
  values derived from constants; "comparison fields stay required nulls
  without comparisons" keeps the `validateUploadManifest` checks.
- `tests/component_protocol_docs.test.ts`: "manifest v9 and review v6 share
  path identity" keeps the fixture assertions, the `schemaVersion` value checks
  and the README index rows.
- `tests/verification_pull_request_title.test.ts`: "CI and release contracts
  document the enforced title boundary" keeps the script path, the error
  constant and the type list presence.

Keep unchanged: `guides_structure`, `guides_versions`, `guides_copy`,
`protocol_structure`, `protocol_split_links`, `protocol_doc_history`,
`markdown_links`, `npm_pin`, `dependency_security`, and every `design_*` test.
`tests/helpers/guides_ci_context.ts` drops the `verification`, `workflow`,
`release`, `recovery` and `terminal` exports.

### Workflow tests

Delete: `tests/ci_workflow.test.ts`, `tests/ci_testbox_workflow.test.ts`,
`tests/ci_runtime_profile.test.ts`, `tests/deployment.test.ts`,
`tests/dependency_audit_workflow.test.ts`, `tests/ci_native_output_lock.test.ts`.

Keep unchanged: `tests/ci_required_guard.test.ts`,
`tests/ci_workflow_remote_state.test.ts`, `tests/ci_pull_request_title.test.ts`,
`tests/npm_pin.test.ts`, `tests/release_evidence_contract.test.ts`,
`tests/workflow_runner_sizes.test.ts`, `tests/publish_action.test.ts`,
`tests/helpers/testbox_workflow.ts`.

New `tests/ci_workflow_policies.test.ts`:

1. Every `uses:` in `.github/workflows/*.yml` and
   `.github/actions/*/action.yml` ends with a 40-character hex revision.
2. The Decision 8 interpolation rules.
3. Every `ci.yml` and `preview.yml` job that checks out uses `fetch-depth: 0`.
4. The `ci.yml` package, unit, browser and hydration jobs contain no
   `git merge-base HEAD origin/main`, branch-point or baseline lockfile
   command, and `ci.yml` never mentions `origin/main`.
5. `.nvmrc`, the `package.json` engines range, the lockfile engines range and
   the README agree with `TESTED_NODE_VERSIONS` and `SUPPORTED_NODE_RANGE`.
6. The Testbox workflow's "Set up Node.js" version, "Set up npm" and "Set up
   Rust" run strings equal the CI repository job's.
7. The Playwright example server command includes `--base HEAD`, checked
   through an exported command builder in `tests/browser/example_servers.ts`,
   not by matching source text. Export one if none exists.

New `tests/ci_workflow_scripts.test.ts`. Each test locates its step by name
and fails with a clear message when the step is absent:

1. Runs the "Select Node verification profile" script with
   `RELEASE_PULL_REQUEST` true and false. Expected outputs derive from
   `TESTED_NODE_VERSIONS` and `RELEASE_VERIFICATION_RUNTIMES`.
2. Runs the Testbox "Stamp installed lockfile" script in a temporary
   directory on Linux and checks the digest file.
3. Runs the Testbox "Expose job environment to Testbox sessions" script with
   a `sudo` stub and checks that only `PATH` and `PLAYWRIGHT_CHANNEL` change.

Coverage note: the deleted "browser checks support an isolated workspace port"
test is covered by `tests/verification_example_servers.test.ts`.

### Whole-tree lints

- `tests/protocol_doc_sizes.test.ts`: delete. The protocol cap ratchet already
  audits every protocol document on every repository-suite run.
- `tests/artifact_path_helpers.test.ts`: replace with ESLint rule
  `mokly/no-artifact-path-literals`.
- `tests/fixture_lifecycle.test.ts`: tests 3 to 5 become ESLint rules
  `mokly/no-late-fixture-teardown` and `mokly/no-eager-fixture-setup`; tests 1
  and 2 stay.
- `tests/browser_shard_balance.test.ts`: delete after the aggregate bound.
- `tests/eslint_postcss_calls.test.ts`: delete "every Mokly source file except
  the helper keeps both PostCSS restrictions"; the repository suite's
  `eslint .` covers every file. Tests 1 to 3 stay.

## Milestone 1: Documentation, agent rules and prose-test removal

The documentation edits and the prose-regex tests cannot be separated. Those
tests pin the sentences that this milestone rewrites, so the removal lands here.

- [ ] `AGENTS.md`: add two rules under `## General`. First: do not test
      documentation wording with regular expressions or sentence matches; test
      documentation against code structurally by comparing parsed values,
      names, options, tables, links and counts with the code or data that owns
      them. Second: verify workflow YAML by executing its scripts with
      controlled inputs and by checking policy properties such as pinned
      action revisions and no untrusted interpolation in `run:` steps; do not
      assert literal job names, step order, matrix values or run strings.
      Update the cap reference in "Rust File Size Limits" to
      `xtask/protocol-document-caps.json`.
- [ ] `docs/protocol/ci-test-repository-inputs.md`: replace the
      `tests/deployment.test.ts` and `tests/ci_workflow.test.ts` items with
      `tests/ci_workflow_policies.test.ts`; state that review owns workflow
      literals.
- [ ] `docs/protocol/ci-workflow.md`: add a "Workflow Verification" paragraph
      that names the policy and script test files and the kept property tests.
- [ ] `docs/protocol/ci-suite-evidence.md`: rewrite "Browser Shard Balance"
      for the aggregate bound (Decision 2) and name the two fixture ESLint
      rules in the fixture paragraphs.
- [ ] `docs/protocol/ci-verification.md` and
      `docs/protocol/ci-verification-repository.md`: point the cap reference at
      the JSON file and list the ESLint-enforced rules in the repository suite
      paragraph.
- [ ] `docs/protocol/verification-ratchets.md`: "Protocol Document Caps" owns
      `xtask/protocol-document-caps.json`, its format, the legacy fallback and
      the fallback removal condition.
- [ ] `docs/protocol/mokly-artifact-paths.md`: name
      `mokly/no-artifact-path-literals` and its scope: `src/**`,
      `packages/viewer/src/**`, `scripts/**` and `examples/**` modules, except
      `packages/viewer/src/navigation/routes.ts` and test directories.
- [ ] `docs/protocol/mokly-guides.md`: state that root guide tests compare
      guide content with code and data structurally and never match sentences.
- [ ] `docs/protocol/remote-verification-testbox.md`: name
      `tests/ci_workflow_scripts.test.ts` for the stamp and environment steps.
- [ ] `xtask/README.md`: name the caps file.
- [ ] Active plans: annotate unticked items and prose that name a removed test
      in `plans/attribution-test-consolidation.md` (lines 502 and 573),
      `plans/baseline-relative-dependency-audit.md` (289, 379, 425),
      `plans/generated-output-simplification.md` (303, 305, 432),
      `plans/styled-link-control-ancestor-rule.md` (187),
      `plans/deterministic-test-timing.md` (362) and
      `plans/hydration-route-shapes.md` (165, 174). Leave ticked history lines
      unchanged. Record each plan edit in the commit message.
- [ ] Apply the Inventory "Documentation prose tests" deletions and trims.
      Remove the unused `guides_ci_context.ts` exports.
- [ ] Run `npm run format:check`, `npm run lint`, and
      `node --import tsx --test tests/guides_*.test.ts tests/protocol_*.test.ts tests/markdown_links.test.ts tests/component_protocol_docs.test.ts tests/verification_pull_request_title.test.ts`.
      Save output under `.context/meta-test-reduction/milestone-1.md`.
- [ ] Commit with Conventional Commits and push.

## Milestone 2: Reduce workflow YAML tests

- [ ] Add `tests/ci_workflow_policies.test.ts` with the seven checks from the
      Inventory. Keep the file under 300 lines.
- [ ] Add `tests/ci_workflow_scripts.test.ts` with the three script runs.
- [ ] Delete the six workflow literal test files.
- [ ] After user approval of Decision 7, reduce `tests/release.test.ts` to its
      property assertions.
- [ ] Run the new tests and the kept workflow tests:
      `node --import tsx --test tests/ci_*.test.ts tests/npm_pin.test.ts tests/release_evidence_contract.test.ts tests/workflow_runner_sizes.test.ts tests/publish_action.test.ts`.
      Save output under `.context/meta-test-reduction/milestone-2.md`.
- [ ] Run `cargo xtask check --suite repository`. Commit and push.

## Milestone 3: Move whole-tree lints and the cap table

- [ ] Add `xtask/protocol-document-caps.json` with the current
      `oversizedCaps` entries.
- [ ] `scripts/verification/ratchets/length-policy.mjs`: add a JSON cap
      parser with the same validation (safe integer above 250, no repeats,
      sorted keys). Keep the TypeScript parser as the legacy baseline reader.
- [ ] `scripts/verification/ratchets/protocol-caps.mjs` and
      `scripts/verification/source-file-length.mjs`: read the JSON file at the
      working tree; at the comparison commit read the JSON file, else the
      legacy test file, else bootstrap from line counts.
- [ ] Update the fixtures in `tests/repository_ratchets_git.test.ts` and
      `tests/source_file_length.test.ts` to write the JSON file. Add the JSON
      parser tests and one legacy-fallback case in a new
      `tests/protocol_caps_table.test.ts`; `tests/repository_ratchets.test.ts`
      is already over 300 lines and must not grow.
- [ ] Delete `tests/protocol_doc_sizes.test.ts`.
- [ ] Add `scripts/eslint/no-artifact-path-literals.mjs`. Report string
      literals and whole template literals that contain `snapshots/` or match
      the `pages/<route>.json` pattern. Register it in `eslint.config.js` with the scope from
      Milestone 1. Delete `tests/artifact_path_helpers.test.ts`. Add
      `tests/artifact_path_lint.test.ts` using `tests/helpers/lint_config.ts`.
- [ ] Add `scripts/eslint/no-late-fixture-teardown.mjs` and
      `scripts/eslint/no-eager-fixture-setup.mjs`. Port the `inspectScope` and
      `moduleFixtureCalls` logic from `tests/fixture_lifecycle.test.ts` to
      ESTree. Scope both rules to `tests/**`. Delete tests 3 to 5 from
      `tests/fixture_lifecycle.test.ts`. Add
      `tests/fixture_lifecycle_lint.test.ts` with the sample code from the
      deleted test 5 as rule cases.
- [ ] `scripts/verification/report-validation.mjs`: export
      `BROWSER_SHARD_SHARE_LIMIT = 1.25` and enforce the bound for the browser
      suite inside `validateShardReports`. The message names the shard, its
      count, the total, the limit, and asks to split a large spec into smaller
      spec files. Add `tests/verification_shard_balance.test.ts`;
      `tests/verification_evidence.test.ts` is already over 300 lines.
- [ ] Delete `tests/browser_shard_balance.test.ts`.
- [ ] Delete test 4 from `tests/eslint_postcss_calls.test.ts`.
- [ ] Smoke: run `npm run lint` and confirm zero findings from the three new
      rules on the current tree. Run
      `node scripts/verification/repository-ratchets.mjs` and
      `cargo xtask source-file-length-lint --all`. Run the new unit tests.
      Save output under `.context/meta-test-reduction/milestone-3.md`.
- [ ] Run `cargo xtask check --suite repository`. Commit and push.

## Milestone 4: Final gate, commit, push and review

- [ ] Run `cargo xtask check`. Save output under
      `.context/meta-test-reduction/final-check.md`.
- [ ] Inspect `git diff --name-status origin/main` and
      `git diff --diff-filter=D --name-status origin/main`. Confirm every
      deletion is in the Inventory. Record the deletions in the commit and PR
      description.
- [ ] Run `git add -A`, commit with Conventional Commits, and push.
- [ ] Review: after the push, use `docs/implementation-review-prompt.md` to
      review the complete local diff against `origin/main`. Report the
      findings. Apply the review-fix rule: fix the `Auto-fix: yes` findings,
      run the checks, commit, push, re-run the review once, and report the
      rest. Add each open finding as one line below.

## Post-merge follow-up (non-blocking)

- Remove the legacy TypeScript cap-table fallback once `origin/main` and every
  open branch's merge base contain `xtask/protocol-document-caps.json`.
- Decide whether `zizmor` and `actionlint` replace the pinned-revision and
  interpolation checks in `tests/ci_workflow_policies.test.ts`.
- Decide whether the Decision 8 interpolation rule applies to every workflow.
- Consider moving the documentation structure lints (`protocol_structure`,
  `protocol_split_links`, `protocol_doc_history`, `guides_structure`,
  `markdown_links`) into one repository-suite script.
- Harness size review, each as its own plan: replace the module-graph resolver
  in the export ratchets with `knip`; convert `scripts/verification` to
  TypeScript and delete the `.d.mts` files; confirm the remote Testbox executor
  is used often enough to keep.
