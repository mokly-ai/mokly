# Audit internal exports in the Mokly package

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** Yes.
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #226 and its completed plan, which put the
  problem outside the scope of its review.
- **Location:** `scripts/verification/ratchets/internal-exports.mjs:12`,
  line 18, and line 118, and `docs/protocol/verification-ratchets.md:3`,
  line 23, and line 181.
- **Reason:** The stale root dates from the package move of PR #199, and the
  review of PR #226 found it outside its diff.

- **Source:** Review.
- **Category:** Repository rule.
- **Terms:**
  - **Unused internal export audit:** the repository ratchet in
    `scripts/verification/ratchets/internal-exports.mjs`. It fails when a
    module exports a name that no other module imports and no package
    export exposes.
  - **Baseline:** the reviewed list of known unused exports in
    `xtask/unused-internal-exports.txt`. It is empty today, and it may only
    shrink.
- **Background:**
  - `docs/protocol/verification-ratchets.md:23` names the three source roots
    of the file-length ratchet: `packages/mokly/src/`, `packages/viewer/src/`,
    and `scripts/`. Line 181 names the four source roots of the unused
    internal export audit: the same three and `packages/ui/src/`.
  - Line 3 of the same page is a status line that links to this item. It
    says that neither ratchet scans `packages/mokly/src/` yet. The
    repository rules remove such a line when its behaviour is implemented.
  - PR #199 moved the `@mokly/mokly` sources from `src` to
    `packages/mokly/src` on 2026-10-25. The root `package.json` is now the
    private workspace `mokly-workspace`, with no `exports`.
  - `SOURCE_ROOTS` at `scripts/verification/ratchets/internal-exports.mjs:12`
    still lists `src`, `packages/ui/src`, `packages/viewer/src`, and
    `scripts`.
  - `PACKAGE_ROOTS` at line 18 lists the workspace root, `packages/model`,
    `packages/frame`, `packages/ui`, and `packages/viewer`, so the audit
    reads no public export of `packages/mokly/package.json`.
  - The baseline entry pattern at line 118 accepts only `src/`,
    `packages/ui/src/`, `packages/viewer/src/`, and `scripts/` paths.
- **Problem:** The audit checks no module under `packages/mokly/src`, which
  holds the shim, the sidecar, and the authoring API. The file-length
  ratchet keeps the same stale root in
  `scripts/verification/ratchets/typescript-length.mjs:7`.
- **Impact if no action:** Unused exports in the largest TypeScript package
  never fail the repository suite. Dead code there grows without notice.
- **Root question:** How does each ratchet scan every source root that the
  protocol names?
- **Options:**
  - **A.** Change nothing, and rely on review for unused exports in
    `packages/mokly/src`. Effort: Small.
  - **B.** Replace `src` with `packages/mokly/src` in `SOURCE_ROOTS` and in
    the baseline pattern. Replace the workspace root with `packages/mokly`
    in `PACKAGE_ROOTS`. Delete each unused export that the audit then
    finds, because the baseline may not grow. The count of such exports is
    not known. Effort: Small.
  - **C.** Apply B through one shared list of source roots and package roots
    that both ratchets import, so that a moved package cannot leave one
    ratchet behind. Fix the root of the file-length ratchet with it. Effort:
    Medium.
- **Left out:** Deriving the roots from the workspaces of the root
  `package.json`. It would add `packages/model/src` and `packages/frame/src`
  to both ratchets, and `packages/ui/src` to the file-length ratchet. The
  protocol names none of these, so it widens the gate beyond the requirement.
- **Wider fix:** C. One list removes the copies that let the
  roots drift.
- **Previous examples:** The file-length ratchet in
  `scripts/verification/ratchets/typescript-length.mjs:7` has the same stale
  `src` root.
- **Related:**
  - [test-helper-unused-exports.md](./test-helper-unused-exports.md) asks
    whether the same audit should also scan `tests/browser`, `tests/helpers`,
    and `packages/viewer/tests`. It changes the same `SOURCE_ROOTS` line,
    but it widens the check for other trees and needs its own decision.
- **Recommendation:** C. It restores the documented roots in both
  ratchets and keeps them in one place.
- **Action:** ask the user, because C restores the roots that
  `docs/protocol/verification-ratchets.md:23` names, but it makes the repository
  gate stricter than the code is today, and the repository rules reserve a
  stricter gate for the user.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/esbuild-resolve-fast-path.md?plain=1#L427).
