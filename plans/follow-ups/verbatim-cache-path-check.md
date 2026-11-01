# Normalize verbatim cache paths before safety checks

- **Severity:** Low. **Likelihood:** Rare. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan: user item 179, delta review 4.
- **Location:** `crates/mokly-compare/src/locations.rs:40`,
  `crates/mokly-compare/src/locations.rs:27`, and
  `crates/mokly-compare/src/locations.rs:84`.
- **Reason:** A user rule of 2026-10-21 deferred each new review item of
  PR #199 until after its merge, for the user's later choice.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Verbatim path:** the Windows `\\?\C:\` form of a path. Windows uses it
    for a path over 260 characters or with a reserved name.
- **Background:** Mokly keeps its comparison caches outside the repository
  and fails with `UnsafeCache` when the cache directory is inside it.
  `locations.rs` resolves the repository and the cache directory with
  `dunce::canonicalize`. On Windows, `LOCALAPPDATA` selects the cache root.
  `dunce` returns the plain form when it can, and keeps the verbatim form
  for a long path or a reserved name. The check then uses
  `directory.starts_with(&repository)`.
- **Problem:** The standard library compares path prefixes by kind, so a
  verbatim cache path never starts with a plain repository path. The check
  misses only when `LOCALAPPDATA` points into the repository through such a
  path.
- **Impact if no action:** In that case, Mokly can write cache data inside
  the source tree.
- **Root question:** How should the cache check compare two Windows paths
  that can use different forms?
- **Options:**
  - **A.** Normalize both paths to one form before the containment check,
    and keep the returned path. Effort: Small.
  - **B.** Document the long-path limit. Effort: Small.
- **Left out:** A string-prefix check stays unsafe across separators and
  path aliases.
- **Wider fix:** A. One path form protects every containment check.
- **Previous examples:** None found.
- **Related:** [windows-canonical-paths.md](./windows-canonical-paths.md)
  concerns the same Windows path forms in other modules. One branch can
  align both.
- **Recommendation:** A. It keeps the cache safety rule for long Windows
  paths.
- **Action:** ask the user, because the user reserved the choice for each open
  review item of the rebuild.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6375).
