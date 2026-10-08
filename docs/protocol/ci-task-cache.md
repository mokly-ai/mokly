# CI Task Cache

## Delivery Status

The task graph, strict environment, local cache, and GitHub Actions cache
wiring are implemented. Hosted verification and admin removal remain open in
the [plan](../../plans/turborepo-cloudflare-remote-cache.md). Tests, reports, and `npm run example:check` stay uncached; check
revalidates referenced paths and Git state outside the build hash.

## Task Graph And Files

Use Turborepo 2.11.7 as a root development dependency with npm workspaces.
Keep the lockfile and `packageManager: "npm@11.21.0"`. Register these tasks:

| Task                  | Dependency            | Inputs                                                    | Outputs                                 |
| --------------------- | --------------------- | --------------------------------------------------------- | --------------------------------------- |
| `@mokly/viewer#build` | `^build`              | `$TURBO_DEFAULT$`, root tsconfig and cleanup script       | `dist/**` relative to `packages/viewer` |
| `//#build:package`    | `@mokly/viewer#build` | `src/**`, asset-copy/cleanup scripts, both root tsconfigs | `dist/**` relative to the root          |
| `//#example:build`    | `//#build:package`    | `examples/basic/**`, imported assets, exclusions below    | `examples/basic/mokly-generated/**`     |

The example owns one disposable output tree: `examples/basic/mokly-generated/**`.
Inputs include `examples/basic/**` and `examples/imported-assets/**`, excluding
that output tree with `!`. Authored CSS stays at the catalogue root. Specs,
components, renderer, config, PostCSS/Browserslist, and the imported image are
inputs. Explicit globs do not inherit `.gitignore` filtering.
Do not cache `.mokly-cache`, review output, reports, or preview exports.

Example inputs also include the ten protocol files listed in
[`turbo.json`](../../turbo.json). Two appear in the compilation source inventory;
the other references affect metadata validation. Unrelated docs stay outside
the task hash. Both root tasks exclude ignored cache, scratch, report, archive,
and nested output patterns from their explicit inputs.

`package.json`, `turbo.json`, and package manager lockfiles are always inputs,
even with explicit `inputs`. The global hash includes source files in internal
packages that the root depends on. The root depends on `@mokly/viewer`, so a
viewer edit changes all three task hashes. It also reaches `//#build:package`
through its viewer dependency hash. `scripts/copy-assets.mjs` imports
`packages/viewer/scripts/browser.mjs` and reads `packages/viewer/src/runtime.ts`.
Both tracked files belong to the viewer's default inputs. Preserve this
dependency when narrowing viewer inputs. The root tsconfig and cleanup script
are explicit viewer inputs. Viewer README and test edits also change the
global hash. Root config and cleanup edits propagate through task inputs.

These root scripts select the cached tasks:

| Script                 | Command                                                                                                              |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `build`                | `turbo run build:package 1>&2`                                                                                       |
| `build:package`        | `node scripts/clean.mjs --package @mokly/mokly && tsc --project tsconfig.build.json && node scripts/copy-assets.mjs` |
| `prepare:verification` | `turbo run example:build`                                                                                            |

`example:build` calls the CLI directly. It must not invoke Turbo recursively.
Its transaction replaces the disposable output tree without touching authored
CSS. Each uncached package task clears its owned dist directory before building.
Prepack keeps stdout empty; build output goes to stderr so `npm pack --json`
remains parseable. POSIX and Windows cmd.exe support `1>&2`.
The installed Turbo shim owns signal handling.

## Global Settings And Environment

The root configuration uses this shape, in addition to `tasks`:

```json
{
  "$schema": "https://turborepo.dev/schema.json",
  "envMode": "strict",
  "agentGuidance": false,
  "noUpdateNotifier": true,
  "ui": "stream",
  "cacheMaxAge": "14d",
  "cacheMaxSize": "50MB",
  "remoteCache": { "enabled": false }
}
```

Do not set deprecated `daemon` or an explicit `cacheDir`. Do not set `apiUrl`,
`teamSlug`, `teamId`, `signature`, timeouts, `preflight`, or `futureFlags`.
The repository supplies no remote endpoint or team. With this configuration,
Turbo makes no requests with Turbo or Vercel CLI login files alone. An explicit
developer team override can still send a diagnostic request; CI supplies none.

