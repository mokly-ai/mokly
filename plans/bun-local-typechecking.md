# Bun for local TypeScript checks

Status: Active. On branch `calummoore/bun-typescript-performance`, no pull request yet. This plan awaits implementation approval. The pull request that completes the work deletes this plan.

Mokly uses Node and npm for development and verification. Its packages use
TypeScript to check source files and write public declarations. Add an optional
local command that uses Bun's native type checker for the same projects.
Keep the existing Node checks as the verification authority.

On 2026-11-01, the user requested this plan after the Bun evaluation.
The recommended first step was local type checking. The alternatives were a
unit runner migration and a complete toolchain migration. Those changes need
separate work because the current test reporter and render sidecar failed
under Bun. This request authorizes planning, not implementation.

## Scope

- Add `npm run typecheck:fast` for local use.
- Keep `npm run typecheck` and the complete gate on the installed TypeScript
  compiler under Node.
- Keep `npm ci`, `package-lock.json`, the npm pin, and package build commands.
- Keep Node for the CLI, render sidecar, test runner, and release commands.
- Keep the current TypeScript version and public declaration output.
- Leave Bun test execution and package installation for separate changes.
- Leave the sidecar transport and historical dependency installation unchanged.

The optional command checks source types. It does not replace the build or
prove complete verification. This work has no screen or mockup changes.

## Design calls

These calls are proposed as part of this plan. They do not change current
requirements before implementation approval.

1. **Local command first.** Agent call, 2026-11-01. Add an optional entry point
   instead of replacing the existing checker. The tested Bun 1.4.4 checker
   matches TypeScript 7.0.2, while this repository uses TypeScript 6. Keep the
   Node result authoritative when the checkers disagree. Alternatives include
   a separate native TypeScript 7 compiler, and parallel or incremental
   TypeScript 6 checks. Keep the selected Bun approach for this first change.
2. **One project inventory.** Agent call, 2026-11-01. Give the standard and fast
   root commands one ordered project list. Separate inline lists can drift.
   Preserve every current project, its configuration, and the stop-on-failure
   behavior. Preserve each project's working directory so standard diagnostic
   paths stay the same. Keep each workspace command and the script-declaration
   command available.
3. **Optional external tool.** Agent call, 2026-11-01. Document the tested Bun
   version, 1.4.4, as an optional developer installation. Add no npm dependency,
   Bun lockfile, automatic download, or version rejection. A developer can use
   `npm install --global bun@1.4.4`. Fresh workspaces use the standard fallback
   until Bun is installed. An npm dev dependency would make installation
   automatic, but would add a native binary to every required install.
4. **Unavailable tool fallback.** Agent call, 2026-11-01. Read `bun --version`
   before selecting its checker. A missing executable or a version below 1.4.4
   uses the standard checker with a warning. Show the optional installation
   command in that warning. Do not fall back after Bun reports type errors,
   another launch failure, a crash, or a signal. Older Bun versions can interpret
   `check` as a script name. This fallback always performs a check.

The shared inventory preserves this order:

1. `packages/mokly/tsconfig.json`.
2. `tsconfig.json`.
3. `packages/ui/tsconfig.json`.
4. `packages/viewer/tsconfig.json`.
5. `tsconfig.scripts-declarations.json`.

Run the fast command's coordinator with Node. Run
`bun check --no-script --all --project` for each project when Bun is available.
The flag `--no-script` prevents a package `check` script from replacing the
checker. The flag `--all` keeps every diagnostic visible in a terminal.
Run the installed TypeScript compiler with `--noEmit` under Node for the
standard command and the unavailable-tool fallback.

Resolve configuration paths from the repository root. Keep the UI and viewer
checks in their package directories. Keep the other checks in the repository
root. Preserve standard diagnostic paths, compiler diagnostics, and unsuccessful
process outcomes. Write no compiled output.

Contract owners:

