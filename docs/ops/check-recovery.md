# Recover Publication Checks

A transient provider outage keeps checks pending with delays capped at one
hour. Only five permanent failures dead-letter an event. Publication state
and served content are unchanged by delivery failures.

## Inspect And Repair

Use the worker warning's event UUID or inspect the queue with deployment
Postgres credentials. The database must have current migrations applied.

```sh
psql "$MKC_DATABASE_URL" -c "SELECT id, publication_id, attempts, permanent_failures, next_attempt_at, dead_lettered_at FROM publication_events WHERE delivered_at IS NULL AND dead_lettered_at IS NOT NULL ORDER BY id"
```

Match the event to worker diagnostics and fix the rejected payload, repository
access or installation permissions first. A 403 caused by rate limiting is
transient; the adapter must classify it using the provider's rate-limit signal.
A 422 for a nonexistent commit SHA requires a valid publication/head, not
repeated retries. No existing GitHub check run is required for recovery.

## Requeue And Verify

Run the installed binary with database credentials only; mail, file-store and
GitHub credentials are unnecessary for requeueing. For a source checkout:

```sh
RUSTC_WRAPPER= cargo run -p mkc-api -- requeue-publication-check --event <event-uuid>
```

Replace `<event-uuid>` with the inspected ID. The command exits 0 and logs
`requeued=true` when it changed a dead letter, or `requeued=false` for an absent,
delivered or already-pending event. Database/configuration failures exit nonzero.
The operation clears the permanent-failure budget, makes the event due now and
advances its retry version so a stale delivery cannot overwrite recovery.
It preserves the event/publication/check identity and does not call GitHub.

The configured API delivery loop processes due events. Verify
`delivered_at` on that same event and the `Mokly` check in GitHub. Further
permanent failures can dead-letter it again; inspect diagnostics before repeating.
The five-minute `publication-check-status` CronJob logs the current undelivered
publication and build check dead-letter count through the API image, using only
database credentials.
The environment Terraform stack creates a Cloud Monitoring log alert for a
positive count, links this runbook and requires existing operator notification
channels. Alerts are scoped to the namespace and maintenance container, with
one notification per hour and a 30-minute incident auto-close. Auto-close does
not prove delivery: inspect the same event after recovery. Check failed/missing
Jobs separately; the count alert cannot observe a Job that never runs. Failed-publication retention still removes records after 30 days.

The API process runs the
[check delivery loop](../protocol/cloud/changes-check.md#provider-delivery) when
GitHub is configured. It checks at most 100 publication events and 100
publication rerequests, plus 100 build checks and 100 build rerequests, per
five-second iteration on every API replica. A requeued event becomes
eligible on the next iteration. Each worker claims one event immediately
before delivery, advancing `attempts` and setting `next_attempt_at` five minutes
ahead. A live claim is absent from due reads. After a process dies, the event
becomes due at that time without operator action. Outcome writes use the claim
version; lapse and reclaim or operator requeue reject stale success and failure
writes. Claims leave the permanent budget unchanged, and failure keeps the
existing backoff without a second version increment. Provider errors can still
delay delivery.
Requeue and count commands do not call GitHub. A project without a repository
binding, a disconnected installation or an uninstalled App has no provider access;
its event is acknowledged without a check. A suspended installation retries.
Build checks use `mkc-api requeue-build-check --build <uuid>`. The status count
includes their undelivered dead letters. Inspect a build dead letter with:

```sh
psql "$MKC_DATABASE_URL" -c "SELECT build_id, version, delivered_version, attempts, permanent_failures, claim_expires_at, next_attempt_at, dead_lettered_at FROM build_checks WHERE delivered_version < version AND dead_lettered_at IS NOT NULL ORDER BY build_id"
MKC_DATABASE_URL=postgres://USER@HOST/DATABASE mkc-api requeue-build-check --build <build-uuid>
```

Requeue preserves the build identity and advances attempts to fence stale
writes. Verify `delivered_version = version` and the build's `Mokly` check. A
bump during delivery leaves the newer version due after the claim ends.

```sh
MKC_DATABASE_URL=postgres://USER@HOST/DATABASE mkc-api publication-check-status
kubectl -n "mkc-$ENVIRONMENT" get cronjobs,jobs
```

See [Changes check](../protocol/cloud/changes-check.md) for classification and backoff.

## Recover Billing Deliveries

The billing worker retains malformed and exhausted Stripe deliveries by event
ID. Inspect failed rows before recovery:

```sh
psql "$MKC_DATABASE_URL" -c "SELECT id, event, attempts, last_failure, due_at FROM billing_deliveries WHERE status = 'failed' ORDER BY received_at, id"
```

Fix the provider, configuration, or event-data problem first, then requeue one
delivery using database credentials only:

```sh
MKC_DATABASE_URL=postgres://USER@HOST/DATABASE \
  mkc-api requeue-billing-delivery --event <evt_…>
```

The command logs `requeued=true` only when it changes a failed delivery. It
clears the attempt and failure state and makes the retained original bytes due
immediately; it does not contact Stripe. The chart's five-minute status job
runs the matching count command expected by the billing alert:

```sh
MKC_DATABASE_URL=postgres://USER@HOST/DATABASE mkc-api billing-delivery-status
```

That command logs `dead_letter_count` with message `billing delivery status`.
After requeueing, verify the same event reaches `done` or `ignored`; a repeated
failure requires another diagnosis rather than blind requeueing.
