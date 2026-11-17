# Preview Script Interfaces

These scripts implement [PR previews](./pr-preview-environments.md).
`capture-catalogue.py` runs from the PR checkout in the unprivileged capture
job. All other scripts run from trusted `main`.
Run commands from the repository root. Diagnostics go to stderr. Reject
malformed arguments and inconsistent configuration before any provider call.
Never evaluate PR titles, branch names, labels or provider output as shell code.

## Commands And Inputs

| Command                                                              | Arguments / result                                |
| -------------------------------------------------------------------- | ------------------------------------------------- |
| `bash infra/scripts/preview-platform.sh`                             | No arguments; installs shared platform            |
| `bash infra/scripts/preview-platform-ready.sh`                       | No arguments; read-only readiness gate            |
| `bash infra/scripts/preview-deploy.sh preview-pr-N`                  | Exactly one environment; deploys and smokes       |
| `bash infra/scripts/preview-destroy.sh preview-pr-N`                 | Exactly one environment; removes all PR resources |
| `python3 infra/scripts/preview-link.py preview-pr-N --email ADDRESS` | Prints newest matching sign-in URL only           |
| `python3 infra/scripts/capture-catalogue.py preview-pr-N`            | Unprivileged; captures the PR's catalogue upload  |
| `python3 infra/scripts/preview-seed-job.py preview-pr-N`             | Runs the seed Job and collects its result         |

`preview-link.py` also accepts `--since-time RFC3339` (default now minus 15
minutes) and `--timeout-seconds INTEGER` (1–120, default 30). All other
switches fail. The log reader requires `MKC_DOMAIN` for exact app host
validation, but no Google/Cloudflare credential or other deployment input.
All environment arguments require the complete `preview-pr-[1-9][0-9]{0,8}`
grammar; `production`, `main-preview` and arbitrary namespaces are invalid.
[Preview seed Job](./preview-seed-job.md) defines the seed script's
arguments, inputs and outputs, and [Preview capture](./preview-capture.md)
defines those of capture. Capture's `--local` mode, which replaces the
environment argument for a local stack, is in
[Local preview seed](./preview-seed-local.md).

An environment argument that is syntactically accepted but misses that grammar
makes each entry point write no stdout, emit exactly one stderr line and exit
1; it never exposes a traceback:

| Entry point            | Exact stderr                                                    |
| ---------------------- | --------------------------------------------------------------- |
| `capture-catalogue.py` | `Catalogue capture failed: environment must match preview-pr-N` |
| `preview-comment.py`   | `Preview comment: environment must match preview-pr-N`          |
| `preview-lifecycle.py` | `Preview lifecycle failed: environment must match preview-pr-N` |
| `preview-seed-job.py`  | `Preview seed failed: environment must match preview-pr-N`      |

Argparse syntax errors retain argparse's exit 2.

Common deployment inputs are `MKC_REGION`, `MKC_DOMAIN`,
`MKC_CATALOGUE_BASE_DOMAIN`, `MKC_CATALOGUE_CLOUDFLARE_ZONE_ID`,
`MKC_PREVIEW_INGRESS_IP` and `MKC_PREVIEW_BLOBS_BUCKET`. See
[platform inputs](./preview-platform.md) for exact validation and fixed project.
Deploy additionally requires `MKC_REVISION`, `MKC_API_IMAGE`,
`MKC_CATALOGUE_IMAGE`, `MKC_APP_IMAGE`. Destruction needs no image/revision,
Postmark, GitHub App, stable ingress map, notification-channel or Terraform
state input. `preview-seed-job.py` requires the common inputs and
`MKC_REVISION`. Its `--validate-evidence` mode requires only `MKC_REVISION`
and `MKC_DOMAIN`.
`MKC_INGRESS_IPS` / `MKC_INGRESS_IP` are stable-environment inputs only.

`build-release.sh ENVIRONMENT...` builds the API, catalogue and per-environment
app archives. `push-images.sh ENVIRONMENT...` pushes those three workload
images and writes `.context/api-image-ref.txt`,
`.context/catalogue-image-ref.txt` and `.context/app-ENVIRONMENT-image-ref.txt`.
PR and stable releases use the same three images.

`python3 infra/scripts/render-values.py preview-pr-N` writes nonsecret JSON
to stdout; deploy saves it at `.context/release-values.json`. Its
`--domain-layout ENVIRONMENT DOMAIN` and `--origins VALUES ENVIRONMENT REVISION`
interfaces have a fixed output order. PR storage, hosts and mode come from the
parent contract; stable rendering is unchanged by PR support. Invalid/mismatched
assertions fail instead of copying secrets or silently choosing another origin.

## Deploy And Redeploy

