# CI Task Cache

## Delivery Status

This is the approved target of the
[remote-cache plan](../../plans/turborepo-cloudflare-remote-cache.md).
The task runner, local task cache, remote service, and workflow wiring are not
implemented. Today each suite builds through the existing npm scripts.
The R2 bucket and its expiry rule are provisioned; the Worker is not deployed.
The sections below specify planned behavior. Tests and suite reports remain
uncached under the [verification contract](./ci-verification.md).

## Task Graph And Files

Use Turborepo 2.11.7 as a root development dependency with npm workspaces.
Keep the lockfile and `packageManager: "npm@11.7.0"`. Register these tasks:

| Task                  | Dependency            | Inputs                                                                      | Outputs                                 |
| --------------------- | --------------------- | --------------------------------------------------------------------------- | --------------------------------------- |
| `@mokly/viewer#build` | `^build`              | `$TURBO_DEFAULT$`, `$TURBO_ROOT$/tsconfig.json`                             | `dist/**` relative to `packages/viewer` |
| `//#build:package`    | `@mokly/viewer#build` | `src/**`, `scripts/copy-assets.mjs`, `tsconfig.json`, `tsconfig.build.json` | `dist/**` relative to the root          |
| `//#example:build`    | `//#build:package`    | `examples/basic/**` with the exclusions below                               | The four generated patterns below       |

The example output patterns are exactly:

```text
examples/basic/generated/**/*.html
examples/basic/generated/mokly-manifest.json
examples/basic/generated/example/workspace.svg
examples/basic/generated/mokly-generated/**
```

Its input array contains `examples/basic/**` and the same four patterns with a
leading `!`. Authored CSS in `generated/` remains an input. This includes the
specs, imported components, renderer, config, PostCSS config, and source assets.
Explicit input globs do not inherit `.gitignore` exclusions.
Do not include generated HTML, the manifest, copied SVG, or generated assets as
inputs. Do not cache `.mokly-cache`, review output, reports, or preview exports.

`package.json`, `turbo.json`, and package manager lockfiles are always inputs,
even with explicit `inputs`. The global hash includes source files in internal
packages that the root depends on, directly or transitively. The root depends
on `@mokly/viewer`, so a viewer source edit changes all three task hashes.
Viewer edits also reach `//#build:package` through its viewer dependency hash.
`scripts/copy-assets.mjs` imports `packages/viewer/scripts/browser.mjs` and
reads `packages/viewer/src/runtime.ts`. Both tracked files belong to the
viewer's default inputs. Both hashing paths cover these reads without duplicate
root globs. Preserve the dependency when narrowing viewer inputs. The root
tsconfig is not a default global input; keep its explicit viewer input.
Local task-graph checks must record whether viewer README and test edits also
change the global hash and all three task hashes.

Change only these root scripts:

| Script                 | Planned command                                                     |
| ---------------------- | ------------------------------------------------------------------- |
| `build`                | `turbo run build:package`                                           |
| `build:package`        | `tsc --project tsconfig.build.json && node scripts/copy-assets.mjs` |
| `prepare:verification` | `turbo run example:build`                                           |