Strict mode admits only declared variables and Turbo's built-in system list.
Each cached task declares `env: ["NODE_ENV"]`, so its value is hashed.
The example also hashes `BROWSERSLIST`, `BROWSERSLIST_ENV`, and `AUTOPREFIXER_GRID`.
Ambient Browserslist config/statistics paths and `NODE_PATH` are not admitted;
the example uses its checked-in Safari 14 target and lockfile-resolved packages.
Use `globalPassThroughEnv` for `CI`, `MOKLY_OUTPUT`, `MOKLY_DIAGNOSTIC`, `NO_COLOR`,
`FORCE_COLOR`, `TERM`, `TERM_PROGRAM`, `WT_SESSION`, `COLUMNS`, and
`BROWSERSLIST_IGNORE_OLD_DATA`. These affect terminal or warning behavior only.
The viewer bundler fixes its browser `process.env.NODE_ENV` to `production`.
Declare and document any additional output-changing variable in `env`.

Do not hash credentials or the Node version. Node 22.14 outputs may serve
Linux Node 24 suites after byte equality is proved on both runtimes.
Turbo collects anonymous telemetry by default. CI, preview, and release set
`TURBO_TELEMETRY_DISABLED: "1"` at workflow scope. Developers can export
`TURBO_TELEMETRY_DISABLED=1` or `DO_NOT_TRACK=1`. `noUpdateNotifier` does not
disable telemetry.

## Cache Store

Use upstream `actions/cache` v6.1.0, pinned to
`55cc8345863c7cc4c66a329aec7e433d2d1c52a9`. Blacksmith runners accelerate
this action with no code change. Do not use the archived `useblacksmith/cache`.

- Path: `.turbo/cache`.
- Key: `turbo-${{ runner.os }}-${{ hashFiles(...) }}`. Hash `package-lock.json`,
  `package.json`, `turbo.json`, both root tsconfigs, `scripts/clean.mjs`,
  `scripts/copy-assets.mjs`, `src/**`, `packages/viewer/**` without `dist` and
  `node_modules`, `examples/basic/**` without `mokly-generated`,
  `examples/imported-assets/**`, and `docs/protocol/mokly-*.md`.
- Restore prefix: `turbo-${{ runner.os }}-`. Turbo's task hashes decide reuse.
  A broader directory key can cause an extra save, but cannot select a wrong
  task artifact.
- The CI `prepare` job computes the key once and exposes `turbo-cache-key`.
  It uses `actions/cache` before `npm ci`. The action saves at job end if the
  exact key was absent. It is the only job that saves this directory.
- Package, unit, browser, and hydration jobs use `actions/cache/restore`
  before `npm ci`, with `needs.prepare.outputs.turbo-cache-key` and the same
  prefix. Both preview deploy jobs restore only, with the same key expression
  as `prepare`. Preview runs the example CLI directly, so it must not save a
  directory that can lack the example task artifact.
- A `main` push saves in the `main` scope. Pull requests, including forks,
  restore their own scope and then the base branch scope. Their saves stay in
  their own merge-ref scope. No secret, environment, token, or signature is
  needed. Repository read access permits cache reads. Never put secrets in
  cached outputs or logs.
- GitHub removes entries unused for 7 days and evicts by oldest access above
  its 10 GB repository limit. At each Turbo run start, `cacheMaxAge: "14d"`
  removes old local entries, then `cacheMaxSize: "50MB"` evicts oldest entries
  above 50 MB. This keeps about 20 runs of entries. Eviction runs in the
  background; a run can add fresh entries after it starts.
- A miss builds locally. A failed restore or save warns and continues; cache
  failure must not fail a job. No step enables `fail-on-cache-miss` or
  `SEGMENT_DOWNLOAD_TIMEOUT_MINS` overrides. The suites still prepare output.

Release and native macOS/Windows jobs use only their local cache. Blacksmith
Testboxes also use only their local cache. Builds must pass with no cache.

## Local Developer Use

Run `npm run build` or `npm run prepare:verification`. No credentials or
login commands are needed. The ignored `.turbo/cache` stores local entries.
Linked Git worktrees share the main worktree's cache automatically. An explicit
cache directory disables sharing. Clear only a fixture-owned cache in tests;
removing a linked checkout's cache path can clear shared data.

