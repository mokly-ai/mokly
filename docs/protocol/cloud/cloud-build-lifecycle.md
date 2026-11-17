# Cloud Build Records And Leases

This sub-contract of [Cloud builds](./cloud-builds.md) defines build records,
worker claims, attempt leases, retries and outcome mapping. The parent defines
availability, triggers, cancellation, supersession, publications and retention.

## Build Record

`builds` columns: `id` (UUID v7), `project_id` (cascade), `repository_id`
(the bound `github_repositories` row), `trigger`, `branch`, `head_sha` (40 or
64 lowercase hex), nullable `pull_request`, nullable `base_ref` (null means
current-only), `config_path`, `state`, nullable `step` (the running step, or
the step a failure stopped in), `attempt` (attempts started),
`next_attempt_at`, nullable `attempt_operation_id`, `lease_token`,
`lease_expires_at` and `deadline_at`, nullable `failure_cause` and
`exit_code`, nullable `publication_id` (set null on delete), nullable
`superseded_by` (set null on delete), `log_bytes`, `log_head_sequence`,
`log_sequence` (last allocated sequence, never reset),
`log_elided_bytes`, `log_complete`, `created_at`, nullable `started_at` and
`finished_at`. SQL constraints require both lease fields only in `running`, require its
operation ID, deadline, positive attempt and start time, tie
`finished_at` to terminal states, a failure cause to `failed` and `timed-out`,
allow a nullable `exit_code` for every failure cause only in `failed`,
and require `publication_id` for `published`. Upload rejections and plan
refusals keep the CLI's exit code when one is available. The last operation ID and
deadline remain after an attempt ends, so its final log writes stay fenced.
SQL also validates triggers, steps, streams, head hashes, positive PR numbers,
32-byte unique grant digests, nonnegative counters, chunk sizes and the log
cap. A partial unique index allows
one active build per `(project_id, head_sha)`. Claim, live-lease, reference,
publication, repository, supersession, outbox and retention indexes bound the
queue and cleanup reads.