Keep `example:build` as the direct CLI command. Turbo executes that script as
a root task; the script must not call Turbo recursively. Existing `prepack`,
`dev`, `test`, and preview scripts retain their command boundaries.

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
    "enabled": true,
    "signature": true,
    "timeout": 30,
    "uploadTimeout": 60,
    "preflight": false
  }
}
```

Do not set deprecated `daemon` or an explicit `cacheDir`. Add `apiUrl` with the
deployed HTTPS Worker origin and `teamSlug: "mokly"` only when remote wiring
is delivered. Keep `teamId` unset for every writer and reader.
The signature binds the hash, team ID, and artifact bytes; slug-only clients
use the same empty team ID. Local task caching requires no signature key.

Strict mode admits only declared variables and Turbo's built-in system list.
Each cached task declares `env: ["NODE_ENV"]`, so its value is hashed.
Use `globalPassThroughEnv` for `CI`, `MOKLY_OUTPUT`, `NO_COLOR`, `FORCE_COLOR`,
`TERM`, `TERM_PROGRAM`, `WT_SESSION`, `COLUMNS`, and
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

| Environment                             | Local            | Remote read | Remote write |
| --------------------------------------- | ---------------- | ----------- | ------------ |
| Developer with neither credential       | read/write       | no          | no           |
| Developer with read-only token and key  | read/write       | yes         | no           |
| Same-repository CI and eligible preview | read/write       | yes         | yes          |
| Fork pull request                       | read/write       | no          | no           |
| Release publishing                      | forced execution | no          | no           |
| Native macOS and Windows                | read/write       | no          | no           |

The repository admin stores the CI writer as `secrets.TURBO_CACHE_TOKEN` and
the shared key as `secrets.TURBO_CACHE_SIGNATURE_KEY`. Jobs map these to
`TURBO_TOKEN` and `TURBO_REMOTE_CACHE_SIGNATURE_KEY` only when both are nonempty.
Use `TURBO_CACHE=local:rw,remote:rw` for those jobs. With either value absent,
leave both Turbo credentials unset and use `TURBO_CACHE=local:rw`.
A fork or developer with neither value must build successfully with local
caching only. Prove this before and after the Worker URL is configured.
A supplied key shorter than 32 bytes is a configuration error, not an opt-out.

The admin gives approved developers the read-only token and the same signature
key through a private password-manager share. Do not send the writer token.
Do not commit credentials, place them in task inputs, or print them in logs.
The key permits verification and signing; the Worker token still controls
uploads. A read-only token alone cannot verify signed downloads.
After remote delivery, load both values from that private share into the shell:

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

Today xtask builds independently for each package, unit, browser, and hydration
suite. The planned rule keeps each call to `npm run prepare:verification`.
It restores unchanged tasks from local or authorized remote cache and executes
misses. Prepared consumers and all suite assertions still run on every call.

Planned restore semantics, pending
[local task-graph verification](../../plans/turborepo-cloudflare-remote-cache.md#milestone-2-turborepo-task-graph-with-local-caching):
restore missing archived files and replace modified archived files with the
cached bytes. Matching local files may avoid writes. Files absent from the
archive remain in place, even inside an output directory. Restore is not a
directory clean. Authored CSS is never an output and must survive unchanged.
Test this with missing, corrupted, and extra files. Tests that require an empty
output tree must clean their own output first; they must not infer cleanup from
a cache hit. Tests must not mutate the shared prepared checkout.

Independent preparation retains these boundaries:

| Boundary                              | Planned cache behavior and safety rule                                                                                                                                                                                                                    |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Historical baseline reconstruction    | The baseline commit supplies its lockfile, source, and task config. Its `npm ci` always runs. Its `npm run build` can hit Turbo if that commit includes Turbo. Its direct `npm run example:build` still executes. Older commits use their original build. |
| Isolated example repositories         | Copy `turbo.json` with the existing fixed tooling list before builds can use the new root script. Each repository owns its output and cache.                                                                                                              |
| Clean packed consumers and npm caches | A package build or real `prepack` can restore tasks. Packing, fresh installs, private empty npm caches, and installed CLI smokes still execute; they are not cached tasks.                                                                                |
| Source mutation                       | A declared input edit must miss the affected task and its dependents. Use `TURBO_FORCE=true` when the test must observe build execution independently of input hashing.                                                                                   |
| Startup and pending-state tests       | Cached tool preparation is allowed before the measured command. The server, on-demand rendering, pending states, and command-to-preview timer always run independently. Force a build if its execution is the behavior under test.                        |
| Cache invalidation                    | Mokly's application caches remain independent. A test of Turbo invalidation must own its cache, mutate an input, and prove a miss; a second unchanged preparation must prove a hit.                                                                       |

## Cache Correctness And CI Delivery

A cached task's artifact bytes must depend only on declared files and hashed
environment. Git refs, commit identity, dirty state, wall-clock time, random
values, and absolute checkout paths must not affect those bytes. Upload commit
metadata is diagnostic and does not relax this rule. Cache archives and task
logs may carry execution metadata; compare the declared product outputs.
Before accepting local caching, build the example twice from clean output at
different times and with changed Git metadata. Build in two different absolute
checkout paths and compare every declared output byte for byte. Check Node
22.14 and Node 24 equality. Reject path-bearing source maps or manifests.
Fix any hidden input or keep the affected task uncached until the contract holds.
Input-mutation checks cover specs, config, authored CSS, root source, viewer
runtime/helper, and the inherited root tsconfig.

The planned hosted `prepare` job uses Node 22.14.0 and npm 11.7.0. It runs in
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
Eligible same-repository preview jobs may cache package/example preparation;
capture, Git comparisons, publication, deployment, and cleanup always execute.
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
