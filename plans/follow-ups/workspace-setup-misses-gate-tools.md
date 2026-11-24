# Workspace setup misses gate tools and services

- **Severity:** Medium. **Effort:** Large. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-23, from the branch `conductor/storybook-support-d-vite-adapter`, after its complete gate of 2026-11-21.
- **Location:** `docs/ops/repository-cutover.md:202-237`, the section "Prepare Conductor", with its install line at line 214 and its setup script lines at lines 220-231. `.agents/setup:34-41`, the system package step, and `.agents/setup:160-174`, the step list. The install script and the setup script on the Conductor page **Settings → Cloud computer**, outside the repository.
- **Reason:** The workspace setup lies outside the change of this branch, and its Conductor part needs a Conductor organization admin.

- **Source:** Implementation.
- **Category:** Process.
- **Terms:**
  - **Complete gate:** `cargo xtask check` without `--suite`, whose local run
    executes every suite in order and stops at the first failed suite.
  - **Conductor cloud computer:** the Amazon Linux 2023 image, without
    systemd, that each new cloud workspace of the Conductor coding agent app
    starts from.
  - **Install script and setup script:** the two Conductor scripts on
    **Settings → Cloud computer** that build the computer image and prepare
    each new workspace.
  - **Amp orb:** a cloud machine of the Amp coding agent, which runs
    `.agents/setup` once and keeps the result as a snapshot for later orbs.
  - **Testbox:** a Blacksmith CI machine that
    `.github/workflows/blacksmith-testbox.yml` prepares with the gate tools
    for a remote run of the complete gate.
