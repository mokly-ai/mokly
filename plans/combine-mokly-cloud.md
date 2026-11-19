# Combine Mokly Cloud into the Mokly repository

Status: Active. On branch `calummoore/combine-mokly-cloud-into-repo-704s`, no pull request yet. The pull request that completes the work deletes this plan, as the `plans` skill says.

Mokly Cloud is the hosted companion of the open-source Mokly packages. It
publishes the catalogue of each branch, posts a GitHub check, and hosts the
viewer. It has an Expo app, an Electron desktop app, an Astro site, a
Cloudflare origin router, Rust API and store crates, Terraform, and Helm. It
lives in the private repository `mokly-ai/mokly-cloud`. This change moves all
of it into this public, MIT-licensed repository. After the change, there is
one Cargo workspace, one npm workspace, one `xtask`, one gate, and one CI. The
cloud uses the workspace packages and crates directly.

The change does not replace the cloud's Mokly contract types with the
`mokly-model` types. It does not rename the `mkc-` crates. It does not change
any product behaviour or screen. Follow-up items record the type merge.

## User decisions

On 2026-11-17, Cal chose these answers to the discussion in this workspace:

- Goal: remove the release-then-bump cost of changes that span both
  products, and stop the choice of the repository for each feature. The
  alternative goals, two repositories with less friction or a single
  co-located copy, were declined. The reason: open source is better, one
  repository is easier to work with, and desktop software must be open
  source.
- Direction: the private cloud moves into the public repository. The
  alternatives were a private monorepo with a public mirror, and two
  repositories with a canary npm tag.
- Layout: full unification. All crates join one Cargo workspace, and all
  npm projects join one npm workspace. The alternative was a `cloud/`
  subdirectory with its own workspaces. Cal allowed a separate prefix for
  some crates.
- History: one squashed import commit. The alternative was the full history
  under a subdirectory. A squash does not publish the old history, which
  holds about 124,000 secret-scanner hits, most of them in test fixtures.
- Consumption: the cloud uses the workspace packages and crates directly.
  The alternative was to keep exact pins on published npm releases. The
  cloud then deploys unreleased Mokly code from `main`.

On 2026-11-17, after the options check of the `plans` skill, Cal answered
the three open decisions. The check report is under
`.context/combine-cloud/`.

- License: AGPL-3.0 for the cloud paths, MIT for the rest. The
  alternatives were MIT for everything, MIT with a trademark policy, a
  source-available license for the cloud paths, and AGPL-3.0 for the whole
  repository. The options check recommended MIT with a trademark policy. A
  competing host of the cloud must publish its changes.
- Operational content: import everything as it is. The alternatives were
  to move the security follow-up items to private advisories, to keep the
  ops content in a private repository, to review every path before the
  push, to add a private reporting rule, and to fix the small known gaps
  first. The options check recommended the fixes first. Cal accepted that
  the ops pages, the infrastructure, and the follow-up items become public.
- Cloud work in flight: freeze cloud `main` now. Open cloud work moves to
  this repository after the merge. The alternatives were to land all open
  work first, to copy later commits by hand, and to re-run a path-map
  script before the merge. The options check recommended the script.

- Dependency audit, answered on 2026-11-17 (option B). A reviewed
  exception may also cover a production path that only the private
  `apps/*` projects reach, for 31 days at most. No published package may
  reach it. A follow-up item tracks the upgrade to Expo SDK 58. Rejected:
  upgrading Expo now, and holding the merge until the upstream fixes ship.
- Audit record kind, decided on 2026-11-17. Only a record with
  `kind: "private-app"` uses the private-app rule. A record without it keeps
  the dev-only rules, so a changed path cannot select the weaker rule in
  silence. npm leaves the `private` flag out of the lockfile, so each audit
  reads the workspace manifests, and the baseline comparison includes them.
- UI library, answered on 2026-11-17 (option A). The Mokly example moves to
  `@firna/ui` 4.0.0, so the repository has one `@firna/ui` version. Rejected:
  a second npm name for 4.0.0, and moving the cloud mockups into
  `apps/mockups`.
