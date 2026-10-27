# Npm Release Operations

This document supplements the [CI and npm release contract](./npm-release.md)
with package registration, maintainer setup, and the evidence each release
keeps.

## Mokly Registry Bootstrap

Every package's first publication is a reviewed interactive registration
under the [bootstrap contract](./npm-bootstrap.md), which owns the registered
packages, the registration procedure, and its rules. Every later publication
uses OIDC through the release workflow. The former unscoped `mokabook` package
is reserved and is not a publication target; the scope does not rename the
`mokly` executable.

## Maintainer Setup

Publishing requires this configuration, and maintainers verify it:

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
  invoke the manual retry with the shared CLI and viewer tags.

No long-lived npm write token is stored in GitHub Actions. See
[GitHub publishing protections](./npm-github-protections.md) for the required
protection state, its read-back, and the merge-authorized publishing policy.

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
the matching viewer tag.

## Related Docs

- [Package and authoring contract](./mokly-package.md)
- [Runtime protocol](./mokly-runtime.md)