- **Background:**
  - The complete gate runs the `repository`, `viewer`, and `browser` suites.
    Then come 16 cloud suites: `cloud-toolchain-pins`, `cloud-rust`,
    `cloud-migrations`, `cloud-typecheck`, `cloud-app`, `cloud-mockups`,
    `cloud-site`, `cloud-openapi`, `cloud-fixtures`, `cloud-emails`,
    `cloud-openapi-lint`, `cloud-terraform`, `cloud-origin-router`,
    `cloud-helm`, `cloud-infrastructure`, and `cloud-desktop`.
    `xtask/src/check/request.rs` defines the order.
  - Every cloud suite fails on a missing tool and on a reported skip.
    `xtask/scripts/strict-command.mjs` also fails a command that prints a
    `SKIP` line. The viewer suite needs Bun at the version in `.bun-version`,
    now 1.4.4.
  - The section "Cloud Suites" of `docs/protocol/ci-verification.md` says
    that `cloud-rust`, `cloud-app`, and `cloud-desktop` create a database per
    run. `MKC_TEST_DATABASE_URL` selects the server. The default is
    `postgres://postgres:postgres@localhost/mkc_test`. So the suites need a
    Postgres server and a BuildKit that already run.
  - Each of four places keeps its own tool list: CI, the Testbox workflow,
    `.agents/setup`, and "Prepare Conductor".
  - CI and the Testboxes run Ubuntu 24.04 and install
    `postgresql-16 libpq-dev e2fsprogs xvfb` with `apt-get`. Ubuntu has
    `openssl` in its base image, so the CI job "Workload image checks" needs
    no `openssl` step. So "Cloud Testbox Tools" in
    `docs/protocol/ci-workflow-cloud.md`, line 35, needs no change.
  - Amp orbs run Debian 12 or Debian 13, and `.agents/setup` uses `apt-get`.
    Its system package step installs only `git-lfs`. It also installs Node,
    npm, Rust, Bun, Playwright Chromium, the npm dependencies, and the shared
    skills. It installs no tool of the cloud suites: no Postgres, `libpq`,
    Terraform, Helm, BuildKit, crane, e2fsprogs, Xvfb, or `openssl`.
  - The last step of `.agents/setup` builds the `mkc-` test binaries, and
    `pq-sys` 0.7.5 always links them to the system `libpq`. So a cold orb
    setup likely fails there since commit `5cba4dc4`, unless the orb image
    has a `libpq` development package. This item did not check it on an orb.
  - Debian 12 ships Postgres 15, and Debian 13 ships Postgres 17. So Postgres
    16 on Debian needs the PostgreSQL apt source. On Debian and Ubuntu, the
    server tools live in `/usr/lib/postgresql/16/bin`, which is not on
    `PATH`. On Amazon Linux 2023, `postgresql16-server` puts them in
    `/usr/bin`.
  - "Prepare Conductor" says that the computer runs Amazon Linux 2023 without
    systemd. It says that cloud workspaces ignore `.conductor/` and
    `conductor.json`. It says that the current setup script of the repository
    installs only the shared skills. Only a Conductor organization admin can
    change the install script and the setup script.
  - Its install line is
    `sudo dnf install -y postgresql16 postgresql16-server libpq-devel e2fsprogs xorg-x11-server-Xvfb`.
    It does not install `openssl`.
  - Its setup script lines install the pinned npm. They run
    `infra/scripts/install-tools.sh` for Terraform and Helm, and
    `infra/scripts/install-build-tools.sh` for BuildKit and crane. They start
    Postgres with `initdb -E UTF8 --locale=C.UTF-8`, create `mkc_test`, and
    run `infra/scripts/start-buildkit.sh`. They install neither Bun nor
    Playwright Chromium.
  - Its check runs `xtask/scripts/require-postgres.mjs`,
    `xtask/scripts/require-postgres-tools.mjs`, and the suites
    `cloud-toolchain-pins`, `cloud-rust`, and `cloud-infrastructure`. So it
    finds a missing `openssl`, but not a missing Bun or Playwright Chromium.
  - The install script of the organization runs
    `infra/scripts/install-tools.sh` and `infra/scripts/install-build-tools.sh`
    when they exist on `main` at build time. Both reached `main` on
    2026-11-20, with commit `5cba4dc4`.
  - Amazon Linux 2023 has no `openssl` command until
    `sudo dnf install -y openssl`. Its base image has only the `openssl-libs`
    package. The `openssl-devel` package does not add the command.
    `infra/README.md` already says that the platform scripts need OpenSSL.
  - `npx playwright install chromium` installs the browser build of the
    Playwright version that `npm ci` installed, now 1.61.1. So that step must
    come after `npm ci`. `npx playwright install-deps` supports only
    `apt-get`. The Conductor computer already had the browser libraries.
  - A service that a setup starts does not last:
    - The workspace of the run below stopped and started again before
      2026-11-23. Its cluster in `/tmp/mkc-pgdata` and its
      `/tmp/mkc-buildkit.log` remained, but no Postgres or BuildKit ran.
      `pg_isready -h localhost` gave `localhost:5432 - no response`.
    - The Amp documentation says that Amp stops every process that
      `.agents/setup` leaves running, so none reaches the snapshot. It names
      `.amp/services.yaml`, or a systemd unit that
      `sudo systemctl enable --now` starts, for a service that must run.
  - From 2026-11-19 to 2026-11-21, the complete gate of the branch
    `conductor/storybook-support-d-vite-adapter` ran in a fresh Conductor
    cloud workspace. The cloud suites joined the gate of the branch with a
    merge on 2026-11-20. The gate failed once for each missing tool. These
    are the failure texts and the fixes that worked:
    - `viewer`: `Error: Cannot run Bun: spawn bun ENOENT`. Fix: Bun 1.4.4
      through `npm install --global bun@1.4.4`.
    - `cloud-toolchain-pins`: an xtask internal error right after
      `$ terraform version -json`. The text, shortened, was
      `[xtask/error] internal error: InternalError { ... message: "start captured command" }], source_chain: ["No such file or directory (os error 2)"] }`.
      It does not name Terraform, because `xtask/src/command/capture.rs:20`
      adds only the context `start captured command`. Fix:
      `infra/scripts/install-tools.sh`, or the same pinned releases by hand.
    - `cloud-toolchain-pins`, after Terraform and Helm:
      `[xtask/diagnostic] npm: installed version must be 11.21.0, found 11.19.0`.
      Fix: `npm install --global npm@11.21.0`.
    - `cloud-rust`:
      `[xtask/database] Postgres database setup or cleanup failed; install psql and use a test role with CREATEDB permission.`
      `cloud-app` and `cloud-desktop` gave the same text in their own runs.
      Fix: the PostgreSQL 16 server and client tools, `libpq-devel`, and a
      running cluster with the database `mkc_test`. The Diesel crate links
      the system `libpq` through `pq-sys`, so the build also needs
      `libpq-devel`.
    - `cloud-rust` on a cluster that `initdb` created without an encoding,
      which gave `SQL_ASCII`: the test
      `backfill_is_scoped_deterministic_and_reversible` in
      `crates/mkc-db/tests/slug_migration_tests.rs` failed with
      `Unicode normalization can only be performed if server encoding is UTF8`.
      Fix: `initdb -E UTF8 --locale=C.UTF-8`, as the runbook says. The suite
      then passed 1340 tests.
    - `cloud-mockups`:
      `Error: browserType.launch: Executable doesn't exist at /home/vercel-sandbox/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell`.
      Fix: `npx playwright install chromium`.
    - `cloud-infrastructure`, before Postgres:
      `[xtask/prerequisite] cloud-infrastructure requires PostgreSQL server tools on PATH: createdb, dropdb, initdb, pg_isready, postgres, psql.`
    - `cloud-infrastructure` contract tests, run by
      `python3 infra/scripts/run-infrastructure-tests.py contracts`: 303
      tests, `FAILED (failures=11, errors=7)`. Each failure and error said
      `openssl is required by the preview-platform tests` or
      `openssl is required to check the preview TLS certificate`. Fix:
      `sudo dnf install -y openssl`, which gave OpenSSL 3.5.5. The 303 tests
      then passed.
  - The workspace met three more needs before those suites ran:
    - The storage tests in `infra/tests/test_buildkit_storage.py` need
      `mkfs.ext4` from e2fsprogs, `mount`, `umount`, and passwordless `sudo`.
    - `infra/scripts/check-image.sh` needs `buildctl`, `crane`, and a running
      BuildKit. Without the tools, it prints a `SKIP` line, which the suite
      rejects.
    - `packages/desktop/scripts/smoke.mjs` runs `xvfb-run` on Linux.
  - In the last run, `cloud-infrastructure` was the 18th of 19 suites. The
    run started at 01:50 UTC on 2026-11-21. It failed at 03:29 UTC. So the
    missing `openssl` showed 1 hour 38 minutes after the start, after every
    earlier suite had passed.
  - The `dnf` history of that workspace showed no package of the install
    line before 2026-11-20. The last earlier install, on 2026-10-15, was
    `gcc gcc-c++ make cmake clang jq pkgconf-pkg-config openssl-devel rsync openssh-clients`.
    So that computer was built without the install line of "Prepare
    Conductor", and before the two pinned tool scripts reached `main`.
  - The branch `conductor/storybook-support-b-story-reading` met the same
    gap in its own fresh Conductor workspace. That report came on
    2026-11-23.
  - On 2026-11-25, the primary workspace of the Storybook support plan ran
    the complete gate on a Conductive cloud computer, a Debian image with
    a 79 GB disk. It met these gaps, in this order:
    - The Rust test build filled the disk. `target/debug` held 39 GB, with
      `debuginfo=2` for each test binary. The link step failed with
      `ld terminated with signal 7 [Bus error]` and
      `No space left on device (os error 28)`. Fix: remove `target/debug`,
      and run the gate with `CARGO_PROFILE_DEV_DEBUG=0`,
      `CARGO_PROFILE_TEST_DEBUG=0`, and `CARGO_INCREMENTAL=0`. The next
      run left 31 GB free.
    - The `xtask` test `rust_tests::test_stage_rejects_a_failing_rust_test`
      failed with `could not execute process rustdoc ... No such file or
directory`. `/usr/local/bin` linked `cargo`, `rustc`, and `rustfmt` to
      the rustup proxies in `/usr/local/cargo/bin`, but not `rustdoc`. Fix:
      `ln -s /usr/local/cargo/bin/rustdoc /usr/local/bin/rustdoc`.
    - A repository test needs Git LFS. Fix: install the `git-lfs` package.
    - `npm run typecheck:ci` stopped with
      `Bun 1.3.14 does not match the pinned version 1.4.4.` Fix:
      `npm install -g --allow-scripts=bun bun@1.4.4`, then point
      `/usr/local/bin/bun` at the installed binary, because the image's own
      Bun comes first on `PATH`.
    - The browser part of `cloud-mockups` stopped with
      `Executable doesn't exist at .../chromium_headless_shell-1228/...`.
      `apps/mockups` uses Playwright 1.61.1. Fix: run
      `npx playwright install chromium` in `apps/mockups`.
    - `cloud-rust`, `cloud-app`, `cloud-desktop`, and `cloud-infrastructure`
      stopped with `Postgres database setup or cleanup failed; install psql
and use a test role with CREATEDB permission.` `cloud-openapi`
      stopped with `rust-lld: error: unable to find library -lpq`.
      `cloud-toolchain-pins` and `cloud-terraform` stopped because
      `terraform` is missing, and `cloud-helm` because `helm` is missing.
      These stayed unfixed.