- Milestone order, answered on 2026-11-17 (option A). Plans in this
  repository follow the order of the shared `plans` skill. The cloud
  override that put documentation first is gone.
- Cloud freeze after the late merges, answered on 2026-11-19 (option A).
  Cloud `main` merged PR #136 and PR #132 after the freeze. Cal kept the
  freeze: nothing more merges into cloud `main`, and open cloud work moves
  here after the merge. Rejected: a GitHub ruleset that blocks merges into
  cloud `main`, and the end of the freeze with a port of each later commit.
- License of the cloud mockups, answered on 2026-11-19 (option B).
  `docs/mockups/` becomes an AGPL path, because its mockups import the AGPL
  tokens and app modules. Rejected: an MIT exception, MIT tokens, and a
  boundary check over every MIT path.
- Verification, instructed on 2026-11-19. Local runs cover the targeted
  tests only. The CI of the pull request runs the full suite.

## Design calls

Each call below is my call, made on 2026-11-17.

- Paths. Cloud crates move to `crates/` beside the Mokly crates. The npm
  projects `app`, `desktop`, `site`, `worker`, and `mockups` move from `ts/`
  to `apps/`. The private `tokens` library moves to `packages/tokens`. Cloud
  protocol docs move to `docs/protocol/cloud/`, because names such as
  `viewer.md` are ambiguous beside the Mokly docs. `docs/ops`, `docs/api`,
  `docs/mockups`, `infra/`, `rules/`, `fixtures/`, `sgconfig.yml`,
  `diesel.toml`, `docker-compose.yml`, and `mokly.config.json` keep their
  paths. Cloud scripts move to `scripts/cloud/`. The cloud architecture page
  moves to `docs/architecture/cloud.md`.
- License scope. `LICENSE` stays MIT and names the AGPL paths. The AGPL
  paths are `apps/`, the `mkc-` crates, `packages/tokens/`, `infra/`, and
  `scripts/cloud/`. Their manifests say `AGPL-3.0-only`. The `-only` form
  keeps the terms under the control of this repository. Docs, plans, and
  the cloud mockups stay MIT. The boundary rule below also keeps the MIT
  packages free of AGPL code.
- License text. Changed on 2026-11-17 during Milestone 2:
  `LICENSES/AGPL-3.0-only.txt` holds the AGPL-3.0 text once, instead of a
  copy in each AGPL path, because the `mkc-` crates alone would need 28
  copies.
- Crate names. The `mkc-` prefix stays, as Cal allowed. The two crates
  without a prefix become `mkc-email-interface` and `mkc-email-postmark`, so
  that every cloud crate has the prefix.
- Toolchain. The workspace uses Rust 1.98.1, the newer of the two pins. The
  Mokly crates publish no crate, so their minimum Rust version can rise.
  The npm pin becomes `npm@11.21.0`, the newer of the two pins.
- Boundary. Mokly is app-independent. No `mokly-*` crate depends on an
  `mkc-` crate. No package under `packages/` imports a project under `apps/`.
  A check enforces both rules. The cloud may depend on Mokly.
- Boundary, extended on 2026-11-17 after Milestone 1. MIT code never
  depends on AGPL code. This also covers `packages/tokens/` and `xtask`.
  The `stripe-catalogue` command of the cloud `xtask` therefore becomes a
  binary of a cloud crate, which `xtask` runs as a subprocess. The cloud
  imports only the documented exports of the Mokly packages and the public
  API of the Mokly crates.
- Native suite. The `mkc-` crates use Diesel with Postgres, which needs
  `libpq`. The hosted macOS and Windows native jobs build and test only the
  `mokly-*` crates and `xtask`. Linux runs every crate.
- Gate. The Mokly `xtask` is the base. Each cloud stage becomes a check in
  an existing Mokly suite or in a new cloud suite. The complete gate runs
  every suite. A cloud suite fails when its tool, such as Postgres, is
  missing, because Mokly suites reject skips.
