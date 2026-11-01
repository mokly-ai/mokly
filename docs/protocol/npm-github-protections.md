# GitHub Publishing Protections

The [release workflow](../../.github/workflows/release.yml) runs on a push to
`main` or a manual dispatch. Its publish job checks out a release tag, but GitHub
environment rules evaluate the **workflow ref**, not that checkout. Permit only
the `main` branch in environment `npm`; dispatch retries from `main` with
the shared CLI tag as `publish_ref`; its matching viewer tag is derived as `viewer-vX.Y.Z`.
Every retry includes both immutable tags. Merging the combined
Release Please PR authorizes its automatic npm publication. Starting a manual
dispatch authorizes a retry of those already-created immutable tags.

## Required State

- Environment `npm`: no required reviewers, no administrator bypass
  (`can_admins_bypass: false`), no wait timer, and custom branch policies
  enabled. Its deployment policy list holds only `main` with `type: branch`,
  not a tag pattern. Keep the environment as the trusted-publisher identity
  and branch boundary; it is not a second approval after the reviewed release
  PR.
- Active tag ruleset `Immutable release tags`: match `refs/tags/v*` and
  `refs/tags/viewer-v*`, prohibit
  updates and deletion, and grant no bypass. Allow creation so release automation
  can create new tags without a special bypass credential.
- Preserve the existing protected `main` branch and verify it requires the
  exact `Required CI` check. Do not replace branch rules as part of this setup.
- All eight npm packages need their own trusted-publisher and team-access
  settings. They share environment `npm` and its main-only policy; a second
  GitHub environment is unnecessary. The CLI's trust does not cover the UI
  package, the viewer, or a native package.

Publishing stays disabled until a read-back of the environment, its deployment
branch policies, the tag ruleset, and the `main` branch protection confirms
this state. Retain that API read-back alongside release evidence. Do not test
tag immutability by trying to move or delete a real release tag.

## Primary References

- [GitHub environment API](https://docs.github.com/en/rest/deployments/environments#create-or-update-an-environment)
- [GitHub environment protection settings](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments)
- [GitHub ruleset API](https://docs.github.com/en/rest/repos/rules#create-a-repository-ruleset)
