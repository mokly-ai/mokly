# No lint blocks new standard canonicalize calls

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** Yes.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan:
  user item 166, native CI round 6. Narrowed on 2026-11-01, on branch
  `conductor/rust-rebuild-166-approved-windows-paths`, to its open lint
  question.
- **Location:**
  - `clippy.toml` at the repository root, a new file.
  - In `crates/mokly-cli/tests`: `changes_parent_death_tests.rs:99`,
    `final_render_tests.rs:12`, `opaque_asset_rebuild_tests.rs:112`,
    `serve_js/support.rs:43`, `sidecar_diagnostic_tests.rs:12`, and
    `sidecar_lifecycle_tests.rs:53`.
  - In `crates/mokly-compare/tests`: `cache_concurrency_tests.rs:43`,
    `concurrent_miss_tests.rs:25`, `durability_tests.rs:24` and `:66`, and
    `working_inputs_tests.rs:28`.
  - In `crates/mokly-compare/tests/cache_tests.rs`: lines 22, 53, 81, 114,
    142, 171, 213, 231, and 248.
  - In `crates/mokly-compare/tests/storage_tests.rs`: lines 22, 30, 59, 63,
    67, 72, and 122.
  - In `crates/mokly-graph/tests`: `opaque_asset_tests.rs:184`.
  - In `crates/mokly-sidecar/tests`: `diagnostic_drain_tests.rs:95`,
    `postcss_evidence_tests.rs:71`, `recycle_memory_tests.rs:90`,
    `smoke/negative_zero_tests.rs:21`, and `smoke_tests.rs:36` and `:70`.
  - In `xtask/src/remote/snapshot/_tests_`: `environment_support.rs:80` and
    `:82`.
- **Reason:** The 2026-10-28 answer did the product part at once and
  reserved the new Clippy lint for Cal.

- **Terms:**
  - **Verbatim path:** the Windows form of a path that starts with `\\?\`,
    such as `\\?\C:\repo`. `std::fs::canonicalize` and
    `Path::canonicalize` return it on Windows.
  - **`dunce`:** a Rust crate. `dunce::canonicalize` returns the plain form,
    such as `C:\repo`, when that form can name the location.
  - **`disallowed-methods`:** a Clippy setting in `clippy.toml`. Clippy then
    reports each call of a listed function, with the reason that the
    setting gives.
- **Background:**
  - npm and Node do not treat the verbatim form and the plain form of one
    location as one root. A native CI round of the Rust rebuild found two
    product calls of `std::fs::canonicalize` after a real npm failure on
    Windows.
  - `dunce::canonicalize` keeps the verbatim form for a path over 260
    characters or with a reserved name.
  - On 2026-10-28 the user answered: "do the product part now; the Clippy
    rule waits for Cal." So `SystemDisk::canonicalize` in
    `crates/mokly-git/src/disk.rs` and `SystemTable::canonicalize` in
    `crates/mokly-sidecar/src/memory_table.rs` now call
    `dunce::canonicalize`.
  - The same answer said: "The new `clippy.toml` `disallowed-methods` rule
    and the test conversions of option B are a new lint, so Cal must approve
    them. Keep that part open, and do not start it."
  - A search on 2026-11-01 found no product call of `std::fs::canonicalize`
    or `Path::canonicalize`. Test code has 36 calls in 19 files: 6 in
    `crates/mokly-cli`, 21 in `crates/mokly-compare`, 1 in
    `crates/mokly-graph`, 6 in `crates/mokly-sidecar`, and 2 in `xtask`.
  - The repository has no `clippy.toml`. `cargo clippy --all-targets` also
    checks test code, so the rule reports the 36 test calls too.
  - The rule of option B is:

    ```toml
    disallowed-methods = [
      { path = "std::fs::canonicalize", reason = "returns the Windows verbatim form that npm and Node reject; use dunce::canonicalize" },
      { path = "std::path::Path::canonicalize", reason = "returns the Windows verbatim form that npm and Node reject; use dunce::canonicalize" },
    ]
    ```

- **Problem:** No check stops a new product call of the standard
  canonicalize. Its verbatim result can then reach npm or Node on Windows.
- **Impact if no action:** A refactor can bring back the Windows path
  failure that the 2026-10-28 product change removed. Only a review can
  catch it.
- **Root question:** How does the repository keep the verbatim Windows path
  form out of product code in the future?
- **Options:**
  - **B.** Add the `clippy.toml` rule above, and convert the 36 test calls
    to `dunce::canonicalize`. Clippy then rejects each new call, with the
    reason text. The rule is a new lint. Effort: Medium.
  - **C.** Add no rule. Product code keeps `dunce` through review only.
    Effort: Small.
- **Left out:**
  - **A.** Keep the two standard library calls in product code. It reverses
    the product change that the user approved on 2026-10-28.
  - Normalize paths only where they reach Node. Other Windows consumers of
    the path stay exposed.
- **Wider fix:** B. The lint stops new verbatim paths at their source.
- **Previous examples:** `SystemDisk::canonicalize` and
  `SystemTable::canonicalize` called `std::fs::canonicalize` until the
  2026-10-28 product change, after the real npm failure on Windows.
- **Related:** [verbatim-prefix-helpers.md](./verbatim-prefix-helpers.md)
  concerns two helpers that remove the verbatim prefix before a comparison.
  Both items have the same cause, the verbatim form, so one branch can
  settle both.
- **Recommendation:** B. It keeps all canonicalization on `dunce`, gives a
  reason text for each new call, and stops a repeat of the npm failure.
- **Action:** ask the user, because B adds a lint, and the 2026-10-28 answer
  reserved this lint for Cal.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6231).
