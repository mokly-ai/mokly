# Use one typed lockfile model

- **Severity:** Low (estimate). **Effort:** Large. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan: user item 123, the wider fix of findings 3 and 4 of the pnpm and Yarn review.
- **Location:** `crates/mokly-compare/src/pnpm_lockfile.rs:113` and
  `crates/mokly-compare/src/manager_lockfiles.rs:17`.
- **Reason:** On 2026-10-21 the user deferred the open review items of PR #199
  until after its merge, for the user's later choice.

- **Source:** Review.
- **Category:** Code structure (estimate).
- **Terms:**
  - **Base install:** the private install of the base commit's
    dependencies that Changes runs when the base lockfile differs from the
    working tree.
  - **Locator:** a Yarn Berry key that names a package and the workspace
    that resolves it.
- **Background:** Before a base install, Mokly confines every local path
  in the base lockfiles to the repository. `pnpm_lockfile::walk` reads pnpm
  lockfile scalars and resolves each from its YAML position.
  `manager_lockfiles::validate` reads Yarn lockfile strings: Classic values
  from the lockfile folder, and Berry values from the workspace of their
  locator. Two findings of the pnpm and Yarn review found wrong path
  classification in these scans. Targeted fixes resolved them, the last
  part by lockfile position.
- **Problem:** The scans have no typed importer or locator context. They
  guess which scalar is a path, and the two formats can classify the same
  scalar in different ways.
- **Impact if no action:** A new lockfile shape can bypass the path
  confinement, or reject a value that is not a path.
- **Root question:** How should base validation find exactly the path
  fields of pnpm and Yarn lockfiles?
- **Options:**
  - **A.** Keep the scalar scans with the targeted fixes. Effort: Small
    (estimate).
  - **B.** Parse pnpm and Yarn lockfiles into one typed model with importer
    and locator context. Check only its path fields, and test it with a
    differential corpus against Yarn's parser. Effort: Large.
- **Left out:** Running each package manager as the parser adds tool
  startup and version coupling to base validation. Only two distinct
  approaches exist without a runtime parser: scan scalars, or type them.
- **Wider fix:** B. Typed path fields remove the position guesses in both
  formats.
- **Previous examples:** Those two findings of the pnpm and Yarn review share
  this wider fix. A related follow-up of the same review proposed one parsed
  dependency-input model for identity and source validation.
- **Recommendation:** B. It removes the repeated parser class, despite its
  larger cost.
- **Action:** ask the user, because condition 5 holds: the user reserved
  the choice for each open review item of the rebuild. Condition 3 also
  holds, because B is Large.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6009).