- Cloud Rust suite, decided on 2026-11-17 after Milestone 1. The Repository
  suite formats every crate and runs Clippy on the `mokly-*` crates and
  `xtask`. A cloud Rust suite runs Clippy and the tests of the `mkc-`
  crates, which need `libpq` and Postgres. The Repository suite then runs on
  every host. The remote executor runs the cloud suites too. The cloud app
  suite accepts `--shard`, as the cloud CI splits it into four jobs.
- Public CI. Fork pull requests never get secrets, preview environments, or
  cloud deploy credentials. Deploy and preview jobs run only for `main` and
  for pull requests from branches of this repository. Only a push to the
  protected `main` branch, or a manual run from `main`, deploys production,
  as in the cloud repository today. The jobs use no approval environment.
- Deploy trigger. Every push to `main` runs the cloud deploy, because a
  change under `packages/` changes the hosted viewer.
- React. One React version serves the viewer and the cloud app, so that the
  app has one React instance. Expo and React Native set the upper bound. On
  2026-11-17 the workspace pinned React 19.2.3 exactly, the version that the
  React Native 0.85.3 renderer of the cloud app needs. Mokly develops with
  React 19.3.0 today. Its packages accept every React 19.
- React Native libraries. On 2026-11-17 the root pinned `react-native`
  0.85.3. The cloud projects adopted the versions that the Mokly lockfile
  already resolved for the shared React Native, Lucide, Playwright, `tsx`,
  `yaml`, `sharp`, and Node type packages, so that each has one copy. Each
  step is a patch or minor step inside the React Native 0.85 range.
  Under user decision 3A the repository installs one `@firna/ui`, 4.0.0,
  at the root. The root also declares `lucide-react`, which Firna's web
  controls import, so the Mokly example does not rely on a cloud manifest
  for it. `packages/tokens` declares the
  React Native peers of `@firna/ui` as dev dependencies, so that npm does
  not resolve a newer `react-native` for it.
- Root scripts. The cloud root scripts `mockups:*`, `emails:*`, and `site:*`
  keep their names at the root, because Mokly has no script with those
  names. Only the colliding names change: `typecheck` becomes
  `cloud:typecheck`, `test` becomes `cloud:test`, and `ci:install` becomes
  `npm ci`.
- Published docs. The `@mokly/mokly` npm package leaves out
  `docs/protocol/cloud/`.
- Contract fixtures. `cargo xtask mokly-fixtures` regenerates the contract
  fixtures from the workspace build, not from installed npm releases. The
  drift check stays.
- Cloud commits after the snapshot. Decided on 2026-11-19. Cloud `main`
  merged PR #136 (`767be7b2`) and PR #132 (`55972c86`) on 2026-11-18, after
  the freeze. Milestone 2a ports both to the combined paths. Production
  probably runs #132 and its migration, so a deploy from this repository
  without it would remove the desktop grant API.
- Runners. Decided on 2026-11-19, at the merge of `main`. On 2026-11-18 the
  user moved every CI job to GitHub-hosted standard runners, in `main` PR
  #342. The cloud jobs follow that decision: the `check`, `images`, and
  `site-lighthouse` jobs of `ci.yml` run on `ubuntu-24.04`, and the macOS
  rows of `desktop-release.yml` run on `macos-26`.
- Release Please scope. Decided on 2026-11-19. Release Please 17.6.0, which
  the release workflow pins, matches excluded directories only. The
  configuration excludes each cloud directory. Shared root files, such as
  the cloud workflows, root tool configurations, and the AGPL license text,
  count for the Mokly release like every other root file. Rejected: moving
  those files into excluded directories, because the workflows cannot move,
  and patching Release Please.

## Contract owners

- `docs/protocol/repository-layout.md`, a new page for the combined layout
  and the boundary rule. Milestone 1 creates it.
- [CI verification](../docs/protocol/ci-verification.md) and
  [CI workflow](../docs/protocol/ci-workflow.md).
