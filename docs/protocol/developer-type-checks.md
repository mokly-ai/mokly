# Developer Type Checks

Continuation of [Developer Test Commands](./developer-test-commands.md).

## Commands And Projects

Three commands check the same five TypeScript projects in this order:

1. `packages/mokly/tsconfig.json`: the `@mokly/mokly` package.
2. `tsconfig.json`: the repository root project.
3. `packages/ui/tsconfig.json`: the `@mokly/ui` package.
4. `packages/viewer/tsconfig.json`: the `@mokly/viewer` package.
5. `tsconfig.scripts-declarations.json`: the declaration files of the
   repository scripts.

| Command                  | Mode     | Checker                                                         |
| ------------------------ | -------- | --------------------------------------------------------------- |
| `npm run typecheck:ci`   | Required | Bun's native checker at exactly the pinned version.             |
| `npm run typecheck`      | Standard | The installed TypeScript 6 compiler under Node.                 |
| `npm run typecheck:fast` | Fast     | Bun 1.4.4 or newer from the `PATH`, or else the standard check. |

Every command resolves public authoring declarations from package output. Run
`npm run build` first. No command builds. The Viewer suite supplies this
preparation for its type check. No command writes compiled output.

A command stops at the first failed project and exits unsuccessfully. It shows
every diagnostic of that project. The UI and viewer projects report paths
relative to their package directories. The other projects report paths
relative to the repository root.

## Required Type Check

[`.bun-version`](../../.bun-version) at the repository root holds the pin.
The pin is the one exact Bun version that the required check accepts: `1.4.4`.
The pin is invalid when the file is missing or unreadable, or when it holds no
exact version.

`npm run typecheck:ci` is the type check of the Viewer suite. Every gate runs
it through that suite: the local and remote complete gates, hosted CI, and the
complete gate of release preparation.

Before the first project, the command reads the pin. Then it asks the `bun`
executable on the `PATH` for its version. When that version equals the pin,
Bun's native checker checks each project. A package `check` script never runs
in its place.

The command fails before the first project when one of these conditions holds:

- The pin is invalid.
- No `bun` executable is on the `PATH`.
- The version probe fails, or its output is not a version.
- Bun reports a version other than the pin, older or newer.

The error gives the reason. With a valid pin, the error also shows the
installation command for the pinned version, `npm install --global bun@1.4.4`.
After the first project starts, type errors, a launch failure, a crash, or a
signal fail the command.

The command never falls back to the standard check. It never installs or
downloads Bun. The exact pin gives every gate host the same compiler rules. A
fallback or a minimum version would let two hosts accept different code.

Bun decides the required result for all five projects. That includes the
tests, the example catalogue, and the repository scripts. No package build
compiles those files. An error that only Bun reports fails the gate. An error
that only TypeScript 6 reports in those files does not fail the gate.

The required check uses Bun's native checker instead of TypeScript 6, for a
faster type check. A second required check with TypeScript 6 was rejected,
because it would check each project twice.

## Standard Type Check

`npm run typecheck` runs the installed TypeScript 6 compiler under Node. It
checks every project for compatibility with the compiler of the package
builds. No gate runs it.

Each package build compiles its sources with the installed TypeScript 6
compiler under Node. That compiler writes the published declarations and
JavaScript modules. A TypeScript 6 error in a package source therefore stops
the package build, and the gate fails. The builds keep TypeScript 6, because
Bun's checker writes no JavaScript or declarations.

Node runs every test and the product. Bun only checks types. A Bun test
runtime was rejected, because the verification reporter and the render
sidecar fail under Bun.

## Fast Local Type Check

`npm run typecheck:fast` is an optional local command for faster feedback. It
is not verification evidence, and no gate runs it. Before the first project,
it selects one checker for the run:

- When a `bun` executable on the `PATH` reports version 1.4.4 or newer, Bun's
  native checker checks each project. A package `check` script never runs in
  its place.
- When no `bun` executable is on the `PATH`, or it reports an older version,
  the command prints a warning on standard error. The warning gives the
  reason. It shows the optional installation command for the pinned version,
  `npm install --global bun@1.4.4`. Then the command runs the standard check.
  That result sets the exit status.

The fast command reads the pin only for that warning. With an invalid pin, the
warning names the minimum version 1.4.4 instead. The checker selection and the
fallback do not change.

Version 1.4.4 is the fast command's minimum. An older Bun can lack the
native checker and treat `check` as a script or file name. The fallback gives
a developer without Bun a complete check instead of a failure or a pass
without a check.

Every other Bun outcome is final. Type errors, another launch failure, a crash,
or a signal fail the command. The standard check does not run after them. A
retry would hide which checker failed and add the slow check to each failed
run.

## Checker Differences

Bun 1.4.4's checker matches TypeScript 7.0.2, so its diagnostics can differ
from the TypeScript 6 result. When the commands disagree, the result of
`npm run typecheck:ci` decides the gate. A standard pass does not prove a
required pass. A fast run with the pinned Bun uses the same checker as the
required check. A fast run with another Bun version, or with the fallback, can
disagree with the required check.

## Bun Provisioning

Bun stays outside the npm dependencies and has no Bun lockfile. No type check
command installs or downloads Bun. Each host sets up the pinned version before
it runs the Viewer suite:

- A developer installs it on each machine, and again after a pin change, as
  the [development guide](../development/README.md) shows.
- Each hosted viewer job sets it up under the
  [CI workflow contract](./ci-workflow.md#job-execution).
- Each remote viewer command installs it on its box under the
  [suite wrapper contract](./remote-verification-testbox.md#suite-wrapper).
- Release preparation sets it up before a complete gate under the
  [release evidence contract](./npm-release-evidence.md#verification-modes).

A Bun dev dependency would give every install the pinned Bun. It was rejected,
because it adds a native binary to every install, including the browser and
Windows jobs that set the CI duration.
