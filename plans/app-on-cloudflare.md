# Serve the web app from Cloudflare

Status: Active. On branch `calummoore/gcp-project-cost-v2-3foo`, no pull request yet. The pull request that completes the work deletes this plan, as the `plans` skill says.

The Mokly Cloud web app is the static Expo web export of `packages/app`. Today
a Node file server in its own GKE workload, `app`, serves it: two pods in each
stable environment and one in each PR preview. Each pod requests the Autopilot
minimum of 0.25 vCPU and 0.5 GiB, about 10 USD a month, so the four stable pods
cost about 40 USD a month. Every app request already passes through the
Cloudflare origin router Worker (`apps/worker`), which then proxies it to
`app-origin.<domain>`, the Google load balancer and the pod.

This change serves the app from Cloudflare and deletes the `app` workload. The
browser behaviour stays the same: the same hosts, routes, Content Security
Policy, cache headers, `/_health` and `/_config`. The `api` and `catalogue`
workloads, the Google load balancer and the marketing site do not change.

User decisions:

- 2026-11-25, Cal: move the app off GKE to Cloudflare ("cloudflare is a better
  platform for it if its just static files"). The alternative was to keep the
  GKE workload and cut replicas.

Design calls (agent, 2026-11-25):

- Keep the repository variables `MKC_APP_CONFIG`, `MKC_MAIN_PREVIEW_APP_CONFIG`
  and `MKC_PRODUCTION_APP_CONFIG`. They carry the API's `github`, `billing` and
  `builds` settings as well as the app's origin assertions. `render-values.py`
  reads them outside the app workload. Reason: no operator change for a
  variable rename.
- The catalogue's preview `wait-for-api` init container runs on the app image
  today only because it needs Node. It moves to a digest-pinned
  `node:<NODE_VERSION>-bookworm-slim` image in the chart values, as the PR
  Postgres image is pinned. Reason: smallest change; the script stays.
- The revision check moves from pod startup to the deploy: each release
  writes a build only when its `build-config.json` names the release
  revision, and the smoke check reads `/_config` and asserts the revision.
- `infra/docker/app-build-config.mjs` stays: the build and the desktop bundle
  both use it. It moves to `packages/app/scripts/`.

Contract owners:

- [Web application](../docs/protocol/cloud/web-app.md).
- [Origin router](../docs/protocol/cloud/origin-router.md).
- [PR previews](../docs/protocol/cloud/pr-preview-environments.md) and
  [preview scripts](../docs/protocol/cloud/preview-scripts.md).
- [Deployment smoke checks](../docs/protocol/cloud/deployment-smoke-checks.md).
- The [worker README](../apps/worker/README.md), the
  [chart README](../infra/helm/mokly-cloud/README.md) and the
  [infra README](../infra/README.md).

Replaced ways:

- The `app` GKE workload, its image and its Node server → builds that Cloudflare
  serves at the same public hosts. Consumers, each moved or deleted in the
  milestone named:
  - Chart: `Deployment/app`, `Service/app`, `BackendConfig/app`,
    `HorizontalPodAutoscaler/app`, `PodDisruptionBudget/app`,
    `ServiceAccount/app`, `NetworkPolicy/app`, the app ingress host, the GFE
    rule for the app port, `mkc.appEnv`, the `app.env` validation, the
    `app:` values, the `wait-for-api` image, the goldens and the Helm tests
    (`check.py`, `namespace_contract.py`, `network_contract.py`,
    `build_contract.py`, `runtime_settings.py`). Milestone 7.
  - Scripts: `build-app.sh`, `build-release.sh`, `push-images.sh`,
    `check-image.sh`, `smoke-images.py`, `render-values.py`,
    `environment.sh` (`MKC_INTERNAL_APP_HOST`), `rollout.sh` (app host
    `-checkhost` and the reset quiesce), `preview-deploy.sh`, `smoke.py`.
    Milestones 2, 5, 6 and 7.
  - Workflows: `deploy.yml` (`build`, `publish`, `plan-*`,
    `release-*`), `preview.yml` (`build`, `release`), `ci.yml` (`images`).
    Milestones 2, 5 and 6.
  - Worker: the app-origin proxy, the unprovisioned-PR pass-through and their
    tests. Milestones 3 and 7.
  - Terraform: the `app` record in `modules/dns` and its test, `hosts.app` in
    `environment`, and their destructive approvals. Milestone 7.
  - Desktop: the CSP contract test and the export table that read
    `app-server.mjs`. Milestone 3.
  - Tests: `test_app_server.py`, `test_release.py`, `test_domain_layout.py`,
    `test_rollout.py`, `test_smoke.py`, `test_namespace_init.py`, and the
    `xtask` CLI tests that name the app image or `check-image.sh`.
    Milestones 2 to 7.
  - Docs: the pages under Milestone 1 and the runbooks under Milestone 7.
  - Old way: `infra/docker/app.Dockerfile`, its `.dockerignore` and
    `infra/docker/app-server.mjs`. Deleted in Milestone 7.

## Decisions

### 1. How Cloudflare holds each environment's build

- **Severity:** Medium. **Effort:** Medium.
- **Source:** Design.
- **Category:** Code structure.
- **Location:** `apps/worker/src/index.ts`, `.github/workflows/deploy.yml`,
  `.github/workflows/preview.yml`.
- **Terms:**
  - **Build:** the `dist` folder of `npm run build:web --workspace @mokly-cloud/app`
    plus `build-config.json`, which names the app origin, the API origin, the
    catalogue base domain and the revision.
  - **R2:** Cloudflare's object storage. A Worker reads it through a binding.
- **Background:** The API origin is baked into the browser bundle at build
  time, so production, main-preview and each labelled PR need their own
  build. Production and main-preview also switch builds at different times:
  main-preview at its release job, production after main-preview passes.
  Only `main` may deploy the router Worker, and PR workflows never deploy
  it. The marketing site already uses a Pages project, `mokly-site`, with
  `pr-N` branch aliases.
- **Problem:** One Worker version holds one set of static assets, so the
  router cannot simply bundle "the app" as Workers assets.
- **Impact if no action:** The app stays on GKE at about 40 USD a month for
  the stable pods, plus one pod for each open preview.
- **Root question:** Where does each environment's build live, and what
  serves it, so that each public host gets its environment's current build,
  each release switches its own environment and restores it when its rollout
  fails, and only trusted `main` jobs can write a stable build? (The options
  check replaced the first question, which left out the restore and the
  writers.)
- **Options:**
  - **A.** One R2 bucket for stable builds and one for preview builds. A
    release uploads its build under `<environment>/<revision>/` and then
    writes `<environment>/current` with the revision. The router reads the
    pointer and serves the object, with the SPA fallback, the 404 for a
    missing asset, the CSP that it computes from `build-config.json`, the
    cache headers and `/_health` and `/_config`. A closed PR deletes its
    prefix, and a failed release writes the old pointer back. Cost: the
    router gains about 150 lines that port `app-server.mjs`, with tests.
    Each request makes two R2 reads, with no edge cache, inside the free
    10 million reads a month. Uploads need an S3 client, because tokens
    scoped to one bucket work only with the S3 API. Old revision prefixes
    need pruning. Effort: Medium.
  - **B.** A Pages project, `mokly-app`, with a branch deployment per
    environment: production on the production branch, `main-preview` and
    `pr-N` as aliases. The router fetches `<alias>.mokly-app.pages.dev`. A
    generated `_headers` file sets the CSP and cache headers. Cost: without
    a top-level `404.html`, Pages serves `index.html` with status 200 for any
    missing path, so a missing hashed asset no longer returns 404, which
    changes a requirement of Web application. Each alias is also public at
    `pages.dev`. Effort: Medium.
  - **C.** One Worker with static assets per environment: `mkc-app-production`,
    `mkc-app-main-preview`, and `mkc-app-pr-N` created on label and deleted
    on close. The router reaches the stable ones through service bindings and
    the PR ones through their `workers.dev` URLs. Cost: a Worker per open PR,
    public `workers.dev` URLs, and preview workflows that create and delete
    Workers. Creating a Worker needs an account-level Workers Admin token,
    which can also replace the router. Effort: Medium.
  - **D.** Workers Static Assets with Previews (added by the options check).
    `mkc-app-production` and `mkc-app-main-preview` hold their builds as
    assets, with a small script (`run_worker_first: true`) that ports
    `app-server.mjs`. The router binds both. `publish` uploads a version,
    each release deploys it, and `wrangler rollback` restores. A third
    Worker, `mkc-app-preview`, holds each PR build as a Preview
    (`wrangler preview --name pr-N`), which the router fetches at
    `pr-N-mkc-app-preview.<subdomain>.workers.dev`. Cost: that fetch is
    unverified, because Cloudflare returns error 1042 for some
    Worker-to-Worker fetches. PR builds are public on `workers.dev`. Effort:
    Medium.
  - **E.** B with a top-level `404.html` (added by the options check). Pages
    then returns 404 for every missing path, and the router serves `/` when
    an extensionless path returns 404, so every Web application rule holds.
    Cost: Pages tokens have no project scope, and the existing PR deploy jobs
    run PR code with the Pages token, so PR code could replace the production
    app. Pages also deletes deployments older than 30 days outside the newest
    100, adds `Access-Control-Allow-Origin: *`, and makes production public at
    `mokly-app.pages.dev`. Effort: Medium.
- **Left out:**
  - One build for every environment, with origins read at run time from the
    host: it breaks the "baked origins" requirement of Web application.
  - Keep the app on GKE with fewer replicas: the user chose Cloudflare.
  - All builds as assets of the router under path prefixes: only `main`
    deploys the router, early in each run, so it can hold no PR build and
    would switch production before its release.
  - A Pages project behind a router service binding: service bindings reach
    only Workers.
  - A Workers for Platforms dispatch namespace: it costs 25 USD a month, most
    of the saving.
  - A Google Cloud Storage bucket that the router reads: the user chose
    Cloudflare.
- **Wider fix:** None. This chooses a hosting model; no defect class.
- **Previous examples:** `mokly-site` on Pages with `pr-N` aliases
  (`.github/workflows/site.yml`).
- **Recommendation:** A. The router reads every build through a binding, so
  no build has a public address. No Worker-to-Worker fetch can meet error 1042. Each switch is one strongly consistent write, which a failed release
  can write back. D is the strongest alternative if a short spike verifies
  its fetch and its token rights. (The first pass also recommended A, for the
  reason that it keeps every Web application rule, which C, D and E also do.)
- **Action:** ask the user, because every option needs new Cloudflare
  resources and credentials, and A, D and E trade router code against
  unverified Worker fetches or a Pages token that PR code can use.

### 2. How the release switches from GKE to Cloudflare

- **Severity:** Medium. **Effort:** Small.
- **Source:** Design.
- **Category:** Process.
- **Location:** `.github/workflows/deploy.yml`, `apps/worker/src/index.ts`.
- **Background:** One push to `main` deploys the router Worker early in the
  run, then main-preview, then production after main-preview passes. Each
  environment's Helm release replaces its pods.
- **Problem:** With every option of decision 1, the new router meets
  production before the production build exists in Cloudflare, because the
  `origin-router` job runs beside `publish`, before the releases. If the router
  has no fallback, production loses the app until `release-production`
  writes its build.
- **Impact if no action:** Production serves no app for 10 to 20 minutes on
  the merge that ships this change. The last five Deploy runs took 11 to 18
  minutes from the router deploy to the end of `release-production`.
- **Root question:** How does each environment serve an app build that
  matches its released API at every step of the deploy that moves it, also
  when that release rolls back? (The options check replaced "keep serving",
  which admitted a version skew and left out the failure path.)
- **Options:**
  - **A.** One pull request. The router keeps the app-origin proxy as a
    fallback while an environment has no build pointer. Each release writes
    its pointer before its Helm rollout removes the app pods. A follow-up
    item removes the fallback and the app-origin DNS records after
    production serves from Cloudflare. Cost: the fallback stays on `main`
    until the follow-up merges. PR previews from before the merge and
    unprovisioned PRs still reach it, and Milestone 7 deletes the DNS record
    that it needs 1 to 3 minutes before each release. Effort: Small.
  - **B.** Two pull requests. The first adds the Cloudflare serving and
    switches each environment while the GKE app keeps running. The second
    deletes the GKE app, the fallback and the records. Cost: the pods run
    until the second merge, and the work needs a second workspace. Effort:
    Small.
  - **C.** One pull request with no fallback. The `publish` job writes both
    pointers, and `origin-router` waits for `publish`. Cost: production then
    runs the new app against the old API until `release-production`, about
    10 to 20 minutes, or until the next production release when main-preview
    fails. Effort: Small.
  - **D.** Seed the deployed builds first (added by the options check).
    `publish` reads each stable environment's revision from `/_config`,
    exports `dist` from its kept `app:release-<revision>-<environment>`
    image, uploads it and writes the pointer, and `origin-router` waits for
    `publish`. The router needs no fallback. Cost: the seed step stays on
    `main` until a follow-up deletes it. Effort: Medium.
  - **E.** Two pull requests with no fallback (added by the options check).
    The first adds the builds, the uploads, the pointer writes and the
    restore, and leaves the router and the GKE app unchanged. The second
    switches the router and deletes the GKE app, the proxy and the
    `app-origin` records, after a run of the first has released both stable
    environments. Cost: the GKE pods run until the second merge, and the work
    needs a second workspace. Effort: Small.
- **Left out:** A maintenance window with production promotion paused: it
  adds an operator step and still needs one of A to C for the order.
- **Wider fix:** None.
- **Previous examples:** None found.
- **Recommendation:** E. The router never reads a build that does not exist
  yet, so E needs no fallback, no seed and no version skew, and nothing
  temporary stays on `main`. It works with every option of decision 1. (The
  first pass recommended A, whose fallback the check found that real requests
  reach.)
- **Action:** ask the user, because A keeps a converter on `main` until a
  follow-up, which the `plans` skill leaves to the user, and B and C trade it
  against later savings or a version skew.

## Milestone 1: Documentation and protocol

Depends on: none

State the new hosting requirements. Each page that describes behaviour that
later milestones build gets a status line that links that milestone.

- [ ] `docs/protocol/cloud/web-app.md`: Cloudflare serves the export at `/`
      with the same fallback, 404, health, config and cache rules; the
      revision check moves to the release.
- [ ] `docs/protocol/cloud/origin-router.md`: the router serves app paths
      from the environment's build in place of the app-origin proxy, and an
      unprovisioned PR gets the router's no-store 404.
- [ ] `docs/protocol/cloud/viewer.md`: the CSP header comes from the router,
      not the static server.
- [ ] `docs/protocol/cloud/marketing-site.md`, `pr-preview-environments.md`,
      `preview-scripts.md`, `deployment-smoke-checks.md`,
      `repository-verification.md`: drop the app workload, the internal app
      host and the app image.
- [ ] `docs/protocol/cloud/desktop-app.md`, `desktop-bundle.md`,
      `desktop-distribution.md`: name the build configuration writer and the
      router-served `/_config` in place of the app image.
- [ ] `docs/architecture/cloud.md`: the app row.
- [ ] Run `npm run format:check` and `npm test -- tests/markdown_links.test.ts`.

## Milestone 2: Static build in place of the app image

Depends on: 1

Build each environment's app as a static archive, not a container image.

- [ ] Move `infra/docker/app-build-config.mjs` to `packages/app/scripts/` and
      update `packages/desktop/scripts/build.mjs` and the
      `desktop-release.yml` path filter.
- [ ] Replace `infra/scripts/build-app.sh` with a build that writes
      `.context/app/<environment>/` (the export and `build-config.json`).
      `build-release.sh` builds one per environment.
- [ ] Move the build-config cases of `infra/tests/test_app_server.py` and the
      archive cases of `test_release.py` to the new build.
- [ ] Remove the app image from `check-image.sh` and the `cloud-infrastructure`
      suite, and add the static build to the suite. Update the `xtask` CLI
      tests that name the app image.

## Milestone 3: Router serves app builds

Depends on: 2 and decision 1

Option A of decision 1 is assumed below. Another choice rewrites this
milestone and Milestones 4 to 6 before work starts. Under option E of
decision 2, this milestone and Milestone 7 move to the second pull request,
and the plan splits before work starts.

- [ ] Bind the stable and preview buckets in `render-wrangler.mjs` and
      `wrangler.test.json`.
- [ ] Serve app paths from `<environment>/<revision>/` through the
      `<environment>/current` pointer: existing files, the `index.html`
      fallback for extensionless paths, 404 for a missing asset, 400 and 405
      as today, `/_health`, `/_config`, the CSP from `build-config.json`,
      `X-Content-Type-Options`, and `immutable` or `no-cache`.
- [ ] Keep the app-origin proxy only for an environment without a pointer,
      as decision 2 option A says.
- [ ] Port the request cases of `test_app_server.py` to `apps/worker/tests/`.
      Keep the routing, rewrite and noindex tests.
- [ ] Move the desktop CSP contract test and export table to the router's CSP
      function.
- [ ] Update `apps/worker/README.md`.

## Milestone 4: Cloudflare storage

Depends on: decision 1

- [ ] Add the two buckets to foundation Terraform, with contract tests. Keep
      the rule that Terraform owns no Worker resource.
- [ ] Give `preview.yml` its own GCP service account in
      `infra/terraform/modules/github/main.tf`. Today it shares
      `mkc-github-deploy` with `deploy.yml`, so it could read a stable token.
- [ ] Add Secret Manager IDs for a stable-bucket write token (deploy
      identity only) and a preview-bucket write token (preview identity
      only), with IAM. A preview token cannot write the stable bucket.
- [ ] Document the operator steps in `docs/ops/deploy.md`: enable R2, add R2
      rights to `mkc-cloudflare-foundation-token` and
      `mkc-cloudflare-plan-token`, create the two bucket-scoped tokens, and
      add the secret versions.

## Milestone 5: Stable releases upload and switch

Depends on: 2, 3 and 4

- [ ] `deploy.yml`: `publish` uploads the main-preview and production builds;
      `release-main-preview` and `release-production` write their pointers
      before the Helm rollout. Drop the app image digests.
- [ ] `rollout.sh`: when it restores the previous Helm release after a
      failed upgrade or smoke check, it also writes the previous pointer back.
- [ ] Prune revision prefixes older than the current and previous release.
- [ ] `render-values.py` reads `MKC_*APP_CONFIG` for the API settings outside
      the app loop.
- [ ] `smoke.py`: `/_config` names the release revision; keep the app-served,
      boot-asset and preview-root checks. Update `test_smoke.py`.

## Milestone 6: PR previews upload and clean up

Depends on: 2, 3 and 4

- [ ] `preview.yml` and `preview-deploy.sh`: upload `pr-N/<revision>/` to the
      preview bucket and write `pr-N/current` before the Helm release.
- [ ] Preview destroy deletes the `pr-N/` prefix.
- [ ] Update `test_lifecycle.py` and the preview workflow `xtask` tests.

## Milestone 7: Delete the GKE app

Depends on: 5 and 6

- [ ] Delete the `app` DNS record in `modules/dns`, with entries in
      `infra/terraform/environment/destructive-approvals/<environment>.json`.
- [ ] Delete the chart resources and values listed under Replaced ways, move
      `wait-for-api` to the pinned Node image, regenerate the goldens, and
      update the Helm tests and `infra/helm/mokly-cloud/README.md`.
- [ ] Delete `infra/docker/app.Dockerfile`, its `.dockerignore`,
      `infra/docker/app-server.mjs` and the app part of `smoke-images.py`.
- [ ] Update `environment.sh`, `rollout.sh` and their tests.
- [ ] Update `docs/ops/deploy.md`, `environment.md`, `production.md`,
      `secrets.md`, `preview.md`, `infra/README.md`,
      `infra/terraform/README.md`, `packages/app/README.md` and
      `packages/desktop/README.md`.
- [ ] Update `plans/follow-ups/legacy-app-host-records-unverified.md`,
      `closed-pr87-records-need-reconciliation.md` and
      `electron-skip-download-setting-may-be-dead.md`, which name the old
      server or image.
- [ ] Add the follow-up item that decision 2 names, when option A or D
      applies.

## Milestone 8: Verification, commit, review, and pull request

Depends on: every other milestone

- [ ] Run the targeted tests and the complete gate named in `AGENTS.md`.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the fix rule: fix the `fix now` findings, record
      follow-up items under `plans/follow-ups/` for the rest, re-review
      once, and report.
- [ ] Delete this plan when the `plans` skill says, under "Deleting the
      plan".
- [ ] Open the pull request. Its description gives the decisions and the
      design calls of this plan with their dates, a permalink to this plan,
      and the follow-up items that the change adds.

## Post-merge follow-up (non-blocking)

- [ ] Confirm that production and main-preview serve the app from
      Cloudflare and that no `app` pod runs in either namespace.
- [ ] Remove the manual cache-bypass rule for the `app-origin*` hosts that
      `infra/terraform/README.md` describes.
- [ ] Check the GKE cost after a week against the 16-pod baseline of
      2026-11-25.
