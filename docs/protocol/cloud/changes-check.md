# Changes Check

The Changes check is the GitHub check run posted for each ready publication
from its durable publication event. An installation-authorized adapter over
the GitHub App's check client delivers it, and the API schedules delivery when
GitHub is configured; the [architecture doc](../../architecture/cloud.md) places the
check workers with the other workers. Webhook handlers mark verified
rerequests in the durable GitHub queue that [GitHub App](./github-app.md)
defines.

## Result

Use the name `Mokly`, the publication head SHA and a stable external ID derived
from its publication ID (`mokly-publication:<publication id>`). Link to
`<app-origin>/<workspace-slug>/<project-slug>/publications/<publication>?view=changes`.
The current slugs are read when the link is minted. Retired claims keep
previously posted check links resolving after either subject is renamed.
The check text is plain product language. Escape Markdown metacharacters and
URL-encode entry paths before constructing links from producer-authored titles.

| Publication outcome                                        | Check conclusion             |
| ---------------------------------------------------------- | ---------------------------- |
| Valid comparison, any number of changes                    | success                      |
| Valid publication without a comparison                     | neutral                      |
| Invalid ingest with an authorized parsed envelope identity | failure                      |
| Storage/network/database outage                            | no failure conclusion; retry |
| Unparseable upload without a trusted head identity         | no GitHub check              |
| Authorization, deadline or superseded attempt              | no failure check             |

