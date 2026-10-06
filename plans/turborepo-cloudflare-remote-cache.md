# Turborepo Remote Cache On Cloudflare

Status: Active. Created on 2026-10-06. No pull request yet. Milestone 1 defines
the approved contract; its supervising-agent review remains open. Task caching
and the Worker are not implemented.

## Summary

Adopt Turborepo as the task runner for the npm build and preparation scripts.
Share its task cache through a self-hosted remote cache that runs on a
Cloudflare Worker with one R2 bucket. The repository owns the Worker, its
tests, and its deployment workflow. `cargo xtask check` stays the complete
gate; its existing npm preparation calls will run through `turbo`.

The change avoids repeated task execution in authorized hosted CI.
Today the package job, four unit shards, four browser shards, and the hydration
job each run `npm run prepare:verification` on an identical tree, so one pull
request runs the same build ten times. A Release Please pull request runs it
twenty times. After this change one prepare job builds and uploads the outputs,
and downstream suites restore unchanged tasks. Each suite still calls
preparation. Fork jobs build with local cache only. Developers get the same
local cache, including sharing between linked Git worktrees.

Baseline timings and output sizes are recorded in
`.context/turborepo-cloudflare-remote-cache/baseline-measurements.md`.

The [CI performance plan](./ci-performance.md) chose to build inside each job
because cross-job artifact transfer was unnecessary for the measured setup
cost. This plan replaces that one decision with a content-addressed cache. The
suite boundaries, shard evidence, and fail-closed aggregate stay unchanged.

## Decisions

| Topic          | Decision                                                                                                                                                         |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Task runner    | Turborepo 2.11.7 as a root `turbo` devDependency. npm workspaces and `package-lock.json` stay as they are.                                                       |
| Cached tasks   | `@mokly/viewer#build`, root `build:package`, and root `example:build`. Test suites are not cached by this plan.                                                  |
| Remote cache   | A Worker owned by this repository under `scripts/turbo-cache/`, storing artifacts in one R2 bucket. No Vercel account.                                           |
| Write policy   | Keys are write-once. Same-repository CI uses a read-write token. Developers use a read-only token. Fork pull requests get no token and use the local cache only. |
| Integrity      | `remoteCache.signature` is on with a key of at least 32 bytes. CI and read-only developers need the same key. Invalid downloads are rejected before extraction.  |
| Release        | `release.yml` forces task execution with `TURBO_FORCE=true`, local cache only, and no remote credentials. Force can refresh local entries.                       |
| Native CI jobs | The macOS and Windows jobs keep building from source with no remote token.                                                                                       |
| Agent guidance | `agentGuidance: false`, so `turbo` never edits `AGENTS.md`.                                                                                                      |
| Expiry         | An R2 lifecycle rule deletes artifacts after 30 days.                                                                                                            |
| Node in hashes | Exclude the Node version only after proving declared outputs match on Node 22.14 and Node 24. The prepare job must serve both Linux profiles.                    |
| Telemetry      | Disable Turbo telemetry at workflow scope in CI, preview, and release from Milestone 2. Developers can export `TURBO_TELEMETRY_DISABLED=1` or `DO_NOT_TRACK=1`.  |
| Team identity  | Configure `teamSlug: "mokly"` and leave `teamId` unset for every client. Rotate the team namespace when rotating the signature key.                              |

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
  current per-suite preparation and the planned restore contract, linked to
  the new task-cache owner without growing beyond 250 lines.
- [`docs/protocol/ci-workflow.md`](../docs/protocol/ci-workflow.md): the
  prepare job, job dependencies, token gating, and the release and native
  exceptions.
- [`docs/protocol/ci-verification-security.md`](../docs/protocol/ci-verification-security.md):
  the remote task cache next to the npm download cache, token classes, and
  fork behavior.
- [`docs/protocol/npm-release.md`](../docs/protocol/npm-release.md) and
  [`docs/protocol/npm-release-evidence.md`](../docs/protocol/npm-release-evidence.md):
  planned release builds bypass reads and never use the remote cache.
- [`docs/protocol/npm-preview-deployments.md`](../docs/protocol/npm-preview-deployments.md):
  same-repository preview builds may read and write the cache.
- [`docs/protocol/README.md`](../docs/protocol/README.md): index entries.
- [`xtask/README.md`](../xtask/README.md) and the root
  [`README.md`](../README.md): developer commands, `.turbo/`, and local
  remote-cache setup.
