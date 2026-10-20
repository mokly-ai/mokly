# Npm Release Operations

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

This document supplements the [CI and npm release contract](./npm-release.md)
with package registration, maintainer setup, and the evidence each release
keeps.

## Mokly Registry Bootstrap

npm trusted publishing can be configured only after a package exists on the
registry, so every package's first publication is a reviewed interactive
bootstrap publication, and every later publication uses OIDC through the
release workflow. The [bootstrap record](./npm-bootstrap.md) owns the
procedure: a fresh isolated checkout of an explicit reviewed full commit SHA,
`npm ci`, the package's own pack, source identity recorded beside the archive
hashes, and the registry read-back. `@mokly/mokly` and `@mokly/viewer` are
registered under that record; each `@mokly/native-<target>` package is
registered the same way before the first release that publishes it. The former
unscoped `mokabook` package is reserved and is not a publication target; the
scope does not rename the `mokly` executable. Never repeat a registration,
republish a registered version, or unpublish to undo one. Verify each package's
own trusted publisher before its next release; one package's trust
configuration is not evidence for another.

## Maintainer Setup

Before enabling publish, maintainers must configure and verify:

- repository Actions may create pull requests, and the default workflow token
  has only the permissions declared in each workflow;
- the branch rule requires the exact `Required CI` status;
- the direct-upload Cloudflare Pages project `mokabook` exists with production
  branch `main`, repository variable `CLOUDFLARE_ACCOUNT_ID` is set, and
  repository secret `CLOUDFLARE_PAGES_API_TOKEN` or `CLOUDFLARE_API_TOKEN` holds
  a least-privilege token with Pages write access;
- the protected `npm` environment allows only the workflow's `main` branch, has
  no required reviewer or wait timer, and disables administrator bypass, without
  storing an npm token. Checking out a release tag does not change the workflow
  deployment ref; manual retries must also dispatch from `main`;
- the `RELEASE_PLEASE_TOKEN` credential owner, least-privilege repository
  access, expiry and rotation, and fallback behavior;
- approved Mokly npm maintainer accounts and teams, enforced 2FA, public
  scoped-package access, and the intended initial owner list for all seven
  packages;
- each package's trusted-publisher repository, workflow filename, environment,
  and allowed publish action exactly match the values above; and
- immutable `v*` and `viewer-v*` tag update and deletion protection and who may
  invoke the manual retry with the CLI tag and any newly released viewer tag.

No long-lived npm write token is stored in GitHub Actions. See
[GitHub publishing protections](./npm-github-protections.md) for exact setup,
read-back verification, merge-authorized publishing policy, and credential
blockers.

## Release Evidence

Each release records its checked CLI commit, viewer tag source, and every package
version, the CLI's exact viewer and platform dependencies, every uploaded
tarball and pack report, every registry verification result, the GitHub
releases, the npm URLs, the provenance and signature results, and every
clean-consumer smoke result. The checked package set and native archives stay available for 90 days. A
manual retry supplies the first automatic run id and reuses its bytes.
The preserved verification record identifies
whether the workflow ran the complete gate or reused CI, and in evidence mode
names the selected CI run, evidence commit, matching tree, and report count.
Keep the workflow run and the protection read-backs. An interactive bootstrap
publication has source, hash, and npm signature evidence, not OIDC provenance;
trusted publications generate provenance automatically. Do not claim a
signature check proves an attestation exists. A failed publish never changes a
tag or rebuilds from a branch. Retries use the existing immutable CLI tag and
any newly released viewer tag. A CLI-only retry leaves `viewer_ref` empty.

## Related Docs

- [Package and authoring contract](./mokly-package.md)
- [Runtime protocol](./mokly-runtime.md)
