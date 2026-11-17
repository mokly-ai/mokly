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
- Crate names. The `mkc-` prefix stays, as Cal allowed. The two crates
  without a prefix become `mkc-email-interface` and `mkc-email-postmark`, so
  that every cloud crate has the prefix.
- Toolchain. The workspace uses Rust 1.98.1, the newer of the two pins. The
  Mokly crates publish no crate, so their minimum Rust version can rise.
  The npm pin becomes `npm@11.21.0`, the newer of the two pins.
- Boundary. Mokly is app-independent. No `mokly-*` crate depends on an
  `mkc-` crate. No package under `packages/` imports a project under `apps/`.
  A check enforces both rules. The cloud may depend on Mokly.
- Native suite. The `mkc-` crates use Diesel with Postgres, which needs
  `libpq`. The hosted macOS and Windows native jobs build and test only the
  `mokly-*` crates and `xtask`. Linux runs every crate.
- Gate. The Mokly `xtask` is the base. Each cloud stage becomes a check in
  an existing Mokly suite or in a new cloud suite. The complete gate runs
  every suite. A cloud suite fails when its tool, such as Postgres, is
  missing, because Mokly suites reject skips.
- Public CI. Fork pull requests never get secrets, preview environments, or
  cloud deploy credentials. Deploy and preview jobs run only for `main` and
  for pull requests from branches of this repository. Production deploys
  keep their GitHub environment protection.
- Deploy trigger. Every push to `main` runs the cloud deploy, because a
  change under `packages/` changes the hosted viewer.
- React. One React version serves the viewer and the cloud app, so that the
  app has one React instance. Expo and React Native set the upper bound.
- Contract fixtures. `cargo xtask mokly-fixtures` regenerates the contract
  fixtures from the workspace build, not from installed npm releases. The
  drift check stays.

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
  repository secrets and environments, the links in docs, and the Conductive
  repository list. Moved in Milestones 7 and 8. Archived after the merge.

## Open decisions

The options check of the `plans` skill ran over these decisions on
2026-11-17. It added options and changed each recommendation. Its report is
under `.context/combine-cloud/`.

### 1. License of the cloud code

- **Severity:** High. **Effort:** Small.
- **Source:** Design.
- **Category:** Process.
- **Location:** `LICENSE`; `license = "UNLICENSED"` in the cloud
  `Cargo.toml`; `"license": "MIT"` in the cloud `ts/site/package.json` and
  `ts/worker/package.json`.
- **Background:** This repository has one MIT `LICENSE`. The cloud has no
  license file, and its manifests disagree. A public import puts the cloud
  under the license that the repository gives it. A license cannot be taken
  back from code that is already public. The cloud also adds the Mokly logos
  to this repository. A code license does not cover a name or a logo. Cal is
  the only human author of both repositories, and there is no contributor
  agreement.
- **Problem:** No decision says which terms cover the cloud code and the
  Mokly brand.
- **Impact if no action:** The import cannot start. The MIT default applies
  without a recorded choice.
- **Root question:** Which use of the public cloud code and of the Mokly
  brand must stay reserved for the hosted business, if any?
- **Options:**
  - **A.** MIT for the whole repository. Anyone may host a competing cloud
    from the code. Effort: Small.
  - **B.** AGPL-3.0 for the cloud paths, MIT for the rest. A competing host
    must publish its changes. Each contributor must know which license
    covers a path. Effort: Small.
  - **C.** A source-available license, such as FSL-1.1 that becomes MIT
    after two years, for the cloud paths. It must leave out the desktop app
    and the app that it loads, because desktop software must be open
    source. Effort: Small.
  - **D.** A, plus a `TRADEMARKS.md` policy. A line in `LICENSE` and the
    README keeps the Mokly name and logos out of the MIT grant. A competing
    host must use its own brand. Effort: Small.
  - **E.** AGPL-3.0 for the whole repository, the published packages
    included. Users who embed the CLI or the viewer in closed tools may
    leave. Releases that are already published stay MIT. Effort: Small.
- **Left out:** A private repository fails the user decision on direction.
  A permissive license with a patent grant, such as Apache-2.0, is a
  variant of A, not a separate approach.
