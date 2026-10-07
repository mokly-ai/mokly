# CI Task Cache

## Delivery Status

The task graph, strict environment, local cache, signed remote configuration,
and policy B CI/preview wiring are implemented. The Worker, credentials, bucket,
and expiry rules are provisioned. Hosted runs, developer sharing, and production
follow-ups remain open in the [plan](../../plans/turborepo-cloudflare-remote-cache.md).
Tests, reports, and `npm run example:check` stay uncached; check revalidates
referenced paths and Git state outside the build hash.

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
components, renderer, config, PostCSS/Browserslist, and the relocated imported
image are inputs. Explicit globs do not inherit `.gitignore` filtering.
Do not cache `.mokly-cache`, review output, reports, or preview exports.

Example inputs also include the ten protocol files listed in
[`turbo.json`](../../turbo.json). Two appear in the compilation source inventory;
the other references affect metadata validation. Unrelated docs stay outside
the hash. Both root tasks exclude every ignored cache, scratch, report, archive,
and nested output pattern from their explicit inputs; see the configuration.

`package.json`, `turbo.json`, and package manager lockfiles are always inputs,
even with explicit `inputs`. The global hash includes source files in internal
packages that the root depends on, directly or transitively. The root depends
on `@mokly/viewer`, so a viewer source edit changes all three task hashes.
Viewer edits also reach `//#build:package` through its viewer dependency hash.
`scripts/copy-assets.mjs` imports `packages/viewer/scripts/browser.mjs` and
reads `packages/viewer/src/runtime.ts`. Both tracked files belong to the
viewer's default inputs. Both hashing paths cover these reads without duplicate
root globs. Preserve the dependency when narrowing viewer inputs. The root
tsconfig and cleanup script are explicit viewer inputs, not global inputs.
Local checks show viewer README and test edits also change the global hash and
all three task hashes. Root config/cleanup edits propagate through task inputs.

These root scripts select the cached tasks:

| Script                 | Command                                                                                                              |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `build`                | `node scripts/turbo-run.mjs build:package 1>&2`                                                                      |
| `build:package`        | `node scripts/clean.mjs --package @mokly/mokly && tsc --project tsconfig.build.json && node scripts/copy-assets.mjs` |
| `prepare:verification` | `node scripts/turbo-run.mjs example:build`                                                                           |

`example:build` calls the CLI directly and must not invoke Turbo recursively. Its transaction replaces the disposable
output tree and removes unexpected files there without touching authored CSS.
Each uncached package task clears its owned dist directory before building.
Prepack must keep stdout empty; build output goes to stderr so real
`npm pack --json` lifecycle output remains parseable. POSIX and Windows cmd.exe
both support the build script's `1>&2` redirection.

The launcher leaves Windows TTY handling to the installed Turbo shim.
It ignores SIGINT, forwards SIGTERM/SIGHUP, and preserves the child's exit signal.
It unsets incomplete credential pairs and selects local:rw, preventing token-only probes.
Direct Turbo invocations must use the same credential setup; do not supply half a pair.

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
  "futureFlags": { "longerSignatureKey": true },
  "remoteCache": {
    "apiUrl": "https://mokly-turbo-cache.calum-785.workers.dev",
    "teamSlug": "mokly",
    "enabled": true,
    "signature": true,
    "timeout": 30,
    "uploadTimeout": 60,
    "preflight": false
  }
}
```

Do not set deprecated `daemon` or an explicit `cacheDir`. The committed `apiUrl` is `https://mokly-turbo-cache.calum-785.workers.dev`,
without a trailing slash or /v8. The committed `teamSlug` is `mokly`. Keep `teamId` unset for every writer and reader.
The signature binds the hash, team ID, and artifact bytes; slug-only clients
use the same empty team ID. Local task caching requires no signature key.

