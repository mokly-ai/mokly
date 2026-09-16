# One-Time Mokly Registry Bootstrap

The public scoped `@mokly/mokly` package was registered on 14 September 2026 as
`0.8.0`, the accepted initial consumer release. Registration is complete; do not
repeat it. Follow the [release contract](./npm-release.md) for all later
versions. Never move an existing Git tag or reset release-please state to
recreate a version.

## Completed Registration

The published archive came from reviewed merged commit
`bf1f5be35f7296a185081b0cb830e068577eb598`. Registry hashes, inventory and npm
signatures matched the retained archive, and all five registry-consumer smoke
suites passed.

The publication explicitly requested `--tag bootstrap`, but npm also assigned
`latest` and rejected both attempts to remove that tag. The maintainer accepted
`0.8.0` as the initial `latest`. The accepted registration tags are:

```json
{ "bootstrap": "0.8.0", "latest": "0.8.0" }
```

Keep `bootstrap` on `0.8.0`; subsequent reviewed releases advance `latest`.
Do not remove `latest`, republish `0.8.0`, or unpublish the package to undo this
accepted registration. This was an interactive maintainer publication, not an
OIDC publication; npm signatures alone do not prove workflow provenance.

Trusted publishing, team access and the package's 2FA requirement are configured.
The CLI has subsequently published 0.9.0. Read back current GitHub protections
before publishing the new viewer package; the historical setup record is not
evidence that both tag streams or both npm packages are protected.

## Viewer First Publication

`@mokly/viewer` is a second public package in the existing `@mokly` npm
organization. It returned E404 on 15 September 2026. Scope ownership alone does
not grant every member package creation, team write access or a trusted
publisher. An approved organization maintainer must have permission to create
public scoped packages and grant `mokly:developers` read/write access to this
package, with required 2FA and token bypass disabled.

The first viewer version is **0.1.0**. The manifest's 0.0.0 is only
release-please's pre-release seed; do not publish a 0.0.0 placeholder. Trusted
publishing is package-specific and requires an existing package, so register
the real 0.1.0 with interactive maintainer authentication:

1. Merge the reviewed implementation, then review the combined release PR.
   Confirm CLI 0.10.0, viewer 0.1.0, the CLI's exact dependency, both changelogs,
   lockfile and required checks. CLI 0.9.0 already exists and cannot be reused.
2. Merge that release PR to create `v0.10.0` and `viewer-v0.1.0`. Keep the
   protected `npm` job awaiting approval during registration. Check both local
   and origin tags identify the same reviewed commit; do not create tags by hand.
3. Check out that commit cleanly, `npm ci`, run `cargo xtask check`, and verify
   both refs with `node scripts/release/verify-ref.mjs v0.10.0 viewer-v0.1.0`.
   Confirm `npm view @mokly/viewer` still returns recognized E404; other errors
   stop registration. If it exists, inspect its versions, ownership and retained
   evidence instead of repeating bootstrap.
4. Supply the independently reviewed full commit SHA to the isolated builder:

   ```sh
   node scripts/release/bootstrap.mjs <reviewed-full-commit-sha> .context/viewer-bootstrap @mokly/viewer
   ```

   This packs only `packages/viewer` from a fresh checkout after `npm ci`, runs
   its real prepack build and license/inventory checks, and records `sourceCommit`
   and `sourceTree`. The destination contains `mokly-viewer-0.1.0.tgz` and
   `pack-report.json`. The command never publishes. It rejects any other viewer
   version, dirty sources, lifecycle mutations or an existing destination.

5. Inspect those bytes and source hashes, then use interactive 2FA to publish
   that retained tarball with `--access public --tag bootstrap --ignore-scripts`.
   Verify registry hashes, inventory and npm signatures against the report.
   Ensure `latest` identifies 0.1.0 before the paired workflow proceeds; npm may
   assign it on registration, otherwise an authorized maintainer sets it after
   verification. Retain `bootstrap` on 0.1.0. Do not repeat the CLI bootstrap.
6. Add a **separate** trusted publisher on `@mokly/viewer`: GitHub organization
   `mokly-ai`, repository `mokly`, workflow `release.yml`, environment `npm`,
   direct `npm publish` allowed. Verify owner/team access, public access and 2FA.
   The shared GitHub environment needs no duplicate entry; its tag ruleset must
   cover `viewer-v*` as well as `v*`.
7. Approve the pending workflow or dispatch its retry from `main` with both
   tags. It builds and smokes both exact archives, verifies and skips the
   existing viewer, and only then publishes the CLI. Any byte/commit mismatch
   is a blocker, never a reason to overwrite a version or weaken the guard.

