# Add UI package export ratchet baselines

- **Severity:** Low (estimate). **Effort:** Small (estimate).
- **Kind:** Post-merge task.
- **Added:** 2026-10-29, from PR #243 and its completed plan, an unchecked
  post-merge task.
- **Location:** `scripts/verification/ratchets/internal-exports.mjs:12` and
  line 13, `scripts/verification/ratchets/public-exports.mjs:30`, and
  `docs/protocol/verification-ratchets.md:21` and line 88.
- **Reason:** The public-export ratchet needs a release tag that carries
  `@mokly/ui`, and the first such tag, `v0.17.0`, appeared only on
  2026-10-29.

- **Terms:**
  - **`@mokly/ui`:** the shared UI package under `packages/ui`. It holds the
    presentational components of the Browse shell and their CSS.
  - **Unused internal export audit:** the ratchet in
    `scripts/verification/ratchets/internal-exports.mjs`. It fails on an
    export that no module imports and no package export exposes.
  - **Public-export ratchet:** the ratchet in
    `scripts/verification/ratchets/public-exports.mjs`. It fails when a
    released export is gone and the upgrade guide does not name it.
- **Background:**
  - PR #243 added `@mokly/ui` on 2026-10-29. Release 0.17.0 carries it. The
    tag `v0.17.0` holds `packages/ui/package.json` at version 0.17.0.
  - The unused internal export audit scans `SOURCE_ROOTS` and reads the
    public exports of `PACKAGE_ROOTS`, at `internal-exports.mjs:12` and line 13. Neither list holds `packages/ui`.
  - `release-please-config.json` has one component, the root `.`. The
    public-export ratchet maps it to `@mokly/mokly`, and it adds the viewer
    as a special case at `public-exports.mjs:30`. It does not audit
    `@mokly/ui`.
  - `docs/protocol/verification-ratchets.md:21` names three source roots,
    and line 88 says that the root component audits the CLI and viewer
    surfaces.
  - The baseline `xtask/unused-internal-exports.txt` may only shrink. So
    each unused export that the audit finds in `packages/ui/src` must be
    removed, not listed.
- **Task:**
  1. Add `packages/ui/src` to the source roots and `packages/ui` to the
     package roots of the unused internal export audit. Extend the baseline
     entry pattern at `internal-exports.mjs:107`.
  2. Make the public-export ratchet audit `@mokly/ui` under the root
     release, with `v0.17.0` as its first baseline tag.
  3. Update `docs/protocol/verification-ratchets.md` with the new source
     root and the audited surface.
  4. Remove each unused export that the audit then finds in
     `packages/ui/src`.
  5. Run `cargo xtask check --suite repository` after
     `git fetch --tags origin`.
- **Impact if no action:** A removed `@mokly/ui` export can ship without an
  upgrade note, and unused exports in the package never fail the
  repository suite.
- **Needs:** The tag `v0.17.0` in the local clone. The task needs no
  deployed change and no credentials.
- **Done when:** The public-export ratchet summary names `@mokly/ui` with
  its `v0.17.0` baseline, the unused internal export audit scans
  `packages/ui/src`, and the repository suite passes.
- **Related:**
  - [mokly-package-internal-export-audit.md](./mokly-package-internal-export-audit.md)
    changes the same `SOURCE_ROOTS` and `PACKAGE_ROOTS` lines for
    `packages/mokly`. One branch can do both.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/ui-package.md?plain=1#L528).