- Measurement record `docs/reviews/ci-remote-cache.md`, created in Milestone 4.

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
| `build` (viewer)   | `^build`              | `$TURBO_DEFAULT$`, `$TURBO_ROOT$/tsconfig.json`                             | `dist/**`                                                                                                                                                                             |
| `//#build:package` | `@mokly/viewer#build` | `src/**`, `scripts/copy-assets.mjs`, `tsconfig.json`, `tsconfig.build.json` | `dist/**`                                                                                                                                                                             |
| `//#example:build` | `//#build:package`    | `examples/basic/**` minus the generated outputs                             | `examples/basic/generated/**/*.html`, `examples/basic/generated/mokly-manifest.json`, `examples/basic/generated/example/workspace.svg`, `examples/basic/generated/mokly-generated/**` |

`package.json`, `turbo.json`, and package manager lockfiles are always task
inputs, even with explicit `inputs`. Viewer changes reach `//#build:package`
through its `@mokly/viewer#build` dependency hash, not an automatic viewer
global hash. The viewer's default inputs include `scripts/browser.mjs` and
`src/runtime.ts`, which `scripts/copy-assets.mjs` consumes directly. This
transitive contract avoids duplicate root globs. Its inherited root tsconfig
also needs the explicit input above. Example inputs exclude all four generated
output globs with `!`; explicit inputs do not inherit `.gitignore` filtering.

Global settings: `envMode: "strict"`, `agentGuidance: false`,
`noUpdateNotifier: true`, `ui: "stream"`, `cacheMaxAge: "14d"`,
`remoteCache: { enabled: true, signature: true, timeout: 30,
uploadTimeout: 60, preflight: false }`, and
`futureFlags: { longerSignatureKey: true }`. Do not set deprecated `daemon`
or explicit `cacheDir`; linked worktrees share the main worktree's cache.
`remoteCache.apiUrl` and `remoteCache.teamSlug` are committed once the Worker
URL exists. The URL is the origin without `/v8`; `teamId` stays unset.

Strict mode hides every environment variable that is not listed in `env`,
`passThroughEnv`, or the built-in system list. The example build runs the
built CLI. The [task contract](../docs/protocol/ci-remote-cache.md) defines
hashed `NODE_ENV` and terminal/warning pass-through variables. Milestone 2
audits dependency reads and verifies these do not hide output-changing inputs.

Cached product outputs must not depend on Git state, timestamps, random values,
or absolute checkout paths. Milestone 2 proves equality across paths and Node
versions before accepting that contract. Restore replaces archived files but
does not remove extra files from output directories (Milestone 2 verifies).
Historical `baselineBuild` still runs `npm ci` and the baseline's scripts:
`npm run build` can hit Turbo when that commit includes it, while the direct
`npm run example:build` still executes.

Cache sources per environment:

| Environment                                  | Local cache    | Remote read | Remote write |
| -------------------------------------------- | -------------- | ----------- | ------------ |
| Developer without both credentials           | yes            | no          | no           |
| Developer with read-only token and key       | yes            | yes         | no           |
| Same-repository pull request and `main` push | yes            | yes         | yes          |
| Fork pull request                            | yes            | no          | no           |
| Release workflow                             | forced rebuild | no          | no           |
| Native macOS and Windows jobs                | yes            | no          | no           |

Give approved developers the reader and signature key through a private
password-manager share; they set `TURBO_CACHE=local:rw,remote:r`. With either
value absent, leave both Turbo credentials unset and use `local:rw`. Builds
must pass with neither value. A short supplied key is a configuration error.

## Remote Cache Worker

The planned Worker implements API `v8` from the
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
- `hash` must match `^[a-fA-F0-9]{1,128}$`; anything else gets 400.
- The `slug` or `teamId` query value must equal the configured team; objects
  are keyed `<team>/<hash>`. Missing, duplicate, or different teams get 403.
  Validate both when both appear. The client sends team IDs only with `team_`.
- Write-once calls `R2Bucket.put` with
  `onlyIf: new Headers({ "If-None-Match": "*" })`. A failed condition returns
  `null`, not an exception; retain the winner and answer 202. Confirm this in
  production during Milestone 4 because local simulation may differ.
