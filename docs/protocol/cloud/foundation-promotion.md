# Foundation Promotion

This contract defines how CI plans and applies the shared foundation Terraform
root, `infra/terraform/foundation`. It extends
[Infrastructure promotion](./infrastructure-promotion.md), which covers the
`main-preview` and `production` environment roots. The bootstrap root, which
owns only the Terraform state bucket, stays operator-applied. Decision: CI does
not apply bootstrap, because a CI identity that can change its own state bucket
adds risk and the bucket almost never changes.

## Workflow And Approval

The Foundation workflow, `.github/workflows/foundation.yml`, plans and applies
foundation on every push to `main` and on every manual dispatch from
`refs/heads/main`. The push or the accepted dispatch is the approval. There is
no second review. Every job refuses any other ref. Foundation runs are
serialized, and a new run never cancels a run in progress.

1. The read-only plan identity saves `release.tfplan`, `plan.txt` and
   `plan.json` in one workflow artifact. The plan job publishes the artifact
   even when the destructive-action policy blocks the plan.
2. The foundation identity downloads that artifact. It regenerates the JSON
   from the binary plan, checks the policy again and applies that exact binary
   plan. Applying never creates a replacement plan.
3. The required aggregate rejects a failed, cancelled or unexpectedly skipped
   plan or apply. Only a wholly unconfigured cloud identity skips both, and the
   aggregate reports the skip.

A CI apply accepts only a `push` or `workflow_dispatch` event from
`foundation.yml@refs/heads/main`. The workload identity federation trusts that
workflow ref, and no other, for the foundation identity. When cloud identity is
configured but the foundation identity secret is not, the apply job fails and
names the missing secret.

Decision: a separate small workflow applies foundation, not jobs inside the
Deploy workflow, so that the only code path that can assume the foundation
identity is that workflow file and the scripts it runs. A separate repository
was rejected: it needs a second toolchain and a pinned shared module, orders
merges by hand and loses the test that reads both roots. A GitHub environment
with required reviewers was rejected because it keeps a manual step.

## Identities

- **Plan identity.** The existing read-only identity plans foundation. Its
  foundation read role contains only `get`, `list`, `getIamPolicy` and
  `getAttestationRules` permissions for the resource types that the root
  declares, and no object permission. It reads only the read-only Cloudflare
  token.
- **Foundation identity.** `mkc-github-foundation` applies foundation. It holds
  one custom role with an exact permission list for the resource types that the
  root declares, object access to the state bucket, and read access to
  `mkc-cloudflare-foundation-token`. That token has DNS edit and SSL and
  Certificates edit on the app/API zone only. It has Zone Settings edit only
  when Terraform manages the zone settings.

The foundation identity can change project IAM, so it is owner-equivalent inside
the project. Main-branch protection and the Foundation workflow file are part of
its credential boundary. Decision: a dedicated identity applies foundation, not
a wider environment apply identity, so that the environment apply role stays
limited to the resources of the environment root.

## Deploy Waits For Foundation

The Deploy workflow waits for the Foundation run of its own commit before its
first credentialed job. Image builds need no credentials and run in parallel
with the wait.

- The wait passes only when the newest Foundation run of that commit on `main`
  completed with success.
- It fails with the run address when that run failed, was cancelled or ended
  with any other conclusion.
- It fails when no Foundation run of that commit appears within 5 minutes.
- It fails when the run does not complete within 120 minutes.
- It never passes on a queued or in-progress run.

When a newer push supersedes a queued Foundation run, GitHub cancels the queued
run. GitHub normally cancels the queued Deploy run of that commit too. A Deploy
run of that commit that already started fails at the wait. The Deploy run of
the newer commit continues.

Decision: Deploy finds the Foundation run by commit. A `workflow_run` trigger was
rejected because its commit is the branch head at event time, not the commit
that the Foundation run applied.

IAM changes take effect after a propagation delay, so a credentialed job
directly after a Foundation run that changed IAM can fail with a permission
denial. The [Foundation apply runbook](../../ops/foundation.md) gives the recovery
for that denial and for a failed Foundation run.

## Destructive Actions

Foundation follows the
[destructive-action rules](./infrastructure-promotion.md#destructive-action-approval)
of the environment roots. Its approval document lives at:

```text
infra/terraform/foundation/destructive-approvals/foundation.json
```

The document's `environment` field is `foundation`. Its `configurationDigest`
covers every `.tf` and `.terraform.lock.hcl` file under the foundation root and
the shared Terraform modules. The
[runbook](../../ops/foundation.md#destructive-foundation-plans) generates it from
the real plan.

## Trust Set

The trust set is the resources that CI needs to authenticate, read, lock state
and apply foundation:

- the workload identity pool, its provider, every GitHub service account and
  their workload identity bindings;
- the plan and foundation custom roles and their project bindings;
- the project roles of the plan identity;
- the state-bucket grants;
- the plan and foundation Cloudflare token IDs and their access grants.

In GitHub Actions, the policy rejects every delete, replacement or forget of a
trust resource, with or without an approval document. The failure names the
operator path. Creates, reads, no-ops and in-place updates of trust resources
pass. Outside GitHub Actions, the normal approval rule applies.

Decision: CI creates and updates trust resources but never deletes, replaces or
forgets them. Routine trust updates, such as a new trusted workflow, stay
automatic, and a delete, replacement or forget cannot lock CI out. An in-place
update, such as disabling the identity pool, or a new authoritative IAM
resource can still remove the access of CI. An operator then recovers it.
Refusing every trust change was rejected because routine updates would wait for
an operator. Letting an approval authorize destructive trust changes was
rejected because a merged mistake could remove the access that CI needs to
repair it. Guards against a lock-out by an update were rejected, such as a
contract test that rejects authoritative IAM types or a policy refusal of an
update that disables the pool, because an operator can recover that case by
hand.

## Operator Path

An operator applies only these changes:

- the bootstrap root;
- the first foundation apply, which creates the foundation identity, its role,
  its trust and its token ID;
- deletes, replacements and forgets of trust resources;
- imports of existing objects into the foundation state, directly before the
  merge of the change that declares them;
- recovery from any lock-out, when CI cannot authenticate, read state, read its
  token, plan or apply foundation.

Decision: an operator imports an existing object directly before the merge of
the change that declares it. Terraform `import` blocks in the change were
rejected, because imports are rare and each import is coordinated with its
merge.

The operator path uses the same plan, check and apply actions outside GitHub
Actions, with the operator identity. An import uses Terraform import with the
operator identity. A plan reads the read-only Cloudflare token
and an apply reads the operator token. A destructive operator apply needs an
exact approval document, which outside GitHub Actions may be uncommitted. The
[runbook](../../ops/foundation.md#destructive-foundation-plans) gives the
procedure.