1. Authenticate/select the fixed GKE cluster; verify platform readiness.
2. Ensure `mkc-preview-pr-N` exists. Create `postgres-credentials`,
   `catalogue-signing-key` and `preview-sign-in` only when absent. Validate
   existing keys/format and the URL/password match; never overwrite them on a
   push. A create conflict re-reads and validates the winner. If
   `PVC/data-postgres-0` exists while either of the first two Secrets is
   absent, fail with a diagnostic to restore that original Secret or delete the
   namespace; never generate replacement database or catalogue signing
   material beside retained data. `preview-sign-in` protects no data, so it
   may be created beside a retained PVC; a new value only retires older links.
3. Read the catalogue DNS token from `mkc-catalogue-dns-token` into private
   storage and send it only in the Cloudflare authorization header. Create or
   update the exact A record `*.pr-N.preview.C` with `content` equal to the
   shared IPv4, `proxied: false`, `ttl: 300` and comment
   `mokly-preview:preview-pr-N`. Adopt only a record already bearing this
   marker; fail on duplicates or an unowned exact name. Record IDs come from
   the provider's response, never from a name.
4. Upsert the two exact principal/role/condition tuples in the bucket's IAM
   policy. Preserve unrelated bindings; retry a concurrent-change conflict at
   most five times with bounded backoff, then fail.
5. Render values, then install or upgrade release `mokly-cloud` in
   `mkc-preview-pr-N` from the chart's PR overlay and the rendered values,
   waiting at most 15 minutes.
6. Wait at most 900s for `Certificate/catalogue-tls` Ready; never disable TLS
   validation or fall back to the Origin CA default on catalogue hosts.
7. Run `python3 infra/scripts/smoke.py` with the derived app/API/catalogue
   origins and intended revision. First-install budget is 900s; upgrades 60s.

Save the prior deployed Helm revision before changing it. On Helm, certificate
or smoke failure, restore that revision with `helm rollback --wait --timeout
15m` when one exists; report rollback failure separately and keep the original
failure status. Do not roll back the database or rotate Secrets. First-install
failures leave resources for diagnosis and later cleanup. No partial result
counts as deployment success. Normal upgrades preserve PVC, credentials, signing key and certificate.

## Destroy And Retry

Cleanup is independent of build success and does not require platform readiness.
Serialise deploy/destroy under concurrency group `preview-pr-N` with
`cancel-in-progress: false`. Uninstall `mokly-cloud`, then delete the namespace
and wait up to 900s for disappearance. This removes Pods, the PVC, generated
Secrets and the Certificate; allow cert-manager finalizers to finish. Never
force-remove certificate/PVC finalizers to hide an error.

After namespace disappearance, remove the two exact conditional IAM bindings,
delete every live object whose name starts with `pr-N/` (trailing slash required),
and delete only the marked exact catalogue A record. Paginate object listings
and DNS queries, preserve IAM etags and unrelated policy members, and use the
provider's canonical DNS record ID. Verify the final prefix listing is empty.
Cloudflare challenges belong to cert-manager, not this A-record cleanup.

Missing Helm release, namespace, binding, prefix objects or marked DNS record
is success for that step. Authentication/authorization, transport, malformed
response, provider API error or timeout is a failure, not evidence of absence.
If uninstall fails, still attempt normal namespace deletion. If namespace
deletion fails, stop before external cleanup to avoid leaving live workloads
without their data. Once the namespace is gone, attempt all external cleanup
steps, accumulate errors and return nonzero if any failed. Retry runs the same
command; partial progress is safe. Cleanup never removes shared infrastructure,
other PR prefixes or stable resources. Soft-deleted bytes expire after seven
days; no per-PR cloud reconciliation follows successful cleanup.

Object cleanup lists every live object under `pr-N/` through the pinned CLI,
validates every entry's bucket, name and URL against that prefix, removes the
listed objects in batches and repeats the listing as the final empty check.
An object that vanished between the listing and its batch is dropped from the
batch, which is then retried. Only the CLI's exact no-object results are
absence; permission, authentication and transport failures remain errors.
Objects are removed in batches rather than one per CLI call because a preview
can hold several hundred blobs and per-object calls exceed a bounded command
timeout.

## Sign-In Log Reader

