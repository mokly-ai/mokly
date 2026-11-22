# Serve record encoding uses expect in production code

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-22, from the round 3 review of the branch
  `calummoore/mokly-edit-background-render-olos`, list of problems outside
  the scope.
- **Location:** `crates/mokly-server/src/revision_file.rs:21`
  (`RevisionFile::new`) and `crates/mokly-server/src/snapshot.rs:246`
  (`encode`).
- **Reason:** Both calls are older than the branch that found them, which did
  not change either function.

- **Source:** Review.
- **Category:** Repository rule.
- **Terms:**
  - **Revision file:** `RevisionFile`, the encoded bytes of one Serve index or
    entry detail, split around its top-level `revision` number, so that each
    response can insert the current revision.
  - **Private Serve encoder:** `encode` in `snapshot.rs`, which writes the
    canonical JSON of a Serve record.
- **Background:**
  - The shared `rust` skill forbids `panic!`, `unwrap`, and `expect` in
    production code.
  - `RevisionFile::new` calls
    `expect("Serve indexes and current details always encode a numeric revision")`
    on the result of `revision_range`.
  - `encode` calls
    `expect("The private Serve encoder receives only Mokly JSON shapes with string map keys")`
    on the result of the JSON encoder.
  - Both invariants hold today: every Serve index and current detail has a
    numeric `revision`, and every encoded shape has string map keys.
- **Problem:** Two `expect` calls stay in production code. If a later change
  breaks one of the invariants, a publication panics instead of failing with
  a typed error.
- **Impact if no action:** The code breaks a repository rule. Today the
  invariants hold, so no panic happens.
- **Root question:** How does a Serve publication fail safely when a record
  cannot be encoded or has no revision?
- **Options:**
  - **A.** Return a typed `mokly-server` error from both functions, and let
    each caller pass it up as a failed publication, which keeps the last
    published state. Add a unit test for each error. Effort: Small.
  - **B.** Make the invariants structural: give `RevisionFile::new` a typed
    record that always has a revision, and give `encode` only shapes whose
    keys are strings by type, so neither call can fail. Effort: Medium.
  - **C.** Wider fix: a clippy rule that denies `expect_used` and
    `unwrap_used` in the production code of every crate, with an allow list
    for tests. It is a new lint, so it needs the user. Effort: Medium.
- **Left out:** Change nothing. It keeps the rule broken.
- **Wider fix:** C, which needs the user.
- **Previous examples:** `plans/follow-ups/record-release-expect.md`, three
  `expect` calls in `crates/mokly-sidecar/src/pool_releases.rs`.
- **Related:** `record-release-expect.md`, the same rule in another crate. One
  lint of option C covers both.
- **Recommendation:** A. It removes both calls with a small change and keeps
  the last published state on a failure. C best protects the codebase, but it
  needs the user.
- **Action:** fix after merge, apply A, because the calls lie outside the
  diff of the branch that found them.
