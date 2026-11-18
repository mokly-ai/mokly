# Manager fixture PATH filter drops Git

- **Severity:** Medium. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-18, from the branch
  `calummoore/mokly-comparison-proof-cost-mcnn`. Its complete local gate met
  this failure. That branch changes only graph validation and cache code.
- **Location:** `tests/helpers/base_manager_tools.ts:104-164`, with the
  filter at lines 150-163. Its callers are
  `tests/helpers/base_manager_fixture.ts:175`,
  `tests/helpers/base_registry_fixture.ts:139`, and
  `tests/static_base_classic_paths.test.ts:74`. Mokly runs Git by name at
  `crates/mokly-git/src/system_command.rs:8`.
- **Reason:** The failure comes from a test helper and the tool layout of the
  machine, outside the graph performance change of the branch that found it.

- **Source:** Implementation.
- **Category:** Test.
- **Terms:**
  - **Manager fixture:** a Node test that builds a base side whose
    dependencies a pinned package manager installs, such as pnpm, Yarn
    Classic, or Yarn Berry.
  - **Fixture PATH:** the `PATH` that `managerPath` in
    `tests/helpers/base_manager_tools.ts` builds for the Mokly process of a
    manager fixture.
  - **Corepack:** the Node tool that provides package-manager shims. Its
    `corepack` executable can sit next to other system tools.
  - **Hosted-CI wrapper:** `tests/static_base_manager_ci.test.ts`. It runs
    five manager, registry, mirror, classic-path, and cold-tier test files
    under the hosted CI defaults.
- **Background:**
  - `managerPath` makes a fixture `bin` directory with a `node` wrapper. When
    the test does not want a missing manager, the directory also gets a link
    to the pinned manager.
  - Then `managerPath` keeps each absolute `PATH` directory whose listing has
    no file named `pnpm`, `yarn`, or `corepack`, with an optional `.cmd`,
    `.exe`, `.bat`, or `.com` suffix. It drops every other directory whole.
  - The filter hides system package managers. So each test uses only its
    pinned manager, or no manager in a missing-manager test. The helper does
    not say why the filter also names `corepack`.
  - Mokly starts Git by its name through `PATH`. Mokly finds a package
    manager by its file name, `pnpm` or `yarn`, in
    `crates/mokly-compare/src/programs.rs`. So the fixture PATH must still
    reach `git`.
  - The machine that showed the failure:
    - Linux x86_64, four CPUs, 8 GB of memory, Node 24.22.1, npm 11.21.0, and
      Bun 1.4.4.
    - `/bin` is a link to `/usr/bin`.
    - `/usr/bin` holds Git 2.56.1 and `corepack`, a link to
      `../lib/node_modules/corepack/dist/corepack.js`.
    - `/usr/local/bin` holds `pnpm`.
    - So the filter drops all three directories, and the fixture PATH has no
      `git`.
  - On 2026-11-18 the complete local gate, `cargo xtask check`, ended with
    exit status 1 after its Node suite. The repository suite, the Rust tests,
    and the type check passed.
  - The Node suite reported 3,023 tests: 2,995 passed, 28 failed, 0 skipped,
    and 0 cancelled.
  - Each failing Mokly process stopped in `review.base-commit` or
    `review.base-dependencies`, before any graph or render work, with this
    text:
    `[mokly/git-failed] Git information could not be read for HEAD. Check the repository and configured base.`
  - The test "a cold Yarn Berry base reads an allowed LANG variable in the
    install" failed instead with `AssertionError [ERR_ASSERTION]: []`. The
    empty list means that the probe recorded no install request.
  - The failing files are `tests/static_base_classic_paths.test.ts`,
    `tests/static_base_manager_mirror.test.ts`,
    `tests/static_base_managers.test.ts`, `tests/static_base_registry.test.ts`,
    and `tests/static_base_secrets.test.ts`. The hosted-CI wrapper failed too,
    because it runs five of these manager and cold-tier files.
  - The 28 failed tests:
    - "a nested Yarn Classic file dependency inside the repository installs on
      tier two"
    - "a nested Yarn Classic file dependency that leaves the repository falls
      back"
    - "base manager and cold-tier tests pass with hosted CI defaults"
    - "a cold Yarn Classic base installs ordinary versions from its committed
      offline mirror"
    - "a cold pnpm base installs offline without scripts and reuses its
      dependency cache", and the same test for Yarn Classic, Yarn Berry,
      pnpm 11, and pnpm 12
    - "a cold pnpm base warns when its manager is missing" and "a cold pnpm
      base warns when its manager is version"
    - "a cold Yarn Classic base warns when its manager is missing" and "a cold
      Yarn Classic base warns when its manager is version"
    - "a cold Yarn Plug'n'Play base gives its resolver fallback reason"
    - "a cold Yarn Berry base with exec dependencies falls back without
      running the generator"
    - "a cold Yarn Berry base disables constraints code from the historical
      tree"
    - "a pnpm base keeps configured install paths inside its private entry",
      and the same test for pnpm 11 and pnpm 12
    - "a cold pnpm base installs from its configured registry with user
      credentials", and the same test for Yarn Classic, Yarn Berry, pnpm 11,
      and pnpm 12
    - "a cold Yarn Classic base cannot send an inherited GITHUB_TOKEN to its
      registry" and the same test for Yarn Berry
    - "a cold Yarn Berry base reads an allowed LANG variable in the install"
    - "a cold Yarn Berry base cannot inject an outside environment file"
  - The workaround, checked on 2026-11-18:
    - A task-local directory held only links to `git` and `git-lfs`, and no
      package manager. It went first on `PATH`.
    - The filter keeps that directory, so Git 2.56.1 stays reachable. Node,
      npm, and Bun stay as before.
    - With that `PATH`,
      `node scripts/verification/run-viewer.mjs tests/static_base_manager_ci.test.ts tests/static_base_secrets.test.ts`
      exited with status 0: 5 tests, 5 passed, 0 failed, in 50,834 ms.
    - The five inner files of the wrapper passed. A successful run does not
      print their inner test count.
    - No product code, test assertion, or helper changed for that run.
  - Unknowns:
    - Hosted CI passes these tests. Nobody checked where its Ubuntu 24.04
      runners keep `git`, `corepack`, `pnpm`, and `yarn`.
    - Nobody checked whether the fixtures need `git-lfs`. The workaround
      linked it as well.
    - On Windows the helper copies `node.exe`. Nobody checked this case on
      Windows.