- [Development guide](../docs/development/README.md).
- [Developer command contract](../docs/protocol/developer-test-commands.md).
- [Verification boundary](../docs/protocol/ci-verification.md#verification-boundary).
- [Gate ownership](../docs/protocol/ci-verification.md#gate-ownership).
- [Base dependency selection](../docs/protocol/mokly-base-dependencies.md).
- [Verification script README](../scripts/verification/README.md).

## Milestone 1: Document the local workflow

Depends on: none

Define the optional command before implementation. Keep the current required
workflow complete for a developer who does not install Bun.

- [ ] Document `typecheck:fast` in the developer command contract.
- [ ] State its project coverage, preparation, fallback, and failure behavior.
- [ ] State that standard Node checking owns the gate and declaration builds.
- [ ] Document optional Bun 1.4.4 installation in the development guide.
- [ ] State that fresh workspaces use the fallback until Bun is installed.
- [ ] Explain the TypeScript 6 and 7 distinction and how to assess disagreement.
- [ ] Preserve the existing requirement to build public declarations first.
- [ ] Add the required linked status line while documented behavior is pending.
- [ ] Keep raw benchmark logs outside the plan and product documentation.

## Milestone 2: Share the existing project inventory

Depends on: 1

Prepare the existing checker to share its project coverage with the optional
command. Its compiler and verification result stay the same.

- [ ] Read the verification script README and existing process helpers.
- [ ] Give one verification module ownership of the ordered project list.
- [ ] Route the standard root typecheck through that inventory under Node.
- [ ] Keep workspace typecheck commands and `typecheck:script-declarations` usable.
- [ ] Preserve configuration options, working directories, diagnostics, order, and failure exit.
- [ ] Check behavior through the public runner with an injected process boundary.
- [ ] Run standard type checking, lint, and the early Repository suite.

## Milestone 3: Add the optional Bun command

Depends on: 2

Add the local command without making Bun a required dependency of a build,
test, release, or verification job.

- [ ] Add `typecheck:fast` to the root package scripts.
- [ ] Reuse the shared project inventory for native Bun checking.
- [ ] Pass `--no-script` and `--all` in every native checker invocation.
- [ ] Preserve the required declaration preparation and checker diagnostics.
- [ ] Use the standard fallback when Bun is missing or older than 1.4.4.
- [ ] Show the optional installation command in the fallback warning.
- [ ] Propagate Bun diagnostics and other failures without a fallback retry.
- [ ] Add focused runner tests for project selection and failure propagation.
- [ ] Test missing and older Bun cases without depending on the host's Bun.
- [ ] Keep tests independent of real process speed and network access.
- [ ] Add no permanent benchmark, third-party checker test, or timing threshold.
- [ ] Update the verification script README with the new entry points.
- [ ] Remove pending-behavior status lines when their commands work.

## Milestone 4: Verify and deliver

Depends on: 1, 2, 3

Prove the optional workflow and preserve the current verification boundary.
Report a pre-existing gate failure with its output if it still blocks the gate.

- [ ] Build the packages and run standard type checking under Node.
- [ ] Run fast type checking with the documented Bun version.
- [ ] Run the fast command without Bun and confirm the standard fallback.
- [ ] Check deliberate temporary type errors with both commands.
- [ ] Save that one-time diagnostic comparison under `.context/bun-local-typechecking/`.
- [ ] Confirm both commands check all five projects and write no compiled files.
- [ ] Measure repeated standard and fast runs on the same machine.
- [ ] Save timing evidence without making it a required threshold.
- [ ] Run focused runner tests and repeat each new asynchronous test ten times.
- [ ] Run formatting, lint, and Markdown links.
- [ ] Confirm required package commands, xtask suites, and workflows do not invoke Bun or the fast command.
- [ ] Run the complete local gate on a host with no Bun executable on its PATH.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the complete local diff against `origin/main` after the push with
      the `implementation-review` skill. Apply the fix rule, record follow-up
      items for remaining findings, and re-review once.
- [ ] Delete this plan under the `plans` skill when the implementation is complete.
- [ ] Open the pull request with the dated decisions, design calls, and plan permalink.

## Evidence and later work

The original experiment is under `.context/bun-analysis/`. Its `report.md`,
`results.jsonl`, and `summary.json` hold the methods, commands, and measurements.
Those files stay ignored and are not prerequisites for a fresh checkout.
Plan checks and later implementation evidence belong under
`.context/bun-local-typechecking/`.
The options check is `.context/bun-local-typechecking/options-check.md`.
Its corrections are included in the design calls and verification tasks.

A future unit runner change must preserve discovery, selection, isolation,
diagnostics, and CI report evidence. A future package manager change must
cover lockfile migration, lifecycle scripts, and historical dependency installs.
A future runtime change must resolve the sidecar protocol failure. None is a
required TODO of this change.

A later compiler migration can evaluate one checker for local and CI use when
the compiler and lint stack can move together. It remains outside this change.
