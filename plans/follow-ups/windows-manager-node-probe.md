# Windows manager fixtures omit the install probe

- **Severity:** Medium. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-18, from the post-push review of branch
  `calummoore/fu-manager-fixture-path-drops-git-rp6g`.
- **Location:** `tests/helpers/base_manager_tools.ts:117-127,174-208`,
  `tests/helpers/base_manager_fixture.ts:175-196`,
  `tests/helpers/base_registry_fixture.ts:139-155`, and
  `tests/static_base_classic_paths.test.ts:74-88` create and use the probe.
  `crates/mokly-compare/src/process.rs:35-45`,
  `crates/mokly-compare/src/manager_environment.rs:17-68`, and
  `crates/mokly-compare/src/programs.rs:70-130` select the Windows process
  and its environment.
- **Reason:** The Node launcher and environment behavior already exist on
  `origin/main` and are outside the Git PATH preservation change.

- **Source:** Review.
- **Category:** Test.
- **Terms:**
  - **Manager fixture:** Test setup that installs a historical dependency
    tree with a pinned pnpm or Yarn version.
  - **Install probe:** The generated `manager-probe.cjs` file that records
    manager installs, captures output, and checks attempted socket connections.
  - **Preload:** A script that Node loads with `--require` before the manager.
- **Background:**
  - `instrumentManagers` writes the probe under the fixture's `.context`
    directory and returns a `NODE_OPTIONS` value that loads it.
  - It creates an empty `manager-calls.jsonl` file before the build.
  - The Unix branch of `managerPath` creates a Node wrapper that adds
    `--require` when the probe file exists.
  - The Windows branch instead copies `process.execPath` to `bin/node.exe`.
    That copy adds no preload argument.
  - Mokly removes inherited `NODE_OPTIONS` before it starts an install.
    The [base install process contract](../../docs/protocol/mokly-base-install-processes.md#environment)
    requires this environment filter.
- **Problem:** Windows manager installs do not load the probe through the
  fixture's Node entry point. The copied executable has no preload argument,
  and the install child cannot inherit `NODE_OPTIONS`.
- **Evidence:**
  - The Windows copy and Unix wrapper both exist unchanged at
    `origin/main` commit `ae79b95cddac6aa9623a1862ccc4d3fb58c62147`.
  - `SystemSpawner::spawn` removes each inherited variable that
    `manager_environment::allowed` does not list. That list omits `NODE_OPTIONS`.
  - Windows manager resolution starts Node with the manager's JavaScript
    file. It adds no probe argument.
  - The probe writes a call only when a pnpm or Yarn entry point receives
    `install`. Without the preload, that code does not execute.
  - The test named "a cold pnpm base installs offline without scripts and
    reuses its dependency cache" asserts a nonempty call log and one install.
    The same scenario covers all five pinned managers.
  - The Git PATH regression also asserts one recorded install. It does not
    introduce the missing Windows probe.
  - No Windows runtime run was available. This evidence comes from the code.
    The hosted Windows job runs Rust tests and does not run these Node tests.
- **Impact if no action:** On Windows, install-count assertions can fail
  even when Mokly completes the requested build. The fixture also lacks its
  install-process output and socket observations.
- **Root question:** How can Windows manager fixtures load their install
  probe while they keep Mokly's required environment filter?
- **Options:**
  - **A.** Give the fixture a native Node launcher that adds `--require`
    when the probe exists. Start the real Node at its installed path and
    preserve arguments, streams, and exit status. Keep the existing manager
    command-file and package layouts. Cost: a Windows launcher implementation
    and a one-time Windows run of the existing integration tests. Effort: Small.
  - **B.** Put native pnpm and Yarn launchers in the fixture bin. Each starts
    the real Node with the probe and pinned manager entry point. Cost: separate
    manager entry points, and these tests no longer exercise the current
    Windows command-file resolution path. Effort: Small.
  - **C.** Build a reusable fixture launcher with Cargo, then copy it into
    each fixture with a file that names Node, its probe, and its arguments.
    Cost: a test-only binary, build steps, and documentation. Effort: Medium.
- **Left out:**
  - Allowing inherited `NODE_OPTIONS` in product installs violates the
    environment contract and lets the parent inject code into an install.
  - Removing or loosening call-log assertions loses the proof that the
    manager installs once and reuses the dependency cache.
  - A command-file Node shim alone does not supply the `node.exe` that
    Windows manager resolution selects.
  - Changing nothing leaves the Windows probe absent.
- **Assumptions:**
  - The install environment filter stays. Source: the base install process
    contract. Every option keeps it.
  - The existing integration tests keep every assertion. Source: the test
    requirement and repository testing rules. Every option keeps it.
- **Wider fix:** A. It makes probe loading part of the fixture Node entry
  point for every manager, without a product exception or a new gate.
- **Previous examples:** The Unix Node wrapper in the same helper already
  addresses the lost `NODE_OPTIONS` preload. Commit `d935e6a66` introduced it.
  No existing follow-up item for the Windows omission was found.
- **Recommendation:** A. It gives Windows the existing Unix fixture behavior
  and keeps the current manager-resolution coverage.
- **Action:** fix after merge, apply A, because the unchanged Windows Node
  setup lies outside the Git PATH preservation change.