- **Problem:** No workspace setup installs every tool that the complete gate
  needs. `.agents/setup` misses every cloud tool, and the Conductor lines
  miss `openssl`, Bun, and Playwright Chromium. The Postgres and BuildKit
  that a setup starts do not survive an Amp snapshot or a workspace stop.
- **Impact if no action:** Each new or resumed workspace finds each missing
  tool or stopped service only through a failed gate run. Each agent then
  repairs the same setup by hand.
- **Root question:** How does an agent in each workspace, new or resumed, get
  a complete gate run that no missing tool or stopped service fails?
- **Options:**
  - **A.** Correct the Conductor lines of the runbook. Add `openssl` to the
    install line, and Bun, `npm ci`, and Playwright Chromium to the setup
    script lines. Add the `viewer` and `cloud-mockups` suites to its check.
    A Conductor organization admin copies the lines into the two scripts and
    rebuilds the computer. The list stays apart from the suites that need
    the tools, Amp orbs get no cloud tool, and the services still end at
    each stop. Effort: Small.
  - **B.** Run the complete gate in remote mode on Testboxes.
    `cargo xtask check` selects that mode when `BLACKSMITH_ORG_TOKEN` is set
    and its availability checks pass. A Conductor organization admin makes
    the token available in each workspace, which already has `blacksmith`,
    `rsync`, and `ssh`. A `--suite` run and the targeted tests stay local, so
    they still need the local tools. It needs a credential, so it is
    blocked. Effort: Small.
  - **C.** Add a check at the start of `cargo xtask check` that names every
    missing tool of the selected suites at once, then stops. It extends
    `xtask/scripts/require-postgres-tools.mjs` and
    `xtask/scripts/require-postgres.mjs` to every tool. Each workspace then
    learns the full list in seconds, without an admin, but still installs
    the tools by hand. A form that only warns adds no failure, but the run
    then still stops at the first missing tool. It adds a new gate check, so
    it is blocked until the user approves it. Effort: Medium.
  - **D.** Add one repository script that installs every tool of the
    complete gate:
    - It installs the system packages through `dnf` or `apt-get`. They are
      `openssl`, the `libpq` development package, the Postgres 16 server and
      client tools, e2fsprogs, Xvfb, and Git LFS. On Debian it adds the
      PostgreSQL apt source. It warns when Git is older than 2.45.0, which
      the Rust tests need.
    - It installs the pinned npm, Bun, Playwright Chromium with its headless
      shell, and the pinned Terraform, Helm, BuildKit, and crane. It reads
      each version from `.nvmrc`, `package.json`, `.bun-version`, or
      `infra/toolchains.json`. Each step skips a tool that is there.
    - It starts a UTF8 Postgres 16 cluster with `mkc_test`, and BuildKit. On
      Amp, both must run as a systemd unit or an `.amp/services.yaml` entry.
      On Conductor, both end at each stop of the workspace.
    - `.agents/setup` gets one new step that runs the script. Its current
      steps stay, because a change to them needs the user's approval.
    - A Conductor organization admin makes the install script and the setup
      script run the script, then rebuilds the computer. Until then, an
      agent in a fresh Conductor workspace runs the script by hand.
    - The runbook, `xtask/README.md`, `docs/development/`, and the section
      "Bun Provisioning" of `docs/protocol/developer-type-checks.md` name it.
    - A change that adds a tool to a suite must update the script, but
      nothing enforces it. A cold run, a warm run, and a complete gate on
      each host prove the script. Effort: Large.
  - **E.** Add the script of D, but let `cargo xtask check` run it before
    its first suite, in place of the Conductor scripts. No admin step is
    needed, and each gate run starts the services again. The gate then runs
    `sudo` installs, also on a developer's own machine. `xtask/README.md`
    says that xtask never installs Bun, so E changes documented behaviour.
    Targeted tests, such as `cargo test -p mkc-db`, still miss the tools
    until the script runs. Effort: Large.
  - **F.** Let CI be the complete gate of a workspace. The agent pushes the
    branch, runs `gh workflow run ci.yml --ref {branch}`, and waits for every
    check job, the native macOS and Windows jobs included. The `finish-work`
    skill accepts CI as the gate only for an open pull request, so F needs a
    rule in `AGENTS.md`. This item did not check that a workspace can start
    workflow runs. Like B, it gives no tools for the targeted tests. Effort:
    Small.
  - **G.** D, and the CI cloud jobs and the Testbox workflow also install
    through the script. A suite argument lets each CI job install only its
    own tools. Each pull request then proves the list on Ubuntu, and CI
    fails until the script names a new tool. It does not catch a tool that
    Ubuntu has and Amazon Linux lacks, such as `openssl`. It changes two
    workflows and must keep their caches. Effort: Large.
  - **H.** D, but the gate starts the services that it needs, and the script
    only installs:
    - When `MKC_TEST_DATABASE_URL` is unset and the default URL gets no
      answer, `xtask/scripts/isolated-postgres.mjs` starts a disposable UTF8
      cluster. It lives in a temporary folder and stops after the suite.
      `infra/tests/test_database_reset.py` already starts such a cluster.
    - `cloud-infrastructure` first runs the idempotent
      `infra/scripts/start-buildkit.sh`. Its storage tests already need
      passwordless `sudo`.
    - A resumed workspace and a new orb then need no service step, and a
      `SQL_ASCII` cluster cannot recur.
    - It changes the database rule of the section "Cloud Suites" of
      `docs/protocol/ci-verification.md`, and the database text of
      `xtask/README.md`. Effort: Large.
  - **I.** One Nix flake holds the same gate tools on each distribution:
    Postgres 16, `libpq`, `openssl`, e2fsprogs, Xvfb, Bun, Terraform, Helm,
    BuildKit, and crane. Each host runs the gate in its dev shell. Nix
    becomes a new dependency of every host, and the Conductor computer needs
    a single-user install without systemd. The storage tests run
    `sudo -n mkfs.ext4`, and `sudo` drops the Nix profile from `PATH`.
    Playwright Chromium still comes from npm. Effort: Large.