- [Developer test commands](../docs/protocol/developer-test-commands.md).
- [Verification ratchets](../docs/protocol/verification-ratchets.md).
- The [xtask README](../xtask/README.md), the root
  [README](../README.md), and [AGENTS.md](../AGENTS.md).

## Replaced ways

- Exact pins on published `@mokly/*` npm releases → workspace packages.
  Consumers: `ts/app`, `ts/site`, `ts/mockups`, and `ts/package.json`; the
  `toolchain-pins` stage; the `mokly-fixtures` stage; the cloud rules in its
  `AGENTS.md`; the cloud protocol pages on artifact compatibility and fixture
  regeneration; the open cloud follow-up items about Mokly releases. Moved
  in Milestone 4. Deleted in Milestone 4.
- The cloud `xtask` and its 25 stages → suites of the Mokly `xtask`.
  Consumers: the cloud CI, deploy, and preview workflows; the cloud README
  and docs that name a stage. Moved in Milestone 6. Deleted in Milestone 6.
- The `ts/` npm workspace and its lockfile → the root npm workspace.
  Consumers: every cloud script, workflow, Dockerfile, and doc that runs
  `npm --prefix ts`. Moved in Milestone 4. Deleted in Milestone 4.
- The `mokly-ai/mokly-cloud` repository → this repository. Consumers: the
  Workload Identity Federation condition in Terraform, the GitHub App, the
  repository secrets and environments, the links in docs, and the Conductor
  repository list. Moved in Milestones 7 and 8. Archived after the merge.

## Milestone 1: Documentation and protocol

Depends on: none

The combined layout, the boundary rule, and the combined gate get their
contracts before the code moves. Each new or changed page starts with a
status line that links this plan, until the behaviour exists.

- [x] Add `docs/protocol/repository-layout.md`: the paths of the design
      calls, the `mkc-` prefix rule, and the boundary rule.
- [x] Update `docs/protocol/ci-verification.md`,
      `docs/protocol/ci-workflow.md`, and
      `docs/protocol/developer-test-commands.md` for the cloud suites, the
      Linux-only cloud crates, and the fork rule.
- [x] Update the root `README.md` and `AGENTS.md` for the combined product.
      Move the cloud rules for one area into the README or the protocol doc
      next to that area, as the `agents-md` skill says.

## Milestone 2: Import the snapshot

Depends on: 1

The cloud snapshot lands at its final paths. This repository is public, so
the first push of an imported file publishes it, as Cal decided.

- [x] Freeze cloud `main`. The snapshot is commit `6d5163d6` of
      `mokly-ai/mokly-cloud`.
- [x] Copy the snapshot to the paths of the design calls. Leave out the
      cloud `.git`, `Cargo.lock`, `ts/package-lock.json`, and the root files
      that this repository already has.
- [x] Merge `.gitignore`, `.prettierignore`, and `.dockerignore`.
- [x] Apply the license scope of the design calls. Add the AGPL text,
      update `LICENSE` and the README, and set `license` in each
      cloud `Cargo.toml` and `package.json`. Keep the third-party notices,
      such as `crates/mkc-domain/data/github-reserved-names-LICENSE` and
      the license of the Inter font under `docs/mockups/styles/fonts/`.
- [x] Run the secret scan again over the imported paths. Save the report
      under `.context/combine-cloud/`.

## Milestone 2a: Port the cloud changes after the snapshot

Depends on: 2

Cloud `main` moved past the snapshot after the freeze. Each later cloud
commit moves to the combined paths, so that no merged cloud change is lost.

- [x] Port cloud commit `767be7b2`, PR #136: the neutral Graphite tokens of
      dark Folio. Branch: `conductor/combine-mokly-cloud-port-cloud-commits`.
- [x] Port cloud commit `55972c86`, PR #132: desktop sign-in through the
      browser, with the `desktop_grants` migration and its lock entry.
      Branch: `conductor/combine-mokly-cloud-port-cloud-commits`.
