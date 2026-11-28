# Snapshot files have no descriptions

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-22, from the check of finding 6 of the round 2 review of
  branch `calummoore/mokly-edit-background-render-olos`.
- **Location:** The `insta` snapshot files without a description under
  `crates/`, by crate on 2026-11-22: `crates/mokly-html` 71,
  `crates/mokly-graph` 24, `crates/mokly-cli` 18, `crates/mokly-model` 5,
  `crates/mokly-sidecar` 4, `crates/mokly-css` 4, `crates/mokly-static` 3,
  `crates/mokly-server` 2, `crates/mokly-publish` 2, and
  `crates/mokly-catalogue` 1.
- **Reason:** The gap is on `origin/main` before the branch that found it,
  which fixed only the one snapshot that its diff changed.

- **Source:** Review.
- **Category:** Test.
- **Terms:**
  - **Snapshot file:** an `insta` `.snap` file that records the expected
    output of one test. Its header holds the source file, the expression, and
    optional `description:` and `info:` fields.
- **Background:**
  - The snapshot rules of the shared `testing` skill say: "Name each
    snapshot. With `insta`, add a description or info so that a reviewer can
    judge the value without the test source."
  - On 2026-11-22, none of the 135 snapshot files under `crates/` and
    `xtask/` had a `description:` or an `info:` header. The branch that found
    the gap gave its one changed snapshot, the publication oracle of
    `mokly-server`, a description, so 134 files stay without one.
  - `cargo insta review` prints the snapshot name and the description beside
    each change. Without a description, a reviewer must read the test source
    to judge a changed value.
  - The default comparator of `insta` 1.49.0 compares only the contents, so a
    description changes no test result.
- **Problem:** 134 of the 135 snapshot files do not say what their value
  shows or where their expected value comes from.
- **Impact if no action:** A reviewer of a changed snapshot must open the
  test source to judge the change, and a wrong accept is easier.
- **Root question:** How does each snapshot tell its reviewer what its value
  shows?
- **Options:**
  - **A.** Add a description to each snapshot when a later change touches its
    test. Effort: Small.
  - **B.** Add a description to every snapshot in one branch, crate by crate,
    with `insta::with_settings!` or `Settings::set_description`, and re-record
    each header with a test filter. Effort: Medium.
  - **C.** A repository check that rejects a snapshot file without a
    description. It is a new gate, so it needs the user. Effort: Small.
- **Left out:** None.
- **Wider fix:** C would prevent new snapshots without a description, but it
  is a new gate that needs the user. The snapshot rule of the `testing` skill
  is in force.
- **Previous examples:** None found.
- **Related:**
  - [readable-json-snapshots.md](./readable-json-snapshots.md): the same
    cause. A reviewer cannot judge a snapshot change. That item makes four
    large JSON snapshots readable.
- **Recommendation:** B. It closes the gap in one pass, and the rule in force
  keeps new snapshots described.
- **Action:** fix after merge, apply B, because the files lie outside the
  diff of the branch that found the gap.