- **Wider fix:** None, because this is a one-time choice.
- **Previous examples:** None found.
- **Recommendation:** D, changed from A by the options check. It keeps one
  code license, as the goal needs, and it protects the brand, which a
  competing host cannot replace. B best protects the hosted code.
- **Action:** ask the user, because a license choice is a business decision
  that the agent cannot make.

### 2. Operational content in public

- **Severity:** High. **Effort:** Medium.
- **Source:** Design.
- **Category:** Security.
- **Location:** `docs/ops/`, `infra/`, and `plans/follow-ups/` in
  `mokly-ai/mokly-cloud`. The options-check report under
  `.context/combine-cloud/` gives the exact lines.
- **Background:** A secret scan of the cloud tree found only test fixtures.
  Some ops pages and some infrastructure settings give detail that helps an
  attacker reach the service past its protection. Some cloud follow-up
  items describe open security gaps and an unconfirmed secret rotation.
  This repository has no `SECURITY.md`, and its reviews write security
  findings into public follow-up items.
- **Problem:** Public detail can let an attacker get past the protection of
  the service, or find an open gap. New findings after the merge will
  also be public.
- **Impact if no action:** The first push of the branch publishes this
  detail. It cannot be taken back.
- **Root question:** How does the public repository keep detail that an
  attacker can use against the running service private, at the import and
  after it?
- **Options:**
  - **A.** Import everything as it is. Effort: Small.
  - **B.** Before the import, move each follow-up item that describes an
    open security gap to a private GitHub security advisory. Import the
    rest. Effort: Small.
  - **C.** Do B. Also keep the ops runbooks and the environment values of
    Terraform and Helm in a small private operations repository. Deploys
    then need a second checkout. Effort: Medium.
  - **D.** Do B. Also review every imported path before the first push:
    ops pages, protocol pages, infrastructure, plans, and code comments.
    Remove the detail that helps an attacker. Move the items about
    unconfirmed rotations. Effort: Medium.
  - **E.** Do D. Also add `SECURITY.md`, turn on private vulnerability
    reporting, and add a rule to `AGENTS.md`: a security finding on the
    deployed cloud goes to a private advisory, not to a public follow-up
    item or a pull request body. Effort: Medium.
  - **F.** Do E. Before the first push, also fix the small known gaps in
    the cloud repository, as the report lists them. Confirm or rotate the
    preview GitHub App secrets. Hide only what is left. It changes infrastructure during the
    migration. Effort: Medium.
- **Left out:** Fixing every security gap before the import fails the goal,
  because it blocks the move for an unknown time. F fixes only the small,
  known gaps.
- **Wider fix:** E, changed from C by the options check. It also covers the
  findings that arrive after the merge.
- **Previous examples:** `plans/follow-ups/checkout-persisted-credentials.md`
  is a public security item in this repository.
- **Recommendation:** F, changed from B by the options check. B leaves
  public detail that helps an attacker while the gaps are open. E is the
  fallback if no infrastructure change may happen before the import.
- **Action:** ask the user, because the choice sets what becomes public,
  and that cannot be undone.

### 3. Cloud work during the migration

- **Severity:** Medium. **Effort:** Medium.
- **Source:** Design.
- **Category:** Process.
- **Location:** Cloud `main`, the open pull requests #133, #132, #107, #93,
  and #88, and 46 cloud branches that are not merged, in
  `mokly-ai/mokly-cloud`.
- **Background:** The import copies one commit of the cloud `main`.
  Milestones 2 to 8 take days. Cloud `main` is active: #134 and #135 merged
  on 2026-11-17. Pull request #132 changes 196 files, and #107 and #88
  conflict with `main`. Cal wrote all the open work.
- **Problem:** Cloud work that merges after the snapshot does not reach this
  repository. A freeze at the start also blocks production fixes for the
  whole migration.
- **Impact if no action:** Work is lost, or it merges into a repository that
  is about to be archived.
- **Root question:** Where does cloud work happen between the snapshot and
  the cutover, and how do its changes reach this repository?