- **Problem:** The fixture PATH filter drops whole directories. When Git
  shares a directory with `corepack`, `pnpm`, or `yarn`, the fixture also
  loses Git, and 28 manager tests fail before they test their behaviour.
- **Impact if no action:** The complete local gate fails on each machine with
  this layout. Each agent there must find the cause and add a manual `PATH`
  workaround.
- **Root question:** How can a manager fixture hide every system package
  manager and still reach the tools that Mokly runs, such as Git?
- **Options:**
  - **A.** Change nothing. Keep the manual workaround on such machines.
    Effort: Small.
  - **B.** Remove `corepack` from the filter. Cost: it fixes this layout
    only. A machine whose Git shares a directory with `pnpm` or `yarn` still
    loses Git, and the reason for the `corepack` term is not known. Effort:
    Small.
  - **C.** Link the needed tools into the fixture `bin`. Before the filter
    runs, `managerPath` finds `git`, and `git-lfs` when present, on the
    original `PATH` and links them into its `bin`. The filter stays. Cost:
    the helper names each needed tool, and Windows needs a copy or a shim in
    place of a link. Effort: Small.
  - **D.** Make the verification runner put a Git-only tool directory first
    on `PATH` for every Node test. Cost: it changes the `PATH` of every test,
    and a raw `node --import tsx --test` run still fails. Effort: Small.
  - **E.** Filter by file, not by directory. For each dropped directory,
    `managerPath` builds a shadow directory with links to every file except
    the package managers. Cost: one link for each file of a large directory
    such as `/usr/bin`, in each fixture, and a separate Windows design.
    Effort: Medium.
- **Left out:**
  - A Mokly setting for the Git program. It adds a product input at a
    boundary only for a test fixture, and C reaches the same result with no
    product change.
  - Failing stubs named `pnpm`, `yarn`, and `corepack` in place of the
    filter. The missing-manager tests need an absent manager, and a stub is
    a present manager.
  - Weaker assertions, skipped tests, or retries. They hide the cause, and
    the testing rules forbid them.
- **Assumptions:**
  - Each manager fixture must hide the system package managers. Source: the
    purpose of `managerPath` and the missing-manager tests. Every option
    keeps it.
  - Mokly finds Git by name through `PATH`. Source:
    `crates/mokly-git/src/system_command.rs:8`. Every option keeps it.
- **Wider fix:** E. It keeps every non-manager tool of a dropped directory,
  whatever tool a later fixture needs.
- **Previous examples:** `plans/follow-ups/partial-clone-lazy-fetch-builds.md`
  records local test runs that put a task-local Git first on `PATH`, for a
  different Git reason.
- **Related:** [yarn-mirror-flake.md](./yarn-mirror-flake.md) records a
  one-time tier fallback of `tests/static_base_manager_mirror.test.ts` on
  hosted CI, with the same helper. A failure of that test with
  `[mokly/git-failed]` comes from this item, not from that flake.
- **Recommendation:** C. It keeps Git for every manager fixture on every
  machine, with a small change to one helper and no product change. E best
  protects against other dropped tools, but it links every file of large
  system directories and needs its own Windows design.
- **Action:** fix after merge, apply C, because the failure lies in a test
  helper outside the graph performance change of the branch that found it.
