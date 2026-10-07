# Turborepo Remote Cache On Cloudflare

Status: Active. Created on 2026-10-06. No pull request yet. Milestone 1 was
accepted at `7b70b7e`. Milestone 2 local implementation and checks are complete; hosted native
verification remains a pre-merge requirement. The supervising agent owns formal
reviews in another worktree. Milestone 3 implementation, local smokes, and the full gate are complete;
its supervising-agent review and final fix gate are complete. R2 and the open user decisions remain recorded. The user selected CI policy B on 2026-10-07. The Worker is deployed at `https://mokly-turbo-cache.calum-785.workers.dev`; Milestone 4 code, documentation and local verification are complete. The approved Node 24 shared-example copy fix and direct cold-baseline recipe checks pass the final gate. Hosted checks, token retirement, developer sharing and the supervising-agent review remain open.

## Summary

Adopt Turborepo as the task runner for the npm build and preparation scripts.
Share its task cache through a self-hosted remote cache that runs on a
Cloudflare Worker with one R2 bucket. The repository owns the Worker, its
tests, and its deployment workflow. `cargo xtask check` stays the complete
gate; its existing npm preparation calls will run through `turbo`.

The change avoids repeated task execution in authorized hosted CI.
Before this change the package job, four unit shards, four browser shards, and the hydration
job each run `npm run prepare:verification` on an identical tree, so one pull
request runs the same build ten times. A Release Please pull request runs it
twenty times. With writes enabled for an event, one prepare job builds and uploads
the outputs, and downstream suites restore unchanged tasks. Under policy A,
PR jobs can restore trusted hits but execute new hashes in each job. Each suite still calls
preparation. Fork jobs build with local cache only. Developers get the same
local cache, including sharing between linked Git worktrees.

Baseline timings and output sizes are recorded in
`.context/turborepo-cloudflare-remote-cache/baseline-measurements.md`.

The [CI performance plan](./ci-performance.md) chose to build inside each job
because cross-job artifact transfer was unnecessary for the measured setup
cost. This plan replaces that one decision with a content-addressed cache. The
suite boundaries, shard evidence, and fail-closed aggregate stay unchanged.

## Decisions

| Topic          | Decision                                                                                                                                                        |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Task runner    | Turborepo 2.11.7 as a root `turbo` devDependency. npm workspaces and `package-lock.json` stay as they are.                                                      |
| Cached tasks   | `@mokly/viewer#build`, root `build:package`, and root `example:build`. Test suites are not cached by this plan.                                                 |
| Remote cache   | A Worker owned by this repository under `scripts/turbo-cache/`, storing artifacts in one R2 bucket. No Vercel account.                                          |
| Write policy   | Keys are write-once. The user selected CI policy B (scoped PR writes) on 2026-10-07. Three principals support all options; forks remain local only.             |
| Integrity      | `remoteCache.signature` is on with a key of at least 32 bytes. CI and read-only developers need the same key. Invalid downloads are rejected before extraction. |
| Release        | `release.yml` forces task execution with `TURBO_FORCE=true`, local cache only, and no remote credentials. Force can refresh local entries.                      |
| Native CI jobs | The macOS and Windows jobs keep building from source with no remote token.                                                                                      |
| Agent guidance | `agentGuidance: false`, so `turbo` never edits `AGENTS.md`.                                                                                                     |
| Expiry         | Trusted artifacts expire after 30 days; the PR-prefix rule expires at 7 days; effective expiry is a post-merge follow-up.                                       |
| Node in hashes | Exclude the Node version only after proving declared outputs match on Node 22.14 and Node 24. The prepare job must serve both Linux profiles.                   |
| Telemetry      | Disable Turbo telemetry at workflow scope in CI, preview, and release from Milestone 2. Developers can export `TURBO_TELEMETRY_DISABLED=1` or `DO_NOT_TRACK=1`. |
| Team identity  | Trusted/read clients use mokly; scoped PR clients use mokly-pr-<number>. Keep teamId empty across namespaces; rotate the team when rotating the key.            |

Rejected alternatives:

- Nx with its self-hosted cache specification: a larger tool whose cache story
  changed direction three times in two years.
- Third-party Turborepo Workers such as `cloudflare/workers-sdk`
  `packages/turbo-r2-archive` and `AdiRishi/turborepo-remote-cache-cloudflare`:
  one token, no write-once guard, and pnpm or vitest tooling that this
  repository does not use.
- A hand-written bucket script in CI: no task graph and no local use.
- GitHub Actions artifacts: no local use and no reuse across runs.

## Contract Owners

Milestone 1 creates or updates these documents so they define the complete
contract before implementation:

- New [`docs/protocol/ci-remote-cache.md`](../docs/protocol/ci-remote-cache.md):
  task graph, inputs, outputs, environment handling, cache sources per
  environment, and local use.
- New [`docs/protocol/ci-remote-cache-access.md`](../docs/protocol/ci-remote-cache-access.md):
  three principals, namespaces, selected policy B, credential boundaries, expiry, and recovery.
- New
  [`docs/protocol/ci-remote-cache-worker.md`](../docs/protocol/ci-remote-cache-worker.md):
  Worker HTTP contract, token classes, write-once storage, limits, deployment,
  and the provisioning runbook.
- [`docs/protocol/ci-verification.md`](../docs/protocol/ci-verification.md):
  current per-suite preparation and restore contract, linked to
  the new task-cache owner without growing beyond 250 lines.
- [`docs/protocol/ci-workflow.md`](../docs/protocol/ci-workflow.md): the
  prepare job, job dependencies, token gating, and the release and native
  exceptions.
- [`docs/protocol/ci-verification-security.md`](../docs/protocol/ci-verification-security.md):
  the remote task cache next to the npm download cache, token classes, and
  fork behavior.
- [`docs/protocol/npm-release.md`](../docs/protocol/npm-release.md) and
  [`docs/protocol/npm-release-evidence.md`](../docs/protocol/npm-release-evidence.md):
  release builds bypass reads and never use the remote cache.
- [`docs/protocol/npm-preview-deployments.md`](../docs/protocol/npm-preview-deployments.md):
  same-repository preview builds may read and write the cache.
- [`docs/protocol/README.md`](../docs/protocol/README.md): index entries.
- [`xtask/README.md`](../xtask/README.md) and the root
  [`README.md`](../README.md): developer commands, `.turbo/`, and local
  remote-cache setup.