- Errors include flat `{code,message}` fields plus the matching
  `{error:{code,message}}` that the real client needs for 403. HEAD stays
  bodyless. The Worker never lists or deletes objects; lifecycle owns expiry.
- OpenAPI paths omit `/v8`; the 2.11.7 client supplies that prefix. Follow the
  actual client paths, including metadata headers omitted from the initial plan.
- Secrets: `TURBO_CACHE_READ_WRITE_TOKEN` and `TURBO_CACHE_READ_ONLY_TOKEN`.
  Binding: `ARTIFACTS` for bucket `mokly-turbo-cache`. Variable:
  `TURBO_CACHE_TEAM`.

Workers request bodies are capped at 100 MB on Free and Pro account plans.
Current artifacts are below 40 MB before compression. Standard R2's monthly
free tier covers 10 GB-month of storage, one million Class A operations, and
ten million Class B operations with free egress. The Worker contract also sets
explicit JSON, hash, metadata, and upload limits.

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
  `secrets.TURBO_CACHE_SIGNATURE_KEY`. Export both only when both exist and
  select `local:rw,remote:rw`; otherwise leave both unset and select `local:rw`.
  A fork receives no remote credentials. Hosted telemetry is disabled from
  Milestone 2, before this remote wiring.
- `release.yml` sets `TURBO_FORCE=true`, local cache only, and no credentials.
  Eligible same-repository preview jobs receive the pair. Native jobs do not.

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
- [x] Review the diff against `origin/main`, then `git add -A`, commit with
      Conventional Commits, and push.
- [ ] Review the complete local diff against `origin/main` with
      `docs/implementation-review-prompt.md` after the push. Report findings
      without changing the implementation.

Evidence files: `.context/turborepo-cloudflare-remote-cache/milestone-1-validation.md`
and `.context/turborepo-cloudflare-remote-cache/milestone-1-sources.md`.

### Milestone 2: Turborepo Task Graph With Local Caching

Install `turbo`, register the task graph, and switch the build scripts to it.
After this milestone every existing command works, repeated builds hit the
local cache. Hosted CI keeps the same jobs and local cache only, but disables
telemetry and forces release builds from the first Turbo use.

- [ ] Run `npm install --save-dev turbo` for the latest 2.x release and confirm
      it resolves 2.11.7 and `npm run dependencies:check` passes. If upstream
      changes before installation, reverify the schema and client contract.
- [ ] Add `turbo.json` with the `$schema`, the task table, and the global
      settings. Keep `remoteCache.apiUrl` and `teamSlug` out until
      Milestone 4.
- [ ] Preserve viewer default inputs, add its inherited root tsconfig input,
      and verify viewer helper/runtime edits invalidate `//#build:package`
      through the viewer dependency hash. Verify root tsconfig edits miss both.
- [ ] Change the root scripts: `build` to `turbo run build:package`, a new
      `build:package`, and `prepare:verification` to `turbo run example:build`.
- [ ] Add `turbo.json` to the fixed copy list in
      `tests/helpers/example_baseline.ts`. Test historical reconstruction in
      the isolated example repository after the root build script changes.
- [ ] Enumerate the environment variables that the viewer build, `copy-assets`,
      and the CLI example build read. List them in `env` or `passThroughEnv`.
      Prove the tasks pass under strict mode with
      `cargo xtask check --suite package`.
- [ ] Confirm the example-build input list: change one file in each candidate
      location (`examples/basic/specs`, `mokly.config.ts`, authored CSS under
      `generated`, and `src`) and check that
      `npx turbo run example:build --dry=json` changes the hash. Record the
      result in `ci-remote-cache.md`.
- [ ] Prove cached outputs depend only on declared inputs and hashed
      environment. Build from clean outputs at different times and after Git
      ref, commit, and dirty-state changes. Fix hidden inputs or disable the
      affected task's cache before accepting it.
- [ ] Build in two different absolute checkout paths and compare all three
      tasks' declared product outputs byte for byte, including maps and
      manifests. Prove Node 22.14 and Node 24 output equality before sharing
      hashes across the two Linux profiles.
- [ ] Verify restore with missing, corrupted, matching, and extra output files;
      preserve authored CSS. Confirm extra files are not removed (Milestone 2
      verifies). Keep clean consumers, mutation, startup, and Mokly cache tests
      independent under the task-cache contract; force execution when needed.
