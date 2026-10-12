# Npm Release Operations

This document supplements the [CI and npm release contract](./npm-release.md)
with registry bootstrap history, maintainer setup, retained evidence, and
related documentation.

## Mokly Registry Bootstrap

The repository and release history moved from `futex-ai/mokabook` to
`mokly-ai/mokly`, but npm package names do not move with GitHub repositories.
The former unscoped `mokabook` package remains reserved at `0.8.0`; it is not a
runtime alias or a second publication target. Because npm trusted publishing can
only be configured after a package exists, the scoped `@mokly/mokly` package
required one reviewed bootstrap publication before normal releases could use
OIDC. The attempted unscoped `mokly` registration was rejected by npm's
name-similarity policy; it was never published. The scope change does not reset
release history or rename the `mokly` executable.

Registration completed on 14 September 2026 as `@mokly/mokly@0.8.0`. npm
assigned both `bootstrap` and `latest` despite the explicit bootstrap tag, and
the maintainer accepted that initial `latest`. Keep `bootstrap` on `0.8.0`; do
not remove `latest` or republish to undo registration. The
[bootstrap record](./npm-bootstrap.md) retains the reviewed source and archive
procedure. Its dedicated `scripts/release/bootstrap.mjs` command builds a fresh
isolated checkout of an explicit reviewed full commit SHA and records source
identity beside the archive hashes; ordinary `pack.mjs` does not supply this
bootstrap source proof.

The bootstrap used interactive maintainer authentication, not OIDC. The CLI
subsequently published 0.9.0. Viewer 0.1.0 was registered separately with
interactive authentication on 17 September 2026 from the same reviewed commit as
CLI 0.10.0. The paired workflow verified and skipped the matching viewer archive
before publishing the CLI through OIDC. The
[bootstrap record](./npm-bootstrap.md#completed-viewer-registration) preserves
that boundary. Verify each package's own trusted publisher before its next
release; one package's trust configuration is not evidence for the other.

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
  access, expiry/rotation, and fallback behavior;
- approved Mokly npm maintainer accounts and teams, enforced 2FA, public
  scoped-package access, and the intended initial owner list;
- each package's trusted-publisher repository, workflow filename, environment,
  and allowed publish action exactly match the values above; and
- immutable `v*` and `viewer-v*` tag update/deletion protection and who may
  invoke the manual retry with both tags.

No long-lived npm write token is stored in GitHub Actions. See
[GitHub publishing protections](./npm-github-protections.md) for exact setup,
read-back verification, merge-authorized publishing policy, and credential
blockers.

## Release Evidence

Each pair records one checked commit, both immutable tags and versions, the
CLI's exact viewer dependency, both uploaded tarballs and pack reports, both
registry verification results, GitHub releases, npm URLs, provenance/signature
results and every clean-consumer smoke result. The preserved verification
record identifies whether the workflow ran the complete gate or reused CI, and
in evidence mode names the selected CI run, evidence commit, matching tree and
report count. Retain the workflow run and protection read-backs. The first
interactive viewer registration has source/hash and npm signature evidence,
**not OIDC provenance**; later trusted publications generate provenance
automatically. Do not claim a signature check proves an attestation exists. A
failed publish never changes a tag or rebuilds from a branch; retries accept
only the existing immutable pair.

## Related Docs

- [Package and authoring contract](./mokly-package.md)
- [Build, Browse, and Review runtime](./mokly-runtime.md)
