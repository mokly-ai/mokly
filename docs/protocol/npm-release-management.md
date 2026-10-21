# npm Release Management

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

Continuation of [CI And npm Release Contract](./npm-release.md).

## Release Management

Conventional Commits feed one root release-please Node component through
`release-please-config.json` and `.release-please-manifest.json`. A push to
`main` creates or updates one release PR for the CLI and viewer. An ordinary push with no release does
not publish. The CLI is the root `.` component. Rust-only changes under `crates/` select
a release for both packages. Its package name remains `@mokly/mokly`, so the export audit
checks the public CLI directory. The single
release PR owns the CLI version, which the private root and five platform
packages share, the shared viewer version, the root changelog, the root
lockfile and the release manifest. The CLI keeps `vX.Y.Z` tags
(`include-component-in-tag: false`, `include-v-in-tag: true`). The viewer uses
`viewer-vX.Y.Z` with the same version as the CLI. A newly released viewer tag identifies the CLI release commit. The CLI's
`changelog-path` is `/CHANGELOG.md`; its build copies that root file into the
published package. The root file retains the full release history. The viewer
changelog keeps a Release Please version marker and historical viewer notes.

The [Pull Request Title Contract](./ci-verification.md#pull-request-title-contract)
checks every proposed squash title before merge because release-please reads
that title from `main`. It accepts generated release titles such as
`chore(main): release 0.13.0`. A breaking change uses a title such as
`feat(publish)!: upload catalogue content deltas` and retains its explanatory
`BREAKING CHANGE:` footer in the squash body; the title check does not replace
or generate that body.

The `@mokly/mokly` component also owns the literal documentation version in
`docs/guides/start/install.md` and `docs/guides/ci/github-action.md` through
`generic` `extra-files`. Each version-bearing region is bounded by the Release
Please HTML markers defined in the
[guides contract](./mokly-guides.md#versions-and-releases). Release PRs update
those literals with the `@mokly/mokly` package version; root tests reject drift.

The root release manifest entry owns the shared release version. The historical
viewer entry retains its independent release baseline. Runtime and packaging
gates derive versions from package metadata. `bump-minor-pre-major`
keeps breaking pre-1.0 changes on the minor stream. Published tags are immutable;
versions advance only through the release PR.

The CLI and viewer share one version. The root component owns both package
versions and releases them together. Core-only commits release the CLI, five native
packages, and viewer. Viewer commits also reach the root component. The root Node updater owns the root
version. JSON `extra-files` update the public CLI version, all native versions,
the exact viewer dependency, and their lockfile edges. They preserve the private
root native `file:` links. Release PR checks must pass `npm ci` and the version
agreement gate. The CLI keeps the root changelog and its full release history.

Before merge and tag creation, the release PR updates one shared version for
the CLI, native packages, and viewer. The release workflow then:

1. Selects the root CLI action output and creates the matching viewer tag at
   the same commit. An existing tag must already identify that commit.
   Manual retries supply the CLI tag. Ordinary pushes without a release do nothing.
2. Starts read-only preparation after native builds succeed, or after validated
   retry archives replace those builds. Preparation checks out the immutable
   CLI tag with full history and no persisted checkout credentials.
3. Resolves the latest available Node 24 patch once and installs npm 11.21.0
   without a package cache. Publication uses that same exact Node version.
   Preparation installs the pinned Rust toolchain and Chromium. A tag that
   predates the Rust toolchain pin uses the runner's default toolchain.
4. Verifies that both tags identify clean `HEAD` locally and on origin.
5. Runs dependency installation, the live npm and Rust audits, and verification
   in the read-only preparation job. It reuses applicable complete CI evidence
   for the exact tagged tree or runs the complete strict gate. The
   [release verification evidence contract](./npm-release-evidence.md) defines
   selection and failure semantics. No preparation step receives publication
   credentials or access to the protected npm environment.
6. On the first run, preparation downloads the five native archives and packs
   the viewer and CLI from the same release commit. Every report identifies the
   shared release commit. A retry reuses the original checked seven-package set
   without rebuilding it. Preparation checks packed
   manifests, inventories, runtime licenses, and clean-consumer smokes. It then
   rechecks source and tags and preserves the archives and evidence.
   Publication waits for preparation, downloads that exact saved set, installs
   dependencies with lifecycle scripts disabled, and rechecks archives and tags.
   It runs no Rust build, package build, or consumer smoke. Missing or invalid
   archives stop publication instead of causing a privileged rebuild.
7. Queries npm. A recognized missing-version response (`E404` or `ETARGET`)
   permits a publish; any other lookup failure stops the workflow. An existing
   version must byte-for-byte match the checked report and commit or the
   workflow fails.
8. Publishes the platform packages, then the shared-version viewer, then the CLI.
   Each registry verification completes before the next publication starts.
9. Downloads the registry artifact and rechecks integrity, shasum, file
   inventory, version, optional `gitHead`, the `latest` dist-tag, and npm
   signatures/provenance. Because npm metadata and tarball endpoints may become
   consistent at different times, recognized missing-version or stale dist-tag
   responses retry the complete check after 2, 4, 8, and 16 seconds, then every
   30 seconds until the cumulative delay reaches five minutes. Content,
   provenance, and unexpected transport failures remain fail-closed.

Publishing occurs in the workflow invocation that creates the CLI release.
A manual dispatch from workflow ref `main` retries an existing `publish_ref`
(`vX.Y.Z`); the matching viewer tag is `viewer-vX.Y.Z`. Its required
`artifact_run_id` identifies the original `main` push run with the checked
archive set. The workflow verifies that run's repository, numeric workflow
identity, branch, and event. Its head can differ from the tag commit when a
later push creates the release. The archive recheck binds the saved bytes to
the checked-out tag's commit and tree. An automatic attempt lists only its own
run's artifacts.
Its `verification` input defaults to `evidence`; selecting `complete` forces the
full local gate without making GitHub evidence requests. A single concurrency
group serializes automatic runs and manual retries without cancelling an
in-progress publish. A completed publication is verified and skipped on
retry; a later package cannot publish before the earlier verification succeeds.

Merging the combined Release Please PR is the human authorization to publish.
The `npm` environment does not require a second reviewer: its purpose is to bind
trusted publishing to this workflow and restrict the workflow ref to `main`.
Starting a manual dispatch authorizes only a retry of the supplied immutable tag
release; the source, version and registry-content guards prevent it from selecting
or rebuilding different release bytes.

The publish job alone receives `id-token: write`, plus read-only Actions and
contents access, and runs in the protected GitHub environment named `npm`.
Preparation receives only read-only Actions and contents access. It receives
no inherited secrets. Both checkouts disable credential persistence.
Release-please receives only contents, pull-request, and issue write
permissions. Tag completion receives only contents write permission and runs
no checkout or build. Manual retries verify existing tags and create no tags.
Prefer a repository-owned fine-grained token or GitHub App
credential in the `RELEASE_PLEASE_TOKEN` secret so release PR events trigger
normal checks. The workflow falls back to `GITHUB_TOKEN`; GitHub suppresses most
follow-on workflow events created with that token, so maintainers must verify
the release PR's required checks when using the fallback.

Before this workflow reaches the default branch, the read-only release-check
workflow runs on a push to `rebuild/ci-release-check`. A later manual dispatch
can run the same check after the workflow reaches the default branch. It pins
all five native builds and the seven-package pack, archive recheck, and clean
consumer smoke to the pushed commit. It has no publication job, npm environment,
OIDC permission, inherited secret, or registry write.

## Release Recovery

Release Please reads the merged release PR body as HTML. Changelog text can
carry an angle-bracket placeholder such as `<path>` from a commit message into
that body. The parser treats the placeholder as an unclosed tag that hides the
`</details>` boundaries. Release Please then finds one release without a
component and logs `PR component: undefined does not match configured
component`. It creates no tags, and every later run stops with
`There are untagged, merged release PRs outstanding`. To recover, edit only the
changelog text in the merged PR body: replace each angle-bracket placeholder,
for example with `{path}`. Keep the `<details>` and `<summary>` markup that
Release Please wrote, because it marks each component's release. Then rerun the
Release workflow. HTML entities such as `&lt;path&gt;` do not work: Release
Please decodes them when it rewrites the body for a second parse.

When the tags exist but publication fails, rerun the failed job. Before a
publication, the workflow saves `mokly-release-{cli-version}` with every
checked archive and report. It retains this set and the native build artifacts
for 90 days. Initial uploads use `overwrite: true`. A failed publish-job rerun
downloads the saved set selected by preparation. Only preparation uploads a
first-run set. A preparation retry reuses a saved set without replacing it,
so publication cannot delete the retained copy. No package lifecycle rebuilds reused archives.

Use **Re-run failed jobs**. A full workflow rerun repeats Release Please. The
releases already exist, so Release Please reports no newly created CLI release and
publication is skipped. If the failed-job rerun is unavailable, use a manual
dispatch with the shared CLI tag and the original `artifact_run_id`.

A manual dispatch requires the original automatic run's `artifact_run_id`.
It downloads that run's complete set, rechecks the archive hashes, inventories,
source identities, and consumer smokes, then resumes the registry sequence.
Missing, expired, duplicate, or wrong-source artifacts stop the retry. Do not
rebuild bytes to recover a partially published version. Recover the retained
checked set or prepare a new reviewed release version.

If the first run failed before it saved the complete set, rerun its failed
jobs. Before a new build, a registry lookup must prove all newly released
versions absent. An existing new-release version requires the saved set.
Every release checks all seven newly published packages. Native registrations use
the reserved `0.0.0` version, which no coordinated release publishes, under the
[bootstrap contract](./npm-bootstrap.md#native-package-registration).

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
npm 11.21.0 satisfies publishing and also meets the `npm trust` minimum; trust
management remains a separate interactive command. Trusted publishing creates
provenance automatically on supported GitHub-hosted runners.