- [x] Before the pull request merges, confirm that cloud `main` has no commit
      after the last ported commit. Port each new commit in the same way.
      Branch: `conductor/combine-mokly-cloud-port-cloud-commits`.

## Milestone 3: One Cargo workspace

Depends on: 2

- [x] Merge the workspace `Cargo.toml`: members, `[workspace.dependencies]`,
      `[workspace.lints]`, resolver 3, and Rust 1.98.1 in
      `rust-toolchain.toml` and `rust-version`.
- [x] Rename `email-interface` and `email-postmark` to `mkc-email-interface`
      and `mkc-email-postmark`, with every use.
- [x] Merge `.cargo/config.toml`. Keep the `target/xtask` target directory
      of the Mokly alias.
- [x] Regenerate `Cargo.lock`. Run `cargo build --workspace`,
      `cargo clippy --workspace --all-targets`, and `cargo test` for each
      crate.
- [x] Move the ast-grep rules and `sgconfig.yml` so that they scan the
      `mkc-` crates. Decide in this TODO whether they also scan the
      `mokly-*` crates, and record the call. Decided on 2026-11-17: the
      three Rust rules apply only to `crates/mkc-*`, because the
      `mokly-*` crates have 1,677 findings of the cloud import style and
      their own style passes Clippy and review. The TypeScript rules stay
      limited to `apps/app/src`.

## Milestone 4: One npm workspace

Depends on: 2

- [x] Add `apps/*` and `packages/tokens` to the root `workspaces`. Remove
      `ts/package.json` and its lockfile. Move its scripts to the root
      `package.json` under a `cloud:` prefix.
- [x] Replace each exact `@mokly/*` pin of a cloud project with the
      workspace package. Add the cloud manifests to the Release Please
      `extra-files` when a pin must follow the release version.
- [x] Choose one React version for the viewer, the UI package, and the
      app. Check that the app bundle holds one React copy.
- [x] Merge `.prettierrc.json` and `eslint.config.js`. Keep the Astro plugin
      and the Mokly intrinsic-element rule for `packages/viewer/src`.
- [x] Move the Mokly example to `@firna/ui` 4.0.0, so the cloud mockups
      resolve the one installed version.
- [x] Let reviewed audit exceptions cover production paths that only the
      private `apps/*` projects reach. Add the follow-up item for Expo SDK 58.
- [x] Make the cloud build of the app, the site, the mockups, and the
      desktop bundle use the built workspace packages. Make
      `cargo xtask mokly-fixtures` read the workspace build.
- [x] Regenerate `package-lock.json`. Run `npm ci`, `npm run build`, and the
      type check of each cloud project.

## Milestone 5: Docs, plans, and repository rules

Depends on: 2

- [x] Fix every moved path and every link to `mokly-ai/mokly-cloud` in the
      docs, the READMEs, the follow-up items, and the scripts.
- [x] Merge the cloud plans and follow-up items into `plans/`. Rewrite each
      item whose subject the replaced ways remove.
- [x] Split each imported TypeScript or JavaScript file over 300 lines,
      except generated files, which the length audit excludes by path. Split
      each protocol page over 250 lines, or add its exact cap to
      `xtask/protocol-document-caps.json`.
- [x] After the `@firna/ui` move, rewrite the cloud pages, READMEs, and
      runbooks that still require published Mokly releases and pin bumps,
      such as `docs/protocol/cloud/mockups.md`,
      `mokly-artifact-compatibility.md`, `repository-typescript.md`,
      `desktop-app.md`, and `docs/ops/mokly-release-cutover.md`, for
      workspace use.
- [x] Extend `tests/markdown_links.test.ts` to every Markdown file that the
      old cloud check read, such as the legal pages of `apps/site`, with
      the root-route rule for site links.
- [x] Run `npm test -- tests/markdown_links.test.ts`, `npm run format:check`,
      `npm run lint`, and `cargo xtask source-file-length-lint`.

## Milestone 6: One xtask and one gate

Depends on: 3, 4, and 5

