# Scheduled Maintenance

The hourly `auth-prune` CronJob runs the released API image with `prune`, a
ten-minute deadline, no retries and `concurrencyPolicy: Forbid`. It uses the
API Workload Identity and native Cloud SQL proxy sidecar. It mounts no mail,
GitHub, signing or storage secrets. All three deletes commit together. Cloud
builds add a second transaction that prunes finished
[builds](../protocol/cloud/cloud-builds.md#retention-and-recovery), at most 1,000
per run, after `MKC_BUILD_RETENTION_SECONDS` (default 2592000).
Build pruning follows the
[build and publication lock order](../protocol/cloud/persistence-boundaries.md#build-and-publication-lock-order).

```sh
MKC_DATABASE_URL=postgres://USER@HOST/DATABASE mkc-api prune
kubectl -n "mkc-$ENVIRONMENT" create job --from=cronjob/auth-prune auth-prune-manual
kubectl -n "mkc-$ENVIRONMENT" logs job/auth-prune-manual -c maintenance
```

Use a unique manual Job name for subsequent runs. A successful command exits
zero and reports link, session, counter and build counts. A failed command exits
nonzero; inspect database reachability and migration state before retrying.
Never infer success from an empty count or a missing scheduled run.

Retention settings are seconds after expiry, from zero through 31536000:
`MKC_AUTH_LINK_RETENTION_SECONDS=604800`,
`MKC_AUTH_SESSION_RETENTION_SECONDS=86400`, and
`MKC_AUTH_RATE_RETENTION_SECONDS=86400`. The chart owns the same auth defaults.
The runtime setting `MKC_BUILD_RETENTION_SECONDS=2592000` uses the same
0–31536000 bound after a build finishes. Active builds remain. The chart sets
it only on the prune workload through `maintenance.buildRetentionSeconds`,
including when builds are disabled. Prune needs no E2B credential.
Session expiry is the earlier of its absolute deadline and seven days since
last activity. Used-link diagnostics disappear after pruning. Active links,
sessions and admission windows are always retained.

The daily `github-prune` CronJob runs `prune-github` in every environment with
database credentials only. It removes OAuth flow hashes one day after expiry
and terminal raw webhook deliveries 30 days after receipt. Pending and
processing deliveries survive regardless of age.

```sh
MKC_DATABASE_URL=postgres://USER@HOST/DATABASE mkc-api prune-github
kubectl -n "mkc-$ENVIRONMENT" create job --from=cronjob/github-prune github-prune-manual
kubectl -n "mkc-$ENVIRONMENT" logs job/github-prune-manual -c maintenance
```

`MKC_GITHUB_OAUTH_RETENTION_SECONDS=86400` and
`MKC_GITHUB_DELIVERY_RETENTION_SECONDS=2592000` accept zero through 31536000.
The command commits bounded batches, reports both counts and is safe to retry.

The daily `publication-maintenance` CronJob runs `maintain-publications` in
production and main preview, whatever the `github.enabled` value. It uses the
API workload identity for Postgres and the environment's GCS bucket and mounts
no secrets. It never calls GitHub. The command exhausts bounded publication and
object-store pages: it recovers abandoned attempts after their deadline,
prunes failed-attempt records created at least 30 days earlier, removes expired
catalogue grants and deletes unreferenced storage after its 24-hour grace. Successful
publications and their files stay until their project or workspace is deleted.

```sh
kubectl -n "mkc-$ENVIRONMENT" create job \
  --from=cronjob/publication-maintenance publication-maintenance-manual
kubectl -n "mkc-$ENVIRONMENT" logs job/publication-maintenance-manual -c maintenance
```

A successful run exits zero and reports abandoned, pruned, deleted-blob and
deleted-orphan counts. A database or storage failure exits nonzero. Inspect
database reachability, migration state and the API identity's bucket access,
then retry with a new Job name. Object-delete failure leaves an
incarnation-fenced tombstone for the next run. Never infer success from an
empty count or a missing run.

PR previews have no `publication-maintenance` CronJob, because their
principals cannot list the shared bucket. Preview cleanup deletes the
namespace database and then every object under the `pr-N/` prefix; see
[PR retention](../protocol/cloud/pr-preview-environments.md#gcs-identity-and-retention).

All maintenance CronJobs use UTC, `concurrencyPolicy: Forbid`, a ten-minute
deadline and no automatic Job retry. GCS lifecycle deletes only noncurrent
versions and incomplete uploads; it never substitutes for reference-aware
publication cleanup. Provider soft deletion can retain deleted object versions
for seven more days. See [retention](../protocol/cloud/retention.md) and
[authentication persistence](../protocol/cloud/persistence-boundaries.md).
