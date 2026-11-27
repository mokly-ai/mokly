# Non-Serve fixtures use the macOS host cache

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-20, from PR #394's startup-output repair.
- **Location:** `crates/mokly-cli/tests/changes_parent_death_tests.rs:111` and
  `crates/mokly-cli/tests/design_attribution_tests.rs:45`.
- **Reason:** These older fixtures run build or attribution commands, outside
  the Serve path that the render-store repair activates.

- **Source:** Implementation.
- **Category:** Test.
- **Terms:**
  - **Cache home:** A temporary child-process home that contains the OS cache
    directory and stays alive until the child stops.
  - **Attribution matrix:** The optional design test that checks which source
    changes affect catalogue output.
- **Background:**
  - Native CLI process fixtures run on macOS and Linux.
  - The cache location library uses the child home plus `Library/Caches` on
    macOS. It reads a nonempty `HOME` before its account-directory fallback.
    `XDG_CACHE_HOME` alone does not redirect that macOS path.
  - Every Rust fixture that starts Serve now uses `Cache` in
    `crates/mokly-cli/tests/process_support/cache.rs`. The owner creates a
    separate temporary home and supplies child-only `HOME`, `XDG_CACHE_HOME`,
    and `LOCALAPPDATA`. The home stays outside the watched source root.
- **Problem:**
  - The build child in `changes_parent_death_tests.rs` sets only
    `XDG_CACHE_HOME` for its cache.
  - The attribution wrapper in `design_attribution_tests.rs` sets XDG and
    `LOCALAPPDATA`, plus temporary-file variables, but does not set child HOME.
  - Both can therefore use the host macOS cache. Their temporary XDG roots do
    not provide the intended isolation there.
  - Source and dependency reads establish the gap. No separate macOS
    reproduction or cost measurement ran for these two fixtures.
- **Impact if no action:** These tests can leave cache entries in the user's
  macOS profile. Unique repository roots limit cross-test reuse, but do not
  isolate the files or their cleanup. No output defect was reproduced.
- **Root question:** How can these process fixtures keep cache files inside
  fixture-owned temporary directories on macOS and Linux?
- **Options:**
  - **A.** Use the existing shared cache-home owner at both child launchers.
    Retain it through child teardown. Preserve the attribution wrapper's
    separate temporary-file settings and all assertions. Effort: Small.
  - **B.** Add child HOME beside the existing cache variables at each launcher.
    Keep the existing temporary directory alive through teardown. This fixes
    the two sites but repeats the environment setup. Effort: Small.
  - Only two approaches fit the existing child-only contract: use the shared
    owner, or configure the existing temporary owner at each launcher.
- **Left out:**
  - Changing the workspace or CI-job home changes unrelated tools and exceeds
    child-only isolation.
  - Adding a product cache setting changes public behavior to solve a test
    setup problem.
  - Testing helper internals does not prove that a real child uses its cache.
  - No change leaves the macOS files outside the fixture-owned directory.
- **Assumptions:** Keep the product's cache-location contract and the child
  commands. Keep every assertion, timeout, retry count, and platform condition.
  These are fixture changes only.
- **Wider fix:** A extends the shared cache-home owner already used by all
  Serve starters. A later launcher can reuse that same owner.
- **Previous examples:** The Serve process fixtures now use the shared owner.
  The existing `changes_support/mod.rs` and `diagnostic_support/fixture.rs`
  already supply child HOME and OS-cache variables with owned temporary data.
- **Related:**
  [isolated-git-in-every-test-helper.md](./isolated-git-in-every-test-helper.md):
  the same kind of cause. A CLI child in a test keeps part of the
  environment of the developer: the cache home here, and the Git settings
  there. Its option B adds the Git variables to `Cache::environment`, the
  owner that option A here uses.
- **Recommendation:** A. It reuses the existing ownership and environment
  boundary, with fewer repeated platform rules.
- **Action:** fix after merge, apply A. The two non-Serve launchers predate the
  current Serve change and need no product change.
- **Done when:**
  - Both child launchers use an owned cache home outside their source roots.
    The owner survives until the child and its descendants finish.
  - The parent-death target and optional attribution matrix pass with their
    original assertions and hang guards.
  - macOS execution confirms that cache files stay under the fixture's home.
    The workspace and host environment remain unchanged.
  - The CLI tests README accurately states the fixtures' cache isolation.
