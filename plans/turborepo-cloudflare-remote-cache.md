# Turborepo Remote Cache On Cloudflare

Status: Active. Created on 2026-10-06. No pull request yet.

## Summary

Adopt Turborepo as the task runner for the npm build and preparation scripts.
Share its task cache through a self-hosted remote cache that runs on a
Cloudflare Worker with one R2 bucket. The repository owns the Worker, its
tests, and its deployment workflow. `cargo xtask check` stays the complete
gate; it calls the same npm scripts, which now run through `turbo`.

The change removes the repeated package and example preparation in hosted CI.
Today the package job, four unit shards, four browser shards, and the hydration
job each run `npm run prepare:verification` on an identical tree, so one pull
request runs the same build ten times. A Release Please pull request runs it
twenty times. After this change one prepare job builds and uploads the outputs,
and every other job restores them. Developers get the same cache locally, and
the complete local gate stops rebuilding the package for each suite.

Baseline timings and output sizes are recorded in
`.context/turborepo-cloudflare-remote-cache/baseline-measurements.md`.

The [CI performance plan](./ci-performance.md) chose to build inside each job
because cross-job artifact transfer was unnecessary for the measured setup
cost. This plan replaces that one decision with a content-addressed cache. The
suite boundaries, shard evidence, and fail-closed aggregate stay unchanged.

## Decisions

| Topic          | Decision                                                                                                                                                         |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Task runner    | Turborepo 2.11.x as a root `turbo` devDependency. npm workspaces and `package-lock.json` stay as they are.                                                       |
| Cached tasks   | `@mokly/viewer#build`, root `build:package`, and root `example:build`. Test suites are not cached by this plan.                                                  |
| Remote cache   | A Worker owned by this repository under `scripts/turbo-cache/`, storing artifacts in one R2 bucket. No Vercel account.                                           |
| Write policy   | Keys are write-once. Same-repository CI uses a read-write token. Developers use a read-only token. Fork pull requests get no token and use the local cache only. |
| Integrity      | `remoteCache.signature` is on with a key of at least 32 bytes. Unsigned or mis-signed artifacts are cache misses.                                                |
| Release        | `release.yml` keeps its uncached boundary with `TURBO_FORCE=true` and no remote token.                                                                           |
| Native CI jobs | The macOS and Windows jobs keep building from source with no remote token.                                                                                       |
| Agent guidance | `agentGuidance: false`, so `turbo` never edits `AGENTS.md`.                                                                                                      |
| Expiry         | An R2 lifecycle rule deletes artifacts after 30 days.                                                                                                            |
| Node in hashes | Build task hashes exclude the Node version. The outputs do not depend on it, and the Node 22 prepare job must serve Node 24 jobs on release pull requests.       |

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
- New
  [`docs/protocol/ci-remote-cache-worker.md`](../docs/protocol/ci-remote-cache-worker.md):
  Worker HTTP contract, token classes, write-once storage, limits, deployment,
  and the provisioning runbook.
- [`docs/protocol/ci-verification.md`](../docs/protocol/ci-verification.md):
  preparation is a cached task graph, and selected suites restore prepared
  outputs.
- [`docs/protocol/ci-workflow.md`](../docs/protocol/ci-workflow.md): the
  prepare job, job dependencies, token gating, and the release and native
  exceptions.
- [`docs/protocol/ci-verification-security.md`](../docs/protocol/ci-verification-security.md):
  the remote task cache next to the npm download cache, token classes, and
  fork behavior.
- [`docs/protocol/npm-release.md`](../docs/protocol/npm-release.md) and
  [`docs/protocol/npm-release-evidence.md`](../docs/protocol/npm-release-evidence.md):
  release runs are forced and uncached.
- [`docs/protocol/npm-preview-deployments.md`](../docs/protocol/npm-preview-deployments.md):
  same-repository preview builds may read and write the cache.
- [`docs/protocol/README.md`](../docs/protocol/README.md): index entries.
- [`xtask/README.md`](../xtask/README.md) and the root
  [`README.md`](../README.md): developer commands, `.turbo/`, and local
  remote-cache setup.
