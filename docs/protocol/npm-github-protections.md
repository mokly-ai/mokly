# GitHub Publishing Protections

The [release workflow](../../.github/workflows/release.yml) runs on a push to
`main` or a manual dispatch. Its publish job checks out a release tag, but GitHub
environment rules evaluate the **workflow ref**, not that checkout. Permit only
the `main` branch in environment `npm`; dispatch retries from `main` with the
existing paired tags as `publish_ref` and `viewer_ref`.

## Required State

- Environment `npm`: required reviewer `calummoore`, no administrator bypass,
  no wait timer, and a custom branch-only deployment policy for `main`.
- Self-review is allowed while `calummoore` is the sole maintainer. Approval
  remains an explicit human step, not an independent-person control. When a
  second approved maintainer is available, add them and enable
  `prevent_self_review` to require independent approval.
- Active tag ruleset `Immutable release tags`: match `refs/tags/v*` and
  `refs/tags/viewer-v*`, prohibit
  updates and deletion, and grant no bypass. Allow creation so release-please
  can create new tags without a special bypass credential.
- Preserve the existing protected `main` branch and verify it requires the
  exact `Required CI` check. Do not replace branch rules as part of this setup.
- Both npm packages need their own trusted-publisher and team-access settings.
  They share environment `npm` and its reviewer/main-only policy; a second GitHub
  environment is unnecessary. The CLI's existing trust does not cover the viewer.

## Apply With An Authorized Maintainer Credential

First read the existing settings. Preserve unrelated reviewers/policies if
the settings changed since this runbook was prepared; update an existing
matching ruleset instead of creating duplicates.

```sh
gh api repos/mokly-ai/mokly/environments/npm
gh api repos/mokly-ai/mokly/environments/npm/deployment-branch-policies
gh api repos/mokly-ai/mokly/rulesets
gh api repos/mokly-ai/mokly/branches/main/protection
```

Use a credential with repository Environments and Administration write access.
Confirm `gh api users/calummoore --jq .id` is `4988117` before applying the reviewer.
The repository's initial environment has no reviewers or deployment policies.

```sh
gh api --method PUT repos/mokly-ai/mokly/environments/npm --input - <<'JSON'
{
  "wait_timer": 0,
  "prevent_self_review": false,
  "reviewers": [{ "type": "User", "id": 4988117 }],
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

Then open Settings → Environments → npm and clear **Allow administrators to
bypass configured protection rules**, and save. GitHub's documented REST
create/update-environment request does not expose this switch; do not assume
an extra `can_admins_bypass` request field applies it. The read-back must report
`can_admins_bypass: false` before publishing is enabled.

If any request fails, stop and read back the current state before retrying. Do
not enable publishing while protection is incomplete. Equivalent settings are
available in repository Settings → Environments → npm and Settings → Rules →
Rulesets. These commands do not store tokens or change npm package ownership.

## Verify And Retain Evidence

Repeat the four read commands above. In the environment, require a
`required_reviewers` protection rule with the approved user, the intended
`prevent_self_review` setting, `can_admins_bypass: false`, and custom branch
policies enabled. The deployment policy list must contain only `main` with
`type: branch`, not a tag pattern. Read the tag ruleset in full with
`gh api repos/mokly-ai/mokly/rulesets/<ruleset-id>` and verify its active status,
tag target, both `v*` and `viewer-v*` conditions, both rules, and empty bypass list. Check `main`
protection's required status checks include `Required CI`.

Retain the API read-back alongside release evidence. Do not test immutability
by trying to move or delete a real release tag.

## Workspace Credential Blocker

At the migration review, the workspace credential could read the environment and ruleset
list, but attempts to update the environment or create the tag ruleset return
HTTP 403 `Resource not accessible by integration`. That read-back showed an
unprotected environment and empty ruleset list; detailed `main` protection was
also denied although `main` reported `protected: true`. This is historical
evidence, not current state. Re-read and retain both streams' settings with an
authorized credential. Committing this runbook applies no external protections.

## Primary References

- [GitHub environment API](https://docs.github.com/en/rest/deployments/environments#create-or-update-an-environment)
- [GitHub environment protection settings](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments)
- [GitHub ruleset API](https://docs.github.com/en/rest/repos/rules#create-a-repository-ruleset)