The shared preview account uses the comment's sign-in link; this reader serves
every other address. The reviewer first requests a link in `/sign-in` or
`/sign-up`.
`preview-link.py` normalizes the full email as the API does and matches exact
addresses, never substrings. Select API pods by `app.kubernetes.io/name=api`
and read container `api` with timestamps since the requested time. Parse only
JSON tracing target `mkc_dev_mail`, message `development email`, and
`fields.recipient` / `fields.link`, covered by recorded fixtures; accept its
sign-in callback URL, not arbitrary URLs in application diagnostics. Across
pods/restarts choose the newest timestamp, with source order as tie-breaker.
The mailer logs every product email the same way, so an event for the address
whose link is not on `/auth/email/callback` is another email (an
invitation links to `/workspaces/:uuid/invitations/:uuid/accept`) and is skipped, never a
failure: a member who is invited and then signs in has both events in the
window. A callback-path link must use HTTPS, the exact derived app host, no
other port or userinfo, and carry its fragment; preserve the full fragment.
No matching event polls every 2s up to the deadline
then exits 1 with a request-a-new-link diagnostic. Do not print other addresses
or logs. Provider/malformed matching-event errors fail explicitly. Pod order is
the Kubernetes `PodList` order. For each pod, the previous log is read before
the current log; when two valid events have the same timestamp, the later
source/line in that order wins. After the final unsuccessful poll, stderr is
exactly `No matching sign-in link found; request a new link and try again.` and
stdout stays empty.

The reader uses the operator's `kubectl` credentials to list the namespace's
API pods and to read each pod's current and available previous container logs
since the requested time, with a ten-second deadline per request.
Only an absent previous log is ignored; 403 and API failures remain failures.
A printed link is a credential; consumers capture stdout privately, never put
it in workflow logs/comments/artifacts.

## Workflow And Comment

`preview.yml` accepts `pull_request_target` events `labeled`, `unlabeled`,
`synchronize`, `reopened`, `closed`, and same-repository-only policy. Deploy
requires an open PR with `preview`; close or removal of that label selects
destroy even after a failed build. Forks and unrelated label events explicitly
skip. `preview-event.py` validates the event's Boolean `repository.private`
and exposes it as `repository_private=true|false` beside the action,
environment and revision. The unprivileged build and capture jobs get only
`contents: read`, no environment, secrets or OIDC. They persist no checkout
credentials and never restore or save an Actions cache. Privileged release runs
trusted-main scripts and handles only image archives and the captured catalogue
plan archive and blobs, which it copies unopened to the PR's bucket prefix. PR
code runs in the unprivileged build and capture jobs and as the PR namespace's
workloads, including the seed Job.

Grant `pull-requests: write` only to the trusted comment step's job alongside
its existing scoped permissions. Upsert a bot-authored comment with marker
`<!-- mokly-preview -->` (distinct from `<!-- mokly-site -->`). Paginate
comments, never edit a human comment, and include the current tested SHA,
`https://pr-N.preview.D/sign-in`, `https://pr-N.preview.api.D`, the catalogue
pattern `https://p-<publication-id>.pr-N.preview.C` and the workflow evidence
URL. The base catalogue suffix is not a working publication link. The exact
outcome/link matrix is in [Preview seed](./preview-seed.md); status never
implicitly enables a link. Never include mail links, tokens or raw API logs;
the private-repository-gated preview sign-in link is the one credential the
comment may carry.

`preview-comment.py` requires `--state`, `--environment`, `--revision`,
`--domain`, `--catalogue-domain`, `--run-url` and
`--repository-private true|false`. After a completed deploy, release also
passes `--secret-file PATH` (mode 0600) and
`--seed-status .context/seed-status.json`; it passes
`--seed-proof .context/seed-proof.json` only when the nonempty proof exists.
The script parses status, uses proof only as a presence flag, validates the
matrix and derives both links from the other trusted inputs. It reads the
secret only when rendering Open preview. The trusted release job posts a
running comment before deployment and a final comment even after a failed
build, capture, seed or cleanup.

After smoke, release reads the generated `preview-sign-in` value only for the
comment's **Open preview** link; it never passes the value to the seed.
Release keeps the value only in a private mode-0600 runner-temporary file,
with the value masked in the workflow log. The private file is neither
retained nor placed under `.context/` and is removed after the final comment
is prepared.

**Require deploy evidence** checks only smoke and its report. The seed step
then runs `preview-seed-job.py` as [Preview seed Job](./preview-seed-job.md)
defines. This step is conditioned only on deploy evidence, not capture
success: an absent capture can therefore still record accepted sign-in before
seeding fails. **Require seed evidence** runs
`python3 infra/scripts/preview-seed-job.py preview-pr-N --validate-evidence`.
The unconditional `required` aggregate separately checks
prepare/build/capture/release policy, smoke evidence, the seed step, its
status and proof, and comment publication for deploy; complete cleanup/comment
for destroy; and only the explicit policy skip for ineligible events. A
missing, cancelled or failed required step fails.
Retain available `deployment-smoke.json`, `seed-status.json` and
`seed-proof.json` even on failure.
