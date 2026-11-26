# CLI Recordings

The root files were captured in this checkout with the pinned tools, without
cloud credentials, on 2026-09-16. They are real output, not invented provider
responses. Command stdout/stderr are kept separate from exit status:

| Files                     | Command                                                                                                                          | Observed result                                           |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `terraform-version.json`  | `terraform version -json`                                                                                                        | Exit 0; Terraform 1.16.2 on linux_amd64                   |
| `gcloud-version.json`     | `gcloud version --format=json`                                                                                                   | Exit 0; SDK 585.0.0                                       |
| `gcloud-no-credentials.*` | `CLOUDSDK_CONFIG=<empty directory> gcloud secrets describe mkc-main-preview-postmark-token --project=mokly-508518 --format=json` | Exit 1; empty stdout, active-account diagnostic on stderr |

## Preview Platform Fixtures

The `preview-platform/` set was added on 2026-09-22. The two
`helm-*-cluster-resources.yaml` files are the cluster-scoped documents from
real `helm template` renders of cert-manager v1.21.2 and ingress-nginx 4.15.1,
normalized to the fields consumed by the inventory parser. The separate
network-optional test pulls those exact charts into `.context/`, renders their
complete output offline with the checked-in values and compares the full
cluster-scoped name inventory with these fixtures.

| Files                                                                                                             | Purpose                                                                                                   |
| ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `helm-cert-manager-cluster-resources.yaml`, `helm-ingress-nginx-cluster-resources.yaml`, `helm-template.exit.txt` | Pinned render inventory and successful Helm status                                                        |
| `kubectl-namespace.json`, `kubectl-ingress-class.json`, `kubectl-dns-token-secret.json`                           | Namespace label, class-controller and nonempty DNS token Secret checks                                    |
| `kubectl-origin-tls-secret.json`                                                                                  | TLS Secret with `tls-cert.pem` and `tls-key.pem` for the expiry, exact wildcard host and key match checks |
| `kubectl-cluster-issuer-ready.json`, `kubectl-service-{pending,ready,wrong-address}.json`                         | Issuer and load-balancer readiness transitions                                                            |
| `kubectl-rollout-ready.{stdout,exit}.txt`, `kubectl-auth-{allowed,denied}.exit.txt`                               | Rollout output and quiet authorization statuses                                                           |
| `gcloud-get-credentials.{stderr,exit}.txt`, `gcloud-secret-access.{stdout,stderr,exit}.txt`                       | Pinned gcloud stream placement and status                                                                 |
| `tls-{key,cert,wrong-sans-cert,mismatched-key,expired-cert}.pem`, `catalogue-dns-token.txt`                       | Synthetic secret material for certificate, file-permission and non-disclosure control flow                |

The `kubectl-*.json` files retain Kubernetes' `-o json` object shape, exact
platform identifiers, Ready condition shape and load-balancer `ipMode` field.
Pending, ready and wrong-address Service states drive control flow; they are
not evidence from the real Mokly cluster. `kubectl-rollout-ready.stdout.txt`
retains the real rollout-status line shape. The command double uses
`kubectl auth can-i --quiet`, whose allowed and denied cases have empty output
and statuses 0 and 1 respectively.

`gcloud-get-credentials.stderr.txt` models the pinned CLI's two success
diagnostics. Secret access uses `--out-file`, whose successful stdout/stderr
fixtures are empty; the double copies the synthetic TLS/token material instead
of placing a value in command arguments. `tls-*.pem` files are locally
generated test certificates/keys, including wrong-SAN, mismatched-key and
expired cases. They are not credentials. `kubectl-origin-tls-secret.json` holds
the base64 of `tls-cert.pem` and `tls-key.pem`. Update it when either file
changes. `tls-cert.pem` expires on 2036-09-19, so the success cases pass the
24-hour expiry rule only until 2036-09-18. Every double preserves command exit
status and warning stream placement.

The foundation credential-failure regression replays the captured failure
exactly and verifies it is propagated, never interpreted as resource absence
or a successful reconciliation. The production scripts check subprocess status
and do not scrape warning text or creation summaries for identifiers.
Origin-certificate ID history uses the documented Secret Manager/Cloudflare
JSON APIs, outside Terraform state.

## Catalogue Capture Fixtures

The `catalogue-capture/` streams and exit files come from the real installed
`@mokly/mokly@0.18.0` CLI. Re-record them from the repository root:

```sh
python3 infra/scripts/record-catalogue-capture.py
python3 infra/scripts/record-catalogue-capture.py --check
```

The script copies the source-only
[`publication-smoke-v0.19`](../../../scripts/cloud/fixtures/publication-smoke-v0.19/README.md)
into an isolated Git checkout. It strictly validates and commits both revisions.
It sets `origin/main` to the first revision. Every publish uses `--strict`,
`--config mokly.config.json`, `--repository github.com/mokly-ai/mokly-cloud`,
`--base origin/main` and a loopback endpoint with a placeholder bearer.
The temporary root owns CLI build and cache directories. It removes kept failed
builds with the rest of the isolated checkout.

The real receiver accepts envelope 3, marker 3 and index 9. Success completes
Plan, Blob and Complete and reports 18 uploaded files. The `invalid-bundle`
and `too-large` cases send one authenticated Plan to receivers that return
400 and 413. `--unknown-option` produces `failure`. An untracked `untracked.txt`
produces `git-uncommitted`. Those two pre-build refusals send no request.
No stale-output case exists in the released CLI.

All recordings keep their exact stdout, stderr and exit status. No diagnostic
is normalized or invented. Empty streams remain empty files. The raw stdout
includes the private build path and cache address. The timing sample keeps the
real session, process ID and elapsed value. Check mode reads the two private paths and the timing session, process ID and
elapsed value separately. It checks their shape and compares every other byte
exactly. It never rewrites the recorded streams. Refusal streams and exit files
always compare byte for byte.

`mokly-double.py` validates the strict publish arguments and replays the five
recorded outcomes exactly. Success sends the synthetic export through the real
capture receiver. Explicit adversarial modes corrupt, repeat or omit requests.
Those modes test receiver refusals and do not model a normal publish.
`catalogue_capture_support.py` builds envelope-3/index-9 Plans for those tests.
The publication smoke also compares its real dirty-checkout refusal with the
recording. Exit and stdout must match. Stderr can add only leading npm notices
or warnings.

Run `python3 -m unittest discover -s infra/tests -p 'test_catalogue_capture*.py'`
to check the streams, version gates and complete receiver exchange.

Successful cloud lookup/import recordings are unavailable without credentials.
During the operator proof, record the exact pinned `gcloud ... --format=json`
and `terraform import` stdout/stderr/status in a secured location. Redact secret
values only; preserve resource name structure, warning placement and exit
behavior before adding any reconciliation test double. Existing manual
credentials must be imported before apply as documented in the runbooks.
Terraform mock-provider tests are explicitly configuration tests, not captured
cloud reconciliation responses.

The rollout and preview-platform shell tests use explicitly synthetic command
doubles to exercise command ordering and exit status. Platform Helm inventory
comes from the real local render described above; Kubernetes readiness and
successful provider operations remain control-flow fixtures, not cloud
reconciliation recordings, and must never be reused as evidence of provider
resource existence or successful provisioning.

## Preview Lifecycle Fixtures

`kubectl-pods.json` reproduces the shape `kubectl get pods --selector ... -o json`
returned on `mkc-autopilot` on 2026-09-23: a selector listing is a `v1` `List`
of `Pod` items rather than a `PodList`; the reader accepts both.

The `preview-lifecycle/` set was added on 2026-09-22. Cloud credentials are not
available in this checkout, so provider-success fixtures are recorded response
shapes, not claims that Mokly resources exist. Cloudflare list/create/update/
delete and `success: false` envelopes retain the current v4 API fields,
pagination and canonical 32-character IDs. GCS IAM files retain policy version
3, etag, unrelated bindings and the pinned CLI's HTTP 412 conflict diagnostic.
The project-number, Helm and kubectl files keep stdout/stderr/status separation
and the identifier/warning layouts consumed by the scripts.

