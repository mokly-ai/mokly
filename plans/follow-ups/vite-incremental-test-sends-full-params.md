# Vite watch test sends full bundle params

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-28, from review round 1 of the branch
  `calummoore/storybook-track-e-storybook-folders-87sk`, outside the scope,
  from the finding check of finding 104.
- **Location:** `tests/sidecar_vite_incremental.test.ts`, the
  `setup: fixture.params` field of the `transformViteCss` call in the two
  tests "Vite dispatches each watched change once to a watchChange" and
  "Vite dispatches each watched change once to a configureServer listener".
  The field was at line 68 when the review found it.
- **Reason:** The two tests predate the branch that found them, and that
  branch does not change them.

- **Source:** Review.
- **Category:** Test.
- **Terms:**
  - **Vite setup:** The Vite configuration and plugins that one sidecar loads
    for one side. The sidecar keys the setup on the settings of a request.
  - **Stylesheet transform request:** The `transformViteCss` request. Its
    `setup` field holds the side's `bundle` settings for the Vite setup.
- **Background:**
  - The `transformViteCss` row of the methods table in
    `docs/protocol/mokly-sidecar.md` says that the setup is the side's
    `bundle` settings with empty entry and stories file lists.
  - The core builds that setup with no source files, at
    `crates/mokly-render/src/vite_stylesheets.rs:47`. So it carries empty
    `entryFiles` and `storiesFiles` and no map of Storybook folders.
  - When the setup key of a request differs from the open setup, the sidecar
    answers `fresh-worker-required`. The pool then replaces the worker and
    retries, and the new worker loads the setup again.
  - The two tests alternate compiles and one stylesheet transform request,
    and they check that each watched change reaches the plugin once. They
    send `setup: fixture.params`, the full bundle params of the compile.
  - On 2026-11-28 a review found that the map of Storybook folders in the
    bundle params gave the two request kinds different setup keys. The
    branch that found it fixed the key. It also added a test to the same
    file that builds the stylesheet setup as the core does: the fixture
    params with empty `entryFiles` and `storiesFiles`.
- **Problem:** The stylesheet request of these tests carries the entry and
  stories lists of the compile, but the core's request carries empty lists.
  So the tests cannot catch a setup key difference between the two request
  kinds.
- **Impact if no action:** A later change that gives the two request kinds
  different setup keys passes these tests. Serve then restarts the Vite
  worker on each alternation, and the tests do not show it.
- **Root question:** How do the tests send the stylesheet transform request
  that the core sends?
- **Options:**
  - **A.** In these tests, build the stylesheet setup as the core does: the
    fixture params with empty `entryFiles` and `storiesFiles`, and no
    `storybookFolders`. Effort: Small.
  - **B.** Add one fixture helper that returns the core's stylesheet setup for
    a set of bundle params. Use it in these tests and in each other test that
    sends `transformViteCss`. Effort: Small.
- **Left out:** Generate the request in the Rust core for the tests. It needs a
  new fixture across the two languages for one field set, and A and B send
  the same fields.
- **Wider fix:** B. One helper gives every test the core's stylesheet setup,
  so a new test does not send the full params again.
- **Previous examples:** None found.
- **Recommendation:** B. It fixes these tests and keeps later tests from the
  same mistake, at the same cost as A.
- **Action:** fix after merge, apply B, because the two tests predate the
  branch that found them, and B also reaches other test files.
