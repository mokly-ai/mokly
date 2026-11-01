# Check test helper trees for unused exports

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** Yes.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan: user item 109, F18 decision 39, covering F18 review finding 36.
- **Location:** `scripts/verification/ratchets/internal-exports.mjs:12`.
- **Reason:** Option B widens a repository check, and a stricter check needs the
  user.

- **Source:** Review.
- **Category:** Process.
- **Terms:**
  - **Internal-export ratchet:** the repository check in
    `scripts/verification/ratchets/internal-exports.mjs` that fails on an
    export that no other module imports.
- **Background:** The ratchet reads the source roots that line 12 lists:
  `src`, `packages/viewer/src`, and `scripts`. Test helper trees are
  outside it. During the rebuild, one cleanup removed all 47 unused exports
  of the test helper trees, so B then started with no baseline entries. The
  count today is not recorded.
- **Problem:** Unused exports in browser and viewer test helpers can build
  up again without a failure. A review of 2026-10-20 found one: a re-export
  of `branchPointPaths` in `tests/browser/branch_point_test.ts` that no test
  read any more.
- **Impact if no action:** Dead test helpers raise the maintenance cost and
  can hide a wrong fixture API.
- **Root question:** How should the repository keep test helper trees free
  of unused exports?
- **Options:**
  - **A.** Keep the current product-only scope. Effort: Small.
  - **B.** Check `tests/browser`, `tests/helpers`, and
    `packages/viewer/tests`, and leave the catalogue fixtures out. This is a
    stricter check. Effort: Medium.
- **Left out:** Checking authored catalogue fixtures would report exports
  that the catalogue reads on purpose. Only two approaches exist: widen the
  existing check, or keep its scope.
- **Wider fix:** B. The existing ratchet then covers the same class in the
  test helper owners.
- **Previous examples:** Commit `ec52f856` of 2026-10-19 removed an unused
  callback type import from a test. Commit `fe3624df` of 2026-10-20 dropped
  unused viewer lookup operations. The review also found the
  `branchPointPaths` re-export above.
- **Related:**
  [mokly-package-internal-export-audit.md](./mokly-package-internal-export-audit.md)
  extends the same ratchet to the Mokly package sources. Both items change
  the roots of one check.
- **Recommendation:** B. The helper trees started with no baseline entries
  after the cleanup, so the check can start clean.
- **Action:** ask the user, because B extends the internal-export ratchet to the
  test helper trees, a stricter check that the always-on rules reserve for the
  user.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5953).