`gcloud-storage-list.json` is Google Cloud CLI 585.0.0's actual `--json`
answer, recorded from the live preview bucket on 2026-09-23: one JSON array of
resources (`url` with the `#generation` fragment, `type: cloud_object`, the
full object `metadata`) holding two objects under the exact prefix. Cleanup
reads the array's elements; the earlier fixture recorded a document stream the
CLI never emits, which made the live destroy leave every object behind. The no-object stderr is the CLI's
`InvalidUrlError` rendering. `gcloud-storage-rm.*` and
`gcloud-storage-rm-missing.*` are the live CLI's (SDK 570.0.0, 2026-09-23)
answers to `rm --read-paths-from-stdin`: stdout stays empty, progress
(`Removing objects:`, a whitespace-only line stored here as an empty line so
the repository's whitespace check accepts the file, `Removing gs://...`,
dots) is stderr, and a batch holding
one vanished URL exits 1 having removed nothing, listing only the missing URLs
after the progress lines. Tests preserve those
streams and exit statuses, retry one etag conflict, reject authorization/API
errors as absence and require a final empty listing. Failed list/removal calls
count as absence only when the entire diagnostic matches the pinned CLI's
no-object message; any additional error remains a failure.

`gcloud-verifier-no-versions.stderr.txt` keeps the public
`gcloud secrets versions access latest` diagnostic for a secret with no
version. The fixture substitutes a test project number and the verifier ID.
The companion exit fixture uses status 1. The Actions variant adds the
credential-file suffix from `CredentialInfo.GetInfoString` in Cloud CLI
585.0.0 with a synthetic account and path. The doubles replay stderr and
exit status without a live Secret Manager call.
[Public CLI output](https://stackoverflow.com/questions/75116369/google-cloud-secret-is-there-or-not)
[Cloud CLI 585.0.0 archive](https://dl.google.com/dl/cloudsdk/channels/rapid/downloads/google-cloud-cli-585.0.0-linux-x86_64.tar.gz)

`api-log-invitation.txt` holds two lines recorded from the live preview API
on 2026-09-23 (token and return address redacted, host renamed to the fixture
preview): the invitation email to an address, linking to the old `/sign-in` path, and
the sign-in email to the same address four seconds later. The reader must skip
the first and answer with the second. The test also checks the current
`/workspaces/:id/invitations/:id/accept` link shape without rewriting the
historical recording. `api-log-current.txt` contains the JSON line emitted on 2026-09-22 by the real
`mkc_email_postmark::delivery::LogMailer` event under the API's exact
`tracing_subscriber::fmt().json().with_env_filter("info")` configuration. The
fixture adds only the leading RFC3339 timestamp that Kubernetes returns for
`logs?timestamps=true`. The previous/malformed files keep the same field layout
for cross-pod ordering, exact-recipient and validation tests. Tokens, addresses,
resource IDs and Secret bytes in this directory are deterministic test values,
not credentials or live resource evidence.

## Foundation Wait Fixtures

The `foundation-gate/` files were recorded on 2026-10-21 with GitHub CLI
2.100.0 against real runs of the old cloud repository:
`gh run list --repo mokly-ai/mokly-cloud --workflow <file> --commit <SHA> --json
attempt,conclusion,createdAt,databaseId,event,headBranch,headSha,number,status,url`,
with `--branch main` for the `main` runs. The Foundation workflow had no runs
yet, so the records come from other workflows:

| File                             | Recorded run                                                |
| -------------------------------- | ----------------------------------------------------------- |
| `gh-run-list-success.json`       | CI push on `main`, `completed`/`success`                    |
| `gh-run-list-failure.json`       | Deploy push on `main`, `completed`/`failure`                |
| `gh-run-list-cancelled.json`     | Site pull request run, `completed`/`cancelled`              |
| `gh-run-list-in-progress.json`   | CI pull request run, `in_progress` with an empty conclusion |
| `gh-run-list-later-attempt.json` | CI pull request run on attempt 2, `completed`/`success`     |
| `gh-run-list-empty.json`         | A commit without runs                                       |
| `gh-run-list-missing-workflow.*` | `--workflow foundation.yml` before that file existed        |

Each file keeps gh's single-line JSON and adds only a final newline for the
repository's whitespace check. The wait tests set each record's commit to the
test commit and set run numbers and attempts explicitly, so the code shows
every change from the recording. The missing-workflow streams keep gh's empty stdout,
its HTTP 404 diagnostic on stderr and exit status 1.

## Terraform Wrapper Fixtures

The `terraform-wrapper/` files were recorded on 2026-10-21 with Terraform
1.16.2 from a local root that holds one `terraform_data.retired` resource:
`plan -no-color -detailed-exitcode -out=release.tfplan` stdout and
`show -json release.tfplan` for a create (exit 2), a no-change plan (exit 0)
and a delete (exit 2). The wrapper tests replay them through a recording
`terraform` double and change only the resource address and actions in code.
