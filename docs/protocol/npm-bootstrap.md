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
The CLI has subsequently published 0.9.0 and 0.10.0, and the viewer registration
is recorded below. Read back current GitHub and npm settings before any later
release; historical setup evidence does not prove that either package's current
publisher, team access or tag protections remain configured.

## Completed Viewer Registration

`@mokly/viewer@0.1.0` was registered on 17 September 2026 from reviewed commit
`37724a8d62d5f68a76c2fddc3bed92425a1740e0`, shared by tags `v0.10.0` and
`viewer-v0.1.0`. Registration is complete; do not repeat it or publish a 0.0.0
placeholder. The accepted viewer dist-tags are:

```json
{ "bootstrap": "0.1.0", "latest": "0.1.0" }
```

The viewer archive was built in an isolated checkout with the explicit reviewed
commit, then published using interactive maintainer authentication and 2FA. The
paired release workflow rebuilt the viewer from the same commit, required an
exact registry-byte match, verified its npm signatures, skipped republishing it,
and then published `@mokly/mokly@0.10.0` through trusted publishing. Retain
`bootstrap` on viewer 0.1.0 as the registration record.

The initial viewer publication has reviewed-source, inventory, hash and npm
signature evidence, but no OIDC provenance. Its next publication through the
package's own trusted publisher supplies the first viewer OIDC attestation.
Before that release, verify the `@mokly/viewer` publisher names GitHub
organization `mokly-ai`, repository `mokly`, workflow `release.yml`, environment
`npm`, and direct `npm publish`; also verify `mokly:developers` access, public
access, required 2FA and disabled token bypass. The CLI package's trust does not
establish any of those package-specific settings.

The shared GitHub environment remains the main-only OIDC boundary for both
packages, with no required reviewer. Merging a combined Release Please PR
authorizes automatic publication; a manual dispatch from `main` may only retry
an existing immutable tag pair through the same byte and source guards. No npm
write token belongs in GitHub Actions.

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
   the [release token's repository access](./npm-release-management.md#maintainer-setup).
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