- Measurement record
  [`docs/reviews/ci-remote-cache.md`](../docs/reviews/ci-remote-cache.md),
  created in Milestone 4.

## Task Graph

Root `package.json` scripts change as follows. Every other script keeps its
name and behavior, including `example:build`, which `turbo` runs as a root
task.

| Script                 | Before                                       | After                                                               |
| ---------------------- | -------------------------------------------- | ------------------------------------------------------------------- |
| `build`                | viewer build, then `tsc`, then `copy-assets` | `turbo run build:package`                                           |
| `build:package`        | none                                         | `tsc --project tsconfig.build.json && node scripts/copy-assets.mjs` |
| `prepare:verification` | `npm run build && npm run example:build`     | `turbo run example:build`                                           |

`turbo.json` registers these tasks:

| Task               | Depends on            | Inputs                                                                      | Outputs                                                                                                                                                                               |
| ------------------ | --------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `build` (viewer)   | `^build`              | default: tracked files in `packages/viewer`                                 | `dist/**`                                                                                                                                                                             |
| `//#build:package` | `@mokly/viewer#build` | `src/**`, `scripts/copy-assets.mjs`, `tsconfig.json`, `tsconfig.build.json` | `dist/**`                                                                                                                                                                             |
| `//#example:build` | `//#build:package`    | `examples/basic/**` minus the generated outputs                             | `examples/basic/generated/**/*.html`, `examples/basic/generated/mokly-manifest.json`, `examples/basic/generated/example/workspace.svg`, `examples/basic/generated/mokly-generated/**` |

The root `package.json`, the lockfile, and the viewer sources are in the global
hash by default, because the root package depends on `@mokly/viewer`. Global
settings: `envMode: "strict"`, `agentGuidance: false`, `noUpdateNotifier: true`,
`ui: "stream"`, `cacheMaxAge: "14d"`, `remoteCache: { enabled: true,
signature: true }`, and `futureFlags: { longerSignatureKey: true }`.
`remoteCache.apiUrl` and `remoteCache.teamSlug` are committed once the Worker
URL exists.

Strict mode hides every environment variable that is not listed in `env`,
`passThroughEnv`, or the built-in system list. The example build runs the
built CLI; Milestone 2 enumerates the variables it reads.

Cache sources per environment:

| Environment                                  | Local cache    | Remote read | Remote write |
| -------------------------------------------- | -------------- | ----------- | ------------ |
| Developer without a token                    | yes            | no          | no           |
| Developer with the read-only token           | yes            | yes         | no           |
| Same-repository pull request and `main` push | yes            | yes         | yes          |
| Fork pull request                            | yes            | no          | no           |
| Release workflow                             | forced rebuild | no          | no           |
| Native macOS and Windows jobs                | yes            | no          | no           |

## Remote Cache Worker