- Measurement record `.context/turborepo-cloudflare-remote-cache/measurements.md`,
  created in Milestone 4; evidence stays outside the tracked tree.

## Task Graph

Root `package.json` scripts use these boundaries. `example:build` calls the CLI
directly, which transactionally replaces its disposable generated tree. Root prepack uses silent npm, and
viewer prepack redirects build output to stderr, preserving pack JSON.

| Script                 | Before                                       | After                                                                                                                |
| ---------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `build`                | viewer build, then `tsc`, then `copy-assets` | `node scripts/turbo-run.mjs build:package 1>&2`                                                                      |
| `build:package`        | none                                         | `node scripts/clean.mjs --package @mokly/mokly && tsc --project tsconfig.build.json && node scripts/copy-assets.mjs` |
| `example:build`        | direct CLI build                             | `node dist/cli/bin.js build --config examples/basic/mokly.config.ts`                                                 |
| `prepare:verification` | `npm run build && npm run example:build`     | `node scripts/turbo-run.mjs example:build`                                                                           |

`turbo.json` registers these tasks:

| Task               | Depends on            | Inputs                                                            | Outputs                             |
| ------------------ | --------------------- | ----------------------------------------------------------------- | ----------------------------------- |
| `build` (viewer)   | `^build`              | `$TURBO_DEFAULT$`, root tsconfig and cleanup script               | `dist/**`                           |
| `//#build:package` | `@mokly/viewer#build` | `src/**`, asset-copy/cleanup scripts, both root tsconfigs         | `dist/**`                           |
| `//#example:build` | `//#build:package`    | `examples/basic/**`, imported assets, protocol docs, minus output | `examples/basic/mokly-generated/**` |

`package.json`, `turbo.json`, and package manager lockfiles are always task
inputs, even with explicit `inputs`. The root manifest, lockfile, and source
files in internal packages that the root depends on enter the global hash.
The root depends on `@mokly/viewer`, so viewer source edits change all three
task hashes. They also reach `//#build:package` through its viewer dependency
hash. Viewer default inputs include `scripts/browser.mjs` and `src/runtime.ts`,
which `scripts/copy-assets.mjs` consumes directly. These paths cover the reads
without duplicate root globs. The inherited root tsconfig is not a default
global input; keep its explicit viewer input. Example inputs exclude the
generated output tree with `!`; explicit inputs bypass `.gitignore` filtering.

Global settings: `envMode: "strict"`, `agentGuidance: false`,
`noUpdateNotifier: true`, `ui: "stream"`, `cacheMaxAge: "14d"`,
`remoteCache: { enabled: true, signature: true, timeout: 30,
uploadTimeout: 60, preflight: false }`, and
`futureFlags: { longerSignatureKey: true }`. Do not set deprecated `daemon`
or explicit `cacheDir`; linked worktrees share the main worktree's cache.
`remoteCache.apiUrl` commits `https://mokly-turbo-cache.calum-785.workers.dev`
and `remoteCache.teamSlug` commits `mokly`. The URL has no trailing slash or `/v8`; `teamId` stays unset.

Strict mode hides every environment variable that is not listed in `env`,
`passThroughEnv`, or the built-in system list. The example build runs the
built CLI. The [task contract](../docs/protocol/ci-remote-cache.md) defines
hashed `NODE_ENV` and terminal/warning pass-through variables. Milestone 2
audits dependency reads and verifies these do not hide output-changing inputs.

Cached product outputs must not depend on Git state, timestamps, random values,
or absolute checkout paths. Milestone 2 proves equality across paths and Node
versions before accepting that contract. Restore replaces archived files but
does not remove extra files from output directories, as Milestone 2 verified.
Historical `baselineBuild` installs with npm ci, then runs direct viewer,
compiler, asset-copy, and example commands from the commit. It never invokes
Turbo inside ignored nested sources, so it cannot reuse an incorrect task hash
or send Turbo telemetry. No repository code reads `MOKLY_BASELINE_COMMIT`.

Cache sources per environment:

| Environment                            | Local cache    | Remote read | Remote write |
| -------------------------------------- | -------------- | ----------- | ------------ |
| Developer without both credentials     | yes            | no          | no           |
| Developer with read-only token and key | yes            | yes         | no           |
| Same-repository pull request           | yes            | yes         | PR namespace |
| `main` push                            | yes            | yes         | trusted      |
| Fork pull request                      | yes            | no          | no           |
| Release workflow                       | forced rebuild | no          | no           |
| Native macOS and Windows jobs          | yes            | no          | no           |

Give approved developers the reader and signature key through a private
password-manager share; they set `TURBO_CACHE=local:rw,remote:r`. With either
value absent, leave both Turbo credentials unset and use `local:rw`. Builds
must pass with neither value. A short supplied key is a configuration error.

## Remote Cache Worker

