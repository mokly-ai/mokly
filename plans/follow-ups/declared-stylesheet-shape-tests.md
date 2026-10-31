# Pin the shape checks of declared stylesheets

- **Severity:** Low (estimate). **Effort:** Small (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-10-31, from the branch
  `conductor/built-repository-packages-in-changes`, which lets a declared
  stylesheet value use `.`, `..`, and empty segments. Its first review put
  this problem outside the scope.
- **Location:** `crates/mokly-render/src/declarations.rs:63-72`,
  `crates/mokly-render/tests/integration/declared_stylesheet_tests.rs`, and
  `docs/protocol/mokly-component-stylesheets.md:41-48`.
- **Reason:** That branch changed only the segment rule of the check, and
  the other shape rules were already untested on `main`.

- **Source:** Review.
- **Category:** Test.
- **Terms:**
  - **Declared stylesheet:** a CSS file that a component lists in the
    `stylesheets` field of its `defineComponent` registration. Mokly links
    it in each document that renders the component.
  - **Shape check:** the first check that `validate` in
    `crates/mokly-render/src/declarations.rs` runs on each authored value,
    before it resolves the path.
- **Background:** The component stylesheet contract,
  `docs/protocol/mokly-component-stylesheets.md`, makes each declared value
  a nonempty POSIX path with a case-insensitive `.css` suffix. It rejects
  absolute paths, backslashes, query or fragment suffixes, and other URL
  schemes. The shape check enforces this with one condition: an empty
  value, a leading `/`, any of the characters backslash, colon, `?`, `#`,
  or NUL, or a value that does not end in `.css`. Each rejection fails the
  build with `component {component} declares invalid stylesheet {path}`,
  which names the authored value. The tests in
  `crates/mokly-render/tests/integration/declared_stylesheet_tests.rs`
  cover `.`, `..`, and empty segments and a path outside `repoRoot`.
- **Problem:** No test runs a value that only the shape check rejects. A
  search of `crates/` and `tests/` for "declares invalid stylesheet" finds
  only the test of a path outside `repoRoot`. A change that drops one
  clause of the condition, such as the colon that rejects a URL scheme,
  passes every test.
- **Impact if no action:** A regression in the shape check could let a URL,
  a query suffix, or a non-CSS file through as a declared stylesheet, and
  no test would fail.
- **Root question:** How does the test suite show that each form that the
  contract rejects still fails the build?
- **Options:**
  - **A.** Change nothing. The condition is short and rarely changes.
    Effort: Small.
  - **B.** Add one test to `declared_stylesheet_tests.rs` that loops over a
    table of literal cases: `/styles/a.css`, `styles\a.css`,
    `https://host/a.css`, `styles/a.css?v=1`, `styles/a.css#x`, a value
    with a NUL character, `styles/a.scss`, and the empty value. Each case
    fails with "declares invalid stylesheet" and its authored value, and
    the failure output names the case. Effort: Small.
  - **C.** Move the shape check into a pure function with unit tests under
    `crates/mokly-render/src/_tests_/`, and keep one integration case.
    Effort: Medium.
- **Left out:** A check of each clause in a browser spec, because the
  lowest level that fails without the check is the Rust integration test.
- **Wider fix:** None. A test for the class of untested validation clauses
  would be a gate, which needs the user's approval.
- **Previous examples:** None found.
- **Recommendation:** B. One table test pins every rejected form at the
  level where the build fails.
- **Action:** ask the user, because condition 6 of the decision test holds:
  a finding about a missing test always waits for the user.
