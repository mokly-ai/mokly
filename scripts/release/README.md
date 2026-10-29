# Release tooling

These scripts prepare, inspect, and publish the CLI, UI package, viewer, and
native npm packages. The [release management contract](../../docs/protocol/npm-release-management.md)
defines version selection and publication requirements.

## Key code

- `context.mjs` selects immutable tags for automatic releases and retries.
- `refs.mjs` verifies release tags, origin identity, and the clean checkout.
- `targets.mjs` lists the release packages in packing and publication order.
- `package_set.mjs` packs or rechecks the complete release archive set.
- `inspect-native.mjs` checks packed native manifests and TLS dependencies.
- `build-native.mjs` builds, or takes, one target's binary and packs its
  native package archive with a report.
- `bootstrap.mjs` packs one registration archive from a reviewed commit:
  `@mokly/viewer` by default, `@mokly/ui`, or a named `@mokly/native-{target}`
  package on a host of that target. Each JavaScript package is pinned to its
  registration version.

## Preparation and publication

The root Release Please component owns the CLI, UI package, and viewer
versions. The UI package has no tag of its own.
The `release-tags` job creates `viewer-vX.Y.Z` at the root `vX.Y.Z` commit
before native builds or preparation. It uses only the GitHub API with contents
write permission, without a checkout or dependency builds. Reruns accept the
same commit and never update a tag. Manual retries only verify existing tags.

`release.yml` calls `release-prepare.yml` at the caller's workflow revision.
The reusable workflow receives only tag, verification, and artifact inputs.
It has read-only permissions and no inherited secrets. It runs live audits,
verification, packing, and clean-consumer smokes. It returns the checked artifact
run and name, plus the exact Node version selected during preparation.

The publish job waits for that result. It downloads the selected archive set,
uses `npm ci --ignore-scripts`, and runs `pack.mjs --reuse` to inspect the bytes.
It then rechecks tags before the native, UI package, viewer, and CLI registry
sequence.
Its `id-token: write` permission is confined to this publication job. A retry
keeps the original saved archives and does not rebuild them.

Run the release integration and workflow tests with the repository Node test
runner. Keep logs and locally packed archives under `.context/`.

## Native registration

`bootstrap.mjs` packs one registration archive from a reviewed commit and never
publishes. The read-only `native-bootstrap.yml` workflow runs it for the five
native targets on the release build runners and uploads each archive with its
reports. The [bootstrap contract](../../docs/protocol/npm-bootstrap.md#native-package-registration)
holds the registration requirements.

To register the five packages from one machine:

1. Dispatch the workflow from `main`, and find its run:

   ```sh
   gh workflow run native-bootstrap.yml --ref main -f commit={sha}
   gh run list --workflow native-bootstrap.yml
   ```

2. Download each artifact into its own new directory:

   ```sh
   gh run download {run} -n native-bootstrap-{target} -D .context/native-bootstrap/{target}
   ```

3. Review each report against the contract, then publish each reviewed archive
   with an approved maintainer account and 2FA:

   ```sh
   npm publish {archive} --tag bootstrap --access public
   ```

4. Compare the registry with the report, then configure the package's trusted
   publisher and access as the contract requires:

   ```sh
   npm view @mokly/native-{target}@0.0.0 name version dist.integrity dist.shasum
   ```

## GitHub publishing protections

The [protections contract](../../docs/protocol/npm-github-protections.md)
defines the required settings. A maintainer with repository Environments and
Administration write access applies them.

1. Read the current settings first. Keep unrelated protection rules, and update
   a matching ruleset instead of creating a duplicate. Check that no release
   workflow waits for environment approval, because a change to the rule can
   start that job at once.

   ```sh
   gh api repos/mokly-ai/mokly/environments/npm
   gh api repos/mokly-ai/mokly/environments/npm/deployment-branch-policies
   gh api repos/mokly-ai/mokly/rulesets
   gh api repos/mokly-ai/mokly/branches/main/protection
   ```

2. Apply the environment update. Run the deployment-policy `POST` only when the
   read-back does not already contain the `main` branch policy.

   ```sh
   gh api --method PUT repos/mokly-ai/mokly/environments/npm --input - <<'JSON'
   {
     "wait_timer": 0,
     "prevent_self_review": false,
     "reviewers": [],
     "deployment_branch_policy": {
       "protected_branches": false,
       "custom_branch_policies": true
     }
   }
   JSON
   gh api --method POST repos/mokly-ai/mokly/environments/npm/deployment-branch-policies --input - <<'JSON'
   { "name": "main", "type": "branch" }
   JSON
   gh api --method POST repos/mokly-ai/mokly/rulesets --input - <<'JSON'
   {
     "name": "Immutable release tags",
     "target": "tag",
     "enforcement": "active",
     "bypass_actors": [],
     "conditions": {
       "ref_name": { "include": ["refs/tags/v*", "refs/tags/viewer-v*"], "exclude": [] }
     },
     "rules": [{ "type": "update" }, { "type": "deletion" }]
   }
   JSON
   ```

3. Open Settings, Environments, npm. Clear **Allow administrators to bypass
   configured protection rules**, and save. The REST request has no field for
   this switch.
4. Repeat the read commands of step 1, and read the tag ruleset in full with
   `gh api repos/mokly-ai/mokly/rulesets/{ruleset-id}`. Compare the result with
   the contract. Keep the read-back with the release evidence under
   `.context/`.

If a request fails, stop and read back the current state before you retry. Do
not enable publishing while the protection is incomplete. Do not test tag
immutability on a real release tag.
