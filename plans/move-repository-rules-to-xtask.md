# Move the Repository File Rules to xtask

Status: Active. [PR #212](https://github.com/mokly-ai/mokly/pull/212) is
open. The plan closes when its PR merges.

Eighteen Node tests under `tests/` check repository files only: the GitHub
workflows and the publish action, the npm and Rust pins, the guides, the
Markdown links, the design CSS of the example catalogue, and the Rust
package-version rule. They test no product code, but they run in the Viewer
suite. This plan rewrites them as one integration test binary of `xtask`,
`xtask/tests/repository_rules`, with every assertion kept. The Repository
suite runs it on Linux, and the Native suite runs it again on macOS and
Windows. The plan deletes the Node tests and the Node helpers that only they
use.

User decision 2 B, 2026-10-26, in the workspace "mokly/tests Rust
migration": rewrite the 18 tests as `xtask` tests with the same assertions.
Rejected: A, keep them in Node. Reason: the checks need no Node, the change
is contained, it matches the user's preference for Rust tests, and it adds no
new crate to the lockfile.

Five cases stay in Node, because each one needs a Node-only tool:

- `tests/ci_workflow_policies.test.ts`, "Node version files agree with the
  package engines and README": it calls `assertNodeVersion` of
  `packages/mokly/src/version.mjs` and the range check of the npm `semver`
  package.
- `tests/ci_workflow_policies.test.ts`, "shared example servers use the
  reserved unavailable base": it calls `exampleServerCommand`, a TypeScript
  builder of the browser suite.
- `tests/release_tags.test.ts`, the three cases that run the JavaScript of
  the tag job's `actions/github-script` step in a `node:vm` context with a
  fake GitHub client. The structure assertions of the tag job move to Rust.

Not covered: the Node scripts that `xtask` calls, which user decision 3 B
ports under the plan `port-verification-scripts-to-xtask.md` on a branch
stacked on this one; the end-to-end tests of the binary, which user decision
1 B ports under `port-cli-tests-to-rust.md`; and the rebuild comparison
tooling, which user decision 4 B deletes in another workspace.

The Node baseline of 2026-10-26 is in
`.context/move-repository-rules-to-xtask/node-baseline.log` and
`node-inventory.txt`.

## Design

- One test binary, `xtask/tests/repository_rules/main.rs`, holds one module
  per area: workflows, guides, Markdown links, design, and the Rust package
  version. A support module finds the repository root from the `xtask`
  manifest directory, reads text, parses YAML, and lists the automation
  files.
- The tests use crates that `Cargo.lock` already holds, at the workspace
  versions: `yaml-rust2` reads YAML 1.2, as the npm `yaml` package does;
  `pulldown-cmark` finds Markdown links and reference definitions; `regex`
  ports the JavaScript patterns, and `fancy-regex` ports the one pattern
  with a lookbehind; `url` makes the WHATWG URL check of guide links;
  `percent-encoding` decodes link paths; `walkdir` lists files; `tempfile`
  holds the publish action fixture. `Cargo.lock` gets no new package.
- The ports write `[0-9]` for the JavaScript `\d` and `[A-Za-z0-9_]` for
  `\w`, because the Rust classes are Unicode-aware.
- The Required CI guard and the publish action cases run `bash`, so they
  compile only under `cfg(unix)`, together with the helpers that only they
  use. The publish action case also needs `node`, because the action's
  install step runs it. Its fake `npm` and `mokly` programs are POSIX shell
  scripts that record their arguments.
- The Markdown parser decides which text is a link. `pulldown-cmark` must
  find the same destinations as the npm `marked` parser in every checked
  file. Milestone 5 compares the two sets before it deletes the Node test.

Contract owners:

- [Repository rules](../AGENTS.md#repository-rules): a repository test checks
  every local link and anchor.
- [Deterministic test repository inputs](../docs/protocol/ci-test-repository-inputs.md).
- [Dependency update pull request](../docs/protocol/dependency-audit-update-pr.md).
- [CI test timing](../docs/protocol/ci-test-timing.md): the `xtask` tests
  follow the same assertion rule.
- The [xtask README](../xtask/README.md) and `AGENTS.md`.

## Milestone 1: Documentation and protocol

No requirement changes. Three protocol pages name a moved test file. They
state each check without a file name, and the READMEs name the files.

- [x] State in `docs/protocol/documentation-policy.md` that a repository
      test checks every local link and anchor, without the file name.
- [x] State the npm pin sentence of
      `docs/protocol/dependency-audit-update-pr.md` without the file name.
- [x] State the example-server and lockfile checks of
      `docs/protocol/ci-test-repository-inputs.md` without file names. Name
      the example-server test in the browser fixtures README. The
      remote-state paragraph changes with decision 3 B, which moves its
      test.

## Milestone 2: Test binary and shared support

- [x] Add the dev-dependencies at their workspace versions. Check that
      `Cargo.lock` gets no new package.
- [x] Create `xtask/tests/repository_rules/main.rs` and its support module.
- [x] Describe the test binary, its areas, and its commands in the xtask
      README.
- [x] Run `cargo test -p xtask --test repository_rules`, Clippy, formatting,
      and the Rust file-length lint.

Evidence: `.context/move-repository-rules-to-xtask/windows-clippy.log`, a
Clippy run for the Windows target without the `cfg(unix)` cases.

## Area milestones

Each area milestone follows the same steps:

1. Port each Node case to a Rust test with every assertion. Keep the cases
   that run `bash` under `cfg(unix)`.
2. Delete the area's Node tests and the Node helpers that only they use.
3. Update each README, doc, and live plan line that names a deleted file.
4. Run the area's Rust tests, Clippy, formatting, the Rust file-length lint,
   and the Node tests that share a touched helper.

## Milestone 3: Workflows and the publish action

- [x] Port `actionlint_config`, `ci_required_guard`, `ci_timing_policy`,
      `dependency_audit_workflow`, `npm_pin`, `rust_pin`, `publish_action`,
      `release`, and `workflow_runner_sizes`.
- [x] Port the cases of `ci_workflow_policies` that read files only: the
      action pins, untrusted input, full history, the checked-out lockfile,
      and the Testbox toolchain. The Testbox case reads
      `TESTED_NODE_VERSIONS` from `packages/mokly/src/version.mjs` as text.
      Keep the two Node-only cases in the Node file.
- [x] Port the structure assertions of the `release_tags` tag job. Keep the
      three script cases in the Node file.
- [x] Update the publish action README, and the two open lines of
      `plans/rust-rebuild.md` that name `tests/actionlint_config.test.ts`
      and `tests/npm_pin.test.ts`.

## Milestone 4: Guides

- [x] Port `guides_copy`, `guides_structure`, and `guides_versions`, with
      the guide loader of `tests/helpers/guides.ts`.

## Milestone 5: Markdown links

- [x] Port `markdown_links`. Save the comparison of the `marked` and
      `pulldown-cmark` link sets under `.context/move-repository-rules-to-xtask/`.
- [x] Remove the `marked` dev-dependency, which only this test uses.
- [x] Update the Markdown check in `AGENTS.md` and the development guide.

Evidence: `.context/move-repository-rules-to-xtask/compare/comparison.md`.

## Milestone 6: Design palette

- [x] Port `design_appearance` and `design_boundaries`, with the palette
      and style-rule readers of `tests/helpers/design_palette.ts` and
      `tests/helpers/design_styles.ts`.
- [x] Keep `paletteColor` of `tests/helpers/design_palette.ts` for the
      browser specs, and remove the contrast functions that only the moved
      tests use.
- [x] Update the verification section of the design library README.

Evidence: the contrast comparison in
`.context/move-repository-rules-to-xtask/compare/comparison.md`.

## Milestone 7: Rust package version

- [x] Port `release_rust_version`, with the detector of
      `tests/helpers/rust_package_version.ts`.

## Milestone 8: Verification, commit, review, and pull request

- [x] Save the map from each Node case to its Rust test under
      `.context/move-repository-rules-to-xtask/`.
- [x] Inject one fault per area into its input, check that the Rust test
      fails, and restore the input. Save the evidence there too.

Evidence: `case-map.md` and `fault-injection.md` in
`.context/move-repository-rules-to-xtask/`. Gate evidence:
`repository-suite.log` and `complete-gate.log` there, remote run
`20261026T181937Z-234094`.

- [x] Run the targeted tests and the complete gate named in `AGENTS.md`.
- [x] Commit with Conventional Commits and push the branch.
- [x] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the review-fix rule: fix the `Auto-fix: yes` findings,
      re-review once, and report the rest.
  - Review 1 of 2026-10-26 fixed findings 1 and 3. Report:
    `.context/move-repository-rules-to-xtask/review-1.md`.
  - Review 2 of the fix fixed its finding 1, the Workflow Verification lead
    sentence, and two pages that still said "root tests" for the moved guide
    checks. Report: `.context/move-repository-rules-to-xtask/review-2.md`.
  - 2. Two publish action checks became stricter. Severity Low, effort
       Small. Recommended: A, keep the standard-error check and confirm it
       with the user.
    - [x] Settled by user decision 1 A of 2026-10-27: keep the stricter
          standard-error check. Rejected: B, restore the Node meaning,
          because the Node check passed for any failure of the step.
  - Outside the review scope: `docs/protocol/ci-workflow.md:220`: the page
    says the policy test requires full-history checkouts in CI and preview
    jobs, but the check covers `ci.yml` only. Separate branch.
    - [x] Resolved on `main` by #218, which removed the sentence.
  - Outside the review scope: `docs/protocol/mokly-guides.md:171`: the page
    says root tests never match prose with regular expressions, but the
    guide copy and version tests match phrases in guide prose. Separate
    branch.
    - [x] Resolved on `main` by #218, which removed the sentence.
- [x] Open the pull request when every other milestone TODO is ticked.
      Put its link in the status paragraph.