The deployed Worker implements API `v8` from the
[published OpenAPI specification](https://turborepo.dev/api/remote-cache-spec)
and the verified 2.11.7 client. The
[Worker contract](../docs/protocol/ci-remote-cache-worker.md) owns exact headers,
JSON shapes, validation limits, error compatibility, and provisioning:

| Method and path             | Behavior                                                                                                                      |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `GET /v8/artifacts/status`  | `{"status":"enabled"}` for any valid token.                                                                                   |
| `HEAD /v8/artifacts/{hash}` | 200 with length, duration, and optional tag/SHA/dirty-hash headers, no body; or 404.                                          |
| `GET /v8/artifacts/{hash}`  | Streams original tarball with length, duration, tag, and optional SHA/dirty-hash headers; or 404.                             |
| `PUT /v8/artifacts/{hash}`  | Conditional write; 202 JSON `urls` for new or existing keys. Reader gets 403. Preserve body and metadata of the first writer. |
| `POST /v8/artifacts`        | Bare hash map with `size`, `taskDurationMs`, optional tag/SHA/dirtyHash, or `null`.                                           |
| `POST /v8/artifacts/events` | Accepts analytics events and returns 200 without storing them.                                                                |

Rules:

- `Authorization: Bearer <token>` is required on every route. Tokens are
  compared in constant time. A missing or unknown token gets 401.
- Artifact path and query hashes match `^[a-fA-F0-9]{1,128}$`; invalid values
  get 400. Discarded event payloads have no field validation.
- The [access contract](../docs/protocol/ci-remote-cache-access.md) resolves
  three principals and allowed namespaces. PR reads fall back to trusted
  objects per hash; writes stay in the PR namespace. Missing, duplicate, or
  forbidden team values get 403. Store the principal in object metadata.
- Write-once calls `R2Bucket.put` with
  `onlyIf: new Headers({ "If-None-Match": "*" })`. A failed condition returns
  `null`, not an exception; retain the winner and answer 202. Confirm this in
  production during Milestone 4 because local simulation may differ.
- Errors include flat `{code,message}` fields plus the matching
  `{error:{code,message}}` that the real client needs for 403. HEAD stays
  bodyless. The Worker never lists or deletes objects; lifecycle owns expiry.
- A parsed `forbidden` 403 triggers token recovery. If recovery fails, remote
  reads and writes stop for the rest of that run while builds continue. A reader
  without `remote:r` loses reads after its first upload; a wrong team also
  disables the remote cache when its JSON 403 is parsed.
- Drop invalid optional SHA, dirty-hash, CI, and interactive diagnostics without
  rejecting uploads. Keep content type, length, duration, and tag rules strict.
- OpenAPI paths omit `/v8`; the 2.11.7 client supplies that prefix. Follow the
  actual client paths, including metadata headers omitted from the initial plan.
- Secrets: `TURBO_CACHE_TRUSTED_WRITE_TOKEN`, `TURBO_CACHE_PR_WRITE_TOKEN`,
  and `TURBO_CACHE_READ_TOKEN`. Missing/short secrets disable their principal;
  duplicate secrets or an invalid team return `configuration_error` (500).
  Binding: `ARTIFACTS` for bucket `mokly-turbo-cache`. Variable:
  `TURBO_CACHE_TEAM`.

Workers request bodies are capped at 100 MB on Free and Pro account plans.
Current artifacts are below 40 MB before compression. Standard R2's monthly
free tier covers 10 GB-month of storage, one million Class A operations, and
ten million Class B operations with free egress. The Worker contract also sets
explicit JSON, hash, metadata, and upload limits.

Repository layout: `scripts/turbo-cache/worker.ts`, `artifacts.ts`, `auth.ts`,
`store.ts`, `r2.ts`, `stream.ts`, `metadata.ts`, `errors.ts`, `wrangler.jsonc`,
`tsconfig.json`, and `README.md`, with tests
under `tests/turbo_cache_*.test.ts` that use an in-memory store. `scripts` is
already a ratchet source root, so the length and export ratchets cover the
Worker. The deployment workflow `.github/workflows/turbo-cache.yml` runs
`wrangler deploy` on `workflow_dispatch` and on `main` pushes that touch
`scripts/turbo-cache/**`. It uses `vars.CLOUDFLARE_ACCOUNT_ID` and a new
`secrets.CLOUDFLARE_WORKERS_API_TOKEN` from the main-only GitHub environment
`turbo-cache-deploy`: an account API token with the Workers `Editor` role
scoped to the `mokly-turbo-cache` Worker plus Workers `Metadata Read-Only`.

## CI Wiring

- A new `prepare` job on Node 22.14.0 runs in parallel with `repository`. It
  runs `npm ci` and `npm run prepare:verification` with the selected access policy
  and uploads only when both credentials exist. It does not need Rust or Chromium.
- `package`, `unit`, `browser`, and `hydration` add `prepare` to `needs` and
  receive the policy B token. Their unchanged `cargo xtask check` call
  restores the outputs through `turbo`.
- `Required CI` adds `prepare` to its `needs`.
- Token variables follow the [access policy](../docs/protocol/ci-remote-cache-access.md).
  The signature variable comes from `secrets.TURBO_CACHE_SIGNATURE_KEY`. Export both only when both exist and
  select the policy's mode and namespace; otherwise leave both unset and select `local:rw`.
  A fork receives no remote credentials. Hosted telemetry is disabled from
  Milestone 2, before this remote wiring.
- `release.yml` sets `TURBO_FORCE=true`, local cache only, and no credentials.
  Preview main uses a trusted writer; preview PR follows the chosen policy. Native jobs do not.

## Out Of Scope

- Caching the unit, browser, hydration, typecheck, and package suites.
  Restored test reports would change the
  [suite evidence contract](../docs/protocol/ci-suite-evidence.md) and the
  release evidence reuse rules. A follow-up plan owns that work.
- Nx, moon, Bazel, or Vercel Remote Cache.
- Caching `npm ci`, the Rust toolchain, or Chromium installs.

## References

- [Turborepo configuration reference](https://turborepo.dev/docs/reference/configuration)
- [Turborepo system environment variables](https://turborepo.dev/docs/reference/system-environment-variables)
- [Turborepo Remote Cache OpenAPI specification](https://turborepo.dev/api/remote-cache-spec)
- [R2 Workers API conditional operations](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/)
- [R2 object lifecycles](https://developers.cloudflare.com/r2/buckets/object-lifecycles/)

## Milestones

### Milestone 1: Documentation And Protocol Contract

Write the two new protocol documents and update the existing contracts listed
under Contract Owners so they describe the task graph, Worker, token policy, CI
wiring, and release exceptions completely. This milestone is
documentation-only: validate the Markdown and review the diff instead of running
`cargo xtask check`.

- [x] Create `docs/protocol/ci-remote-cache.md` at or below 250 lines with a
      Delivery Status, the task table, inputs and outputs, global settings,
      environment handling, the cache-source table, local developer setup,
      and the `TURBO_FORCE` release rule.
- [x] Create `docs/protocol/ci-remote-cache-worker.md` at or below 250 lines
      with the endpoint table, token classes, write-once storage, key layout,
      limits, the `wrangler.jsonc` shape, the deployment workflow, and the
      provisioning runbook for the bucket, lifecycle rule, secrets, first
      deploy, and token rotation.
- [x] Update `ci-verification.md`, `ci-workflow.md`,
      `ci-verification-security.md`, `npm-release.md`,
      `npm-release-evidence.md`, and `npm-preview-deployments.md` for the
      prepare job, cache sources, fork gating, and forced release builds.
- [x] Add both new documents to `docs/protocol/README.md`.
- [x] Update `xtask/README.md` and the root `README.md` develop section:
      `turbo` runs preparation, `.turbo/` is the local cache, and how to use a
      read-only token.
- [x] Add one sentence to the status paragraph of `plans/ci-performance.md`
      that points to this plan for the superseded build-in-each-job decision.
- [x] Run `npx prettier --check` on the changed Markdown and run
      `node --import tsx --test tests/protocol_doc_sizes.test.ts`.
- [x] Find and run every test that reads a changed document. Check every
      relative link, including plan links. Run the mainline diff and deletion
      checks before and after the commit. Keep all evidence under `.context/`.
- [x] Apply the four supervising-agent review corrections: global viewer
      inputs, discarded event validation, optional diagnostic handling, and
      the client's `forbidden` recovery and run-wide disable behavior. Repeat
      documentation validation and Git preservation checks, then commit and push.
- [x] Review the diff against `origin/main`, then `git add -A`, commit with
      Conventional Commits, and push.
- [x] Review the complete local diff against `origin/main` with
      `docs/implementation-review-prompt.md` after the push. Report findings
      without changing the implementation.
  - Baseline rebuilds reused another commit's Turbo output — fixed in Milestone 2 with direct baseline commands.
  - Same-repository PR jobs can poison shared cache — resolved by the user's policy B choice on 2026-10-07 and scoped CI wiring in Milestone 4. The shared PR token can still write another PR's namespace.
  - Turbo stdout broke `npm pack --json` — fixed in Milestone 2.
  - Ignored files under example inputs — fixed in Milestone 2.
  - Preview wording claimed example caching — fixed in Milestone 2.
  - Release Please measurement could not run before merge — moved to non-blocking post-merge follow-up in Milestone 2.

Evidence files: `.context/turborepo-cloudflare-remote-cache/milestone-1-validation.md`
and `.context/turborepo-cloudflare-remote-cache/milestone-1-sources.md`.
Review follow-up evidence: `.context/turborepo-cloudflare-remote-cache/milestone-1-review-validation.md`
and `.context/turborepo-cloudflare-remote-cache/milestone-1-review-merge-audit.log`.

### Milestone 2: Turborepo Task Graph With Local Caching

Install `turbo`, register the task graph, and switch the build scripts to it.
After this milestone every existing command works, repeated builds hit the
local cache. Hosted CI keeps the same jobs and local cache only, but disables
telemetry and forces release builds from the first Turbo use.

- [x] Before root script changes, build the old scripts from a clean tree and
      record SHA-256 for every package/viewer file and all four example output
      patterns. Compare with a forced Turbo build from clean outputs. Require
      identical bytes; explain and justify any difference.
- [x] Make historical baselines bypass Turbo entirely by using the underlying
      viewer, TypeScript, asset-copy, and direct example commands. Keep this
      recipe aligned with root scripts. Test distinct viewer/package baselines
      in a linked worktree, both before and after Turbo delivery, with no Turbo
      cache reads, writes, or telemetry. Confirm no code reads
      `MOKLY_BASELINE_COMMIT`.
- [x] Keep stdout empty across the prepack build chain while preserving real
      lifecycle builds. Add an isolated real `npm pack --json` regression and
      verify any redirection is compatible with Windows `cmd.exe`.
- [x] Compare resolved example input files with Git's file inventory minus
      generated outputs and ignored paths, including `examples/basic/.context`.
      Document uncached example checking and direct preview example builds.
      Move the Release Please timing measurement to non-blocking post-merge work.
- [x] Audit the complete example configuration and everything it loads: roots,
      styles, documents, renderer, PostCSS/Browserslist, assets, baseline recipe,
      and shared-impact paths. Add uncovered repository inputs outside the
      example. Prove input edits change hashes and unrelated docs, root README,
      tests, and plans do not, using two-direction dry JSON checks.
- [x] Audit ignored paths under explicit example and root-source input globs.
      Exclude every possible scratch/output path, including `.mokly-write-*`
      and `.mokly-review-*`, so ignored leftovers do not change task hashes.
- [x] Align TypeScript source discovery and viewer asset copying with ignored
      input exclusions. Add failing regressions first so an ignored leftover
      cannot change uncached output while keeping the same cache key.
- [x] Clean each package's owned distribution before uncached task execution,
      and clean before packing. Add a failing stale-output regression and hash
      the cleanup script in both tasks. Baselines start from fresh extracted
      sources and need no task cleanup step.
- [x] Clean all four declared example output patterns before root example
      builds, preserving authored CSS. Capture an unowned ignored HTML cache
      contamination regression before the fix and prove it cannot enter cache
      artifacts. Keep the generic Mokly CLI ownership contract unchanged.
- [x] Confirm the lockfile contains all six `@turbo/*` platform packages and
      that the dependency audit accepts them.
- [x] Run `npm install --save-dev turbo` for the latest 2.x release and confirm
      it resolves 2.11.7 and `npm run dependencies:check` passes. If upstream
      changes before installation, reverify the schema and client contract.
- [x] Resolve the newly uncovered Sharp and Shell Quote advisories with
      compatible targeted dependency updates. Capture a bounded regression
      before the Shell Quote update and rerun the live audit and complete gate.
- [x] Add `turbo.json` with the `$schema`, the task table, and the global
      settings. Keep `remoteCache.apiUrl` and `teamSlug` out until
      Milestone 4.
- [x] Preserve viewer default inputs and its `$TURBO_ROOT$/tsconfig.json` input.
      Use `--dry=json` to prove viewer source/helper edits change the global hash
      and all three task hashes. Prove a root tsconfig edit changes the viewer
      and `//#build:package` hashes; the root tsconfig is not a global input.
      Check which viewer files the global hash covers, including README and
      tests, and record the result in `ci-remote-cache.md`.
- [x] Change the root scripts: `build` to `node scripts/turbo-run.mjs build:package 1>&2`, a new
      `build:package`, and `prepare:verification` to `node scripts/turbo-run.mjs example:build`.
- [x] Add `turbo.json` to the fixed copy list in
      `tests/helpers/example_baseline.ts`. Test historical reconstruction in
      the isolated example repository after the root build script changes.
- [x] Keep committed example fixture conversion valid for multiline baseline
      command arrays, with a failing regression before the fixture-helper fix.
- [x] Ensure Turbo test fixtures never track or archive their shared
      `node_modules` link; baseline installs must own their dependency tree.
- [x] Enumerate the environment variables that the viewer build, `copy-assets`,
      and the CLI example build read. List them in `env` or `passThroughEnv`.
      Prove the tasks pass under strict mode with
      `cargo xtask check --suite package`.
- [x] Confirm the example-build input list: change one file in each candidate
      location (`examples/basic/specs`, `mokly.config.ts`, authored CSS under
      `generated`, and `src`) and check that
      `npx --no-install turbo run example:build --dry=json` changes the hash. Record the
      result in `ci-remote-cache.md`.
- [x] Prove cached outputs depend only on declared inputs and hashed
      environment. Build from clean outputs at different times and after Git
      ref, commit, and dirty-state changes. Fix hidden inputs or disable the
      affected task's cache before accepting it.
- [x] Build in two different absolute checkout paths and compare all three
      tasks' declared product outputs byte for byte, including maps and
      manifests. Prove Node 22.14 and Node 24 output equality before sharing
      hashes across the two Linux profiles.
- [x] Verify restore with missing, corrupted, matching, and extra output files;
      preserve authored CSS. Confirm extra files are not removed (Milestone 2
      verifies). Keep clean consumers, mutation, startup, and Mokly cache tests
      independent under the task-cache contract; force execution when needed.
- [x] Set workflow-scope `TURBO_TELEMETRY_DISABLED: "1"` in `ci.yml`,
      `preview.yml`, and `release.yml` before any hosted Turbo run. Set release
      `TURBO_FORCE=true` and local cache only now, not in Milestone 4. Update
      workflow assertions for these early changes.
- [x] Prove `npm run build` and `npm run prepare:verification` pass with neither
      token nor key, using `TURBO_CACHE=local:rw` and both credentials unset.
- [x] Add `.turbo/` to `.gitignore` and `.prettierignore`. Confirm ESLint's
      existing Git-ignore integration and Prettier's explicit ignore file both
      ignore cache metadata.
- [x] Add `tests/turbo_config.test.ts`. It parses `turbo.json`; asserts
      `agentGuidance === false`, `envMode === "strict"`,
      `remoteCache.signature === true`, and
      `futureFlags.longerSignatureKey === true`; asserts the `example:build`
      outputs equal the ignored generated patterns in `.gitignore`; and runs
      `npx --no-install turbo run example:build --dry=json` to assert the
      `@mokly/viewer#build`, `//#build:package`, `//#example:build` dependency execution order with caching enabled, independent of the
      dry JSON task array's lexical ordering.
- [x] Update `tests/ci_workflow*.test.ts`, `tests/release*.test.ts`, and
      `tests/deployment.test.ts` where they assert script contents or workflow
      steps that change.
- [x] Smoke test: `npm run build` twice shows `FULL TURBO` on the second run;
      `npm run prepare:verification` twice does the same; `npm run dev` serves
      the example; `cargo xtask check` passes with each later suite restoring
      preparation from the local cache.
- [x] Confirm `turbo` did not write to `AGENTS.md` and that no `turbo` block
      exists there.
- [x] Update the Delivery Status in `docs/protocol/ci-remote-cache.md` for the
      local task graph.
- [x] Preserve incoming mainline dependency updates, hydration coverage, test
      concurrency, and documentation policy. Repeat output/runtime/path proofs and the complete
      gate on the integrated tree. Keep the original before-script evidence.
- [x] Fix review finding 7: pass `MOKLY_DIAGNOSTIC` through strict-mode tasks,
      document it, and add the failing configuration regression before the fix.
- [x] Fix review finding 10: mark local task caching, forced release builds,
      and hosted telemetry opt-out as delivered in the index and CI contract.
- [ ] Before merge, verify hosted workflow behavior after a PR exists. Confirm
      telemetry/local-only settings, release force behavior, and native macOS
      and Windows binary installation and execution. The Linux workspace cannot
      prove native jobs; no hosted CI run exists yet.
- [x] Run `cargo xtask check`.
- [x] Run `git add -A`, commit with Conventional Commits, and push.
- [x] Review the complete local diff against `origin/main` with
      `docs/implementation-review-prompt.md` after the push. Report findings
      without changing the implementation.
  - Re-review of the fixes (`0c8608c`, `37e4a1b`) and merge `d6e8414`: no new findings. Findings 1–6, 8, and 9 wait for the user.
  - Finding 1 (medium, code structure): direct baseline recipe copies the build pipeline; recommend a stable `baseline:build` in a follow-up PR. Waiting for the user.
  - Finding 2 (medium, test): Turbo tests check the real root's unstaged AGENTS diff; recommend comparing bytes where Turbo runs. Waiting for the user.
  - Finding 3 (low, product bug): distribution cleanup causes dev HTTP 500 during uncached builds; recommend building in place and removing unwritten files. Waiting for the user.
  - Finding 4 (low, test): root prepack cleanup on a cache hit has no test. Waiting for the user.
  - Finding 5 (low, performance): Turbo tests add about 4.7 minutes of serial work; recommend one installed fixture per file. Waiting for the user.
  - Finding 6 (low, cache correctness): example excludes `.wrangler`, `.turbo`, and `.superpowers` that entry discovery reads; recommend removing these exclusions and comparing inventories. Waiting for the user.
  - Finding 8 (low, test): helpers do not create `.context` before temporary directories; focused fresh-checkout runs fail. Waiting for the user.
  - Finding 9 (low, process): Turbo uses `^2.11.7` despite an exact verified contract; recommend pinning 2.11.7. Waiting for the user.

Evidence: `.context/turborepo-cloudflare-remote-cache/m2-progress.md` and
`.context/turborepo-cloudflare-remote-cache/m2-validation.md`.
Review-fix evidence: `.context/turborepo-cloudflare-remote-cache/m2-review-fix-validation.md`.
Merge decisions: `.context/turborepo-cloudflare-remote-cache/m2-merge-decisions.md`.

### Milestone 3: Remote Cache Worker

Implement, test, and typecheck the Worker and its deployment workflow. Nothing
in CI uses it yet, so the product stays functional.

- [x] Record Milestone 1 review statuses and close its review TODO. Preserve the
      Milestone 2 review TODO. Confirm the old Milestone 2 stash contains no
      missing change, then drop it.
- [x] Write the three-principal access contract before implementation. Keep the
      CI policy pending between A, B, and C, with B recommended.
- [x] Clarify that policy A cannot share new PR hashes across jobs; scoped
      writes under B or accepted shared writes under C can populate them.
- [x] Preserve main's cache self-ignore behavior, npm 11.21.0 pin, and
      deterministic test rules. Align the Worker workflow and contract with the
      npm pin. Repeat the signed-client smoke and complete gate on this tree.
- [x] Keep protocol pages free of plan milestone history. Preserve Delivery
      Status and link the plan for implementation ownership.
- [x] Prove that a real PR client using the trusted slug receives 403, builds
      continue with remote caching disabled, and no new trusted object appears.
- [x] Put the final GET after the duplicate PUT in the local runbook. State
      that earlier PR-prefix expiry is inferred from the R2 lifecycle example
      and requires production confirmation before remote writes are enabled.
- [x] Keep auth, routing, and ArtifactStore runtime-neutral. Confine Workers
      types to the R2 adapter and fetch entry; preserve root Node/DOM types.
- [x] Compare fixed SHA-256 token digests with a constant-time loop in both
      runtimes, against every configured secret on every request.
- [x] Validate all request metadata before body consumption. Stream artifacts,
      enforce actual length and limits, and test mismatched Content-Length.
- [x] Prove every HEAD response is bodyless, including all error paths.
- [x] Select a compatibility date accepted by pinned Wrangler without a
      fallback warning and record the result in the Worker contract.
- [x] Follow deployment workflow runner, action, permission, timeout,
      concurrency, remote-Git, telemetry, credential, and no-fork conventions.
      Assert the exact deploy command and tests/typecheck before deploy.
- [x] Run real Turbo signed writer/reader, wrong-key, PR fallback/scoped-write,
      and forbidden trusted-write smokes against local Wrangler from a separate
      clone. Compare outputs byte for byte and preserve the main cache.
- [x] Add and confirm an ignore rule before creating local .dev.vars secrets.
- [x] Run `npm install --save-dev @cloudflare/workers-types` and confirm the
      dependency audit passes.
- [x] Implement `scripts/turbo-cache/store.ts`: an `ArtifactStore` interface
      with `head`, `get`, and `putIfAbsent`, and a separate runtime-specific R2 adapter that uses
      `onlyIf: new Headers({ "If-None-Match": "*" })`. Treat null as an
      existing-key result. Store principal, duration, tag, SHA, and dirty hash atomically.
- [x] Implement `scripts/turbo-cache/auth.ts`: bearer parsing, a constant-time
      comparison of fixed SHA-256 digests in Workers and Node, and three-principal
      resolution with fail-closed configuration.
- [x] Implement `scripts/turbo-cache/artifacts.ts`: the six routes, hash
      validation, the team check, response headers, 202 for already-present
      keys, and 403 for read-only writes.
- [x] Implement `scripts/turbo-cache/worker.ts`: the `fetch` entry, routing,
      404 and 405 defaults, and flat plus wrapped error fields that meet both
      OpenAPI and the 2.11.7 client. Keep every HEAD response bodyless.
- [x] Add `scripts/turbo-cache/wrangler.jsonc` with `name`, `main`,
      `compatibility_date`, the R2 binding, `TURBO_CACHE_TEAM`, and
      observability. Add `scripts/turbo-cache/tsconfig.json` with Workers
      types and add `tsc --project scripts/turbo-cache/tsconfig.json --noEmit`
      to `typecheck:prepared`.
- [x] Add `tests/turbo_cache_worker.test.ts`, `tests/turbo_cache_auth.test.ts`,
      and `tests/turbo_cache_store.test.ts` with an in-memory store: status,
      head, get, put, write-once, read-only 403, missing and wrong token 401,
      wrong team 403, bad hash 400, query, events, method not allowed, and the
      header round trip for `x-artifact-tag` and `x-artifact-duration`.
- [x] Test the complete verified wire contract: PUT 202 `urls`, bare query
      maps with `taskDurationMs` and optional commit metadata, HEAD metadata,
      bodyless HEAD errors, status values, flat/wrapped 403 compatibility,
      missing/duplicate/both team parameters, JSON and upload limits, duration
      bounds, and strict tag rules. Prove invalid optional SHA, dirty-hash, CI,
      and interactive diagnostics do not reject PUTs and are not stored or
      echoed. Events require auth, team, a JSON array, and limits only; accept
      arbitrary items and fields. Do not require client-interactive headers.
- [x] Bridge the core stream through a Workers FixedLengthStream in the R2
      adapter. Capture the known-length failure first; prove early conditional
      refusal, stream errors, and complete metadata without buffering artifacts.
- [x] Test the R2 adapter binding call itself, including `Headers` in `onlyIf`,
      null on an existing object, no head-then-put guard, exceptions, and
      preservation of the first body and all metadata during concurrent PUTs.
- [x] Add `.github/workflows/turbo-cache.yml` with `workflow_dispatch` and a
      `main` path filter. Validate the account and token like `preview.yml`.
      Deploy with
      `npx --no-install wrangler deploy --config scripts/turbo-cache/wrangler.jsonc`.
- [x] Add `scripts/turbo-cache/README.md` with the runbook commands: bucket
      create, `wrangler r2 bucket lifecycle add` with a 30-day expiry,
      `wrangler secret put` for the three tokens, deploy, a curl smoke test,
      PR-prefix expiry, and one-object poison recovery. Document only the admin commands.
- [x] Keep every file under 300 lines and resolve ratchet findings for the new
      `scripts` modules.
- [x] Local smoke: run
      `npx --no-install wrangler dev --local --config scripts/turbo-cache/wrangler.jsonc` with the
      local R2 simulation, then curl status, put, head, get, and a second put.
      Keep the runbook in the README and the transcript under `.context/`.
- [x] Update the Delivery Status in `docs/protocol/ci-remote-cache-worker.md`.
- [x] Run `cargo xtask check`.
- [x] Run `git add -A`, commit with Conventional Commits, and push.
- [x] Review the complete local diff against `origin/main` with
      `docs/implementation-review-prompt.md` after the push. The supervising
      agent runs the review. Apply the `AGENTS.md` review-fix rule after it
      reports; keep the review itself read-only.
  - Re-review of `39606e5`, `e4437ba`, `4a4f4e1`, and merge `865d37d`: R1 fixed in `9030e33`; R2, finding 1, and finding 3 wait for the user.
  - R2 (low, test): the finding-5 drift test in `tests/turbo_cache_workflow.test.ts` also reads the plan's "Repository layout" text, so a future Worker module would force edits to a completed plan; it runs in milliseconds and protects the contract's module list and config block. Recommended: keep the contract check and drop the plan check. Waiting for the user.
  - [x] Fix re-review finding R1: log every 500-or-higher response, including safe configuration-check diagnostics and invalid stored metadata; preserve client responses and capture failing regressions first.
  - [x] Run the final re-review gate, close the review with the R1 commit SHA, commit the plan, and push. Stop after this last fix round.

  - Finding 1 (high, security): the deploy workflow used an account-wide Workers/R2 write token as a repository secret, which any branch workflow could read. Admin moved the Worker-scoped token into main-only `turbo-cache-deploy` on 2026-10-07. The user approved the credential rule and workflow test for Milestone 4; both are implemented.
    - Pages token check completed on 2026-10-07: the replacement `github-actions-mokly-preview-pages` has only Pages Read/Write; Worker settings and R2 listing are denied. Provisioning evidence is under `.context/turborepo-cloudflare-remote-cache/provisioning-2026-10-07.md`.
  - Finding 3 (low, missing test): no automated test runs the Workers runtime, so a broken FixedLengthStream path can deploy; recommend an unstable_startWorker integration test with local R2 in the deploy gate. Waiting for the user.
  - [x] Fix finding 2: disable version preview URLs explicitly, assert the config, and document the old-version URL check after token rotation.
  - [x] Fix finding 4: log unexpected error names/messages through the injected logger while keeping client responses generic; capture the regression first.
  - [x] Fix finding 5: list every Worker module and copy the exact Wrangler configuration into the contract, with a drift regression.
  - [x] Merge main's browser helper change after the fixes; audit preservation, run the complete gate, commit, and push the fixes plus merge. The supervising agent owns the re-review.

Evidence: `.context/turborepo-cloudflare-remote-cache/m3-progress.md` and
`.context/turborepo-cloudflare-remote-cache/m3-validation.md`.
Main integration decisions: `.context/turborepo-cloudflare-remote-cache/m3-main-decisions.md`.
Review-fix evidence: `.context/turborepo-cloudflare-remote-cache/m3-review-fix-validation.md`.
Review-fix merge decisions: `.context/turborepo-cloudflare-remote-cache/m3-review-main-decisions.md`.
Final re-review evidence: `.context/turborepo-cloudflare-remote-cache/m3-rereview-validation.md`.

### Milestone 4: Cloudflare Provisioning And CI Wiring

Provision the bucket and secrets, deploy the Worker from this branch, wire
hosted CI to the remote cache, and measure the result. The provisioning steps
need a Cloudflare account owner and a repository admin. They are completable
before the merge.

- [x] Admin: create the `mokly-turbo-cache` R2 bucket. Done on 2026-10-06 in
      region WEUR; see
      `.context/turborepo-cloudflare-remote-cache/provisioning-2026-10-06.md`.
- [x] Admin: add the 30-day expiry lifecycle rule `expire-artifacts`. Done on
      2026-10-06.
- [x] Admin: create the account API token `github-actions-mokly-turbo-cache-deploy`
      with the Workers `Editor` role scoped to the `mokly-turbo-cache` Worker
      and Workers `Metadata Read-Only` for all Workers. Done on 2026-10-07;
      stored as `CLOUDFLARE_WORKERS_API_TOKEN` in the GitHub environment
      `turbo-cache-deploy`, which allows only `main`.
- [x] Run one deploy with that token from the admin's machine before merge to
      prove the permission is enough. Done on 2026-10-07; see
      `.context/turborepo-cloudflare-remote-cache/provisioning-2026-10-07.md`.
- [x] Preserve main's dependency updates, generated-output migration, renderer
      typecheck and Testbox executor. Resolve conflicts path by path. Update
      Turbo outputs, imported-asset inputs, baseline fixtures and cleanup tests
      for the disposable mokly-generated tree; keep baselines outside Turbo.
- [x] Preserve main's baseline dependency audit and daily update workflow from
      6bb64219. Keep audit mode selection, release strict mode, all incoming
      tests and the xtask module split; combine the audit and cache docs.
- [x] Preserve main's attribution fixture consolidation and targeted developer
      test commands through 088fadb4, including its AGENTS.md update. Keep
      every incoming test, reporter, selection rule and protocol link.
- [x] Align main's cold-baseline browser recipe assertion with the accepted
      direct build commands. Keep its real cold install/build, warm-cache
      validation, export, comparison and UI assertions.
- [x] Preserve main's c451f24c review-guidance changes without local AGENTS.md
      edits. Audit both incoming documentation files and the two-parent merge.
- [x] Preserve main's 2013d289 plan-history rules, seven historical plan
      permalink updates and expanded Markdown link test. Keep the completed
      CI performance plan's main wording; describe supersession in this live plan.
- [x] Resolve the existing Node 24 shared-example copy failure from main, with
      user approval. The owner creates an empty root that exclusive fs.cp rejects;
      keep collision checks and all fixture/cache assertions.
      The user approved removal of only that empty placeholder on 2026-10-07.
- [x] Capture the token-only status-probe regression. Add a root launcher that
      removes incomplete credential pairs and keeps builds local, including
      Windows. Copy it into isolated fixtures and repeat real local-only proofs.
- [x] Implement and test policy B main-only environments with deployment: false,
      separate trusted/PR event guards, and silent GITHUB_ENV mapping after installs.
- [x] Add the approved credential rule and workflow tests; remove legacy broad
      token aliases. Keep the Pages credential free of Workers/R2 writes.
- [x] Match GitHub's case-insensitive secret references in the workflow guard.
      Capture a failing lowercase-reference regression and keep dot/bracket
      forms covered for forbidden aliases and protected credentials.
- [x] Admin: confirm CLOUDFLARE_PAGES_API_TOKEN has no Workers or R2 write
      permissions. The user replaced and verified the Pages-only token on
      2026-10-07; workflow code still cannot inspect live token permissions.
- [ ] Admin: retire the old Pages token after its Last used time stops changing.
- [x] Repeat Node 22.14/24 output equality after the main output/dependency
      migration before the Node 22 prepare job serves Node 24 suites.
- [x] Add `environment: turbo-cache-deploy` to the deploy job in
      `turbo-cache.yml` and assert it in `tests/turbo_cache_workflow.test.ts`.
      The token is not a repository secret, so the job cannot deploy without it.
- [x] Admin: choose CI policy A, B (recommended), or C. The user chose B on
      2026-10-07. The trusted writer lives in the GitHub environment
      `turbo-cache-trusted`, which allows only `main`. The access contract
      records B's shared-PR-token residual risk.
- [x] Admin: add the documented 7-day `mokly-pr-` lifecycle rule
      `expire-pr-artifacts`. Done on 2026-10-07. Confirming the earlier expiry
      needs 7 days, so it is a post-merge follow-up.
- [x] Admin: generate the three Worker tokens and the signature key with
      `openssl rand -hex 32`. Done on 2026-10-07 on the admin's Mac; values
      never left it in any output.
- [ ] Verify the rotation runbook changes the Worker team, all client team
      settings, and the 7-day PR lifecycle prefix together, preserving old
      namespace expiry.
- [x] Admin: run the first deploy from this branch with pinned Wrangler 4.113.0
      and the admin's login. Done on 2026-10-07 at `11b207d`:
      `https://mokly-turbo-cache.calum-785.workers.dev`. With no secrets it answers 401 to every
      request; the version preview URL returns 404. See
      `.context/turborepo-cloudflare-remote-cache/provisioning-2026-10-07.md`.
- [x] Admin: set the Worker secrets for the chosen principals. Done on
      2026-10-07 with `wrangler secret bulk`.
- [x] Admin: add GitHub secrets with the selected principal token names and
      `TURBO_CACHE_SIGNATURE_KEY`. Done on 2026-10-07:
      `TURBO_CACHE_TRUSTED_WRITE_TOKEN` in the environment `turbo-cache-trusted`;
      `TURBO_CACHE_PR_WRITE_TOKEN` and `TURBO_CACHE_SIGNATURE_KEY` as repository
      secrets. The read-only token and key are in the admin's Keychain item
      `mokly-turbo-cache-developer`.
- [ ] Admin: give approved developers the read-only token and signature key
      through a private password-manager share. Confirm `local:rw,remote:r`
      suppresses uploads and that a read-only token without a key cannot
      accept a signed download.
- [x] Confirm token rotation makes old tokens return 401 and a known old
      version's preview URL cannot reach the Worker; keep preview_urls false.
      Done on 2026-10-07 for the PR token.
- [x] Verify large uploads and batches against Workers Free's 1,000 internal
      subrequests per request (R2) and 10 ms CPU budget. Cover trusted and PR
      fallback batches; a 1,024-hash query can exceed that subrequest budget.
      Done on 2026-10-07: a 40 MiB upload and a 3-hash batch passed; a
      1,024-hash PR batch returned 500, and Turbo falls back to HEAD.
- [ ] Decide whether to cap batch queries below the subrequest budget, so a
      large batch gets 413 instead of 500. Turbo falls back to HEAD either way.
- [x] Confirm the configured apiUrl has no trailing slash. Verify requests use
      /v8 paths, since a trailing slash can produce //v8 paths and silent misses.
- [x] Confirm production R2 conditional behavior: absent-key PUT succeeds,
      repeated and concurrent PUTs keep one complete body and its original
      metadata, and a failed condition returns null. Compare with local
      simulation; resolve any difference before enabling remote writes.
      Done on 2026-10-07; matches local simulation.
- [x] Commit `remoteCache.apiUrl` and `remoteCache.teamSlug` in `turbo.json`.
- [x] Add the `prepare` job to `ci.yml`. Add it to the `needs` of `package`,
      `unit`, `browser`, `hydration`, and `Required CI`. Add the token
      environment only when both secrets exist; otherwise leave both unset
      and use local cache only, including forks.
- [x] Keep the forced release and telemetry settings from Milestone 2. Map main preview to the trusted writer and PR preview to policy B. Keep release
      and native jobs without remote credentials.
- [x] Update `tests/ci_workflow.test.ts` and the related workflow tests for the
      new job graph and environment.
- [x] Verify fork behavior locally: run `npm run prepare:verification` with
      the Worker URL configured, both credentials unset, and local cache only.
      Confirm exit 0 and no remote requests. Test either credential missing too.
- [ ] Verify the remote path in an isolated checkout with an empty private
      cache, the read-only token/key, and `local:rw,remote:r`. Confirm three
      remote hits after CI fills the cache. Do not delete a shared worktree cache.
- [ ] Smoke-test real signed round trips, rejected unsigned/invalid artifacts,
      response length, batch-to-HEAD fallback, and safe cache errors. Prove a
      parsed `forbidden` from a reader upload or wrong team disables remote
      reads and writes for the rest of the run while builds pass. Confirm
      `remote:r` prevents reader uploads. Document access-token rotation and
      new-namespace signature-key rotation.
- [ ] Push and read the pull request run: `prepare` uploads three artifacts and
      ten ordinary downstream jobs report cache hits. Record
      per-job durations before and after, and the R2 object count, in
      `.context/turborepo-cloudflare-remote-cache/measurements.md`.
- [x] Update the Delivery Status sections and the Contract Owners documents to
      implemented.
- [x] Run `cargo xtask check`.
- [x] Run `git add -A`, commit with Conventional Commits, and push.
- [ ] Review the complete local diff against `origin/main` with
      `docs/implementation-review-prompt.md` after the push. Report findings
      without changing the implementation.

Evidence: `.context/turborepo-cloudflare-remote-cache/m4-validation.md`.
Main integration decisions: `.context/turborepo-cloudflare-remote-cache/m4-main-decisions.md`.
Dependency-audit integration decisions: `.context/turborepo-cloudflare-remote-cache/m4-audit-main-decisions.md`.
Developer-test integration decisions: `.context/turborepo-cloudflare-remote-cache/m4-developer-main-decisions.md`.
Review-guidance integration decisions: `.context/turborepo-cloudflare-remote-cache/m4-agent-main-decisions.md`.
Plan-history integration decisions: `.context/turborepo-cloudflare-remote-cache/m4-history-main-decisions.md`.
Remote-verification integration decisions: `.context/turborepo-cloudflare-remote-cache/m4-remote-main-decisions.md`.
Fixture-cleanup flake fix (Git 2.55 background maintenance) and gate runs: `.context/turborepo-cloudflare-remote-cache/m4-flake-turbo-inventory.md`.

## Post-merge follow-up (non-blocking)

- Confirm the first main push accepts the conditional trusted environment,
  enforces the branch restriction, grants its token, and creates no deployment
  records for cache-only jobs (deployment: false). No main push exists before merge.

- Measure the first Release Please pull request's twenty downstream jobs after
  this change merges. Release Please creates that pull request from main, so
  this measurement cannot be a pre-merge milestone requirement.

- Confirm that PR-area objects expire after 7 days, the earlier of the two
  lifecycle rules.
- Watch the first five `main` runs for remote cache errors in the `turbo` logs
  and in Worker observability.
- Rotate the read-only token and record the rotation date when the first
  external contributor receives it.
- Open a follow-up plan for cached test suites once the suite evidence
  contract defines replayed reports.