The interactive viewer registration proves reviewed source, hashes and npm
signatures, not OIDC provenance. Record that distinction; the next viewer
publication through trusted publishing supplies its first OIDC attestation.
No npm write token belongs in GitHub Actions. This procedure is post-merge work;
preparation of the implementation publishes nothing and creates no release tags.

## Reviewed Source And Archive

The following records the pre-publication procedure, retained for audit and
archive reproduction. Registration required merged migration/review fixes on
`main`, before merging the Release Please PR:

1. Confirm `npm view @mokly/mokly` returns a recognized missing-package response.
   Stop on other lookup errors or if a package already exists; do not overwrite
   or repeat registration.
2. Check out the reviewed migration commit from `main`, including its review
   fixes, with no staged, unstaged, or untracked source changes. Fetch `main`
   first and verify the chosen commit is the intended merged source.
3. Install dependencies with `npm ci` and run `cargo xtask check`. The bootstrap
   command builds and packs but does not replace this complete verification.
4. Supply that independently reviewed full 40-character SHA explicitly. Do not
   use a branch name, abbreviated SHA, or blindly derive approval from `HEAD`:

   ```sh
   node scripts/release/bootstrap.mjs <reviewed-full-commit-sha> .context/bootstrap-artifact
   ```

The command requires `HEAD` to equal the supplied SHA, a clean source tree, and
`@mokly/mokly@0.8.0`. It fetches that exact commit into a fresh temporary checkout,
installs the lockfile with `npm ci`, and runs the package's `prepack` build via
`npm pack`. Ignored local `dist`, dependencies, and caches cannot leak into that
checkout. The isolated fetch is depth-one: partially fetched workspaces do not
need unrelated historical blobs, and build scripts must not require Git history
before the reviewed commit. It checks the runtime license closure and package allowlist, verifies
the source is still clean and pinned after lifecycle scripts finish, and
recomputes the archive hashes before exposing the result.

The destination must not already exist. On success it contains exactly:

- `mokly-mokly-0.8.0.tgz`: npm's scoped archive filename, to inspect and publish
  without rebuilding;
- `pack-report.json`: npm's inventory, size, version, integrity and shasum,
  extended with independently verified `sourceCommit` and `sourceTree` Git IDs.

These Git fields link the retained report and exact archive bytes to the
reviewed checkout. They are local build evidence, not npm-generated `gitHead`
or signed OIDC provenance; the bootstrap is an interactive maintainer publish.
Keep the report with the archive. The command never publishes, changes package
versions, moves refs, or edits the source checkout. Temporary build data is
removed on success and failure.

## Registration And Trusted Publishing

The completed publication used an approved npm maintainer account with 2FA
after inspection of the report's source SHA, package identity, inventory and
hashes. These are historical commands; do not repeat the publish command:

```sh
npm publish .context/bootstrap-artifact/mokly-mokly-0.8.0.tgz --access public --tag bootstrap --ignore-scripts
npm view @mokly/mokly@0.8.0 name version dist.integrity dist.shasum
npm view @mokly/mokly dist-tags --json
```

Registry hashes were compared to the retained report. Both initial tags are
recorded above; accepting `latest` does not change the reviewed archive or
release-managed version state. Before the next release:

1. Verify npm trusted publishing on `@mokly/mokly` for GitHub organization `mokly-ai`,
   repository `mokly`, workflow `release.yml`, environment `npm`, allowing the
   workflow's direct `npm publish` action.
2. Verify `mokly:developers` retains read/write access to the scoped package,
   publishing requires 2FA, and token bypass is disabled. Store no npm write
   token in GitHub.
3. Verify the [GitHub publishing protections](./npm-github-protections.md) and
   the [release token's repository access](./npm-release.md#maintainer-setup).
4. Review and merge the next Release Please PR only after those prerequisites
   are satisfied. Its new `vX.Y.Z` tag identifies the next release; the verified
   trusted publication advances `latest` while `bootstrap` stays on `0.8.0`.
5. Verify package contents, owner/team access, metadata, provenance, dist-tags,
   `npx --package @mokly/mokly mokly --version`, and a minimal clean build/serve fixture. Only then
   deprecate every `mokabook` version with a move notice; do not unpublish it.

## Development Evidence

`tests/release_bootstrap.test.ts` uses real isolated Git/npm fixtures to prove
dirty/ref/name/version rejection, scoped archive naming with the unchanged
`mokly` executable, exclusion of stale ignored output, source/hash
evidence, destination preservation, symlinked temporary roots, partial source
clones with missing historical blobs, and rejection of lifecycle input mutations.
Run it with `node --import tsx --test tests/release_bootstrap.test.ts`.
`tests/release_bootstrap_viewer.test.ts` additionally proves the isolated viewer
first-publish identity, version restriction and lifecycle mutation rejection.