## Suite Preparation And Restore

Each package, browser, and hydration suite still calls
`npm run prepare:verification`. Unit preparation reaches it through
`npm run prepare:unit`, then writes the
[example compilation snapshot](./ci-example-snapshot.md) outside task caching.
Unchanged tasks restore locally; misses execute. Hosted suites first restore
the local cache directory through GitHub. Every suite assertion still executes.

Restore replaces missing or modified archived files with cached bytes.
Files absent from the archive remain in place, even inside an output directory.
Restore is not a directory clean. Authored CSS is not an output and survives.
Tests that need empty output must clean their own output first. Task execution
cleans each package distribution; packing cleans both before restoring/building.
Example execution transactionally replaces its generated tree. Unowned HTML
must not enter cache. Tests must not mutate the shared prepared checkout.

Independent preparation retains these boundaries:

| Boundary                        | Cache behavior and safety rule                                                                                                                                                                                      |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Historical baseline             | Use the commit's source and lockfile, npm ci, direct viewer build, TypeScript executable, asset copying, and direct example CLI. Never invoke Turbo in ignored nested sources; no Turbo cache or telemetry is used. |
| Isolated example repositories   | Copy `turbo.json` with the fixed tooling list. Each repository owns its output and cache.                                                                                                                           |
| Packed consumers and npm caches | Package builds and prepack can restore tasks. Packing, fresh installs, private empty npm caches, and installed CLI smokes still execute.                                                                            |
| Source mutation                 | A declared input edit must miss the affected task and its dependents. Use `TURBO_FORCE=true` when the test must observe execution.                                                                                  |
| Startup and pending states      | Tool preparation can restore before the measured command. The server, rendering, pending states, and command-to-preview timer run independently.                                                                    |
| Cache invalidation              | Mokly's caches remain independent. Turbo input checks own their cache and prove misses after edits and hits without edits.                                                                                          |

## Cache Correctness And CI Delivery

Artifact bytes depend only on declared files and hashed environment. Git refs,
commit identity, dirty state, wall-clock time, random values, and absolute paths
must not affect bytes. Cache archives and task logs can carry diagnostic
metadata; compare product outputs. One-time proofs show matching old/new output,
Node 22.14/24.21 output, and output across paths, build times, refs, commits, and
unrelated dirty state. Fix hidden inputs or keep the affected task uncached.

The Node 22.14.0 `prepare` job runs beside `repository`. It needs neither Rust
nor Chromium. It installs with npm 11.21.0 and prepares the three tasks once.
Package, unit, browser, and hydration depend on both jobs. `Required CI` also
requires `prepare` success. Task artifacts never prove a suite passed.
The nine- and eighteen-report aggregates stay unchanged.

Release sets `TURBO_FORCE=true` and `TURBO_CACHE=local:rw`. Every build executes,
including prepack; force can refresh local entries. Release restores and saves
no GitHub task cache. Audits, archives, installs, provenance, and registry checks
stay independent. Preview restores package tasks, then directly runs
`example:build`. Capture, comparison, publication, and deployment execute.
See the [workflow graph](./ci-workflow.md),
[release evidence](./npm-release-evidence.md), and
[preview contract](./npm-preview-deployments.md).

The [static guards](../../tests/turbo_static_guards.test.ts) protect the direct
recipe, clean-first scripts, compiler exclusions, and asset filtering.
The [workflow cache test](../../tests/turbo_workflow_cache.test.ts) keeps one
task-cache saver, restore-only suite and preview steps, one pinned revision,
the shared path and restore prefix, the key output reference, no `environment`
in CI or preview, no task-cache credentials, telemetry off, release force, and
no task-cache step in native jobs.
One-time output and restore proofs stay under `.context/`. The package suite still
runs real `npm pack --json` through prepack.

## References

The installed Turbo package supplies `docs/reference/configuration.mdx`,
`schema.json`, `docs/crafting-your-repository/caching.mdx`, and `docs/telemetry.mdx`.
See [Turbo configuration](https://turborepo.dev/docs/reference/configuration),
[GitHub dependency caching](https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/caching-dependencies-to-speed-up-workflows),
[`actions/cache`](https://github.com/actions/cache), and
[Blacksmith cache acceleration](https://docs.blacksmith.sh/blacksmith-caching/dependencies-actions).