- **Options:**
  - **A.** Freeze cloud `main` now. Open work moves to this repository after
    the merge. Effort: Small.
  - **B.** Land or close the open pull requests and branches, then freeze
    cloud `main` and take the snapshot. Effort: Medium.
  - **C.** Take the snapshot now. Before the merge, import each later cloud
    commit again by hand as a path-mapped patch. Effort: Medium.
  - **D.** Write the path map of the design calls once, as a script. The
    script makes the first import. Before the merge, the script runs again
    on the latest cloud `main`, and the difference lands as one commit.
    Cloud work continues until a short freeze for the final sync. Changes
    to the merged manifests and the renamed crates need manual fixes.
    Effort: Medium.
- **Left out:** New cloud work on this branch has no deploy path before
  Milestone 8, so it ships no sooner than under A.
- **Wider fix:** D. It brings over every later commit, whatever its
  content.
- **Previous examples:** None found.
- **Recommendation:** D, changed from B by the options check. Cloud `main`
  stays live for fixes, and the freeze is short.
- **Action:** ask the user, because the choice sets when cloud work must
  stop.

## Milestone 1: Documentation and protocol

Depends on: none

The combined layout, the boundary rule, and the combined gate get their
contracts before the code moves. Each new or changed page starts with a
status line that links this plan, until the behaviour exists.

- [ ] Add `docs/protocol/repository-layout.md`: the paths of the design
      calls, the `mkc-` prefix rule, and the boundary rule.
- [ ] Update `docs/protocol/ci-verification.md`,
      `docs/protocol/ci-workflow.md`, and
      `docs/protocol/developer-test-commands.md` for the cloud suites, the
      Linux-only cloud crates, and the fork rule.
- [ ] Update the root `README.md` and `AGENTS.md` for the combined product.
      Move the cloud rules for one area into the README or the protocol doc
      next to that area, as the `agents-md` skill says.

## Milestone 2: Import the snapshot

Depends on: 1, and the answers to decisions 1, 2, and 3

The cloud snapshot lands at its final paths. This repository is public, so
the first push of an imported file publishes it. Do not push a commit of
this milestone before decision 2 is applied.

- [ ] Apply the cloud-side part of decision 2 in `mokly-ai/mokly-cloud`
      first, when the chosen option has one.
- [ ] Write the path map of the design calls as a script under
      `scripts/cloud/`. It copies a cloud commit to its final paths and
      leaves out the cloud `.git`, `Cargo.lock`, `ts/package-lock.json`, and
      the root files that this repository already has.
- [ ] Take the snapshot as decision 3 says. Record its commit in this plan.
- [ ] Merge `.gitignore`, `.prettierignore`, and `.dockerignore`.
- [ ] Apply decision 1 to `LICENSE`, to `license` in `Cargo.toml`, and to
      every cloud `package.json`. Keep the third-party notices, such as
      `crates/mkc-domain/data/github-reserved-names-LICENSE` and the license
      of the Inter font under `docs/mockups/styles/fonts/`.
- [ ] Apply the import part of decision 2 to the snapshot.
- [ ] Run the secret scan again over the imported paths. Save the report
      under `.context/combine-cloud/`.

## Milestone 3: One Cargo workspace

Depends on: 2

- [ ] Merge the workspace `Cargo.toml`: members, `[workspace.dependencies]`,
      `[workspace.lints]`, resolver 3, and Rust 1.98.1 in
      `rust-toolchain.toml` and `rust-version`.
- [ ] Rename `email-interface` and `email-postmark` to `mkc-email-interface`
      and `mkc-email-postmark`, with every use.
- [ ] Merge `.cargo/config.toml`. Keep the `target/xtask` target directory
      of the Mokly alias.
- [ ] Regenerate `Cargo.lock`. Run `cargo build --workspace`,
      `cargo clippy --workspace --all-targets`, and `cargo test` for each
      crate.
- [ ] Move the ast-grep rules and `sgconfig.yml` so that they scan the
      `mkc-` crates. Decide in this TODO whether they also scan the
      `mokly-*` crates, and record the call.

## Milestone 4: One npm workspace

Depends on: 2

