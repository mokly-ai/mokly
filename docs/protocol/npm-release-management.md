# npm Release Management

Continuation of [CI And npm Release Contract](./npm-release.md).

## Release Management

Conventional Commits feed two release-please Node components through
`release-please-config.json` and `.release-please-manifest.json`. A push to
`main` creates or updates a release PR; an ordinary push with no release does
not publish. The single release PR owns both package versions and changelogs,
the root lockfile and the release manifest. The CLI keeps `vX.Y.Z` tags
(`include-component-in-tag: false`, `include-v-in-tag: true`). The viewer uses
`viewer-vX.Y.Z`, with component `viewer` and `packages/viewer/CHANGELOG.md`.
Both tags must identify the same reviewed release commit.

The [Pull Request Title Contract](./ci-verification.md#pull-request-title-contract)
checks every proposed squash title before merge because release-please reads
that title from `main`. It accepts generated release titles such as
`chore(main): release 0.13.0`. A breaking change uses a title such as
`feat(publish)!: upload catalogue content deltas` and retains its explanatory
`BREAKING CHANGE:` footer in the squash body; the title check does not replace
or generate that body.

The root component also owns the literal documentation version in
`docs/guides/start/install.md` and `docs/guides/ci/github-action.md` through
`generic` `extra-files`. Each version-bearing region is bounded by the Release
Please HTML markers defined in the
[guides contract](./mokly-guides.md#versions-and-releases). Release PRs update
those literals with the root package version; root tests reject drift.

The viewer manifest is seeded at **0.0.0**, not 0.1.0, to record that it has no
prior release. Its per-package `initial-version` is explicitly **0.1.0** because
release-please 17.6.0 otherwise treats the missing prior release as 1.0.0 rather
than applying a conventional bump to the 0.0.0 marker. The working viewer
package is already 0.1.0 so clean local workspace installs can resolve the CLI's
exact dependency before that release. Subsequent release PRs own both package
versions; the initial-version setting is ignored after a release exists, and no
runtime or packaging gate may remain hardcoded to 0.1.0. `bump-minor-pre-major`
keeps breaking pre-1.0 changes on the minor stream. The requested 0.8.0 → 0.9.0
CLI pairing was overtaken by main's already published `v0.9.0` (`87daaa4`,
release PR #73). The current manifest retains that released **0.9.0** state, so
this feature proposes **CLI 0.10.0** with **viewer 0.1.0**, tagged `v0.10.0` and
`viewer-v0.1.0`. Never reuse 0.9.0 or move its tag; release-managed package
versions advance in the release PR.

The `node-workspace` plugin uses `updateAllPackages: true` to propose both
packages whenever either releases, including a patch of an otherwise unchanged
package. It preserves the CLI's exact dependency (no caret or local link).
Versions remain independent; `linked-versions` would incorrectly force them
equal and is unnecessary for a combined PR. A viewer `extra-files` JSON updater
also sets the root lockfile's `packages[""].dependencies["@mokly/viewer"]`:
release-please 17.6.0's workspace updater handles linked workspace versions but
does not update that root dependency edge. Release PR checks must pass `npm ci`
and the same version-pair gate before merge.

The release workflow then:

1. Selects both release-please tags (the viewer uses the path-prefixed action
   output), or explicit manual `publish_ref` and `viewer_ref` inputs. An
   incomplete pair fails closed; ordinary pushes do nothing.
2. Checks out the CLI tag with history on a GitHub-hosted runner.
3. Resolves the latest available Node 24 patch for the single publish job and
   installs npm 11.7.0 without a package cache. Rust 1.95.0 and Chromium are
   installed only when complete verification is selected.
4. Verifies both local and remote tags identify `HEAD`, the source tree is clean
   including untracked files, and each tag matches its package version.
5. Runs `npm ci`, performs the live workspace dependency audit, then selects
   applicable complete CI evidence for the tag's exact tree or falls back to the
   complete `cargo xtask check` gate. The
   [release verification evidence contract](./npm-release-evidence.md) defines
   candidate selection, validation and failure semantics.
6. Packs viewer then CLI, validates both packed manifests and inventories plus
   the runtime license closure, and smoke-tests those exact paths in clean
   consumers. Each archive has its own integrity, shasum, inventory and size
   report under `release-artifact/viewer` or `release-artifact/cli`. Rechecks
   the source and tags after lifecycle scripts and preserves both artifacts.
7. Queries npm. A recognized missing-version response (`E404` or `ETARGET`)
   permits a publish; any other lookup failure stops the workflow. An existing
   version must byte-for-byte match the checked report and commit or the
   workflow fails.
8. Publishes the checked viewer path publicly with npm trusted publishing when
   absent; completes its registry verification before publishing the CLI path.
9. Downloads the registry artifact and rechecks integrity, shasum, file
   inventory, version, optional `gitHead`, the `latest` dist-tag, and npm
   signatures/provenance. Because npm metadata and tarball endpoints may become
   consistent at different times, recognized missing-version or stale dist-tag
   responses retry the complete check after 2, 4, 8, and 16 seconds, then every
   30 seconds until the cumulative delay reaches five minutes. Content,
   provenance, and unexpected transport failures remain fail-closed.

Publishing occurs in the workflow invocation that creates both GitHub releases.
A manual dispatch from workflow ref `main` retries an existing `publish_ref`
(`vX.Y.Z`) and `viewer_ref` (`viewer-vX.Y.Z`) pair through the identical path.
Its `verification` input defaults to `evidence`; selecting `complete` forces the
full local gate without making GitHub evidence requests. A single concurrency
group serializes automatic runs and manual retries without cancelling an
in-progress publish. A completed viewer publication is verified and skipped on
retry; the CLI cannot publish before that verification succeeds.

Merging the combined Release Please PR is the human authorization to publish.
The `npm` environment does not require a second reviewer: its purpose is to bind
trusted publishing to this workflow and restrict the workflow ref to `main`.
Starting a manual dispatch authorizes only a retry of the supplied immutable tag
pair; the source, version and registry-content guards prevent it from selecting
or rebuilding different release bytes.

The publish job alone receives `id-token: write`, plus read-only Actions and
contents access, and runs in the protected GitHub environment named `npm`.
Release-please receives only contents, pull-request, and issue write
permissions. Prefer a repository-owned fine-grained token or GitHub App
credential in the `RELEASE_PLEASE_TOKEN` secret so release PR events trigger
normal checks. The workflow falls back to `GITHUB_TOKEN`; GitHub suppresses most
follow-on workflow events created with that token, so maintainers must verify
the release PR's required checks when using the fallback.

## Registry Operations And Evidence

Registry bootstrap history, maintainer setup, retained release evidence, and
the related documentation follow the separate
[npm release operations contract](./npm-release-operations.md).

## Current External Requirements

Implementation must re-check these primary references because release tooling
changes over time:

- [npm trusted publishers](https://docs.npmjs.com/trusted-publishers/)
- [npm scoped public packages](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/)
- [npm package executables](https://docs.npmjs.com/cli/npm-exec/)
- [npm package metadata](https://docs.npmjs.com/files/package.json/)
- [release-please action](https://github.com/googleapis/release-please-action)
- [release-please manifest and workspace plugins](https://github.com/googleapis/release-please/blob/v17.6.0/docs/manifest-releaser.md)

As rechecked on 15 September 2026, npm trusted publishing requires Node 22.14 or
newer and npm 11.5.1 or newer. Use npm 11.15 or newer for `npm trust`
management, including allowed-action permissions added in 11.15. The package
must already exist before a trust relationship can be configured. The workflow's
npm 11.7.0 satisfies publishing; use npm 11.15 or newer only for the separate
interactive trust-management command. Trusted publishing creates provenance
automatically on supported GitHub-hosted runners.
