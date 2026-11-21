# Pull Request Environments

Add the `preview` label to an open same-repository PR to deploy its app. Pushes
update it and rerun its smoke checks; reopening a labelled PR redeploys it.
Removing the label or closing the PR deletes its data and resources.

This runbook describes the lifecycle in the archived
[preview plan](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/pr-preview-environments.md). The shared platform,
the deploy, destroy and sign-in-link scripts, and the workflow wiring are
implemented on `main`. The workflow owns the labelled-PR lifecycle; the
operator commands below remain available for investigation and recovery.

## Review A Labelled PR

1. Add `preview`, then open the **Preview** workflow from the PR checks. Only
   repository writers should label code they trust to run in the shared cluster.
2. Wait for **Preview required**, usually about ten minutes after a push.
   Deployment smoke and the sample project seed must pass; open the run to see
   a failing check. The seed step prints the seed Job's log, which names the
   failed step and its reason. Rerun the workflow to seed again.
3. Open **Catalogue** signed out. It opens this PR's publication in the public
   **Mokly Cloud** sample project, with its mockups and their Changes against
   `main`. Sign in only to use the app. This public repository gets no
   **Open preview** link. So open **App** (`https://pr-N.preview.D/sign-in`,
   where `D` is `MKC_DOMAIN`, `mokly.ai`), and request a link for the shared
   account `preview@mokly.ai` on Sign in. Then
   [read the link](#read-a-sign-in-link), or ask an operator to read it. After
   the sign-in, **Sample project** opens this PR in the app.
4. Review your change. Data survives pushes, including accounts and publications.
   Removing the label or closing the PR deletes that data; save anything you
   need first.

There is one comment marked `<!-- mokly-preview -->`. It shows App, API,
Catalogue, the tested commit and a link to check results. Open preview appears
after a successful deploy when seed sign-in was accepted and the event confirms
the repository is private. That link signs in the shared account without a
request. Anyone who can read the PR can use it until the preview is removed.
Sample project appears only with a completed seed proof. A failed capture or
later seed step can therefore keep Open preview without claiming the sample
project succeeded. After a fully successful run, Catalogue links this PR's
publication, `https://p-<publicationId>.pr-N.preview.C/`. Otherwise it shows
`p-<publication-id>.pr-N.preview.C` as a pattern; the base suffix alone is not
a publication. `C` is `MKC_CATALOGUE_BASE_DOMAIN`
(`moklyusercontent.com`). Updates replace the same comment. A failed update
shows the failure rather than retaining an earlier success. Cleanup changes it
to **Preview removed**, or links to the failed cleanup run for retry.
While deploying, it says **Checks running**. Failed checks say **Checks
failed. Open the run for details.** Failed cleanup says **Cleanup failed. Rerun
the workflow.** A fully successful run says **Checks passed**.

The static site has its own automatic same-repository PR preview at
`https://pr-N.mokly-site.pages.dev`, independent of the `preview` label. Its
`<!-- mokly-site -->` comment names the app review URL too. Fork and Release
Please PRs receive no Pages credentials. Closing a PR removes the site's
branch deployments in its separate workflow; a site cleanup failure does not
mean the app namespace is retained, or the reverse.

## Read A Sign-In Link

Previews deliver every sign-in link to restricted API logs, also the link of
the shared account. A reviewer with namespace pod/log access, authenticated
kubectl and the repository checkout runs:

```sh
export MKC_DOMAIN=mokly.ai
python3 infra/scripts/preview-link.py preview-pr-123 \
  --email preview@mokly.ai
```

Use your PR number and the address you just entered in the app. To review as
another address, request its link on Sign in or Sign up first. The command
prints the newest matching link from the last 15 minutes, waiting up to 30
seconds for it. Open the complete URL, including its `#token=...` fragment, in
the browser where you requested it. A consumed or expired link needs a new
request. For a known request time, add `--since-time 2026-09-22T12:00:00Z`.
`--timeout-seconds` accepts 1–120. If no exact-address event arrives, request a new link and rerun
the same command.
Do not post the URL in the PR or workflow logs: it signs in as that address.
A reviewer without log access asks an authorized operator to retrieve their
link privately. No password or per-PR GitHub App setup is required.

For rollout diagnostics, an operator can inspect the namespace:

```sh
kubectl -n mkc-preview-pr-123 get pods,jobs,pvc,certificate
kubectl -n mkc-preview-pr-123 logs deployment/api -c api --since=10m
```

API logs contain sign-in links; keep them restricted.
[Script interfaces](../protocol/cloud/preview-scripts.md) define exact flags and
error behavior.

## Shared Platform Prerequisites

The [Foundation workflow](./foundation.md) applies the regional address
`mkc-preview-ingress`, shared bucket `mokly-508518-preview-blobs`, two proxied A
wildcards and the existing app/API edge pack. Operators add one shared Origin CA
key/certificate and a catalogue-only DNS token through [Secrets](./secrets.md).
Repository variables `MKC_PREVIEW_INGRESS_IP` and `MKC_PREVIEW_BLOBS_BUCKET`
come from foundation outputs. PRs have no entries in `MKC_INGRESS_IPS`.

Every configured main deploy runs `preview-platform` after `origin-router` and
before `plan-main-preview`. It installs the pinned ingress-nginx and
cert-manager releases in `mkc-preview-system`, updates the two platform Secrets
and verifies `ClusterIssuer/mkc-preview-letsencrypt` and the reserved IP. The
job is required even while production promotion is disabled. A preview run
checks readiness and names `deploy.yml`'s `preview-platform` job when repair is
needed. The preview workflow never installs shared infrastructure.

Each PR owns the following resources; none needs an operator provisioning step:

| Resource                                                | Lifetime                                                 |
| ------------------------------------------------------- | -------------------------------------------------------- |
| Namespace `mkc-preview-pr-N`, release `mokly-cloud`     | Label lifecycle                                          |
| API, catalogue, app and Postgres 16, one replica each   | Label lifecycle                                          |
| Postgres PVC `data-postgres-0`, 2 GiB                   | Preserved across pushes; deleted with namespace          |
| Secrets `postgres-credentials`, `catalogue-signing-key` | Generated once; preserved across pushes                  |
| Secret `preview-sign-in`                                | Generated once; the shared account's sign-in secret      |
| Certificate/Secret `catalogue-tls`                      | Let's Encrypt `*.pr-N.preview.C`; retained across pushes |
| DNS-only A `*.pr-N.preview.C`                           | Preview workflow creates/deletes it                      |
| Objects under `pr-N/` in the shared bucket              | Deleted with the namespace database during cleanup       |
| Conditional bucket IAM for `api` / `catalogue`          | Object-user / object-viewer for that prefix only         |

Exact hosts, IAM expressions, values keys and ownership are in
[PR preview environments](../protocol/cloud/pr-preview-environments.md).
Stable environments retain Cloud SQL, GCE ingress and their existing secrets.

After a change to the ingress path or the trusted-proxy settings of a stable
or a PR environment, prove the client-IP walk live before you rely on it.
Send magic-link requests with a forged `X-Forwarded-For` header both through
Cloudflare and directly to the load balancer. The per-peer admission limit
must count every request against the real peer, so the limit trips (HTTP 429)
after the configured number of requests from one source whatever the forged
header says; a limit that never trips means the forged address was trusted.
The malformed-chain rules in
[REST trusted proxies](../protocol/cloud/rest-proxies.md#trusted-proxies) apply on
both paths.

## Checks And Evidence

PR code builds in an unprivileged job with no cloud credentials or OIDC. Its
three image archives contain the API, catalogue and app. Trusted `main` scripts
push and deploy them, then run the deployment smoke checks. A parallel
unprivileged job runs the PR's own capture tools to capture its mockups exactly as
`mokly publish` would upload them; after smoke, trusted `main` code copies them
to the PR's bucket prefix and runs the seed Job, in which the PR's own API
image publishes them to the **Mokly Cloud** project of `preview@mokly.ai`. See
[Preview seed](../protocol/cloud/preview-seed.md). Capture uses the PR's workspace CLI
and `publish --strict` on the clean committed PR head.
A `git-uncommitted` failure needs a commit, stash or ignore rule. A build
output directory that Git does not ignore also causes it, and the error names
the `.gitignore` rule to add. The repository commits authored
source only and follows
[output ownership](../protocol/cloud/repository-generated-files.md).
The failure stops before a receiver request. Push that correction and rerun;
capture must never publish a different revision from the image build.
Re-recorded CLI test doubles cover the refusal and retain their recorded
bytes unless the real CLI output changes. A re-record script refreshes them
from the workspace CLI, and its `--check` mode compares them.

Capture renders the `origin/main` merge base from its sources with the
workspace CLI. When the base's lockfiles differ from the head's, the CLI
installs the base's locked dependencies without lifecycle scripts.
Require npm registry access and run only trusted main history;
the base render executes the base commit's code.
The unprivileged capture job retains no Actions cache. Its 15-minute publish
limit includes the base render, any base install, the comparison and the
upload. The head install has a separate 15-minute limit and the
job has a 20-minute limit.
See [capture](../protocol/cloud/preview-capture.md#comparison-base) for the base
rules.

A base whose sources fail the current validation makes Changes unavailable,
and capture rejects the resulting upload without a comparison.
Merge a `main` whose sources pass the current validation into the PR and
rerun. A PR that changes capture configuration or upload formats previews
itself with its own tools, as
[format changes](../protocol/cloud/preview-capture.md#format-changes) defines.

Browser tests run in CI against a
local stack on every PR; the preview workflow runs none.

Open artifact `preview-evidence-pr-N` in the run. For 14 days it holds
`deployment-smoke.json`, the DNS/TLS, revision, health and isolation results,
`seed-status.json`, and `seed-proof.json` only after the seeded project,
publication and credential cleanup all pass. Failed runs retain whichever of
those files were written. A missing required report never counts as passing
evidence.

## Cleanup And Recovery

Removing `preview` or closing a same-repository PR invokes
`bash infra/scripts/preview-destroy.sh preview-pr-N`, even if its build failed.
It uninstalls Helm, deletes and waits for the namespace (including PVC and
certificate), removes only its two conditional bucket bindings, deletes live
objects beneath `pr-N/`, and deletes its marked catalogue DNS record. It keeps
shared ingress, DNS wildcards, ACME account, bucket and stable environments.
Seven-day bucket soft deletion can retain recoverable bytes after live objects
are removed. The PR database has no backup or recovery guarantee.

A missing resource is already clean. Provider, permission and timeout errors
fail **Preview required** and the comment links to the failed run. Fix the
reported cause and rerun it; successful earlier steps are safe to repeat.
If namespace deletion is blocked, external cleanup waits until the workloads
are gone. Do not remove finalizers or destroy shared resources to force a pass.
For an operator retry, run the same destroy command with the inputs in the
[script contract](../protocol/cloud/preview-scripts.md). No Terraform apply or
per-PR cloud cleanup follows it.

If an Open preview link leaks, or the sample data needs a reset, remove the
`preview` label and wait for cleanup to pass before adding it again. Namespace
deletion removes the database, the Secret and every session created from it;
re-adding the label creates a new namespace and link, and the seed runs on an
empty database. Each cycle issues a new catalogue certificate, so keep it for
rare resets within the [certificate limits](#costs-and-certificate-limits).

The destroy command needs the common region/domain/zone/shared-address/shared-
bucket inputs, but no revision or image input and no ready preview platform. It
waits 900 seconds for namespace disappearance. If that wait fails it leaves
IAM, objects and DNS in place; after the namespace is gone it tries all three
external cleanup groups before reporting any combined failure.

Helm/certificate/smoke failure restores the prior Helm revision when one
exists, keeping the PVC and Secrets; it never downgrades SQL. A first-install
failure leaves diagnostic resources until retry or cleanup. Push a correction
or rerun the failed workflow; avoid toggling the label solely to retry
certificate issuance.

## Costs And Certificate Limits

| Cost                                                        | Shared or per PR                   | Ends when                                         |
| ----------------------------------------------------------- | ---------------------------------- | ------------------------------------------------- |
| Ingress controller, cert-manager, regional load balancer/IP | Shared                             | Platform is deliberately retired                  |
| API, catalogue, app and Postgres Autopilot requests         | Per PR                             | Namespace deletion finishes                       |
| Postgres persistent disk, 2 GiB                             | Per PR                             | PVC/disk deletion finishes                        |
| GCS bytes, requests and network transfer                    | Shared bucket, measured per prefix | Live deletion plus seven-day soft-delete window   |
| Artifact Registry storage                                   | Three images per PR revision       | Seven-day `preview-` cleanup; release tags remain |
| App/API advanced edge certificate pack                      | Shared existing pack               | Pack retired; no per-PR Cloudflare pack           |

These are cost drivers, not a quoted monthly price. Labelled PRs keep running
until closed or unlabelled; there is no stale-label reaper. Old registry images
may need rebuilding before a stopped preview can start again.

Let's Encrypt permits five certificates for an identical identifier set in a
rolling seven-day window (one replacement capacity refills about every 34
hours), and 50 new certificates per registered domain per seven days across
accounts. Other certificates under `C` share that domain allowance. Namespace
deletion discards the per-PR certificate; repeated relabelling can exhaust the
limit. Redeploy preserves it and cert-manager renews it. Honour the ACME
`Retry-After` on failure; do not recreate the namespace or ACME account to try
to bypass it. See [Let's Encrypt rate limits](https://letsencrypt.org/docs/rate-limits/).

## Verification Record

The operator-run proofs of the preview environments are in the
[preview verification record](./preview-verification.md).