- [ ] Add `apps/*` and `packages/tokens` to the root `workspaces`. Remove
      `ts/package.json` and its lockfile. Move its scripts to the root
      `package.json` under a `cloud:` prefix.
- [ ] Replace each exact `@mokly/*` pin of a cloud project with the
      workspace package. Add the cloud manifests to the Release Please
      `extra-files` when a pin must follow the release version.
- [ ] Choose one React version for the viewer, the UI package, and the
      app. Check that the app bundle holds one React copy.
- [ ] Merge `.prettierrc.json` and `eslint.config.js`. Keep the Astro plugin
      and the Mokly intrinsic-element rule for `packages/viewer/src`.
- [ ] Make the cloud build of the app, the site, the mockups, and the
      desktop bundle use the built workspace packages. Make
      `cargo xtask mokly-fixtures` read the workspace build.
- [ ] Regenerate `package-lock.json`. Run `npm ci`, `npm run build`, and the
      type check of each cloud project.

## Milestone 5: Docs, plans, and repository rules

Depends on: 2

- [ ] Fix every moved path and every link to `mokly-ai/mokly-cloud` in the
      docs, the READMEs, the follow-up items, and the scripts.
- [ ] Merge the cloud plans and follow-up items into `plans/`. Rewrite each
      item whose subject the replaced ways remove.
- [ ] Split each imported TypeScript or JavaScript file over 300 lines,
      except generated files, which the length audit excludes by path. Split
      each protocol page over 250 lines, or add its exact cap to
      `xtask/protocol-document-caps.json`.
- [ ] Run `npm test -- tests/markdown_links.test.ts`, `npm run format:check`,
      `npm run lint`, and `cargo xtask source-file-length-lint`.

## Milestone 6: One xtask and one gate

Depends on: 3, 4, and 5

- [ ] Port each cloud stage to the Mokly `xtask`. Put format, Clippy, Rust
      tests, whitespace, links, Prettier, and ESLint into the existing
      suites. Add cloud suites for the rest: migrations, the app, mockups,
      the site, OpenAPI, fixtures, email templates, Terraform, the origin
      router, Helm, infrastructure, and desktop.
- [ ] Limit the native suite on macOS and Windows to the `mokly-*` crates
      and `xtask`.
- [ ] Add the boundary check of the design calls to the Repository suite.
- [ ] Delete the cloud `xtask`. Keep every Rust file at 300 lines or fewer.
- [ ] Run `cargo xtask check`. Save the result under
      `.context/combine-cloud/`.

## Milestone 7: One CI

Depends on: 6

- [ ] Merge the cloud `ci.yml` jobs and `preview.yml` into the Mokly
      workflows. Add `deploy.yml`, `foundation.yml`, `site.yml`, and
      `desktop-release.yml`. Make `Required CI` require the cloud jobs.
- [ ] Apply the public CI rule of the design calls to every job that reads
      a secret or requests an OIDC token. Test the guard with a fork
      pull request event fixture.
- [ ] Scope Release Please to the published packages. Keep the cloud
      projects out of the changelog and the version bump.
- [ ] Change the repository and the workflow paths in the Workload Identity
      Federation condition of `infra/terraform/modules/github`, and in its
      contract tests.

## Milestone 8: Cutover before the merge

Depends on: 7

Each TODO needs an operator with owner access. The agent prepares the
commands and the checklist.

- [ ] Copy the repository secrets, the variables, and the `production` and
      preview environments, with their protection rules, to this
      repository.
- [ ] Apply the Terraform change of Milestone 7, so that Google Cloud trusts
      both repositories during the cutover.
- [ ] Point the GitHub App and the preview environments at this repository.
- [ ] Take the final sync of decision 3, when the chosen option has one.
- [ ] Add the cloud services to the Conductive repository setup of this
      repository.

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

- [ ] Watch the first deploy from `main` of this repository through to
      production.
- [ ] Remove the old repository from the Terraform trust condition.
- [ ] Archive `mokly-ai/mokly-cloud`. Point its README at this repository.
- [ ] Replace the cloud's own Mokly contract types in `mkc-mokly-contract`
      with the `mokly-model` types.
