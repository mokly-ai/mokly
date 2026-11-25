# Serve the web app from Cloudflare

Status: Active. On branch `calummoore/gcp-project-cost-v2-3foo`, no pull request yet. The pull request that completes the work deletes this plan, as the `plans` skill says.

The Mokly Cloud web app is the static Expo web export of `packages/app`. Today
a Node file server in its own GKE workload, `app`, serves it: two pods in each
stable environment and one in each PR preview. Each pod requests the Autopilot
minimum of 0.25 vCPU and 0.5 GiB, about 10 USD a month, so the four stable pods
cost about 40 USD a month. Every app request already passes through the
Cloudflare origin router Worker (`apps/worker`), which then proxies it to
`app-origin.<domain>`, the Google load balancer and the pod.

This change deploys each environment's build to a Cloudflare Pages project,
`mokly-app`, points the router at it, and deletes the `app` workload. The
browser behaviour stays the same: the same hosts, routes, Content Security
Policy, cache headers, `/_health` and `/_config`. The `api` and `catalogue`
workloads and the Google load balancer do not change. The change also stops
PR jobs from running PR code with the Pages token, for the site and the
Mokly preview as well as the app.

User decisions:

- 2026-11-25, Cal: move the app off GKE to Cloudflare ("cloudflare is a better
  platform for it if its just static files"). The alternative was to keep the
  GKE workload and cut replicas.
- 2026-11-25, Cal: decision 1, option E, a Pages project with a top-level
  `404.html`, with the PR deploy-job fix. The agent first recommended A, R2
  buckets read by the router; the user preferred Cloudflare's own branch
  previews and less router code.

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
- The revision check moves from pod startup to the release: a release deploys
  a build only when its `build-config.json` names the release revision, and
  the smoke check reads `/_config` and asserts the revision.
- `infra/docker/app-build-config.mjs` stays: the build and the desktop bundle
  both use it. It moves to `packages/app/scripts/`.
- An operator creates the `mokly-app` Pages project, as for `mokly-site`.
  Terraform owns no Pages project. Its production branch is `production`; the
  branch aliases are `main-preview` and `pr-N`. Reason: the site's model, and
  `main` stays free for no environment.
- The build writes the headers into Pages' `_headers` file and writes
  `_health`, `_config` and an empty `404.html` as files. Reason: Pages then
  serves every rule from the build, and the router only maps hosts and turns
  an extensionless 404 into the app document.

Contract owners:

- [Web application](../docs/protocol/cloud/web-app.md).
- [Origin router](../docs/protocol/cloud/origin-router.md).
- [PR previews](../docs/protocol/cloud/pr-preview-environments.md) and
  [preview scripts](../docs/protocol/cloud/preview-scripts.md).
- [Deployment smoke checks](../docs/protocol/cloud/deployment-smoke-checks.md).
- The [worker README](../apps/worker/README.md), the
  [chart README](../infra/helm/mokly-cloud/README.md), the
  [site README](../apps/site/README.md) and the
  [infra README](../infra/README.md).

Replaced ways:

- The `app` GKE workload, its image and its Node server → builds on the
  `mokly-app` Pages project that the router serves at the same public hosts.
  Consumers, each moved or deleted in the milestone named:
  - Chart: `Deployment/app`, `Service/app`, `BackendConfig/app`,
    `HorizontalPodAutoscaler/app`, `PodDisruptionBudget/app`,
    `ServiceAccount/app`, `NetworkPolicy/app`, the app ingress host, the GFE
    rule for the app port, `mkc.appEnv`, the `app.env` validation, the
    `app:` values, the `wait-for-api` image, the goldens and the Helm tests
    (`check.py`, `namespace_contract.py`, `network_contract.py`,
    `build_contract.py`, `runtime_settings.py`). Milestone 8.
  - Scripts: `build-app.sh`, `build-release.sh`, `push-images.sh`,
    `check-image.sh`, `smoke-images.py`, `render-values.py`,
    `environment.sh` (`MKC_INTERNAL_APP_HOST`), `rollout.sh` (app host
    `-checkhost` and the reset quiesce), `preview-deploy.sh`, `smoke.py`.
    Milestones 4, 5, 6 and 8.
  - Workflows: `deploy.yml` (`build`, `publish`, `plan-*`,
    `release-*`), `preview.yml` (`build`, `release`), `ci.yml` (`images`).
    Milestones 4, 5 and 6.
  - Worker: the app-origin proxy, the unprovisioned-PR pass-through and their
    tests. Milestone 7.
  - Terraform: the `app` record in `modules/dns` and its test, `hosts.app` in
    `environment`, and their destructive approvals. Milestone 8.
  - Desktop: the CSP contract test and the export table that read
    `app-server.mjs`. Milestone 4.
  - Tests: `test_app_server.py`, `test_release.py`, `test_domain_layout.py`,
    `test_rollout.py`, `test_smoke.py`, `test_namespace_init.py`, and the
    `xtask` CLI tests that name the app image or `check-image.sh`.
    Milestones 4 to 8.
  - Docs: the pages under Milestone 1 and the runbooks under Milestone 8.
  - Old way: `infra/docker/app.Dockerfile`, its `.dockerignore` and
    `infra/docker/app-server.mjs`. Deleted in Milestone 8.
- PR jobs that run PR code with the Pages token → a build job without the
  token and a deploy job that runs only base-branch code. Consumers: the
  `deploy-pr` jobs of `site.yml` and `preview.yml`, and the new app preview
  deploy. Milestone 3.

## Decisions

### 1. How Cloudflare holds each environment's build

Answered 2026-11-25 by Cal: E, with the PR deploy-job fix (Milestone 3). The
item stays as the record of the options.

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
- **Recommendation:** A, at the time. The router reads every build through a
  binding, so no build has a public address, and each switch is one strongly
  consistent write. On 2026-11-25 the agent changed its view to E with the PR
  deploy-job fix, which needs less code and matches the site.
- **Action:** answered by the user: E.

### 2. How the release switches from GKE to Cloudflare

- **Severity:** Medium. **Effort:** Small.
- **Source:** Design.
- **Category:** Process.
- **Location:** `.github/workflows/deploy.yml`, `apps/worker/src/index.ts`.
- **Background:** One push to `main` deploys the router Worker early in the
  run, then main-preview, then production after main-preview passes. Each
  environment's Helm release replaces its pods.
- **Problem:** The new router meets production before the production build
  exists on Pages, because the `origin-router` job runs beside `publish`,
  before the releases. If the router has no fallback, production loses the
  app until `release-production` deploys its build.
- **Impact if no action:** Production serves no app for 10 to 20 minutes on
  the merge that ships this change. The last five Deploy runs took 11 to 18
  minutes from the router deploy to the end of `release-production`.
- **Root question:** How does each environment serve an app build that
  matches its released API at every step of the deploy that moves it, also
  when that release rolls back? (The options check replaced "keep serving",
  which admitted a version skew and left out the failure path.)
- **Options:**
  - **A.** One pull request. The router keeps the app-origin proxy as a
    fallback while an environment has no Pages deployment. Each release
    deploys its build before its Helm rollout removes the app pods. A
    follow-up item removes the fallback and the app-origin DNS records after
    production serves from Pages. Cost: the fallback stays on `main` until
    the follow-up merges. PR previews from before the merge and
    unprovisioned PRs still reach it, and Milestone 8 deletes the DNS record
    that it needs 1 to 3 minutes before each release. Effort: Small.
  - **B.** Two pull requests. The first adds the Pages serving and switches
    each environment while the GKE app keeps running. The second deletes the
    GKE app, the fallback and the records. Cost: the pods run until the
    second merge, and the work needs a second workspace. Effort: Small.
  - **C.** One pull request with no fallback. The `publish` job deploys both
    builds, and `origin-router` waits for `publish`. Cost: production then
    runs the new app against the old API until `release-production`, about
    10 to 20 minutes, or until the next production release when main-preview
    fails. Effort: Small.
  - **D.** Seed the deployed builds first (added by the options check).
    `publish` reads each stable environment's revision from `/_config`,
    exports `dist` from its kept `app:release-<revision>-<environment>`
    image and deploys it to the environment's branch, and `origin-router`
    waits for `publish`. The router needs no fallback. Cost: the seed step
    stays on `main` until a follow-up deletes it. Effort: Medium.
  - **E.** Two pull requests with no fallback (added by the options check).
    The first adds the builds, the Pages deploys and the restore, and leaves
    the router and the GKE app unchanged. The second switches the router and
    deletes the GKE app, the proxy and the `app-origin` records, after a run
    of the first has released both stable environments. Cost: the GKE pods
    run until the second merge, and the work needs a second workspace.
    Effort: Small.
- **Left out:** A maintenance window with production promotion paused: it
  adds an operator step and still needs one of A to C for the order.
- **Wider fix:** None.
- **Previous examples:** None found.
- **Recommendation:** E. The router never reads a build that does not exist
  yet, so E needs no fallback, no seed and no version skew, and nothing
  temporary stays on `main`. (The first pass recommended A, whose fallback
  the check found that real requests reach.)
- **Action:** ask the user, because A keeps a converter on `main` until a
  follow-up, which the `plans` skill leaves to the user, and B and C trade it
  against later savings or a version skew.

Under E, Milestones 7 and 8 wait for the first merge, so they move to a
follow-up item for a second branch before work starts, and this plan ends
with Milestones 1 to 6 and 9.

## Milestone 1: Documentation and protocol

Depends on: none

State the new hosting requirements. Each page that describes behaviour that
later milestones build gets a status line that links that milestone.

- [ ] `docs/protocol/cloud/web-app.md`: a Pages project serves the export at
      `/` with the same fallback, 404, health, config and cache rules; the
      revision check moves to the release.
- [ ] `docs/protocol/cloud/origin-router.md`: the router serves app paths from
      the environment's `mokly-app` branch in place of the app-origin proxy,
      and an unprovisioned PR gets the router's no-store 404.
- [ ] `docs/protocol/cloud/viewer.md`: the CSP header comes from the build's
      `_headers` file, not the static server.
- [ ] `docs/protocol/cloud/marketing-site.md`, `pr-preview-environments.md`,
      `preview-scripts.md`, `deployment-smoke-checks.md`,
      `repository-verification.md`: drop the app workload, the internal app
      host and the app image.
- [ ] `docs/protocol/cloud/desktop-app.md`, `desktop-bundle.md`,
      `desktop-distribution.md`: name the build configuration writer and the
      Pages-served `/_config` in place of the app image.
- [ ] `docs/architecture/cloud.md`: the app row.
- [ ] Run `npm run format:check` and `npm test -- tests/markdown_links.test.ts`.

## Milestone 2: Verify Pages behaviour

Depends on: none

Settle the open points of option E before the build and the router depend on
them. This needs a Cloudflare Pages token, so the user or an operator runs
the deploys, or grants a temporary secret. Save the results under
`.context/app-on-cloudflare/`.

- [ ] Create a scratch Pages project. Deploy one real build with `404.html`,
      `_headers`, `_health` and `_config` to its production branch and to a
      `pr-1` branch.
- [ ] Record, for both aliases: the status and body for a missing asset, a
      missing extensionless path and `/index.html`; every header that Pages
      adds; whether `_headers` sets the CSP, the cache headers and the JSON
      type of `_health` and `_config`; whether Pages adds `noindex` to branch
      aliases.
- [ ] Record whether a branch alias can roll back to an earlier deployment,
      whether direct uploads count against the plan's deploy limit, and the
      export's file count against the 20,000-file limit.
- [ ] Delete the scratch project.
- [ ] Update this plan for each result that differs from its design.

## Milestone 3: PR Pages deploys run no PR code with the token

Depends on: none

- [ ] Split the `deploy-pr` jobs of `.github/workflows/site.yml` and
      `.github/workflows/preview.yml` into a build job without the Pages token
      and a deploy job that checks out the base branch, downloads only the
      build artifact, and runs the base branch's pinned
      `wrangler pages deploy --branch pr-N`.
- [ ] Keep production branch deploys in `main` jobs only.
- [ ] Update `docs/ops/secrets.md`, the site README and the `xtask`
      workflow tests.
- [ ] Narrow `plans/follow-ups/pr-jobs-hold-account-pages-token.md` to its
      wider fix, option C.

## Milestone 4: Pages build in place of the app image

Depends on: 1 and 2

Build each environment's app as a Pages-ready folder, not a container image.

- [ ] Move `infra/docker/app-build-config.mjs` to `packages/app/scripts/` and
      update `packages/desktop/scripts/build.mjs` and the
      `desktop-release.yml` path filter.
- [ ] Replace `infra/scripts/build-app.sh` with a build that writes
      `.context/app/<environment>/`: the export, `build-config.json`,
      `_config`, `_health`, an empty `404.html`, and a `_headers` file with
      the CSP from `build-config.json`, `X-Content-Type-Options`, `immutable`
      for hashed files, `no-cache` for others and `no-store` for `_health`
      and `_config`. `build-release.sh` builds one per environment.
- [ ] Move the build-config cases of `infra/tests/test_app_server.py` and the
      archive cases of `test_release.py` to the new build, with cases for the
      generated `_headers`.
- [ ] Move the desktop CSP contract test and export table to the `_headers`
      generator.
- [ ] Remove the app image from `check-image.sh` and the `cloud-infrastructure`
      suite, and add the Pages build to the suite. Update the `xtask` CLI
      tests that name the app image.

## Milestone 5: Stable releases deploy to Pages

Depends on: 2 and 4

The router and the GKE app do not change yet.

- [ ] Document the operator step in `docs/ops/deploy.md`: create the
      `mokly-app` project with production branch `production`.
- [ ] `deploy.yml`: `release-main-preview` deploys the main-preview build to
      branch `main-preview`, and `release-production` deploys the production
      build to `production`, each before its Helm rollout. Only these `main`
      jobs hold the token.
- [ ] `rollout.sh`: when it restores the previous Helm release after a failed
      upgrade or smoke check, it also restores the previous Pages deployment
      of that branch, by the method that Milestone 2 found.
- [ ] `render-values.py` reads `MKC_*APP_CONFIG` for the API settings outside
      the app loop.
- [ ] `smoke.py`: the environment's Pages alias answers `/_config` with the
      release revision and passes the app-served and boot-asset checks.
      Update `test_smoke.py`.

## Milestone 6: PR previews deploy to Pages

Depends on: 3 and 4

- [ ] `preview.yml`: the token-free build job builds the `pr-N` app build,
      and the deploy job of Milestone 3 deploys it to branch `pr-N` of
      `mokly-app` before the Helm release.
- [ ] Preview destroy deletes the branch's deployments, as
      `scripts/cloud/site/cleanup.sh` does for the site.
- [ ] Update `test_lifecycle.py` and the preview workflow `xtask` tests.

## Milestone 7: Router serves the Pages builds

Depends on: 5 and 6

- [ ] Map each public host to its alias: `D` to `mokly-app.pages.dev`,
      `br-<branch>.preview.D` to `<branch>-preview.mokly-app.pages.dev`, and
      `pr-N.preview.D` to `pr-N.mokly-app.pages.dev`, with the project name
      as a Worker variable in `render-wrangler.mjs`.
- [ ] Serve the app document at `/` when an extensionless path returns 404,
      strip the headers that Milestone 2 found Pages adds, and rewrite
      `pages.dev` targets in `Location`, `Content-Location` and `Link` to the
      public host.
- [ ] Return the router's no-store 404 for a PR alias with no deployment.
- [ ] Replace the app-origin proxy tests with Pages fetch tests. Keep the
      routing, rewrite and noindex tests.
- [ ] Update `apps/worker/README.md`.

## Milestone 8: Delete the GKE app

Depends on: 7

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

## Milestone 9: Verification, commit, review, and pull request

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

- [ ] Confirm that production and main-preview serve the app from Pages and
      that no `app` pod runs in either namespace.
- [ ] Remove the manual cache-bypass rule for the `app-origin*` hosts that
      `infra/terraform/README.md` describes.
- [ ] Check the GKE cost after a week against the 16-pod baseline of
      2026-11-25.
