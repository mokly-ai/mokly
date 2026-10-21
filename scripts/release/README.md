# Release tooling

These scripts prepare, inspect, and publish the CLI, viewer, and native npm
packages. The [release management contract](../../docs/protocol/npm-release-management.md)
defines version selection and publication requirements.

## Key code

- `context.mjs` selects immutable tags for automatic releases and retries.
- `refs.mjs` verifies release tags, origin identity, and the clean checkout.
- `package_set.mjs` packs or rechecks the complete release archive set.
- `inspect-native.mjs` checks packed native manifests and TLS dependencies.

## Preparation and publication

`release.yml` calls `release-prepare.yml` at the caller's workflow revision.
The reusable workflow receives only tag, verification, and artifact inputs.
The root Release Please component owns the CLI and viewer versions.
The `release-tags` job creates `viewer-vX.Y.Z` at the root `vX.Y.Z` commit
before native builds or preparation. It uses only the GitHub API with contents
write permission, without a checkout or dependency builds. Reruns accept the
same commit and never update a tag. Manual retries only verify existing tags.
It has read-only permissions and no inherited secrets. It runs live audits,
verification, packing, and clean-consumer smokes. It returns the checked artifact
run and name, plus the exact Node version selected during preparation.

The publish job waits for that result. It downloads the selected archive set,
uses `npm ci --ignore-scripts`, and runs `pack.mjs --reuse` to inspect the bytes.
It then rechecks tags before the native, viewer, and CLI registry sequence.
Its `id-token: write` permission is confined to this publication job. A retry
keeps the original saved archives and does not rebuild them.

Run the release integration and workflow tests with the repository Node test
runner. Keep logs and locally packed archives under `.context/`.
