# Preview Seed

This sub-contract of [PR preview environments](./pr-preview-environments.md)
gives every labelled PR a shared account and a sample project holding the PR's
own mockups and comparison against `main`. One link signs in the shared
account, and only the comment of a private repository carries it. Stable
environments never run the seed. `D`, `C` and `N` follow the parent contract.

## Account And Sign-In Link

| Item      | Value                                                                                    |
| --------- | ---------------------------------------------------------------------------------------- |
| Account   | `preview@mokly.ai`, configured by `MKC_PREVIEW_SIGN_IN_EMAIL`                            |
| Plan      | `team`, configured by `MKC_PREVIEW_SIGN_IN_PLAN`; new preview-account workspaces only    |
| Secret    | Namespace Secret `preview-sign-in`, key `preview-sign-in`: 32 random bytes as 64 hex     |
| API mount | Read-only `/var/run/mokly-secrets/preview-sign-in`; sets `MKC_PREVIEW_SIGN_IN_SECRET`    |
| Link      | `https://pr-N.preview.D/auth/preview/callback#secret=<secret>`                           |
| Exchange  | `POST /v1/auth/preview`, defined in [Authentication](./auth-sessions.md#preview-sign-in) |

The secret uses lowercase hex digits with no newline. `preview-deploy.sh`
creates the Secret only when absent and validates its format on every deploy;
a push never replaces it, so one link works for the namespace's life. Unlike the
database and signing Secrets, it may be created beside a retained PVC: a new
value only retires earlier links. Namespace deletion removes the Secret
together with every session.

In a private repository, anyone who can read the PR, including copies of its
comment in email notifications or chat, can sign in to that preview as the
shared account until its namespace is deleted. This exposure is accepted,
because only people with access can read a private repository, and a preview
holds only seed data, test data and reviewers' own uploads. The link is the
only credential the PR comment may carry. A public repository gets no link in
the comment, because anyone can read it. There, the shared account signs in
like every other address, with an email link that the
[log reader](./preview-scripts.md#sign-in-log-reader) reads.

## Catalogue Capture

[Preview capture](./preview-capture.md) defines the clean committed checkout,
the strict publish, the captured exchange, the comparison base and the
failure recovery. Capture is an unprivileged loopback exchange. The release
job copies its bytes unopened to the run's seed folder, and the seed command
replays them. A capture that fails or yields no comparison stops only the
catalogue path: the seed still records sign-in status and fails at the
missing catalogue. A PR that changes capture configuration or upload formats
previews itself with its own tools, as
[format changes](./preview-capture.md#format-changes) defines.

## Contract With Main

The seed runs from the PR's own API binary, not as an HTTP client in `main`'s
release job, because such a client breaks whenever a PR changes a path that
it calls. PR code never runs in the release job, because that job can mint
the deploy identity.

The `preview-seed` command with its `--run` argument, the `seed/<run>/`
objects with their schemas, and the fixed **Sample project** route are the
contract between `main`'s release job and the PR's API image. A PR that
changes one of them breaks its own seed until it merges, so a change to the
contract gets its own PR.

## Seed Command

`mkc-api preview-seed --run <run>` seeds one run and exits. The run key
matches `[a-z0-9][a-z0-9-]{0,49}`, so the Job name `preview-seed-<run>` fits
in 63 characters. The release job uses `<run id>-<run attempt>` of its
workflow run, and the local stack uses `local`. The command loads the same
settings as `serve`. Without the preview sign-in capability and settings of
[Authentication](./auth-sessions.md#preview-sign-in), it fails with a typed
configuration error before any write, so production never seeds. `serve`
never seeds, so an API restart does not seed again.

The objects of one run live in the folder `seed/<run>/` under the API's
object prefix: `pr-N/seed/<run>/` in the preview bucket, and the same folder
under `MKC_FILE_STORE_ROOT` locally. The folder sits beside the content
store's `sha256/` names, and
[blob listing](./persistence-publication-storage.md#object-prefixes) ignores it. The
seed never lists the folder.

| Object                                              | Writer      | Content                                                          |
| --------------------------------------------------- | ----------- | ---------------------------------------------------------------- |
| `request.json`                                      | Release job | `schemaVersion` 1, `environment`, `revision`, `pullRequest`      |
| `catalogue/plan.tar.gz`, `catalogue/blobs/<sha256>` | Release job | The captured exchange, byte for byte; absent when capture failed |
| `seed-status.json`, `seed-proof.json`               | Seed        | The [status and proof](#status-and-proof)                        |

In `request.json`, `environment` is `preview-pr-N` with `pullRequest` `N`, or
`local` with `pullRequest` null. `revision` is the tested head as 40
lowercase hex digits. The status and the proof carry the request's
environment and revision, and the proof carries its pull request.

## Seed Steps

The seed identities are workspace `Mokly` with slug `mokly-ai`, and project
`Mokly Cloud` with slug `mokly`, repository `mokly-ai/mokly` and config path
`mokly.config.json`. The repository is the one that runs the preview, because
[capture](./preview-capture.md#catalogue-capture) uploads for that repository.
The sample project has no repository link and publishes through its project
token. The seed log names each step, and a failure names the failed step and
its reason:

1. Read `request.json`. Require a valid environment, a pull request number
   that matches it, and a 40-digit revision. When the request is missing or
   invalid, log the reason and write no status, because the status takes its
   environment and revision from the request.
2. Write the status with `signIn` `refused` and `project` `failed`.
3. Require the request's revision to equal the image's build revision, which
   `/v1/health` reports. A development build reports `development` and skips
   only this comparison.
4. Find or create the configured account. Issue no session.
5. As that account, find or create the seed workspace. Require plan `team`.
6. Find or create the seed project in it. Require its identity values and
   visibility `private`.
7. Before any upload, require the head SHA in the captured plan's envelope
   to equal the request's revision. The seed reads upload envelope 3 only, so
   a plan with another envelope version fails this step.
8. Create a project token named `Preview seed`.
9. Replay the captured [upload exchange](./publication-upload-exchange.md)
   with that token, under the same rules as an HTTP upload: the plan, each
   blob that the plan names as missing, then the completion. An expired or
   superseded attempt starts one fresh attempt, as the CLI does.
10. Require a `ready` publication with the request's revision as its head SHA,
    the request's pull request, and a viewer URL that starts with the app
    origin.
11. Once the token exists, always revoke it, also after a failure.
12. Write the status again. Write the proof only after steps 10 and 11
    succeed. Exit 0 only when the project is seeded.

A mismatched existing workspace or project fails with the field, the expected
value and the received value before a token exists. A missing catalogue logs
`catalogue missing`. The seed retries a failed bucket request for up to two
minutes, because the deploy grants the API's bucket access shortly before.
Diagnostics name steps, reasons, slugs, IDs and hashes only. The secret, the
publishing token, and the plan and blob bytes never reach logs, evidence or
artifacts.

The preview sign-in plan setting accepts `free` or `team` and defaults to
`free`. It requires the secret, email and preview sign-in capability as defined
in [Authentication](./auth-sessions.md#preview-sign-in). PR previews set it to
`team`. The API assigns Team only when the creator's normalized email, read in
the creation transaction, matches the configured account. All other new
workspaces start on Free. Existing workspaces keep their plan. Team
makes new projects private by default and permits private uploads. It creates
no subscription, leaves seat counting unchanged, and leaves the unconfigured
Billing pane at “Billing opens soon”.

## Seed Job

[Preview seed Job](./preview-seed-job.md) defines the suspended Job template,
the release script that runs and collects each seed Job, and its failure
messages.

## Status And Proof

After step 2, the seed always attempts its final write of `seed-status.json`,
also after an unexpected failure:

```json
{
  "schemaVersion": 1,
  "environment": "preview-pr-N",
  "revision": "<40-lowercase-sha>",
  "signIn": "accepted",
  "project": "failed",
  "checkedAt": "<UTC-RFC3339>"
}
```

`signIn` is `accepted` when the account step succeeded with preview sign-in
configured, and `refused` otherwise. No deploy check exchanges the secret.
`project` is `seeded` only after the publication checks, the token revocation
and the proof write all succeed; otherwise it is `failed`. The seed reads the
catalogue after the account step, so a failed capture can still produce
`accepted`.

Only after the publication checks and the token revocation succeed, the seed
atomically writes this exact proof from the validated publication:

```json
{
  "schemaVersion": 1,
  "environment": "preview-pr-N",
  "revision": "<publication-headSha>",
  "workspaceSlug": "mokly-ai",
  "projectSlug": "mokly",
  "projectId": "<project-uuid>",
  "publicationId": "<publication-uuid>",
  "publicationState": "ready",
  "pullRequest": 123,
  "viewerUrl": "<publication-viewerUrl>",
  "uploadStatus": 201,
  "checkedAt": "<UTC-RFC3339>"
}
```

`uploadStatus` is 201 for a new publication and 200 for a replay. The same
head replays the same publication, so a rerun is safe.

## Workflow, Comment And Failures

The release job needs `capture` but deploys when capture fails; it downloads
`seed-catalogue` into `.context/seed/catalogue` only after capture succeeds.
[Script interfaces](./preview-scripts.md#workflow-and-comment) define the
secret-file handling, the comment command and the required aggregate. Seed
failure never invokes Helm rollback.

| Workflow outcome                      | `--state`        | Exact status                               | **Open preview**        | **Sample project** |
| ------------------------------------- | ---------------- | ------------------------------------------ | ----------------------- | ------------------ |
| Deploy is running                     | `running`        | `Checks running`                           | No                      | No                 |
| Deploy or smoke failed                | `failed`         | `Checks failed. Open the run for details.` | No                      | No                 |
| Deploy passed; capture or seed failed | `failed`         | `Checks failed. Open the run for details.` | If sign-in was accepted | No                 |
| Deploy, capture and seed passed       | `success`        | `Checks passed`                            | Yes                     | Yes                |
| Cleanup passed                        | `removed`        | `Preview removed`                          | No                      | No                 |
| Cleanup failed                        | `cleanup-failed` | `Cleanup failed. Rerun the workflow.`      | No                      | No                 |

The Open preview cells also require the event's validated
`repository.private` to be true; a public repository gets no credential link.
Sample project is
`https://pr-N.preview.D/mokly-ai/mokly/pull-requests/N`. The proof is only
its presence flag; no proof value forms either link. Status selects the exact
message independently of the link inputs.

## Reset

A rerun or a push runs a new seed Job. The seed finds or creates, so it
restores deleted sample data but does not undo a change: a changed seed value,
such as a slug or the plan, fails with a mismatch on an existing preview until
a reset. To reset, remove the `preview` label, wait for cleanup, and add the
label again. Cleanup deletes the namespace, the database, the sign-in Secret
and the bucket prefix, so the new preview seeds an empty database. Each label
cycle issues a new catalogue certificate. Let's Encrypt allows five for one PR
in seven days, so keep the label cycle for rare resets.

## Local Stack

[Local preview seed](./preview-seed-local.md) defines the local account, the
local seed command, its proof and the viewer limits.