`build_upload_grants` columns: `id` (UUID v7), `build_id` (cascade),
`attempt`, `token_digest` (32-byte SHA-256, unique), `expires_at` (the
attempt's deadline), nullable `consumed_at`, nullable `outcome` and
`created_at`, unique per `(build_id, attempt)`. `outcome` is `accepted`,
`rejected`, `plan-required` or `unavailable`, recorded and ranked as
[Publication ingest](./publication-ingest.md#build-uploads) defines.

| State        | Meaning                                                | Next states                                                             |
| ------------ | ------------------------------------------------------ | ----------------------------------------------------------------------- |
| `queued`     | Waiting for a worker until `next_attempt_at`           | `running`, `superseded`, `cancelled`, `failed`                          |
| `running`    | One attempt holds the lease                            | `queued`, `published`, `failed`, `timed-out`, `superseded`, `cancelled` |
| `published`  | Its attempt's upload committed or replayed a ready one | None                                                                    |
| `failed`     | A consumer failure, a plan refusal or Mokly's failure  | None                                                                    |
| `timed-out`  | A step exceeded its absolute or idle budget            | None                                                                    |
| `superseded` | A newer head on the same reference replaced it         | None                                                                    |
| `cancelled`  | A project member cancelled it                          | None                                                                    |

Failure causes are typed. `exit`, `upload-rejected`, `unsupported-lockfile`,
`unsupported-mokly-version` and `output-limit` end `failed` and are the
consumer's to fix; `deadline` and `idle` end `timed-out`; `plan-required` ends
`failed` and is the workspace's plan; `infrastructure` and
`repository-unavailable` end `failed` and are Mokly's. `uncommitted-changes`
ends `failed` and is the consumer's to fix. No `stale-generated-output` cause
exists, because the pinned CLI has no `build-stale` code. A
failure's `step` is `checkout`, `install` or `publish`, or null when no step
was running.

## Claims, Leases And Retries

The worker loop runs in every API process when builds are configured.
Build-enabled deployments run at least two API replicas. The chart rejects
a lower `scaling.minReplicas` when builds are enabled. Each replica runs claims, checks and sandbox
reconciliation. Database fences coordinate all replicas. It polls
every two seconds, claims again at once after a claim, and runs at most
`MKC_BUILDS_PER_PROCESS` attempts (default 4). Each claim is one serializable
transaction selecting the first row by `(next_attempt_at, created_at, id)`
that is either `queued` and due, or `running` with an expired lease. A queued
row is claimable only while its workspace has fewer than two running
builds with live leases. The persistence query locks the workspace row
before recounting live leases, then locks its first eligible build with
`FOR UPDATE SKIP LOCKED`. The caller starts, rejects or recovers that build
before this transaction commits. This serializes starts within each
workspace under READ COMMITTED too; expired-lease recovery has one owner.
Every build start rechecks the limit under the same workspace lock. A concurrent
claim can find no unlocked candidate and return idle; the next poll retries.

Recovery and attempt starts follow the
[build and publication lock order](./persistence-boundaries.md#build-and-publication-lock-order).

Claims, renewals and upload-grant consumption use current time to decide
ownership. A lock wait or transaction retry cannot make an expired lease or
grant valid. An attempt's start time, lease expiry and deadline use the time of
the successful ownership decision. Starting an attempt rechecks eligibility
and workspace capacity.

Recovering an expired running row ends that attempt: `published` when it has a
`publication_id`, otherwise an infrastructure failure (below); either way its
log is complete and its sandbox is left to reconciliation. Starting an
attempt first rechecks that the project can build, otherwise the build ends
`failed` with `repository-unavailable`, and then `publishingAllowed`,
otherwise it ends `failed` with `plan-required`. It then increments `attempt`, sets a
fresh `attempt_operation_id`, a unique lease token, `lease_expires_at` two
minutes ahead, `deadline_at` fifteen minutes ahead and `started_at`, deletes
earlier attempts' log chunks and resets the attempt log counters and `log_complete` (never `log_sequence`),
inserts the attempt's upload grant, and bumps the check outbox. The upload
token is generated before the transaction; only its digest is stored.

After the claim commits, the worker mints the attempt's Contents-read
installation token. A GitHub 403 or 404 there means the installation no
longer reaches the repository and ends the build `failed` with
`repository-unavailable`; any other failure is an infrastructure failure.
Every later write of the attempt is conditional on the build ID, its lease
token and `running`. The worker renews the lease every thirty seconds.
Renewal extends only a live lease: its stored `lease_expires_at` must be later
than the renewal time, read after its build lock on the same clock that claims
use. Its new expiry is two minutes after that reading. Equality
means expired. An expired lease never becomes live again. A lease becomes
live only through an attempt start under the workspace lock and capacity
check, so the workspace's limit of two holds.

When renewal updates nothing, the worker drops the stream, destroys the
sandbox and writes nothing more. It treats an expired lease as lost; lease
recovery ends that attempt.
As each step starts it records `step` and bumps the outbox.
Log chunks are fenced separately by `attempt_operation_id`, so a reclaimed
worker's late output is discarded and a publishing attempt's last lines still
land. Finalization records the outcome and sets `log_complete`:

| Runner outcome                        | Result                                        |
| ------------------------------------- | --------------------------------------------- |
| Any outcome with `publication_id` set | `published`                                   |
| Completed without a publication       | Infrastructure failure                        |
| Step failed at checkout               | Infrastructure failure                        |
| Step failed at install                | `failed`, `exit`, with the exit code          |
| Step failed at publish                | By the grant's recorded upload outcome, below |
| Unsupported lockfile                  | `failed`, `unsupported-lockfile`              |
| Unsupported Mokly version             | `failed`, `unsupported-mokly-version`         |
| Output overflow                       | `failed`, `output-limit`                      |
| Deadline or idle budget exceeded      | `timed-out`, `deadline` or `idle`             |
| Infrastructure                        | Infrastructure failure                        |

The runner outcomes are the [runner's](./cloud-build-runner.md#request-and-outcomes).
A failed publish step whose grant recorded a rejected upload ends `failed`
with `upload-rejected`; one whose grant recorded a plan refusal ends `failed`
with `plan-required`; one whose grant recorded an unavailable upload is an
infrastructure failure. When the grant recorded no outcome, the worker applies
the runner's [typed CLI-code mapping](./cloud-build-runner.md#cli-failure-codes).
Consumer and plan failures keep the CLI exit code when available.
Infrastructure outcomes retain no exit code. An infrastructure failure
returns the build to `queued` with
`next_attempt_at` 60, 120, 240 and 480 seconds ahead after attempts one to
four, clearing the lease; after the fifth attempt the build ends `failed`
with `infrastructure`. Every transition bumps the check outbox.

Finalization, including infrastructure requeue, follows the
[build and publication lock order](./persistence-boundaries.md#build-and-publication-lock-order).