- [ ] Set workflow-scope `TURBO_TELEMETRY_DISABLED: "1"` in `ci.yml`,
      `preview.yml`, and `release.yml` before any hosted Turbo run. Set release
      `TURBO_FORCE=true` and local cache only now, not in Milestone 4. Update
      workflow assertions for these early changes.
- [ ] Prove `npm run build` and `npm run prepare:verification` pass with neither
      token nor key, using `TURBO_CACHE=local:rw` and both credentials unset.
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
      `onlyIf: new Headers({ "If-None-Match": "*" })`. Treat null as an
      existing-key result. Store duration, tag, SHA, and dirty hash atomically.
- [ ] Implement `scripts/turbo-cache/auth.ts`: bearer parsing, a constant-time
      comparison over UTF-8 bytes that works in Workers and Node, and token
      class resolution.
- [ ] Implement `scripts/turbo-cache/artifacts.ts`: the six routes, hash
      validation, the team check, response headers, 202 for already-present
      keys, and 403 for read-only writes.
- [ ] Implement `scripts/turbo-cache/worker.ts`: the `fetch` entry, routing,
      404 and 405 defaults, and flat plus wrapped error fields that meet both
      OpenAPI and the 2.11.7 client. Keep every HEAD response bodyless.
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
- [ ] Test the complete verified wire contract: PUT 202 `urls`, bare query
      maps with `taskDurationMs` and optional commit metadata, HEAD metadata,
      bodyless HEAD errors, status values, flat/wrapped 403 compatibility,
      missing/duplicate/both team parameters, JSON and upload limits, duration
      bounds, and optional headers. Do not require client-interactive headers.
- [ ] Test the R2 adapter binding call itself, including `Headers` in `onlyIf`,
      null on an existing object, no head-then-put guard, exceptions, and
      preservation of the first body and all metadata during concurrent PUTs.
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
      Keep the runbook in the README and the transcript under `.context/`.
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
      first deploy from this branch. Use `workflow_dispatch` if the workflow
      is already registered; otherwise use the documented pinned-Wrangler
      deploy command after its checks. A new dispatch-only workflow is not on
      the default branch yet. Record the Worker URL before merging.
- [ ] Admin: add the repository secrets `TURBO_CACHE_TOKEN` (read-write) and
      `TURBO_CACHE_SIGNATURE_KEY`.
- [ ] Admin: give approved developers the read-only token and signature key
      through a private password-manager share. Confirm `local:rw,remote:r`
      suppresses uploads and that a read-only token without a key cannot
      accept a signed download.
- [ ] Confirm production R2 conditional behavior: absent-key PUT succeeds,
      repeated and concurrent PUTs keep one complete body and its original
      metadata, and a failed condition returns null. Compare with local
      simulation; resolve any difference before enabling remote writes.
- [ ] Commit `remoteCache.apiUrl` and `remoteCache.teamSlug` in `turbo.json`.
- [ ] Add the `prepare` job to `ci.yml`. Add it to the `needs` of `package`,
      `unit`, `browser`, `hydration`, and `Required CI`. Add the token
      environment only when both secrets exist; otherwise leave both unset
      and use local cache only, including forks.
- [ ] Keep the forced release and telemetry settings from Milestone 2. Add the
      token/key pair to eligible same-repository preview jobs. Keep release
      and native jobs without remote credentials.
- [ ] Update `tests/ci_workflow.test.ts` and the related workflow tests for the
      new job graph and environment.
- [ ] Verify fork behavior locally: run `npm run prepare:verification` with
      the Worker URL configured, both credentials unset, and local cache only.
      Confirm exit 0 and no remote requests. Test either credential missing too.
- [ ] Verify the remote path in an isolated checkout with an empty private
      cache, the read-only token/key, and `local:rw,remote:r`. Confirm three
      remote hits after CI fills the cache. Do not delete a shared worktree cache.
- [ ] Smoke-test real signed round trips, rejected unsigned/invalid artifacts,
      response length, batch-to-HEAD fallback, and safe cache errors. Document
      access-token rotation and new-namespace signature-key rotation.
- [ ] Push and read the pull request run: `prepare` uploads three artifacts and
      ten downstream jobs (twenty for Release Please) report cache hits. Record
      per-job durations before and after, and the R2 object count, in
      `docs/reviews/ci-remote-cache.md`.
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
