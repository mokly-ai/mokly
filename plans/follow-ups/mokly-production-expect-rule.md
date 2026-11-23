# Mokly production expect calls need one rule

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** Yes.
- **Kind:** Needs decision.
- **Added:** 2026-11-22, from the round 3 review of the branch
  `calummoore/mokly-edit-background-render-olos`, list of problems outside
  the scope, and the checks of its round 4 review.
- **Location:** `crates/mokly-server/src/revision_file.rs:21`
  (`RevisionFile::new`) and `crates/mokly-server/src/snapshot.rs:246`
  (`encode`), the two calls that the review found; `Cargo.toml:67-76`, the
  workspace lint tables; `xtask/src/check/commands.rs:84`, the Clippy stage of
  the Mokly crates; and the shared `rust` skill in the `Firna-AI/skills`
  repository, which forbids `expect` in production code.
- **Reason:** The rule that applies is the shared `rust` skill, which the user
  said on 2026-11-03 that the user changes, and a new lint is the user's
  choice.

- **Source:** Review.
- **Category:** Repository rule.
- **Terms:**
  - **Same-version output:** data that Mokly's own code of the same version
    produced, such as a Serve index or an entry detail that the core encodes.
  - **Workspace lints:** the `[workspace.lints]` tables of the root
    `Cargo.toml`, which a crate uses only when its manifest sets
    `[lints] workspace = true`.
- **Background:**
  - The shared `rust` skill forbids `panic!`, `unwrap`, and `expect` in
    production code.
  - On 2026-11-03 the user decided that Mokly checks data once, where it
    enters from outside. `docs/protocol/mokly-component-review-validation.md`
    keeps that decision. #284, commit `055c95981`, applied it: it removed the
    errors for impossible states of same-version output and added about 126
    production `expect` lines in 12 Mokly crates. Its message says that the
    user changes the shared `typescript` and `rust` skills. The `rust` skill
    still forbids `expect`.
  - The two calls that the review found are of this kind.
    `RevisionFile::new` expects a numeric `revision` in every Serve index and
    current detail. `encode` expects only Mokly JSON shapes with string map
    keys; #284 replaced its `Result` with `InternalError::Model` by this call.
    `encode` also writes the HTTP body of a preview render
    (`crates/mokly-server/src/application.rs:189`), not only a publication.
  - `mokly-server` has five more production `expect` calls of the same
    kind: `response.rs:54`, `preview.rs:136`, and `render_request.rs:183`,
    `:189`, and `:201`. The Mokly crates have about 115 production `expect`
    and 5 production `unwrap` calls in 66 files of 12 crates, and
    `mokly-test-support` has 14 more. Eight more production `expect` lines
    came after #284.
  - `Cargo.toml:73-76` already denies `unwrap_used`, `expect_used`, and
    `panic` for Clippy, and `:70-71` sets `unsafe_code = "forbid"`. All 28
    `mkc-*` crates set `[lints] workspace = true`. No `mokly-*` crate and not
    `xtask` sets it, and the Clippy stage of the Mokly crates passes only
    `-D warnings`.
  - Six Mokly crates hold FFI `unsafe` code in 13 production files, so a plain
    opt-in of the workspace lints would also reject that code.
- **Problem:** The shared `rust` skill forbids the `expect` calls that #284
  added under a user decision, and no lint checks either rule in the Mokly
  crates. So each review finds a rule break that the user decided on purpose.
- **Impact if no action:** Each review of the Mokly crates can report these
  calls again, and new calls of both kinds come in with no check.
- **Root question:** Which rule applies to an impossible state of
  same-version output in Mokly production code, and how is it checked?
- **Options:**
  - **A.** Keep each `expect` with the invariant in its message, and change
    the shared `rust` skill to allow it for an impossible state of
    same-version output, as the user said on 2026-11-03. Effort: Small.
  - **B.** Give the invariants types first, such as a record type that always
    holds a revision, and then deny `expect_used`, `unwrap_used`, and `panic`
    crate by crate, as `crates/mkc-mokly-contract/src/lib.rs:4` allows them
    in unit tests. Effort: Medium.
  - **C.** Return typed errors again. This brings back what #284 removed and
    reverses part of the decision of 2026-11-03. Effort: Medium.
  - **D.** Opt the Mokly crates into the Clippy rules only: a lint table in
    each Mokly manifest, `unsafe_code = "deny"` with a local allow in each FFI
    module, or flags in the Mokly Clippy stage. It is a new lint, so the user
    decides. Effort: Medium.
- **Left out:** Change nothing. Each review would keep finding the same calls.
- **Wider fix:** D, which needs the user.
- **Previous examples:**
  [record-release-expect.md](./record-release-expect.md): three `expect`
  calls in `crates/mokly-sidecar/src/pool_releases.rs`, which #284 also
  added.
- **Related:** [record-release-expect.md](./record-release-expect.md), the
  same rule and the same commit. Its release work waits for the answer of
  this item.
- **Recommendation:** A. It follows the decision of 2026-11-03 and needs no
  code change. B best protects the codebase.
- **Action:** ask the user, because the user said on 2026-11-03 that the user
  changes the shared `rust` skill, and a new lint is the user's choice.