A publication has a comparison when its envelope names a base, as
[upload validation](./publication-upload-validation.md#comparison-validation)
defines. A current-only upload has none. An upload whose index reports its
Changes as `unavailable`, because the base sources fail validation, also has
none and gets the neutral result.

For the failure row, an authorized publisher can name any commit SHA in their
own repository in an invalid upload; a nonexistent SHA receives GitHub's 422,
a permanent delivery error. Only an invalid bundle, an unsupported version and
a too-large upload produce a failure check. Internal outages, superseded
retries, authorization failures and expired attempts never produce a red check.

Differences are information, never a reason to fail CI. Summary text reports
changed, added and removed counts. Count the records of the stored catalogue
index under the [Changes count](./publication-review.md#changes-count), each
exactly once. Kind `added` is added, kind `removed` is removed,
and every other counted record is changed, including a paired pure move.
The total is the number of counted records.
Separately count the counted current records with `previousPath` as moved;
this is a subset, not another addition to the total.
For `m > 0`, the exact initial summary string is
`"{c} changed, {a} added, {r} removed.\n{m} moved.\n\n[View Changes]({url})"`.
For `m == 0`, keep
`"{c} changed, {a} added, {r} removed.\n\n[View Changes]({url})"`.
Count its newline and UTF-8 bytes in the existing 60,000-byte budget before
appending entry links. Never drop that line to fit another link; an initial
summary over budget is a delivery error.
Screens, pages, documents, use cases, components and variants each count as
their own entry. Affected consumers and per-viewport render
states do not add changes.
The counts persisted at admission as the immutable viewer observation are the
counts the check reports; admission never waits for asynchronous check
delivery.

Include links for the first twenty counted records in the index's canonical
entry order. That order takes the current records kind by kind,
components, documents, pages, screens and then use cases, each kind in its
index order, and then the removed records in their index order.
A current record links with its current path, and a removed record with its
base path. Labels use the recorded title, capped at 160 Unicode
characters including an ellipsis
before Markdown escaping. The assembled summary is capped at 60,000 UTF-8
bytes (therefore fewer than GitHub's 65,535 characters). Stop appending link
lines at the first line that would exceed the budget, dropping it and all
trailing links; always retain the totals line and View Changes link. An
oversized configured app URL is a delivery error, never an oversized provider
request. These are presentation limits; accepted producer titles are unchanged.
Every link targets that immutable publication's Changes view with its screen/entry
path in `catalogueScreen=<path>`, matching canonical sharing and the key the app reads
and writes back. Include the total and a Changes link even when
there are more than twenty entries. Never infer membership from rendered views.
A check without a comparison says
`Catalogue published.` with a viewer link and no made-up comparison counts.

A failure check requires a parsed upload-v3 envelope whose repository and
config were authorized with the active project token. Ingest
retains that identity before recording rejection, including a later
framing/content/limit error.
An unparseable envelope or an error before it is read produces no check.
Unauthorized repository/config claims are never retained or delivered.

## Provider Delivery

`CheckRuns::upsert` carries
the project ID, a status (`queued`, `in_progress` or `completed`), a conclusion
when completed (`success`, `neutral`, `failure` or `cancelled`), the head SHA,
the external ID, output and details URL. `mkc-publications` implements it over
the GitHub App's `Checks` client. The adapter resolves the project's
repository binding to its installation and canonical `owner/name`, then
updates the `github_check_runs` row recorded for the external ID. With no row,
it lists the head's `Mokly` check runs of this App and matches the external
ID, which recovers a create whose response was lost; only when none matches
does it create the run. Recovery uses `check_name=Mokly`, the configured `app_id`, `filter=all` and
100 rows per page, with a bound of 100 pages. An incomplete or failed list
never permits a create. A created or recovered run is recorded with its
project, repository, GitHub ID, head SHA and external ID. Recording preserves
a concurrent rerequest mark. A recovered run is recorded before its output is
updated. Updates replace the details URL with the current destination.

A project without a repository binding cannot carry a check, and neither can
a project whose installation was disconnected or uninstalled. Their events are marked
delivered without a provider request; these are the only deliveries that no
provider acknowledged. A suspended installation is transient and retries, even when suspension
deactivated its repository selection. An installation bound to a different
workspace conveys no access to this project. A repository removed from an
otherwise connected, active installation is a permanent missing-resource
error.

`mkc-api` runs the delivery loop in-process only with GitHub configuration.
Every five seconds each API replica runs publication and build delivery
batches and their rerequest batches, each bounded to 100 rows. Batches never hold a transaction across a provider request. The
loop consumes `github_check_runs` rows that the [GitHub App](./github-app.md)
handlers mark `rerequested` and clears the mark in the same transaction as the
outbox write it causes. Both consumers claim at most 100 marked rows of their
owner prefix, `mokly-publication:` or `mokly-build:`, through the parent-first
claim in
[Persistence boundaries](./persistence-boundaries.md#build-and-publication-lock-order).
Publication consumption checks the publication, project, bound repository ID
and head SHA, then appends a new due `rerequest` event with zero attempts and
permanent failures. It clears stale, absent or mismatched identities without
writing an event. Build consumption applies the
[build re-run rule](#build-checks) before clearing each mark. A publication rerequest follows the
rerequest rules below.

## Delivery And Rerequests

The interface upserts by stable external ID, repository and head rather than
blindly creating duplicates. Only mark an event delivered after the provider
acknowledges success. A batch considers at most 100 due events, continues after
individual failures and counts successful deliveries.
A due read grants no ownership. Immediately before each event's delivery,
the loop claims that row in its own short transaction. The conditional update
requires an undelivered, non-dead-lettered, due row with the batch's observed
`attempts`. It advances `attempts` once, moves `next_attempt_at` to five minutes
after the claim time and returns the new version and current permanent-failure
count. A lost claim skips the event, including all file and provider reads.
Never claim the whole batch at once or hold a transaction across a provider
request. A claim left by a dead process becomes due after five minutes.
Success and failure writes require the claimed version and a still-undelivered,
non-dead-lettered row. A write that affects no row is a stale outcome and has
no effect. Success marks delivery; failure schedules backoff and updates the
permanent budget and dead letter without advancing `attempts` again. Backoff
uses the pre-claim version, so the delay sequence stays unchanged. Build check queries use the same per-row claim and attempts fence, with
the separate claim deadline below. Both outboxes use these rules during delivery.
The caller may scope a batch to one project: a scoped batch never reads files
or changes retry/delivery state for another project's events, and an unscoped
batch delivers database-wide.

The interface error
classifies HTTP 4xx (including 403, 404 and 422) and local provider validation
as permanent. The provider interface retains otherwise unclassified client
response statuses, including 422, instead of hiding them in internal errors.
HTTP 408, 429, provider-confirmed rate limits (including a 403
rate-limit response), 5xx, timeouts and transport/internal failures are transient.

Each event has a retry version, a separate permanent-failure count, a
next-attempt time and an optional dead-letter time. Claims advance the
version. Only permanent failures consume the five-failure budget;
transient failures stay retryable indefinitely while the publication exists.
Delays are 60, 120, 240, 480, 960, 1920 seconds, then one hour, capped there.
Backoff uses the retry version, regardless of failure class. The fifth
permanent failure dead-letters that event. Future and dead-letter events are
never due, and neither is a claim whose five-minute deadline is still ahead.
A lapsed and reclaimed event rejects the old worker's success and failure
writes, so concurrent workers never count the same failure twice. A database
failure recording the outcome aborts the batch.
A crashed worker may replay delivery, so the provider must reconcile the same
external ID. The caller schedules batches; ready publications never roll back.

Operators can recover a dead letter without an existing GitHub check using
`mkc-api requeue-publication-check --event <event-uuid>`, with only
`MKC_DATABASE_URL` configured. After repairing the provider/configuration cause,
this atomically clears the dead letter and permanent budget and makes the
event due now, retaining its identity. Recovery advances the retry version
rather than resetting it, fencing stale in-flight failures; subsequent backoff
retains the cap. Requeue only affects undelivered dead letters; repeated calls
are harmless no-ops. Run the normal worker batch to deliver it. See
[Check recovery](../../ops/check-recovery.md) for inspection and verification.

Rerequests identify the stored publication, re-read its state and its stored
catalogue index, and upsert the same result with a fresh event retry budget.
They never rebuild, ingest, fetch a moving base or change
publication bytes. An expired publication returns neutral with
a link to the project; it is not invalid ingest. A mismatched repository/head
rerequest cannot update another publication's check. [GitHub App](./github-app.md)
deduplicates webhook deliveries before they reach a rerequest.

## Build Checks

A
[cloud build](./cloud-builds.md) writes its check only through its
`build_checks` outbox, under the external ID `mokly-build:<build id>`, on the
build's head SHA. The details URL is
`<app-origin>/<workspace-slug>/<project-slug>/builds/<build id>` with the
slugs current when the link is minted. The outbox renders the build's state
when it is delivered, so a delayed delivery never writes an older state:

| Build state                         | Status and conclusion     | Title and summary                                                          |
| ----------------------------------- | ------------------------- | -------------------------------------------------------------------------- |
| `queued`                            | `queued`                  | `Waiting to publish`                                                       |
| `running`                           | `in_progress`             | `Publishing`, naming the step                                              |
| `published`                         | completed, as publication | The Changes result of `publication_id`, linking to that publication        |
| `failed` (consumer) or `timed-out`  | completed, `failure`      | `Unable to publish`, the cause and step, the exit code and the output tail |
| `failed` (`plan-required`)          | completed, `neutral`      | `Publishing to private projects is on Team`                                |
| `failed` (`infrastructure`)         | completed, `neutral`      | `Build couldn't run`, with Re-run as the way on                            |
| `failed` (`repository-unavailable`) | completed, `neutral`      | `Build couldn't run`, naming the lost repository access                    |
| `superseded` or `cancelled`         | completed, `cancelled`    | `Replaced by a newer push` or `Publishing cancelled`                       |

The [consumer cause](./cloud-builds.md#build-record) `uncommitted-changes`
uses the consumer-failure row: completed, `failure`, **Unable to publish**,
with the cause, step, exit code when available and output tail. It says "Add
build output to .gitignore and publish again." No `stale-generated-output`
cause exists, because Mokly 0.18.0 has no `build-stale` code.

The `output-limit` summary uses the `output-limit` row of the cause table in
[Viewer builds](./viewer-builds.md#build-card), so the check names the failure
and recovery consistently with the card.
The [runner limits](./cloud-build-runner.md#budgets) distinguish that failure
from retained output elision, which also occurs in successful builds.

The output tail is the last 50 lines of the retained log in a fenced block,
already redacted and normalized with the [build log](./cloud-build-api.md#listbuildlog)
text rules, trimmed to the summary's 60,000-byte budget before the
totals and links. Omit the tail when no nonempty fenced output fits the budget.
A published build uses the publication rules above, including the Changes
count, the moved line and the entry links, but keeps its own external ID and
details URL. An unsupported installed CLI says
`Update Mokly to version 0.18.0 or later.` No event of a
publication that names a
build delivers anything, because the build's outbox already owns that head's
check. A bump makes the outbox row due again, as
[Cloud builds](./cloud-builds.md#publications-and-checks) defines. Delivery,
retry versions, backoff and dead letters follow the rules above, applied to
the outbox row. The build outbox has nullable `claim_expires_at`. A claim
requires an undelivered version, a due row, no dead letter and no live claim;
it advances `attempts` and reserves five minutes through that column. A
state bump increments `version`, makes the row due now and clears the dead
letter and permanent budget, while preserving its claim. Success fences by
claimed attempts, records only the version read by the claim and clears the
claim. A newer version is then claimable at once. Failure fences by claimed
attempts, sets backoff and clears the claim; it increments the current
permanent budget atomically for a permanent error. This keeps a bump's budget
reset when the older delivery fails. Every API replica runs this outbox batch.

Re-run on a build check follows the
[re-run rule](./cloud-builds.md#publications-and-checks): a rebuild only for a
failed, timed-out or cancelled build whose head is still current, and
otherwise a re-delivery of the build's result with a fresh retry budget.
`mkc-api publication-check-status` also counts dead-lettered build checks, and
`mkc-api requeue-build-check --build <uuid>` requeues one the way
`requeue-publication-check` requeues an event.