The Worker implements the Turborepo Remote Cache API `v8` from the
[published OpenAPI specification](https://turborepo.dev/api/remote-cache-spec):

| Method and path             | Behavior                                                                                               |
| --------------------------- | ------------------------------------------------------------------------------------------------------ |
| `GET /v8/artifacts/status`  | `{"status":"enabled"}` for any valid token.                                                            |
| `HEAD /v8/artifacts/{hash}` | 200 with `Content-Length`, or 404.                                                                     |
| `GET /v8/artifacts/{hash}`  | Streams the stored gzip tarball with `x-artifact-tag` and `x-artifact-duration`, or 404.               |
| `PUT /v8/artifacts/{hash}`  | Stores the body once. An existing key stays untouched and still answers 202. Read-only tokens get 403. |
| `POST /v8/artifacts`        | Returns size, duration, and tag for each requested hash, or `null`.                                    |
| `POST /v8/artifacts/events` | Accepts analytics events and returns 200 without storing them.                                         |

Rules:

- `Authorization: Bearer <token>` is required on every route. Tokens are
  compared in constant time. A missing or unknown token gets 401.
- `hash` must match `^[a-fA-F0-9]{1,128}$`; anything else gets 400.
- The `slug` or `teamId` query value must equal the configured team; objects
  are keyed `<team>/<hash>`. A different team gets 403.
- Write-once uses an R2 conditional put with `If-None-Match: *`. The Worker
  never lists or deletes objects; the lifecycle rule owns expiry.
- Secrets: `TURBO_CACHE_READ_WRITE_TOKEN` and `TURBO_CACHE_READ_ONLY_TOKEN`.
  Binding: `ARTIFACTS` for bucket `mokly-turbo-cache`. Variable:
  `TURBO_CACHE_TEAM`.

Limits to document: Workers request bodies are capped at 100 MB on the free and
Pro plans, and current artifacts are below 40 MB before compression. The R2
free tier covers 10 GB of storage, one million writes, and ten million reads
per month with free egress.

Repository layout: `scripts/turbo-cache/worker.ts`, `artifacts.ts`, `auth.ts`,
`store.ts`, `wrangler.jsonc`, `tsconfig.json`, and `README.md`, with tests
under `tests/turbo_cache_*.test.ts` that use an in-memory store. `scripts` is
already a ratchet source root, so the length and export ratchets cover the
Worker. The deployment workflow `.github/workflows/turbo-cache.yml` runs
`wrangler deploy` on `workflow_dispatch` and on `main` pushes that touch
`scripts/turbo-cache/**`. It uses `vars.CLOUDFLARE_ACCOUNT_ID` and a new
`secrets.CLOUDFLARE_WORKERS_API_TOKEN` with Workers Scripts and Workers R2
Storage write permissions.

## CI Wiring

- A new `prepare` job on Node 22.14.0 runs in parallel with `repository`. It
  runs `npm ci` and `npm run prepare:verification` with the read-write token
  and uploads the three task outputs. It does not need Rust or Chromium.
- `package`, `unit`, `browser`, and `hydration` add `prepare` to `needs` and
  receive the same token variables. Their unchanged `cargo xtask check` call
  restores the outputs through `turbo`.
- `Required CI` adds `prepare` to its `needs`.
- Token variables come from `secrets.TURBO_CACHE_TOKEN` and
  `secrets.TURBO_CACHE_SIGNATURE_KEY`, with `TURBO_TELEMETRY_DISABLED=1`. A
  fork pull request has empty secrets; the workflow must leave `TURBO_TOKEN`
  unset in that case rather than export an empty value.
- `release.yml` sets `TURBO_FORCE=true` and no token. The same-repository jobs
  in `preview.yml` receive the token. Native jobs receive no token.

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

- [ ] Create `docs/protocol/ci-remote-cache.md` at or below 250 lines with a
      Delivery Status, the task table, inputs and outputs, global settings,
      environment handling, the cache-source table, local developer setup,
      and the `TURBO_FORCE` release rule.
- [ ] Create `docs/protocol/ci-remote-cache-worker.md` at or below 250 lines
      with the endpoint table, token classes, write-once storage, key layout,
      limits, the `wrangler.jsonc` shape, the deployment workflow, and the
      provisioning runbook for the bucket, lifecycle rule, secrets, first
      deploy, and token rotation.
- [ ] Update `ci-verification.md`, `ci-workflow.md`,
      `ci-verification-security.md`, `npm-release.md`,
      `npm-release-evidence.md`, and `npm-preview-deployments.md` for the
      prepare job, cache sources, fork gating, and forced release builds.
- [ ] Add both new documents to `docs/protocol/README.md`.
- [ ] Update `xtask/README.md` and the root `README.md` develop section:
      `turbo` runs preparation, `.turbo/` is the local cache, and how to use a
      read-only token.
- [ ] Add one sentence to the status paragraph of `plans/ci-performance.md`
      that points to this plan for the superseded build-in-each-job decision.
- [ ] Run `npx prettier --check` on the changed Markdown and run
      `node --import tsx --test tests/protocol_doc_sizes.test.ts`.
- [ ] Review the diff against `origin/main`, then `git add -A`, commit with
      Conventional Commits, and push.
- [ ] Review the complete local diff against `origin/main` with
      `docs/implementation-review-prompt.md` after the push. Report findings
      without changing the implementation.

### Milestone 2: Turborepo Task Graph With Local Caching

Install `turbo`, register the task graph, and switch the build scripts to it.
After this milestone every existing command works, repeated builds hit the
local cache, and hosted CI is unchanged except that it runs `turbo` with the
local cache only.

- [ ] Run `npm install --save-dev turbo` for the latest 2.x release and confirm
      `npm run dependencies:check` passes.
- [ ] Add `turbo.json` with the `$schema`, the task table, and the global
      settings. Keep `remoteCache.apiUrl` and `teamSlug` out until
      Milestone 4.
- [ ] Change the root scripts: `build` to `turbo run build:package`, a new
      `build:package`, and `prepare:verification` to `turbo run example:build`.
- [ ] Enumerate the environment variables that the viewer build, `copy-assets`,
      and the CLI example build read. List them in `env` or `passThroughEnv`.
      Prove the tasks pass under strict mode with
      `cargo xtask check --suite package`.
- [ ] Confirm the example-build input list: change one file in each candidate
      location (`examples/basic/specs`, `mokly.config.ts`, authored CSS under
      `generated`, and `src`) and check that
      `npx turbo run example:build --dry=json` changes the hash. Record the
      result in `ci-remote-cache.md`.
- [ ] Add `.turbo/` to `.gitignore` and confirm Prettier and ESLint ignore it
      through the existing gitignore integration.
- [ ] Add `tests/turbo_config.test.ts`. It parses `turbo.json`; asserts
      `agentGuidance === false`, `envMode === "strict"`,
      `remoteCache.signature === true`, and
      `futureFlags.longerSignatureKey === true`; asserts the `example:build`
      outputs equal the ignored generated patterns in `.gitignore`; and runs
      `npx turbo run example:build --dry=json` to assert the
      `@mokly/viewer#build`, `//#build:package`, `//#example:build` order with
      caching enabled.
- [ ] Update `tests/ci_workflow*.test.ts`, `tests/release*.test.ts`, and
      `tests/deployment.test.ts` where they assert script contents or workflow
      steps that change.
- [ ] Smoke test: `npm run build` twice shows `FULL TURBO` on the second run;
      `npm run prepare:verification` twice does the same; `npm run dev` serves
      the example; `cargo xtask check` passes with each later suite restoring
      preparation from the local cache.
- [ ] Confirm `turbo` did not write to `AGENTS.md` and that no `turbo` block
      exists there.
- [ ] Update the Delivery Status in `docs/protocol/ci-remote-cache.md` for the
      local task graph.
- [ ] Run `cargo xtask check`.
- [ ] Run `git add -A`, commit with Conventional Commits, and push.
- [ ] Review the complete local diff against `origin/main` with
      `docs/implementation-review-prompt.md` after the push. Report findings
      without changing the implementation.

### Milestone 3: Remote Cache Worker

Implement, test, and typecheck the Worker and its deployment workflow. Nothing
in CI uses it yet, so the product stays functional.

- [ ] Run `npm install --save-dev @cloudflare/workers-types` and confirm the
      dependency audit passes.
- [ ] Implement `scripts/turbo-cache/store.ts`: an `ArtifactStore` interface
      with `head`, `get`, and `putIfAbsent`, and the R2 adapter that uses
      `onlyIf` with `If-None-Match: *` and stores the tag and duration as
      custom metadata.
- [ ] Implement `scripts/turbo-cache/auth.ts`: bearer parsing, a constant-time
      comparison over UTF-8 bytes that works in Workers and Node, and token
      class resolution.
- [ ] Implement `scripts/turbo-cache/artifacts.ts`: the six routes, hash
      validation, the team check, response headers, 202 for already-present
      keys, and 403 for read-only writes.
- [ ] Implement `scripts/turbo-cache/worker.ts`: the `fetch` entry, routing,
      404 and 405 defaults, and JSON errors in the specification's error shape.
- [ ] Add `scripts/turbo-cache/wrangler.jsonc` with `name`, `main`,
      `compatibility_date`, the R2 binding, `TURBO_CACHE_TEAM`, and
      observability. Add `scripts/turbo-cache/tsconfig.json` with Workers
      types and add `tsc --project scripts/turbo-cache/tsconfig.json --noEmit`
      to `typecheck:prepared`.
- [ ] Add `tests/turbo_cache_worker.test.ts`, `tests/turbo_cache_auth.test.ts`,
      and `tests/turbo_cache_store.test.ts` with an in-memory store: status,
      head, get, put, write-once, read-only 403, missing and wrong token 401,
      wrong team 403, bad hash 400, query, events, method not allowed, and the
      header round trip for `x-artifact-tag` and `x-artifact-duration`.
- [ ] Add `.github/workflows/turbo-cache.yml` with `workflow_dispatch` and a
      `main` path filter. Validate the account and token like `preview.yml`.
      Deploy with
      `npx --no-install wrangler deploy --config scripts/turbo-cache/wrangler.jsonc`.
- [ ] Add `scripts/turbo-cache/README.md` with the runbook commands: bucket
      create, `wrangler r2 bucket lifecycle add` with a 30-day expiry,
      `wrangler secret put` for both tokens, deploy, and a curl smoke test.
- [ ] Keep every file under 300 lines and resolve ratchet findings for the new
      `scripts` modules.
- [ ] Local smoke: run
      `npx wrangler dev --config scripts/turbo-cache/wrangler.jsonc` with the
      local R2 simulation, then curl status, put, head, get, and a second put.
      Record the transcript in the README.
- [ ] Update the Delivery Status in `docs/protocol/ci-remote-cache-worker.md`.
- [ ] Run `cargo xtask check`.
- [ ] Run `git add -A`, commit with Conventional Commits, and push.
- [ ] Review the complete local diff against `origin/main` with
      `docs/implementation-review-prompt.md` after the push. Report findings
      without changing the implementation.

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
- [ ] Admin: create the `CLOUDFLARE_WORKERS_API_TOKEN` repository secret with
      Workers Scripts and Workers R2 Storage write permissions.
- [ ] Admin: generate the two Worker tokens and the signature key with
      `openssl rand -hex 32`.
- [ ] Admin: set the Worker secrets with `wrangler secret put`, then run the
      `turbo-cache.yml` workflow from this branch with `workflow_dispatch`.
      Record the Worker URL.
- [ ] Admin: add the repository secrets `TURBO_CACHE_TOKEN` (read-write) and
      `TURBO_CACHE_SIGNATURE_KEY`.
- [ ] Commit `remoteCache.apiUrl` and `remoteCache.teamSlug` in `turbo.json`.
- [ ] Add the `prepare` job to `ci.yml`. Add it to the `needs` of `package`,
      `unit`, `browser`, `hydration`, and `Required CI`. Add the token
      environment with an explicit unset-when-empty step so forks run without
      the remote cache.
- [ ] Set `TURBO_FORCE=true` and no token in `release.yml`. Add the token to
      the same-repository jobs in `preview.yml`. Leave the native jobs without
      a token.
- [ ] Update `tests/ci_workflow.test.ts` and the related workflow tests for the
      new job graph and environment.
- [ ] Verify fork behavior locally: run `npm run prepare:verification` with
      `TURBO_API` set and `TURBO_TOKEN` unset, and confirm `turbo` exits with
      code 0 and reports that remote caching is disabled.
- [ ] Verify the remote path locally: with the read-only token, delete
      `.turbo/cache`, run `npm run prepare:verification`, and confirm every
      task reports a remote cache hit after a CI run has filled the cache.
- [ ] Push and read the pull request run: `prepare` uploads three artifacts and
      the other ten jobs report cache hits. Record per-job durations before and
      after, and the R2 object count, in `docs/reviews/ci-remote-cache.md`.
- [ ] Update the Delivery Status sections and the Contract Owners documents to
      implemented.
- [ ] Run `cargo xtask check`.
- [ ] Run `git add -A`, commit with Conventional Commits, and push.
- [ ] Review the complete local diff against `origin/main` with
      `docs/implementation-review-prompt.md` after the push. Report findings
      without changing the implementation.

## Post-merge follow-up (non-blocking)

- Watch the first five `main` runs for remote cache errors in the `turbo` logs
  and in Worker observability.
- Rotate the read-only token and record the rotation date when the first
  external contributor receives it.
- Open a follow-up plan for cached test suites once the suite evidence
  contract defines replayed reports.
