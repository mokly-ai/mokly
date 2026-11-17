# Cloud Builds

A cloud build publishes a catalogue without the consumer's CI. When a push or
pull request reaches an installation-linked project, Mokly Cloud schedules a
build that checks out the head SHA in a one-shot sandbox, runs the consumer's
own `mokly publish`, and uploads through the unchanged
[upload exchange](./publication-upload-exchange.md) with a build-scoped token.
CLI uploads remain available alongside builds. This document owns the
lifecycle; the
[runner](./cloud-build-runner.md) and its [sandbox](./cloud-build-sandbox.md)
own the sandbox steps and the
[build API](./cloud-build-api.md) owns the REST surface. The `Mokly` check
rows are in [Build checks](./changes-check-builds.md).

The [architecture](../../architecture/cloud.md) describes component ownership. The
[API guide](../../../crates/mkc-api/README.md) gives code entry points.

## Availability And Eligibility

Builds are **configured** when the deployment has the complete
builds group (`MKC_E2B_API_KEY`, `MKC_E2B_BUILD_TEMPLATE`,
`MKC_E2B_DEPLOYMENT_ID`) and the GitHub App group; see
[configuration](./cloud-build-runner.md#configuration). Unconfigured
deployments, including every PR preview, schedule nothing and run no worker.

A project **can build** when builds are configured and its repository link
names an active repository in an active, connected installation bound to its
workspace. Creation with `repositoryId` establishes that link. A project without
a repository link never can build. It has no builds, GitHub check or pull
request details. `buildsAvailable` reports exactly this predicate.
A build also publishes only while the project's `publishingAllowed` capability
of [Platform model](./platform-model.md#roles) holds. A public project permits
publishing, as does a private project of a Team workspace. No plan sets a
build count or a build-minute quota. The same
[two-live-attempt limit](./cloud-build-lifecycle.md#claims-leases-and-retries)
applies on every plan. Per-plan build limits were rejected because billing
defines no usage limit.

A build publishes the catalogue that the project's config path names, a JSON
configuration file. The [runner](./cloud-build-runner.md#steps)
defines the Mokly version, the platform and the clean checkout that a build
needs.

Automatic builds starts on for new projects linked to GitHub. A project without
a repository link starts with it off and cannot turn it on. Requested builds
and Re-run require build availability but do not depend on Automatic builds.

A **reference** is a branch of the bound repository, or an open pull request
whose head and base repositories are both the project's bound repository.
A pull request with either repository elsewhere, or whose head repository
is gone, never builds until an approval flow exists. The
[fork fact](./viewer-read-model.md#pull-requests--listpullrequests) makes this
eligibility rule available to reference readers.

A closed or merged pull request receives no new build. A build already queued
or running when it closed keeps running and can publish; closing the pull
request does not cancel or supersede it.

## Triggers

| Trigger (`trigger`)   | Reference and head                                | Comparison base               |
| --------------------- | ------------------------------------------------- | ----------------------------- |
| `push`                | Default branch; reconciled current tip            | None (current-only)           |
| `pull-request`        | Pull request; reconciled head SHA and head branch | Pull request base branch      |
| `setup`               | Default branch at project creation; stored tip    | None                          |
| `request` (branch)    | Named branch; stored tip                          | Default branch, or none on it |
| `request` (pull req.) | Named pull request; stored head                   | Pull request base branch      |
| `rerun`               | The re-run build's reference, head and base       | As that build                 |

`push` fires for a push to the repository's stored default branch that leaves
a tip (tag refs and deletions never build). `pull-request` fires only for the
`opened`, `reopened` and `synchronize` actions. Both use the head the handler
has just reconciled from GitHub, never the payload's, so a delayed delivery
cannot build an old head. Both require automatic builds on. `setup` runs when
an installation-linked project with automatic builds on is created: after the
project commits, and before the create request is answered, the API reads the
default branch tip through the installation and schedules; a provider failure
schedules nothing and never fails the creation.

Every trigger schedules only for a project that can build and whose
`publishingAllowed` holds, and never when a
ready publication exists for `(project, head SHA, config path)` or an active
(`queued` or `running`) build exists for `(project, head SHA)`. Automatic,
`setup` and `rerun` triggers skip silently; requests are refused as the
[build API](./cloud-build-api.md#requestbuild) defines. Webhook triggers
commit in the handler's durable-effect transaction, together with its
reconciliation. Requests and `setup` read GitHub first and then run one
serializable scheduling transaction that rechecks every rule.

Requested and setup builds take the observation time before the provider read.
In the scheduling transaction they record the reference observation through
the same guarded write as webhook triggers: an older observation never
replaces a newer one. They then read the reference back and schedule from the
head the database holds. The ready-publication and active-build duplicate
checks, including `build-already-published` and `build-already-active`, use
that stored head. A request therefore never schedules or supersedes with a
head older than the newest recorded one.

## Build Record

[Cloud build records](./cloud-build-lifecycle.md#build-record) defines stored
fields, states and failure causes.

## Claims, Leases And Retries

[Cloud build leases](./cloud-build-lifecycle.md#claims-leases-and-retries)
defines worker claims, capacity, attempt fences, finalization and retries.

## Supersession And Cancellation

A branch build's reference is `(project, branch)` with no pull request; a pull
request build's is `(project, pull_request)`. Scheduling a `push`,
`pull-request`, `setup` or `request` build moves every queued build, and every
running build without a `publication_id`, of the same reference with a
different head to `superseded`, sets `superseded_by` to the new build and
`finished_at`, and bumps their check outboxes, in the scheduling transaction.
A `rerun` supersedes nothing.

`cancelBuild` moves a queued build, or a running build without a
`publication_id`, to `cancelled` at once. Any other build is returned
unchanged, because it is terminal or its upload already committed. A
superseded or cancelled running build stops authorizing uploads immediately,
because ingest requires `running`; its worker notices at the next renewal. A
ready commit and a supersession or cancellation serialize: whichever commits
first wins.

Both transitions apply the [attempt-ending upload rule](./publication-ingest.md#ending-build-attempts)
in that same transaction.
They follow the
[build and publication lock order](./persistence-publication-storage.md#build-and-publication-lock-order).

## Publications And Checks

A plan authorized by
a build grant creates its attempt with `publications.build_id` set. When that
attempt's completion answers 201, or 200 for the publication already ready
for the head, ingest consumes the grant and sets the running build's
`publication_id` in the same transaction, as
[Publication ingest](./publication-ingest.md#build-uploads) defines; the
worker or lease recovery then makes the `published` transition. The build may
name a publication that another producer committed first. Upload cleanup for
every attempt end follows [Publication ingest](./publication-ingest.md#ending-build-attempts).
The ready transaction follows the
[build and publication lock order](./persistence-publication-storage.md#build-and-publication-lock-order).

Grant consumption reads the shared clock after it holds the project, build,
grant and completion publication locks. The grant expiry, attempt deadline
and lease expiry must all be strictly later than that reading. A lock wait
or a transaction retry cannot keep an expired grant or lease valid. A failed
consumption rolls back the ready transition and its other writes.

`build_checks` is the build's check outbox: `version`, `delivered_version`,
`build_id`, `attempts`, `permanent_failures`, `next_attempt_at`,
`dead_lettered_at` and nullable `claim_expires_at`,
with the retry and dead-letter rules of
[Changes check](./changes-check.md#delivery-and-rerequests). A bump increments
`version`, makes the row due now, clears `dead_lettered_at` and resets
`permanent_failures`; `attempts` keeps counting as the retry version. A bump
leaves a live claim unchanged. Per-row delivery claims, attempt fences,
success/failure writes and requeue follow
[Build checks](./changes-check-builds.md). The
delivery loop renders the build's current state under the external ID
`mokly-build:<build id>`; only this outbox writes that check, and no event of
a publication that names a build delivers a check.

On a `mokly-build:` check it schedules a `rerun` build only for a
`failed`, `timed-out` or `cancelled` build whose head is still its reference's
last observed head (the branch tip in `github_branches`, or the pull request
head in `github_pull_requests`, including its retained head and base repository
IDs for the fork rule) and only when the rules in
[Triggers](#triggers) allow it; that build gets its own check. Otherwise,
including every superseded or published build, the outbox re-delivers the
build's current result with a fresh retry budget. A re-run therefore never
publishes a head older than its reference's current one.

Both build and publication Re-run workers claim marks through the same
[parent-first query](./persistence-publication-storage.md#build-and-publication-lock-order).
They clear each mark in the transaction that schedules its replacement build,
bumps its result outbox or inserts its publication event. Busy parents or
checks stay marked for a later batch. No provider request runs in that transaction.

## Retention And Recovery

`mkc-api prune` deletes builds whose `finished_at` is at or before
`now - MKC_BUILD_RETENTION_SECONDS` (default 2592000, thirty days; 0–31536000),
oldest first and at most 1,000 per run, cascading their grants, log chunks and
check outbox, together with the failed publication attempts that name them.
Ready and expired publications keep their rows with `build_id` set to null.
Active builds are never deleted. Project deletion cascades every build; its
worker stops at the next renewal.

Retention and parent deletion follow the
[persistence lock order](./persistence-publication-storage.md#build-and-publication-lock-order).
The [parent deletion contract](./persistence-boundaries.md#table-ownership) also
defines deletion with published builds.

Recovery needs no scheduled retention worker: the claim loop reclaims expired
leases, and every five minutes the worker reconciles the deployment's
sandboxes as the [sandbox contract](./cloud-build-sandbox.md#reconciliation)
defines.

## Verification

Unit tests use unimock at the store, runner, clock, entropy, credential and
check boundaries: eligibility, every trigger, skip rules, supersession,
cancellation races, workspace and process limits, lease renewal and
recovery, token-mint failures, plan refusals, every outcome mapping, retry
backoff and exhaustion, and the re-run rule. Postgres tests cover the partial unique
index, claim fencing, log fencing, the workspace limit and retention. An
integration suite runs the real worker against Postgres with a fake runner
that uploads a released fixture through the real plan, blob and completion
services with the minted grant. It proves every runner
and grant outcome, claim refusals, lease recovery, retry backoff and exhaustion,
including stored state, cause, exit code, step, log completion and check bumps.
It also proves the `published` transition and the check sequence. A signed-webhook API smoke
proves scheduling, scoped credentials, output and failure checks. The fake
runner also proves a rejected upload ends with `upload-rejected` and its
publish exit code.

Postgres regressions hold expired build A's row while another replica starts
queued build C beside a second live build. A's old owner then attempts to
renew. Renewal fails and at most two leases remain live. Tests also cover the
exact expiry boundary. The
[lock-order overlap and parent deletion tests](./persistence-boundaries.md)
cover the full completion path and published builds.

One App browser test follows a build that the real API runs. The API runs
the build with a fake runner in place of the sandbox. The runner uploads a
released fixture through the upload exchange with the minted grant. The test
requests the build in the App. It follows the build card to `published`
through the real build and log reads. It then opens the published catalogue.
Routed build answers alone were rejected, because they hide a mismatch
between the build reads and the App. A browser test against the real API for
each build state was rejected, because routed answers reach the many states
quickly.