- **Left out:**
  - Change nothing. It fails the goal, because each workspace then finds
    the tools one failed run at a time.
  - A container image with every tool. It fails the goal, because the
    Conductor computer has no Docker or Podman.
  - A host hook that starts the services, such as a systemd unit or
    `.agents/resume` on an orb. It fails the goal on the Conductor computer,
    which has no systemd and no documented resume hook.
  - A local gate that names every failed suite at the end. It fails the goal,
    because a workspace still finds its tools through a failed run.
  - Removing tool needs one at a time, such as the `openssl` command of the
    preview-platform tests. It fails the goal, because the suites test most
    of their needs, such as Postgres and BuildKit.
- **Wider fix:** G. D keeps one list, but nothing makes a change that adds a
  tool update it. G fails CI until the script names the new tool, unless
  the Ubuntu image already has it. C is a detection fix for the same class.
- **Previous examples:**
  - Commit `5cba4dc4` combined Mokly Cloud into this repository and added
    the 16 cloud suites. It changed `.github/workflows/ci.yml` and
    `.github/workflows/blacksmith-testbox.yml`, but not `.agents/setup`.
  - `.agents/setup` installs `git-lfs`, because the `mokly-git` LFS tests
    need it and the CI images include it. The step came with `09f9e531`.
  - Commit `76d69b63` made each remote viewer command install the pinned
    Bun, because a Testbox warmup image can lack Bun.
- **Related:**
  - `plans/follow-ups/repository-cutover-after-merge.md`, the same code. Its
    second task rebuilds the Conductor cloud computer for Terraform and
    Helm. That one rebuild should also install the tool list of this item.
    Its third task deletes or moves the cutover runbooks, and the move can
    carry the corrected "Prepare Conductor" lines. It names neither
    `openssl` nor the other tools of this item.
  - `plans/follow-ups/development-guide-omits-git-tools.md`, the same code at
    the start of the gate. Its open option B adds a check for Git 2.45.0 and
    Git LFS there, like C. One answer should settle both.
- **Recommendation:** H. D starts the services from a setup, which an Amp
  snapshot or a Conductor stop ends, but H starts them in each gate run. The
  first recommendation was D. G best protects the list against drift, and
  it can follow H.
- **Action:** ask the user, because H changes the database rule of
  `docs/protocol/ci-verification.md`, and its Conductor part needs an
  organization admin.
