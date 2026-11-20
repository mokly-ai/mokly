# Audit public exports of model and frame

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** Yes.
- **Kind:** Needs decision.
- **Added:** 2026-11-18, from the branch
  `calummoore/fu-ui-export-ratchet-baseline-psdh`, which added `@mokly/ui` to
  the export ratchets and found this problem outside its scope.
- **Location:** `scripts/verification/ratchets/public-exports.mjs:24`, line 37,
  and line 251, `docs/protocol/verification-ratchets.md:90`,
  `release-please-config.json:70` and line 110, `packages/model/package.json`,
  and `packages/frame/package.json`.
- **Reason:** That branch had approval only for the `@mokly/ui` audit, and a
  stricter gate for two more packages needs the user.

- **Source:** Implementation.
- **Category:** Repository rule.
- **Terms:**
  - **Public-export ratchet:** the repository check in
    `scripts/verification/ratchets/public-exports.mjs`. It fails when a
    released export is gone and `docs/guides/start/upgrade.md` does not name
    it as an inline code span.
  - **Shared root release:** the one Release Please component, `.`, in
    `release-please-config.json`. It releases `@mokly/mokly`, `@mokly/ui`,
    `@mokly/model`, `@mokly/frame`, and `@mokly/viewer` at one version.
  - **Baseline tag:** the newest release tag with the tag prefix of a package
    that `HEAD` reaches. The ratchet compares the package exports at that tag
    with the working tree.
- **Background:**
  - `docs/protocol/verification-ratchets.md:90` says that the shared root
    release audits the CLI, UI, and viewer package surfaces. It names no model
    or frame surface. The code follows that rule.
  - `scripts/verification/ratchets/public-exports.mjs:24` starts from the
    release components. The viewer joins as a special case with its own
    `viewer-v` tags. Line 37 adds `@mokly/ui` as a second special case with the
    root `v` tags.
  - `release-please-config.json:70` and line 110 set the versions of
    `packages/model/package.json` and `packages/frame/package.json` in each
    root release. `docs/protocol/npm-release.md` says that a CLI release
    publishes both packages at the shared version.
  - PR #286 added both packages on 2026-11-04. A bootstrap registration
    published `@mokly/model@0.18.0` and `@mokly/frame@0.18.0` that day, from a
    commit of that pull request and outside any release tag.
  - The tag `v0.18.0` holds neither package. `v0.19.0` of 2026-11-12 is the
    first root release tag that holds them, both at version 0.19.0.
  - `@mokly/model` exports one JavaScript entry, its root. `@mokly/frame`
    exports its root and `@mokly/frame/internal`.
  - `docs/protocol/mokly-frame-package.md` says that only `@mokly/viewer`
    imports `@mokly/frame/internal`. It also says that hosts import the frame
    interface only from the viewer.
  - `docs/protocol/mokly-model-package.md` says that `@mokly/viewer/data`
    re-exports the model rules that it lists. It does not tell hosts to avoid
    `@mokly/model`.
  - The viewer re-exports 14 frame and model names in
    `packages/viewer/src/index.ts` and nine model names in
    `packages/viewer/src/data.ts`, each by name. The viewer audit already
    reports when one of these names leaves the viewer.
  - Other names have no audit. Examples are `encodeUrlPath` and
    `parseLogicalTarget` of `@mokly/model`, and each name of
    `@mokly/frame/internal`.
  - The ratchet compares only with the newest reachable baseline tag. After a
    release ships a removal, the ratchet no longer reports it.
  - At `public-exports.mjs:251`, the ratchet fails with "has no unique package
    location" when the baseline tag holds no package of that name.
- **Problem:** The public-export ratchet does not audit `@mokly/model` or
  `@mokly/frame`, although each root release publishes both. A removed export
  of either package can ship without an upgrade note.
- **Impact if no action:** A host that imports `@mokly/model` directly can
  meet a removed export with no upgrade step. The same holds for a host that
  imports `@mokly/frame`, although the frame contract sends hosts to the
  viewer.
- **Root question:** Which shared root release exports need an upgrade note
  when removed?
- **Options:**
  - **A.** Change nothing. The viewer audit keeps covering the names that the
    viewer re-exports. Removals of the other model and frame names need no
    note. Effort: Small.
  - **B.** Add `@mokly/model` and `@mokly/frame` to the shared root release as
    the `@mokly/ui` special case does, with the root `v` tags. Their first
    baseline tag is `v0.19.0`. Update the "Public Package Exports" section of
    `docs/protocol/verification-ratchets.md` and the ratchet tests. Each
    removal from `@mokly/frame/internal` then needs an upgrade note too,
    although only the viewer imports it. A later package of the shared root
    release can miss the audit again. Effort: Small.
  - **C.** Derive the audited packages from the shared root release. Audit
    each public package of the root workspace list, because the root release
    sets the version of each one. Read that list at `HEAD` and in the working
    tree, as the `@mokly/ui` rule does, so that a working-tree edit cannot
    drop a package. Keep the `viewer-v` tags of the viewer. Skip a package
    until a release tag holds it, so that a new package does not fail the
    audit before its first release. Replace the viewer and UI special cases
    with this rule. Update the protocol section and the tests. The
    `@mokly/frame/internal` cost of B applies too. Effort: Medium.
- **Left out:**
  - Comparing with the packages on npm. It needs network access, and the
    published packages ship `dist` without the `src` entry points that the
    ratchet maps.
  - Auditing only the root entries and skipping `@mokly/frame/internal`. It
    leaves a published subpath without an audit, and it needs an exception to
    the rule that the ratchet reads every key of an export map.
- **Wider fix:** C. One rule derives the audited packages from the shared root
  release, so a new package cannot miss the audit.
- **Previous examples:** `@mokly/ui` joined the shared root release in PR #243
  on 2026-10-29. Root releases `v0.17.0`, `v0.18.0`, and `v0.19.0` shipped it
  before a later change added its audit. `@mokly/model` and `@mokly/frame`
  then joined in PR #286 with the same gap.
- **Recommendation:** C. It covers both packages now and each later package of
  the shared root release, so the gap cannot recur.
- **Action:** ask the user, because C extends the public-export ratchet to more
  packages, a stricter gate that the always-on rules reserve for the user.