Strict mode admits only declared variables and Turbo's built-in system list.
Each cached task declares `env: ["NODE_ENV"]`, so its value is hashed.
The example also hashes `BROWSERSLIST`, `BROWSERSLIST_ENV`, and `AUTOPREFIXER_GRID`.
Ambient Browserslist config/statistics paths and `NODE_PATH` are not admitted;
the example uses its checked-in Safari 14 target and lockfile-resolved packages.
Use `globalPassThroughEnv` for `CI`, `MOKLY_OUTPUT`, `MOKLY_DIAGNOSTIC`, `NO_COLOR`,
`FORCE_COLOR`, `TERM`, `TERM_PROGRAM`, `WT_SESSION`, `COLUMNS`, and
`BROWSERSLIST_IGNORE_OLD_DATA`. These affect terminal or warning behavior only;
they must not change artifact bytes. The viewer bundler fixes its browser
`process.env.NODE_ENV` to `production`. Audit the CLI and dependency reads
during local task-graph delivery. Any additional output-changing variable must
be declared in `env` and documented before caching is accepted.

Do not hash tokens, the signature key, or the Node version. Turbo consumes
credentials outside the task-input contract. Node 22.14 outputs may serve
Linux Node 24 suites only after byte equality is proved on both runtimes.
Native jobs use their own local cache and no remote credentials.

Turbo collects anonymous telemetry by default. Set
`TURBO_TELEMETRY_DISABLED: "1"` at workflow scope in `ci.yml`, `preview.yml`,
and `release.yml` as soon as their scripts start using Turbo.
Developers can export `TURBO_TELEMETRY_DISABLED=1` or `DO_NOT_TRACK=1`.
`noUpdateNotifier` does not disable telemetry.

## Cache Sources And Credentials