- [x] Port each cloud stage to the Mokly `xtask`. Put format, Clippy, Rust
      tests, whitespace, links, Prettier, and ESLint into the existing
      suites. Add cloud suites for the rest: migrations, the app, mockups,
      the site, OpenAPI, fixtures, email templates, Terraform, the origin
      router, Helm, infrastructure, and desktop.
- [x] Limit the native suite on macOS and Windows to the `mokly-*` crates
      and `xtask`.
- [x] Add the boundary check of the design calls to the Repository suite.
- [x] Move the `stripe-catalogue` command into a binary of a cloud crate.
- [x] Make the remote executor run the cloud suites. Allow `--shard` for
      the cloud app suite.
- [x] Delete the cloud `xtask`. Keep every Rust file at 300 lines or fewer.
- [x] Run `cargo xtask check`. Save the result under
      `.context/combine-cloud/`.

## Milestone 7: One CI

Depends on: 6

- [x] Port the cloud workflow contract tests of the old cloud `xtask`
      (`tests/cli/` at `6d5163d6`: `ci_capacity`, `deployment_*`,
      `desktop_*`, `origin_router_workflow`, `preview_*`, and `workflow`
      tests) with the workflows they read. Keep every assertion.
- [x] Merge the cloud `ci.yml` jobs and `preview.yml` into the Mokly
      workflows. Add `deploy.yml`, `foundation.yml`, `site.yml`, and
      `desktop-release.yml`. Make `Required CI` require the cloud jobs.
- [x] Apply the public CI rule of the design calls to every job that reads
      a secret or requests an OIDC token. Test the guard with a fork
      pull request event fixture.
- [x] Set `ELECTRON_SKIP_BINARY_DOWNLOAD=1` in every CI job that does not
      run Electron, and move that rule to the CI workflow pages.
- [x] Leave `docs/protocol/cloud/` out of the `@mokly/mokly` package.
- [x] Scope Release Please to the published packages. Keep the cloud
      projects out of the changelog and the version bump.
- [x] Run the cloud jobs of `ci.yml` and the desktop release builds on
      GitHub-hosted standard runners, as `main` PR #342 requires.
- [x] Change the repository and the workflow paths in the Workload Identity
      Federation condition of `infra/terraform/modules/github`, and in its
      contract tests.

## Milestone 8: Cutover before the merge

Depends on: 7

Each TODO needs an operator with owner access. The agent prepares the
commands and the checklist. The
[repository cutover runbook](../docs/ops/repository-cutover.md) gives each
step, its command, and its check.

- [ ] Copy the repository secrets, the variables, and the `production` and
      preview environments, with their protection rules, to this
      repository.
- [ ] Apply the Terraform change of Milestone 7, so that Google Cloud trusts
      both repositories during the cutover.
- [ ] Point the GitHub App and the preview environments at this repository.
- [ ] Add the cloud services to the Conductor repository setup of this
      repository.

## Milestone 9: Verification, commit, review, and pull request

Depends on: every other milestone

The merge of `main` on 2026-11-19 records its conflict resolutions in
`.context/combine-cloud/merge-main-2026-11-19.md`.

- [ ] Run the targeted tests. The CI of the pull request runs the
      complete gate.
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

- [ ] Set `MKC_CLOUD_CUTOVER_ENABLED` to `true`. Watch the first deploy from
      `main` of this repository through to production.
- [ ] Remove the old repository from the Terraform trust condition.
- [ ] Move the open cloud pull requests #133, #107, and #88 to this
      repository, or close them. Do this before the archive, because an
      archived repository is read-only.
- [ ] Archive `mokly-ai/mokly-cloud`. Point its README at this repository.
- [ ] Remove the cutover-only trust code: the legacy repository input,
      `MKC_LEGACY_REPOSITORY_ID`, and `infra/terraform/modules/github/moved.tf`.
- [ ] Replace the cloud's own Mokly contract types in `mkc-mokly-contract`
      with the `mokly-model` types.
