# Public-export ratchet fails with stale release tags

- **Severity:** Low (estimate). **Effort:** Small (estimate).
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #222 and its completed plan, which put the
  failure outside the scope in its first review.
- **Location:** `docs/protocol/developer-test-commands.md:3`,
  `docs/protocol/verification-ratchets.md:101`,
  `scripts/verification/ratchets/git.mjs:139`, and
  `tests/public_export_ratchet_git.test.ts:233` and line 242.
- **Reason:** The failure came from the release tags of the local clone, not
  from the diff of PR #222, and it failed the same way on `origin/main`.

- **Source:** Review.
- **Category:** Process.
- **Terms:**
  - **Public-export ratchet:** the repository check in
    `scripts/verification/ratchets/public-exports.mjs`. It fails when a
    released export is gone and `docs/guides/start/upgrade.md` does not
    name it as an inline code span.
  - **Baseline tag:** the release tag whose package surface the ratchet
    compares with the working tree.
- **Background:**
  - The baseline tag is the newest local tag that matches `v[0-9]*` or
    `viewer-v[0-9]*` and that `HEAD` reaches. `newestReachableTag` in
    `scripts/verification/ratchets/git.mjs:139` runs `git describe` for it.
  - `docs/protocol/verification-ratchets.md:101` states this rule. The
    ratchet fails closed with a `git fetch --tags origin` hint only when no
    matching tag exists at all.
  - A removal note is needed only until a newer release includes the
    removal. The test "a removal note stays required until a newer release
    includes it" in `tests/public_export_ratchet_git.test.ts` checks this.
  - In a release pull request, `.release-please-manifest.json` at `HEAD`
    already holds the next version, which has no tag yet. The test "a
    release pull request audits against the last released tags", at
    `tests/public_export_ratchet_git.test.ts:233`, requires the audit to use
    the last released tags then.
  - The test "the repository public surface has complete release notes" at
    line 242 runs the ratchet on the repository itself.
  - CI checks out the full history with `fetch-depth: 0` in
    `.github/workflows/ci.yml`.
- **Problem:**
  - On 2026-10-28 the ratchet and that test failed in the local clone of
    PR #222 and on `origin/main` at `2dd2937f`. They reported exports
    removed since `v0.14.0` and `viewer-v0.5.0` that the upgrade guide did
    not name.
  - Newer tags already existed on `origin`: `v0.15.0` and `viewer-v0.6.0`
    from 2026-10-20, and `v0.16.1` and `viewer-v0.16.1` from 2026-10-26.
    `HEAD` reached them. So the local clone most likely lacked these tags,
    and the ratchet compared with an old release (estimate).
  - A branch review saw the same failure in one diagnostic run on
    2026-10-29.
  - On 2026-10-30, a read-only run of the audit in a clone with `v0.17.0` and
    `viewer-v0.17.0` reported no finding and one noted removal.
  - So the upgrade guide and the ratchet are correct for a clone with every
    release tag. The gap is one preparation step of a local clone, which no
    page names.
- **Impact if no action:** A local gate in a clone without the newest tags
  fails on removals that a release already includes. An agent can then
  record a false failure, or edit the upgrade guide to satisfy an old
  baseline.
- **Root question:** How does a contributor prepare a local clone so that the
  public-export ratchet compares with the newest release?
- **Options:**
  - **A.** State in "Public Commands And Preparation" of
    `docs/protocol/developer-test-commands.md` that a local repository suite
    or complete gate needs `git fetch --tags origin` first. The ratchet and
    its rules do not change. Effort: Small.
  - **B.** Keep the documented local-tag rule of
    `docs/protocol/verification-ratchets.md:101`, and add no validation and
    no new text. A contributor who sees findings for old removals fetches
    the tags and runs the suite again. Effort: Small.
  - **C.** Fetch the release tags in `cargo xtask check --suite repository`
    before the audit. Every local gate then needs network access to
    `origin`. Effort: Small (estimate).
- **Left out:**
  - Requiring the tag of the version that `.release-please-manifest.json`
    records at `HEAD`. In a release pull request that version is not
    released yet, so the check would fail every release pull request. It
    also adds a new validation.
  - Naming in the upgrade guide every export removed since `v0.14.0` and
    `viewer-v0.5.0`. The guide is correct for the newest release, and such
    notes would only satisfy clones with stale tags.
  - Comparing with the packages on npm. It needs network access like C, and
    the published packages ship `dist` without the `src` entry points that
    the ratchet maps.
- **Wider fix:** C (estimate). A fetch inside the suite removes the stale-tag
  case for every local run, but it makes each local gate depend on the
  network.
- **Previous examples:** On 2026-10-28 the agent of PR #222 opened that pull
  request with this local failure, because the ratchet failed the same way
  on `origin/main`. `AGENTS.md:87` already names a similar preparation step:
  fetch `origin/main` before `cargo xtask source-file-length-lint`.
- **Recommendation:** A (estimate). It names the missing preparation step
  where contributors look for it, with no new failure mode and no network
  dependency in the gate. C best protects the codebase, at the cost of
  network access in every local gate.
- **Action:** ask the user, because condition 6 holds (estimate): this is a
  process finding about how a contributor prepares a local clone.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/render-cache-weight-and-watch-recheck.md?plain=1#L431).