Policy B uses local and remote reads/writes for main and same-repository PRs.
Main uses the trusted namespace; PRs use `mokly-pr-<number>` with trusted fallback.
Forks, native jobs, and clients without both credentials use local:rw only.
Release forces local execution. Approved developers use local:rw,remote:r.
The [access contract](./ci-remote-cache-access.md#ci-policy-b) owns exact secret
scopes, event/environment guards, `$GITHUB_ENV` mapping, and permission rules.
Missing either credential leaves both unset. Local-only builds must pass with
the deployed URL configured. A supplied short key is a configuration error.

The admin gives approved developers the read-only token and the same signature
key through a private password-manager share. Do not send the writer token.
Do not commit credentials, place them in task inputs, or print them in logs.
The key permits verification and signing; the Worker token still controls
uploads. A read-only token alone cannot verify signed downloads.
When approved, load both values from that private share into the shell:

```bash
export TURBO_CACHE=local:rw,remote:r
export TURBO_TELEMETRY_DISABLED=1
npm run prepare:verification
```

Also export `TURBO_TOKEN` and `TURBO_REMOTE_CACHE_SIGNATURE_KEY` from the share.
The `remote:r` mode prevents attempted uploads that would receive 403.
Do not use Vercel login or link commands. To work without remote credentials,
unset both values and export `TURBO_CACHE=local:rw`.

The default local cache is `.turbo/cache`, under ignored `.turbo/`.
Linked Git worktrees automatically use the main worktree's `.turbo/cache`.
An explicit cache directory disables this sharing. Clear only a fixture-owned
cache in tests; removing a linked checkout's cache path may clear shared data.

## Suite Preparation And Restore

Each package, unit, browser, and hydration suite still calls
`npm run prepare:verification`. Unchanged tasks restore from local cache; misses
execute. Authorized hosted jobs can restore from the remote cache. Every prepared consumer and suite
assertion still executes.

Restore semantics verified against the local client:
restore missing archived files and replace modified archived files with the
cached bytes. Matching local files may avoid writes. Files absent from the
archive remain in place, even inside an output directory. Restore is not a
directory clean. Authored CSS is never an output and must survive unchanged.
Test this with missing, corrupted, and extra files. Tests that require an empty
output tree must clean their own output first; they must not infer cleanup from
a cache hit. Task execution cleans each package distribution first; packing
cleans both before restoring/building. Example execution transactionally replaces its disposable generated tree,
preserving authored CSS; unowned HTML must not enter cache.
Fresh baseline extraction needs no task
cleanup. Tests must not mutate the shared prepared checkout.

Independent preparation retains these boundaries. The baseline recipe mirrors
the root build commands; an alignment test protects it. Ignored nested baseline
sources cannot be hashed safely through the enclosing Git repository.
`baselineEnvironment()` sets `MOKLY_BASELINE_COMMIT`; no repository code reads it.
Strict Turbo tasks hide it, and direct baseline builds do not need it.

| Boundary                              | Cache behavior and safety rule                                                                                                                                                                                                                                                 |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Historical baseline reconstruction    | The commit supplies its source and lockfile. The example recipe runs npm ci, the direct viewer build, the TypeScript executable, asset copying, and the direct example CLI. It never invokes Turbo, including for pre-Turbo commits; no task cache or Turbo telemetry is used. |
| Isolated example repositories         | Copy `turbo.json` with the existing fixed tooling list before builds can use the new root script. Each repository owns its output and cache.                                                                                                                                   |
| Clean packed consumers and npm caches | A package build or real `prepack` can restore tasks. Packing, fresh installs, private empty npm caches, and installed CLI smokes still execute; they are not cached tasks.                                                                                                     |
| Source mutation                       | A declared input edit must miss the affected task and its dependents. Use `TURBO_FORCE=true` when the test must observe build execution independently of input hashing.                                                                                                        |
| Startup and pending-state tests       | Cached tool preparation is allowed before the measured command. The server, on-demand rendering, pending states, and command-to-preview timer always run independently. Force a build if its execution is the behavior under test.                                             |
| Cache invalidation                    | Mokly's application caches remain independent. A test of Turbo invalidation must own its cache, mutate an input, and prove a miss; a second unchanged preparation must prove a hit.                                                                                            |

## Cache Correctness And CI Delivery

A cached task's artifact bytes must depend only on declared files and hashed
environment. Git refs, commit identity, dirty state, wall-clock time, random
values, and absolute checkout paths must not affect those bytes. Upload commit
metadata is diagnostic and does not relax this rule. Cache archives and task
logs may carry execution metadata; compare the declared product outputs.
Clean old/new builds matched byte for byte. Node 22.14 and 24.21 matched across
all declared outputs, including maps and manifests. Two absolute paths, later
build times, Git ref/commit changes, and unrelated dirty state also matched.
Input and Git-inventory regressions preserve these cache boundaries.
Fix any hidden input or keep the affected task uncached until the contract holds.
Input-mutation checks cover specs, config, authored CSS, root source, viewer
runtime/helper, and the inherited root tsconfig.

The hosted `prepare` job uses Node 22.14.0 and npm 11.21.0. It runs in
parallel with `repository`, installs with `npm ci`, and runs preparation once.
It needs neither Rust nor Chromium. `package`, `unit`, `browser`, and
`hydration` depend on both jobs. Each keeps its suite preparation call and
restores the three tasks. `Required CI` requires `prepare` success too.
No task artifact becomes a test report or proves a suite passed. Forks execute
the same job graph with local cache only, so separate jobs can rebuild.

Release jobs set `TURBO_FORCE=true`, unset both Turbo credentials, and disable
remote cache with `TURBO_CACHE=local:rw`. Every build executes, including
`prepack`; forced execution can still refresh local cache entries. Live audits,
exact archives, installs, provenance, and registry checks stay independent.
Preview package preparation uses Turbo; its direct `example:build` executes
without a task-cache restore. Main and same-repository PR previews share package
artifacts under policy B. Capture, comparisons, publication, and deployment execute.
See the [workflow graph](./ci-workflow.md),
[release evidence](./npm-release-evidence.md), and
[Worker contract](./ci-remote-cache-worker.md).

## Verified Upstream References

The offline 2.11.7 package supplies `docs/reference/configuration.mdx` (`inputs`,
signature, and settings), `schema.json`,
`docs/crafting-your-repository/caching.mdx` (worktree sharing), and
`docs/telemetry.mdx`. Public equivalents are the
[configuration reference](https://turborepo.dev/docs/reference/configuration),
[cache reference](https://turborepo.dev/docs/crafting-your-repository/caching),
and [telemetry policy](https://turborepo.dev/docs/telemetry).
