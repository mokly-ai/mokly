# Release tooling

These scripts prepare, inspect, and publish the CLI, viewer, and native npm
packages. The [release management contract](../../docs/protocol/npm-release-management.md)
defines version selection and publication requirements.

## Release pull request check

Run the component and viewer-source check from the candidate checkout:

```bash
node scripts/release/check-pr.mjs "$RELEASE_BASE_SHA"
```

`RELEASE_BASE_SHA` is the full base commit from the pull request event. The
script reads committed package versions at that commit and at `HEAD`. A viewer
version change requires a CLI version change. Reusing a viewer version compares
its immutable tag with `HEAD`, including source changes already on the PR base.
Only `packages/viewer/tests` is excluded. The diff disables rename detection so
a production source moved into that test directory still counts as a deletion.
The check reads Git history and creates no tag or release.

## Key code

- `check-pr.mjs` checks release PR component selection and viewer reuse.
- `context.mjs` selects immutable tags for automatic releases and retries.
- `refs.mjs` verifies release tags, origin identity, and the clean checkout.
- `package_set.mjs` packs or rechecks the complete release archive set.
- `published_viewer.mjs` downloads the exact viewer archive for CLI-only releases.
- `inspect-native.mjs` checks packed native manifests and TLS dependencies.

## Preparation and publication

`release.yml` calls `release-prepare.yml` at the caller's workflow revision.
The reusable workflow receives only tag, verification, and artifact inputs.
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
