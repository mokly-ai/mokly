# Changes Check: Build Checks

This continues [Changes check](./changes-check.md) for the check of each
[cloud build](./cloud-builds.md).

## Build States

A cloud build writes its check only through its `build_checks` outbox, under the external ID `mokly-build:<build id>`, on the
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
A published build uses the publication rules of the
[result](./changes-check.md#result), including the Changes
count, the moved line and the entry links, but keeps its own external ID and
details URL. An unsupported installed CLI says
`Update Mokly to version 0.18.0 or later.` No event of a
publication that names a
build delivers anything, because the build's outbox already owns that head's
check. A bump makes the outbox row due again, as
[Cloud builds](./cloud-builds.md#publications-and-checks) defines. Delivery,
retry versions, backoff and dead letters follow the
[delivery rules](./changes-check.md#delivery-and-rerequests), applied to
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

## Related Docs

- [Changes check](./changes-check.md)
- [Cloud builds](./cloud-builds.md)
- [Viewer builds](./viewer-builds.md)
- [GitHub App](./github-app.md)
